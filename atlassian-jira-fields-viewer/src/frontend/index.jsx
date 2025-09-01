import React, { useEffect, useState } from 'react';
import ForgeReconciler, { DynamicTable, TextField } from '@forge/react';
import { invoke } from '@forge/bridge';

const App = () => {
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
      { key: 'number', content: '#' },
      { key: 'name', content: 'Field Name' },
      { key: 'key', content: 'Field ID' },
      { key: 'type', content: 'Field Type' },
      { key: 'projectName', content: 'Project Name' },
    ],
  };

  // Filter fields by Field Name
  const filteredFields = fields.filter(field =>
    field.name?.toLowerCase().includes(filter.toLowerCase())
  );

  const sortedFields = [...filteredFields].sort((a, b) => {
    const aName = a.name || '';
    const bName = b.name || '';
    return aName.localeCompare(bName);
  });

  const rows = sortedFields.map((field, index) => ({
    key: field.id,
    cells: [
      { key: 'number', content: index + 1 },
      { key: 'name', content: field.name },
      { key: 'key', content: field.key },
      { key: 'type', content: field.schema?.type || 'N/A' },
      { key: 'projectName', content: field.projectName || '-' },
    ],
  }));

  return (
    <>
      <TextField
        label="Filter by Field Name"
        value={filter}
        onChange={e => setFilter(e.target.value)}
      />
      <DynamicTable
        caption="List of Jira Fields in this Jira instance"
        head={head}
        rows={rows}
        isLoading={loading}
        emptyView="No fields to display"
      />
    </>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
