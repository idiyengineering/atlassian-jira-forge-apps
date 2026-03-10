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
    const contextResponse = await api
      .asApp()
      .requestJira(route`/rest/api/3/field/${fieldId}/context?maxResults=50`, {
        headers: { Accept: 'application/json' },
      });

    if (contextResponse.ok === false) {
      return [];
    }

    const contextData = await contextResponse.json();
    const contexts = contextData?.values || [];
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

    return Array.from(new Set(optionValues)).sort((a, b) => a.localeCompare(b));
  } catch (error) {
    return [];
  }
});

export const handler = resolver.getDefinitions();
