import api, { route } from '@forge/api';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the Forge API
vi.mock('@forge/api', () => ({
  __esModule: true,
  default: {
    asApp: vi.fn(),
  },
  route: vi.fn(),
}));

// Mock the Forge Resolver
vi.mock('@forge/resolver', () => {
  let storedFunctions = {};
  
  return {
    __esModule: true,
    default: vi.fn().mockImplementation(function() {
      return {
        define: vi.fn((name, fn) => {
          storedFunctions[name] = fn;
        }),
        getDefinitions: vi.fn(() => storedFunctions),
      };
    }),
  };
});

describe('Resolvers', () => {
  let handler;
  let mockRequestJira;

  beforeAll(async () => {
    // Import after mocks are set up
    const module = await import('../src/resolvers/index.js');
    handler = module.handler;
  });

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
    
    // Setup the mock chain
    mockRequestJira = vi.fn();
    api.asApp = vi.fn().mockReturnValue({
      requestJira: mockRequestJira,
    });
    
    route.mockImplementation((strings, ...values) =>
      strings.reduce((acc, str, idx) => acc + str + (values[idx] ?? ''), '')
    );
  });

  describe('getAllFields', () => {
    it('should fetch and enrich fields with project names', async () => {
      // Mock fields response
      const mockFields = [
        {
          id: 'field1',
          name: 'Team Field',
          scope: { project: { id: '10001' } },
        },
        {
          id: 'field2',
          name: 'Global Field',
        },
        {
          id: 'field3',
          name: 'Another Team Field',
          scope: { project: { id: '10002' } },
        },
      ];

      // Mock projects response
      const mockProjects = [
        { id: '10001', name: 'Project Alpha' },
        { id: '10002', name: 'Project Beta' },
      ];

      // Setup mock responses
      mockRequestJira
        .mockResolvedValueOnce({
          json: async () => mockFields,
        })
        .mockResolvedValueOnce({
          json: async () => mockProjects,
        });

      // Call the handler
      const result = await handler.getAllFields();

      // Verify API calls
      expect(api.asApp).toHaveBeenCalledTimes(2);
      expect(mockRequestJira).toHaveBeenCalledTimes(2);

      // Verify enriched fields
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        id: 'field1',
        name: 'Team Field',
        scope: { project: { id: '10001' } },
        projectName: 'Project Alpha',
        optionInfo: null,
      });
      expect(result[1]).toEqual({
        id: 'field2',
        name: 'Global Field',
        projectName: null,
        optionInfo: null,
      });
      expect(result[2]).toEqual({
        id: 'field3',
        name: 'Another Team Field',
        scope: { project: { id: '10002' } },
        projectName: 'Project Beta',
        optionInfo: null,
      });
    });

    it('should handle fields with unknown project IDs', async () => {
      const mockFields = [
        {
          id: 'field1',
          name: 'Orphan Field',
          scope: { project: { id: '99999' } },
        },
      ];

      const mockProjects = [
        { id: '10001', name: 'Project Alpha' },
      ];

      mockRequestJira
        .mockResolvedValueOnce({
          json: async () => mockFields,
        })
        .mockResolvedValueOnce({
          json: async () => mockProjects,
        });

      const result = await handler.getAllFields();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'field1',
        name: 'Orphan Field',
        scope: { project: { id: '99999' } },
        projectName: 'Unknown Project',
        optionInfo: null,
      });
    });

    it('should handle empty fields and projects', async () => {
      mockRequestJira
        .mockResolvedValueOnce({
          json: async () => [],
        })
        .mockResolvedValueOnce({
          json: async () => [],
        });

      const result = await handler.getAllFields();

      expect(result).toEqual([]);
    });

    it('should handle fields with null or undefined scope', async () => {
      const mockFields = [
        {
          id: 'field1',
          name: 'Field with null scope',
          scope: null,
        },
        {
          id: 'field2',
          name: 'Field with undefined scope',
        },
      ];

      const mockProjects = [];

      mockRequestJira
        .mockResolvedValueOnce({
          json: async () => mockFields,
        })
        .mockResolvedValueOnce({
          json: async () => mockProjects,
        });

      const result = await handler.getAllFields();

      expect(result).toHaveLength(2);
      expect(result[0].projectName).toBeNull();
      expect(result[1].projectName).toBeNull();
    });

    it('should handle API errors gracefully', async () => {
      mockRequestJira.mockRejectedValueOnce(new Error('API Error'));

      await expect(handler.getAllFields()).rejects.toThrow('API Error');
    });

    it('should handle malformed JSON responses', async () => {
      mockRequestJira.mockResolvedValueOnce({
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      await expect(handler.getAllFields()).rejects.toThrow('Invalid JSON');
    });

    it('should correctly map multiple fields to the same project', async () => {
      const mockFields = [
        {
          id: 'field1',
          name: 'Team Field 1',
          scope: { project: { id: '10001' } },
        },
        {
          id: 'field2',
          name: 'Team Field 2',
          scope: { project: { id: '10001' } },
        },
        {
          id: 'field3',
          name: 'Team Field 3',
          scope: { project: { id: '10001' } },
        },
      ];

      const mockProjects = [
        { id: '10001', name: 'Shared Project' },
      ];

      mockRequestJira
        .mockResolvedValueOnce({
          json: async () => mockFields,
        })
        .mockResolvedValueOnce({
          json: async () => mockProjects,
        });

      const result = await handler.getAllFields();

      expect(result).toHaveLength(3);
      result.forEach(field => {
        expect(field.projectName).toBe('Shared Project');
        expect(field.optionInfo).toBeNull();
      });
    });
  });

  describe('option enrichment in getAllFields', () => {
    const okJsonResponse = (body) => ({
      ok: true,
      json: async () => body,
    });

    const retryableResponse = (status) => ({
      ok: false,
      status,
      headers: {
        get: () => '0',
      },
      text: async () => `retryable ${status}`,
    });

    it('should enrich option-based fields with de-duplicated sorted options', async () => {
      const fields = [
        {
          id: 'customfield_10000',
          name: 'Priority',
          schema: { type: 'option' },
        },
      ];
      const projects = [];

      mockRequestJira
        .mockResolvedValueOnce(okJsonResponse(fields))
        .mockResolvedValueOnce(okJsonResponse(projects))
        .mockResolvedValueOnce(okJsonResponse({ values: [{ id: '10' }, { id: '20' }] }))
        .mockResolvedValueOnce(okJsonResponse({ values: [{ value: 'Beta' }, { value: 'Alpha' }] }))
        .mockResolvedValueOnce(okJsonResponse({ values: [{ value: 'Alpha' }, { value: 'Gamma' }] }));

      const result = await handler.getAllFields();

      expect(result).toHaveLength(1);
      expect(result[0].optionInfo).toEqual({
        status: 'loaded',
        options: ['Alpha', 'Beta', 'Gamma'],
      });
    });

    it('should fallback to create metadata when context options are empty', async () => {
      const fields = [
        {
          id: 'customfield_10124',
          name: 'Team Select',
          schema: { type: 'option' },
          scope: { project: { id: '10001' } },
        },
      ];
      const projects = [{ id: '10001', name: 'Team Project' }];

      mockRequestJira
        .mockResolvedValueOnce(okJsonResponse(fields))
        .mockResolvedValueOnce(okJsonResponse(projects))
        .mockResolvedValueOnce(okJsonResponse({ values: [{ id: '10' }] }))
        .mockResolvedValueOnce(okJsonResponse({ values: [] }))
        .mockResolvedValueOnce(okJsonResponse({
          projects: [
            {
              issuetypes: [
                {
                  fields: {
                    customfield_10124: {
                      allowedValues: [{ value: 'Option B' }, { value: 'Option A' }],
                    },
                  },
                },
              ],
            },
          ],
        }));

      const result = await handler.getAllFields();
      expect(result[0].optionInfo).toEqual({
        status: 'loaded',
        options: ['Option A', 'Option B'],
      });
    });

    it('should retry when context request returns 429', async () => {
      const fields = [
        {
          id: 'customfield_10000',
          name: 'Priority',
          schema: { type: 'option' },
        },
      ];

      mockRequestJira
        .mockResolvedValueOnce(okJsonResponse(fields))
        .mockResolvedValueOnce(okJsonResponse([]))
        .mockResolvedValueOnce(retryableResponse(429))
        .mockResolvedValueOnce(okJsonResponse({ values: [{ id: '10' }] }))
        .mockResolvedValueOnce(okJsonResponse({ values: [{ value: 'Alpha' }] }));

      const result = await handler.getAllFields();

      expect(result[0].optionInfo).toEqual({
        status: 'loaded',
        options: ['Alpha'],
      });
      expect(mockRequestJira).toHaveBeenCalledTimes(5);
    });

    it('should retry when option request returns 503', async () => {
      const fields = [
        {
          id: 'customfield_10000',
          name: 'Priority',
          schema: { type: 'option' },
        },
      ];

      mockRequestJira
        .mockResolvedValueOnce(okJsonResponse(fields))
        .mockResolvedValueOnce(okJsonResponse([]))
        .mockResolvedValueOnce(okJsonResponse({ values: [{ id: '10' }] }))
        .mockResolvedValueOnce(retryableResponse(503))
        .mockResolvedValueOnce(okJsonResponse({ values: [{ value: 'Alpha' }] }));

      const result = await handler.getAllFields();

      expect(result[0].optionInfo).toEqual({
        status: 'loaded',
        options: ['Alpha'],
      });
      expect(mockRequestJira).toHaveBeenCalledTimes(5);
    });
  });
});
