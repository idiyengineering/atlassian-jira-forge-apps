import React, { useEffect, useState } from 'react';
import ForgeReconciler, { Label, DynamicTable, Textfield, Tabs, TabList, Tab, TabPanel, Box} from '@forge/react';
import { invoke } from '@forge/bridge';

export const App = () => {
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    invoke('getAllFields')
      .then(setFields)
      .finally(() => setLoading(false));
  }, []);

  const head = {
    cells: [
      { key: 'number', content: '#', width: 2 },
      { key: 'name', content: 'Field Name' },
      { key: 'key', content: 'Field ID' },
      { key: 'type', content: 'Field Type' },
      { key: 'projectName', content: 'Project Name' },
    ],
  };

  // --- 🔁 Common Utility Functions ---

  const sortFieldsByName = (fields) => {
    return [...fields].sort((a, b) => {
      const aName = a.name || '';
      const bName = b.name || '';
      return aName.localeCompare(bName);
    });
  };

  const mapFieldsToRows = (fields) => {
    return fields.map((field, index) => ({
      key: field.id || `row-${index}`,
      cells: [
        { key: 'number', content: index + 1 },
        { key: 'name', content: field.name },
        { key: 'key', content: field.key },
        { key: 'type', content: field.schema?.type || 'N/A' },
        { key: 'projectName', content: field.projectName || 'Company Managed Fields' },
      ],
    }));
  };

  const getDuplicateFields = (fields) => {
    const nameCount = {};
    fields.forEach(field => {
      const name = field.name || '';
      nameCount[name] = (nameCount[name] || 0) + 1;
    });

    const duplicateNames = new Set(
      Object.entries(nameCount)
        .filter(([_, count]) => count > 1)
        .map(([name]) => name)
    );

    return fields.filter(field => duplicateNames.has(field.name));
  };

  // --- 📦 Field Processing ---

  const filteredFields = fields.filter(field =>
    field.name?.toLowerCase().includes(filter.toLowerCase())
  );

  const sortedFields = sortFieldsByName(filteredFields);
  const rows = mapFieldsToRows(sortedFields);

  const sortedDuplicateFields = sortFieldsByName(getDuplicateFields(fields));
  const duplicateRows = mapFieldsToRows(sortedDuplicateFields);

  // --- 💡 UI Rendering ---
  return (
    <>
      <Tabs id="default">
        <TabList>
          <Tab>List of Jira Fields in this Jira instance</Tab>
          <Tab>List of Duplicate Jira Fields in this Jira instance</Tab>
        </TabList>
        <TabPanel>
          <Box padding="space.300">
            <Label labelFor="filter">Filter by Field Name</Label>
            <Textfield
              id="filter"
              value={filter}
              onChange={(e) => setFilter(e?.target?.value || '')}
            />
            <DynamicTable
              head={head}
              rows={rows}
              isLoading={loading}
              emptyView="No fields to display"
              isFixedSize={true}
            />
          </Box>
        </TabPanel>
        <TabPanel>
          <Box padding="space.300">
            <DynamicTable
              head={head}
              rows={duplicateRows}
              isLoading={loading}
              emptyView="No duplicate fields"
              isFixedSize={true}
            />
          </Box>
        </TabPanel>
      </Tabs>
    </>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
