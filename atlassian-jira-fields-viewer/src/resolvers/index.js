import Resolver from '@forge/resolver';
import api, { route } from '@forge/api';

const resolver = new Resolver();

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
    const requestJiraWithFallback = async (path) => {
      try {
        return await api.asUser().requestJira(path, {
          headers: { Accept: 'application/json' },
        });
      } catch (error) {
        return api.asApp().requestJira(path, {
          headers: { Accept: 'application/json' },
        });
      }
    };

    console.log(`[getFieldOptions] fetching options for fieldId=${fieldId}`);
    const contextResponse = await requestJiraWithFallback(
      route`/rest/api/3/field/${fieldId}/context?maxResults=50`
    );

    let contexts = [];
    if (contextResponse.ok === false) {
      const responseText = await contextResponse.text();
      console.error(
        `[getFieldOptions] context request failed for fieldId=${fieldId} status=${contextResponse.status} body=${responseText}`
      );
    } else {
      const contextData = await contextResponse.json();
      contexts = contextData?.values || [];
      console.log(`[getFieldOptions] fieldId=${fieldId} contexts=${contexts.length}`);
    }
    const optionValues = [];

    for (const context of contexts) {
      const contextId = context?.id;
      if (!contextId) {
        continue;
      }

      const optionResponse = await requestJiraWithFallback(
        route`/rest/api/3/field/${fieldId}/context/${contextId}/option?maxResults=100`
      );

      if (optionResponse.ok === false) {
        const responseText = await optionResponse.text();
        console.error(
          `[getFieldOptions] option request failed for fieldId=${fieldId} contextId=${contextId} status=${optionResponse.status} body=${responseText}`
        );
        continue;
      }

      const optionData = await optionResponse.json();
      const contextOptions = optionData?.values || [];

      for (const option of contextOptions) {
        if (option?.value) {
          optionValues.push(option.value);
        }
      }
    }

    let result = Array.from(new Set(optionValues)).sort((a, b) => a.localeCompare(b));

    // Team-managed fields can return empty context options; use create metadata as fallback.
    if (result.length === 0 && projectId) {
      const createMetaResponse = await requestJiraWithFallback(
        route`/rest/api/3/issue/createmeta?projectIds=${projectId}&expand=projects.issuetypes.fields`
      );

      if (createMetaResponse.ok) {
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

        if (metaValues.length > 0) {
          result = Array.from(new Set(metaValues)).sort((a, b) => a.localeCompare(b));
          console.log(
            `[getFieldOptions] fieldId=${fieldId} populated from createmeta fallback optionCount=${result.length}`
          );
        }
      } else {
        const responseText = await createMetaResponse.text();
        console.error(
          `[getFieldOptions] createmeta fallback failed for fieldId=${fieldId} projectId=${projectId} status=${createMetaResponse.status} body=${responseText}`
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
