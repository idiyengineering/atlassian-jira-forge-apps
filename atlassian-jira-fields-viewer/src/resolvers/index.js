import Resolver from '@forge/resolver';
import api, { route } from '@forge/api';

const resolver = new Resolver();

resolver.define('getAllFields', async (req) => {
  const response = await api.asApp().requestJira(route`/rest/api/3/field`, {
    headers: {
      'Accept': 'application/json',
    },
  });
  const data = await response.json();
  console.log('Fields fetched:', data);
  return data;
});


export const handler = resolver.getDefinitions();
