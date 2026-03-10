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
  if (!fieldId) {
    return [];
  }

  try {
    console.log(`[getFieldOptions] fetching options for fieldId=${fieldId}`);
    const contextResponse = await api
      .asApp()
      .requestJira(route`/rest/api/3/field/${fieldId}/context?maxResults=50`, {
        headers: { Accept: 'application/json' },
      });

    if (contextResponse.ok === false) {
      const responseText = await contextResponse.text();
      console.error(
        `[getFieldOptions] context request failed for fieldId=${fieldId} status=${contextResponse.status} body=${responseText}`
      );
      return [];
    }

    const contextData = await contextResponse.json();
    const contexts = contextData?.values || [];
    console.log(`[getFieldOptions] fieldId=${fieldId} contexts=${contexts.length}`);
    const optionValues = [];

    for (const context of contexts) {
      const contextId = context?.id;
      if (!contextId) {
        continue;
      }

      const optionResponse = await api
        .asApp()
        .requestJira(route`/rest/api/3/field/${fieldId}/context/${contextId}/option?maxResults=100`, {
          headers: { Accept: 'application/json' },
        });

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

    const result = Array.from(new Set(optionValues)).sort((a, b) => a.localeCompare(b));
    console.log(`[getFieldOptions] fieldId=${fieldId} optionCount=${result.length}`);
    return result;
  } catch (error) {
    console.error(`[getFieldOptions] unexpected error for fieldId=${fieldId}: ${error?.message || error}`);
    return [];
  }
});

export const handler = resolver.getDefinitions();
