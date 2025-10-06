import api, { route } from '@forge/api';

// Mock the Forge API
jest.mock('@forge/api');

// Mock the Forge Resolver
jest.mock('@forge/resolver', () => {
  let storedFunctions = {};
  
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(function() {
      return {
        define: jest.fn((name, fn) => {
          storedFunctions[name] = fn;
        }),
        getDefinitions: jest.fn(() => storedFunctions),
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
    jest.clearAllMocks();
    
    // Setup the mock chain
    mockRequestJira = jest.fn();
    api.asApp = jest.fn().mockReturnValue({
      requestJira: mockRequestJira,
    });
    
    route.mockImplementation((strings, ...values) => strings.join(''));
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
      });
      expect(result[1]).toEqual({
        id: 'field2',
        name: 'Global Field',
        projectName: null,
      });
      expect(result[2]).toEqual({
        id: 'field3',
        name: 'Another Team Field',
        scope: { project: { id: '10002' } },
        projectName: 'Project Beta',
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
      });
    });
  });
});
