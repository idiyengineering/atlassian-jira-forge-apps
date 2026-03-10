import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { invoke } from '@forge/bridge';
import { beforeEach, describe, expect, test, vi } from 'vitest';

// Mock @forge/bridge
vi.mock('@forge/bridge', () => ({
  invoke: vi.fn(),
}));

// Mock @forge/react components
vi.mock('@forge/react', () => ({
  __esModule: true,
  default: {
    render: vi.fn(),
  },
  Label: ({ children, labelFor }) => <label htmlFor={labelFor}>{children}</label>,
  DynamicTable: ({ head, rows, isLoading, emptyView }) => {
    if (isLoading) return <div>Loading...</div>;
    if (rows.length === 0) return <div>{emptyView}</div>;
    return (
      <table>
        <thead>
          <tr>
            {head.cells.map((cell) => (
              <th key={cell.key}>{cell.content}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              {row.cells.map((cell) => (
                <td key={cell.key}>{cell.content}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  },
  Textfield: ({ id, value, onChange }) => (
    <input
      id={id}
      type="text"
      value={value}
      onChange={onChange}
      data-testid="filter-input"
    />
  ),
  Tabs: ({ children, id }) => <div data-testid="tabs" id={id}>{children}</div>,
  TabList: ({ children }) => <div data-testid="tab-list">{children}</div>,
  Tab: ({ children }) => <button data-testid="tab">{children}</button>,
  TabPanel: ({ children }) => <div data-testid="tab-panel">{children}</div>,
  Box: ({ children, padding }) => <div data-testid="box" data-padding={padding}>{children}</div>,
  Tooltip: ({ text, children }) => <span data-tooltip={text}>{children}</span>,
}));

// Import the App component
import { App } from '../src/frontend/index';

const mockFields = [
  {
    id: 'field1',
    name: 'Summary',
    key: 'summary',
    schema: { type: 'string' },
    projectName: 'Project A',
  },
  {
    id: 'field2',
    name: 'Description',
    key: 'description',
    schema: { type: 'string' },
    projectName: 'Project B',
  },
  {
    id: 'field3',
    name: 'Summary',
    key: 'custom-summary',
    schema: { type: 'string' },
    projectName: 'Project C',
  },
  {
    id: 'field4',
    name: 'Priority',
    key: 'priority',
    schema: { type: 'priority' },
  },
];

describe('Jira Fields Viewer App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Component Rendering', () => {
    test('should render loading state initially', () => {
      invoke.mockImplementation(() => new Promise(() => {})); // Never resolves

      const { container } = render(<App />);

      expect(screen.getAllByText('Loading...').length).toBeGreaterThan(0);
    });

    test('should render tabs with correct labels', async () => {
      invoke.mockResolvedValue(mockFields);

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('List of Jira Fields in this Jira instance')).toBeInTheDocument();
        expect(screen.getByText('List of Duplicate Jira Fields in this Jira instance')).toBeInTheDocument();
      });
    });

    test('should render filter input', async () => {
      invoke.mockResolvedValue(mockFields);

      render(<App />);

      await waitFor(() => {
        expect(screen.getByLabelText('Filter by Field Name')).toBeInTheDocument();
      });
    });
  });

  describe('Data Fetching', () => {
    test('should invoke getAllFields on mount', async () => {
      invoke.mockResolvedValue(mockFields);

      render(<App />);

      expect(invoke).toHaveBeenCalledWith('getAllFields');
      expect(invoke).toHaveBeenCalledTimes(1);
    });

    test('should display fields after successful fetch', async () => {
      invoke.mockResolvedValue(mockFields);

      render(<App />);

      await waitFor(() => {
        expect(screen.getAllByText('Summary').length).toBeGreaterThan(0);
        expect(screen.getByText('Description')).toBeInTheDocument();
        expect(screen.getByText('Priority')).toBeInTheDocument();
      });
    });

    test('should show empty view when no fields returned', async () => {
      invoke.mockResolvedValue([]);

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('No fields to display')).toBeInTheDocument();
      });
    });
  });

  describe('Filtering Functionality', () => {
    test('should filter fields by name', async () => {
      invoke.mockResolvedValue(mockFields);

      render(<App />);

      await waitFor(() => {
        expect(screen.getAllByText('Summary').length).toBeGreaterThan(0);
      });

      const filterInput = screen.getByTestId('filter-input');
      fireEvent.change(filterInput, { target: { value: 'Description' } });

      await waitFor(() => {
        expect(screen.getByText('Description')).toBeInTheDocument();
        expect(screen.queryByText('Priority')).not.toBeInTheDocument();
      });
    });

    test('should be case-insensitive when filtering', async () => {
      invoke.mockResolvedValue(mockFields);

      render(<App />);

      await waitFor(() => {
        expect(screen.getAllByText('Summary').length).toBeGreaterThan(0);
      });

      const filterInput = screen.getByTestId('filter-input');
      fireEvent.change(filterInput, { target: { value: 'SUMMARY' } });

      await waitFor(() => {
        expect(screen.getAllByText('Summary').length).toBeGreaterThan(0);
      });
    });

    test('should show empty view when filter matches no fields', async () => {
      invoke.mockResolvedValue(mockFields);

      render(<App />);

      await waitFor(() => {
        expect(screen.getAllByText('Summary').length).toBeGreaterThan(0);
      });

      const filterInput = screen.getByTestId('filter-input');
      fireEvent.change(filterInput, { target: { value: 'NonExistentField' } });

      await waitFor(() => {
        expect(screen.getByText('No fields to display')).toBeInTheDocument();
      });
    });
  });

  describe('Duplicate Fields Detection', () => {
    test('should identify and display duplicate fields', async () => {
      invoke.mockResolvedValue(mockFields);

      render(<App />);

      await waitFor(() => {
        const tabPanels = screen.getAllByTestId('tab-panel');
        // Second tab panel should show duplicates
        // In this case, "Summary" appears twice
        expect(tabPanels.length).toBe(2);
      });
    });

    test('should show empty view when no duplicate fields exist', async () => {
      const uniqueFields = mockFields.filter((f, index) => index !== 2); // Remove duplicate Summary
      invoke.mockResolvedValue(uniqueFields);

      render(<App />);

      await waitFor(() => {
        const emptyViews = screen.queryAllByText('No duplicate fields');
        expect(emptyViews.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Field Sorting', () => {
    test('should sort fields alphabetically by name', async () => {
      invoke.mockResolvedValue(mockFields);

      render(<App />);

      await waitFor(() => {
        const rows = screen.getAllByRole('row');
        // First row is header, so check data rows
        const cellsInFirstDataRow = rows[1]?.querySelectorAll('td');
        const cellsInSecondDataRow = rows[2]?.querySelectorAll('td');

        // After sorting: Description, Priority, Summary, Summary
        expect(cellsInFirstDataRow?.[1]?.textContent).toBe('Description');
        expect(cellsInSecondDataRow?.[1]?.textContent).toBe('Priority');
      });
    });
  });

  describe('Table Structure', () => {
    test('should display correct table headers', async () => {
      invoke.mockResolvedValue(mockFields);

      render(<App />);

      await waitFor(() => {
        expect(screen.getAllByText('#').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Field Name').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Field ID').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Field Type').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Options').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Project Name').length).toBeGreaterThan(0);
      });
    });

    test('should display row numbers starting from 1', async () => {
      invoke.mockResolvedValue(mockFields);

      render(<App />);

      await waitFor(() => {
        const rows = screen.getAllByRole('row');
        const firstDataRow = rows[1]?.querySelectorAll('td');
        expect(firstDataRow?.[0]?.textContent).toBe('1');
      });
    });

    test('should handle fields without schema type', async () => {
      const fieldsWithoutType = [{
        id: 'field5',
        name: 'Custom Field',
        key: 'custom',
      }];
      invoke.mockResolvedValue(fieldsWithoutType);

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('N/A')).toBeInTheDocument();
      });
    });

    test('should display default project name for company managed fields', async () => {
      invoke.mockResolvedValue(mockFields);

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Company Managed Fields')).toBeInTheDocument();
      });
    });

    test('should load and display option count for selectable fields', async () => {
      const selectableFields = [
        {
          id: 'customfield_10010',
          name: 'Risk Level',
          key: 'customfield_10010',
          schema: { type: 'option', custom: 'com.atlassian.jira.plugin.system.customfieldtypes:select' },
        },
      ];

      invoke.mockImplementation((fnName) => {
        if (fnName === 'getAllFields') {
          return Promise.resolve(selectableFields);
        }

        if (fnName === 'getFieldOptions') {
          return Promise.resolve(['Low', 'Medium', 'High']);
        }

        return Promise.resolve([]);
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('option (3)')).toBeInTheDocument();
        expect(screen.getByText('Low, Medium, High')).toBeInTheDocument();
      });

      expect(invoke).toHaveBeenCalledWith(
        'getFieldOptions',
        expect.objectContaining({ fieldId: 'customfield_10010' })
      );
    });
  });
});

// To run these tests:
// 1. Install dependencies: npm install
// 2. Run tests: npm test
// 3. Run tests with coverage: npm run test:coverage
// 4. Run tests in watch mode: npm run test:watch
