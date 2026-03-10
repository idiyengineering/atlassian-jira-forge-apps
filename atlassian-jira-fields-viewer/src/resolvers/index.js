import Resolver from '@forge/resolver';
import api, { route } from '@forge/api';

const resolver = new Resolver();
const JSON_HEADERS = { Accept: 'application/json' };

const requestJiraAsApp = (path) => {
  return api.asApp().requestJira(path, {
    headers: JSON_HEADERS,
  });
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

const fetchFieldContexts = async (fieldId) => {
  const contextResponse = await requestJiraAsApp(
    route`/rest/api/3/field/${fieldId}/context?maxResults=50`
  );

  if (!contextResponse.ok) {
    await logFailedResponse(
      `[getFieldOptions] context request failed for fieldId=${fieldId}`,
      contextResponse
    );
    return [];
  }

  const contextData = await contextResponse.json();
  const contexts = contextData?.values || [];
  console.log(`[getFieldOptions] fieldId=${fieldId} contexts=${contexts.length}`);
  return contexts;
};

const fetchOptionsForContext = async (fieldId, contextId) => {
  const optionResponse = await requestJiraAsApp(
    route`/rest/api/3/field/${fieldId}/context/${contextId}/option?maxResults=100`
  );

  if (!optionResponse.ok) {
    await logFailedResponse(
      `[getFieldOptions] option request failed for fieldId=${fieldId} contextId=${contextId}`,
      optionResponse
    );
    return [];
  }

  const optionData = await optionResponse.json();
  const contextOptions = optionData?.values || [];
  return contextOptions.map((option) => option?.value).filter(Boolean);
};

const fetchOptionsFromContexts = async (fieldId, contexts) => {
  const optionValues = [];

  for (const context of contexts) {
    const contextId = context?.id;
    if (!contextId) {
      continue;
    }

    const values = await fetchOptionsForContext(fieldId, contextId);
    optionValues.push(...values);
  }

  return getUniqueSortedOptions(optionValues);
};

const fetchOptionsFromCreateMeta = async (fieldId, projectId) => {
  const createMetaResponse = await requestJiraAsApp(
    route`/rest/api/3/issue/createmeta?projectIds=${projectId}&expand=projects.issuetypes.fields`
  );

  if (!createMetaResponse.ok) {
    await logFailedResponse(
      `[getFieldOptions] createmeta fallback failed for fieldId=${fieldId} projectId=${projectId}`,
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

resolver.define('getAllFields', async () => {
  // Step 1: Get all fields
  const fieldResponse = await api.asApp().requestJira(route`/rest/api/3/field`, {
    headers: { 'Accept': 'application/json' },
  });
  const fields = await fieldResponse.json();

  // Step 2: Get all projects
  const projectResponse = await api.asApp().requestJira(route`/rest/api/3/project`, {
    headers: { 'Accept': 'application/json' },
  });
  const projects = await projectResponse.json();

  // Step 3: Build map from projectId to projectName
  const projectMap = {};
  for (const project of projects) {
    projectMap[project.id] = project.name;
  }

  // Step 4: Enrich fields with project name if team-managed
  const enrichedFields = fields.map(field => {
    const projectId = field.scope?.project?.id;
    return {
      ...field,
      projectName: projectId ? projectMap[projectId] || 'Unknown Project' : null
    };
  });

  return enrichedFields;
});

resolver.define('getFieldOptions', async ({ payload }) => {
  const fieldId = payload?.fieldId;
  const projectId = payload?.projectId;
  if (!fieldId) {
    return [];
  }

  try {
    console.log(`[getFieldOptions] fetching options for fieldId=${fieldId}`);
    const contexts = await fetchFieldContexts(fieldId);
    let result = await fetchOptionsFromContexts(fieldId, contexts);

    // Team-managed fields can return empty context options; use create metadata as fallback.
    if (result.length === 0 && projectId) {
      const fallbackResult = await fetchOptionsFromCreateMeta(fieldId, projectId);
      if (fallbackResult.length > 0) {
        result = fallbackResult;
        console.log(
          `[getFieldOptions] fieldId=${fieldId} populated from createmeta fallback optionCount=${result.length}`
        );
      }
    }

    console.log(`[getFieldOptions] fieldId=${fieldId} optionCount=${result.length}`);
    return result;
  } catch (error) {
    console.error(`[getFieldOptions] unexpected error for fieldId=${fieldId}: ${error?.message || error}`);
    return [];
  }
});

export const handler = resolver.getDefinitions();
