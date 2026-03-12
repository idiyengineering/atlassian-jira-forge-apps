import Resolver from '@forge/resolver';
import api, { route } from '@forge/api';

const resolver = new Resolver();
const JSON_HEADERS = { Accept: 'application/json' };
const RETRYABLE_STATUSES = new Set([429, 503]);
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 250;
const MAX_CONCURRENCY = 5;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getRetryDelayMs = (response, attempt) => {
  const retryAfter = response?.headers?.get?.('retry-after');
  const retryAfterSeconds = Number.parseInt(retryAfter, 10);
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0) {
    return retryAfterSeconds * 1000;
  }

  return INITIAL_RETRY_DELAY_MS * (2 ** attempt);
};

const requestJiraAsApp = async (path) => {
  let lastResponse = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const response = await api.asApp().requestJira(path, { headers: JSON_HEADERS });
    lastResponse = response;

    if (response.ok || !RETRYABLE_STATUSES.has(response.status) || attempt === MAX_RETRIES) {
      return response;
    }

    const delayMs = getRetryDelayMs(response, attempt);
    console.warn(
      `[requestJiraAsApp] retrying status=${response.status} attempt=${attempt + 1} delayMs=${delayMs}`
    );
    await wait(delayMs);
  }

  return lastResponse;
};

const mapWithConcurrency = async (items, worker, maxConcurrency = MAX_CONCURRENCY) => {
  const results = new Array(items.length);
  let index = 0;

  const runNext = async () => {
    const currentIndex = index;
    if (currentIndex >= items.length) {
      return;
    }
    index += 1;
    results[currentIndex] = await worker(items[currentIndex], currentIndex);
    await runNext();
  };

  const workers = Array.from(
    { length: Math.min(maxConcurrency, items.length) },
    () => runNext()
  );
  await Promise.all(workers);
  return results;
};

const getResponseBodySafely = async (response) => {
  try {
    return await response.text();
  } catch {
    return '<unavailable>';
  }
};

const logFailedResponse = async (prefix, response) => {
  const responseText = await getResponseBodySafely(response);
  console.error(`${prefix} status=${response.status} body=${responseText}`);
};

const getUniqueSortedOptions = (values) => {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
};

const isOptionBasedField = (field) => {
  const type = field?.schema?.type?.toLowerCase?.() || '';
  const items = field?.schema?.items?.toLowerCase?.() || '';
  const custom = field?.schema?.custom?.toLowerCase?.() || '';

  return (
    type === 'option' ||
    items === 'option' ||
    custom.includes('select') ||
    custom.includes('checkbox') ||
    custom.includes('radio') ||
    custom.includes('cascading')
  );
};

const fetchFieldContexts = async (fieldId) => {
  const contextResponse = await requestJiraAsApp(
    route`/rest/api/3/field/${fieldId}/context?maxResults=50`
  );

  if (!contextResponse.ok) {
    if (contextResponse.status === 404) {
      // Some custom fields are not available in the contexts API; treat as expected.
      return [];
    }
    await logFailedResponse(
      `[getAllFields] context request failed for fieldId=${fieldId}`,
      contextResponse
    );
    return [];
  }

  const contextData = await contextResponse.json();
  return contextData?.values || [];
};

const fetchOptionsForContext = async (fieldId, contextId) => {
  const optionResponse = await requestJiraAsApp(
    route`/rest/api/3/field/${fieldId}/context/${contextId}/option?maxResults=100`
  );

  if (!optionResponse.ok) {
    await logFailedResponse(
      `[getAllFields] option request failed for fieldId=${fieldId} contextId=${contextId}`,
      optionResponse
    );
    return [];
  }

  const optionData = await optionResponse.json();
  const contextOptions = optionData?.values || [];
  return contextOptions.map((option) => option?.value).filter(Boolean);
};

const fetchOptionsFromContexts = async (fieldId, contexts) => {
  const contextIds = contexts.map((context) => context?.id).filter(Boolean);
  if (!contextIds.length) {
    return [];
  }

  const optionGroups = await mapWithConcurrency(
    contextIds,
    (contextId) => fetchOptionsForContext(fieldId, contextId)
  );

  return getUniqueSortedOptions(optionGroups.flat());
};

const fetchOptionsFromCreateMeta = async (fieldId, projectId) => {
  const createMetaResponse = await requestJiraAsApp(
    route`/rest/api/3/issue/createmeta?projectIds=${projectId}&expand=projects.issuetypes.fields`
  );

  if (!createMetaResponse.ok) {
    await logFailedResponse(
      `[getAllFields] createmeta fallback failed for fieldId=${fieldId} projectId=${projectId}`,
      createMetaResponse
    );
    return [];
  }

  const createMetaData = await createMetaResponse.json();
  const projects = createMetaData?.projects || [];
  const metaValues = [];

  for (const project of projects) {
    const issueTypes = project?.issuetypes || [];
    for (const issueType of issueTypes) {
      const fieldMeta = issueType?.fields?.[fieldId];
      const allowedValues = fieldMeta?.allowedValues || [];
      for (const item of allowedValues) {
        const value = item?.value || item?.name;
        if (value) {
          metaValues.push(value);
        }
      }
    }
  }

  return getUniqueSortedOptions(metaValues);
};

const fetchFieldOptionInfo = async (field) => {
  const fieldId = field?.id;
  const projectId = field?.scope?.project?.id;

  if (!fieldId) {
    return null;
  }

  try {
    const contexts = await fetchFieldContexts(fieldId);
    let options = await fetchOptionsFromContexts(fieldId, contexts);

    if (options.length === 0 && projectId) {
      const fallbackOptions = await fetchOptionsFromCreateMeta(fieldId, projectId);
      if (fallbackOptions.length > 0) {
        options = fallbackOptions;
      }
    }

    return { status: 'loaded', options };
  } catch (error) {
    console.error(`[getAllFields] option fetch failed for fieldId=${fieldId}: ${error?.message || error}`);
    return { status: 'error', options: [] };
  }
};

resolver.define('getAllFields', async () => {
  const fieldResponse = await requestJiraAsApp(route`/rest/api/3/field`);
  const fields = await fieldResponse.json();

  const projectResponse = await requestJiraAsApp(route`/rest/api/3/project`);
  const projects = await projectResponse.json();

  const projectMap = {};
  for (const project of projects) {
    projectMap[project.id] = project.name;
  }

  const optionFields = fields.filter((field) => isOptionBasedField(field) && field?.id);
  const optionInfos = await mapWithConcurrency(optionFields, (field) => fetchFieldOptionInfo(field));
  const optionInfoByFieldId = Object.fromEntries(
    optionFields.map((field, idx) => [field.id, optionInfos[idx]])
  );

  return fields.map((field) => {
    const projectId = field.scope?.project?.id;
    return {
      ...field,
      projectName: projectId ? projectMap[projectId] || 'Unknown Project' : null,
      optionInfo: optionInfoByFieldId[field.id] || null,
    };
  });
});

export const handler = resolver.getDefinitions();
