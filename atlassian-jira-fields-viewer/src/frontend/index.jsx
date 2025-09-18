import React, { useEffect, useState } from 'react';
import ForgeReconciler, { Label, DynamicTable, Textfield } from '@forge/react';
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

  // Helper: Get duplicate field names
  const getDuplicateFields = (fields) => {
    const nameCount = {};
    const duplicates = [];

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
  
  const duplicateRows = getDuplicateFields(fields).map((field, index) => ({
    key: `dup-${field.id}`,
    cells: [
      { key: 'number', content: index + 1 },
      { key: 'name', content: field.name },
      { key: 'key', content: field.key },
      { key: 'type', content: field.schema?.type || 'N/A' },
      { key: 'projectName', content: field.projectName || 'Company Managed Fields' },
    ],
  }));

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
      { key: 'projectName', content: field.projectName || 'Company Managed Fields' },
    ],
  }));

  return (
    <>
      <Label labelFor="filter">Filter by Field Name</Label>
      <Textfield
        id="filter"
        value={filter}
        onChange={(e) => setFilter(e?.target?.value || '')}
      />
      <Label>List of Jira Fields in this Jira instance</Label>
      <DynamicTable
        head={head}
        rows={rows}
        isLoading={loading}
        emptyView="No fields to display"
      />
      <Label>List of Duplicate Jira Fields in this Jira instance</Label>
      <DynamicTable
        head={head}
        rows={duplicateRows}
        isLoading={loading}
        emptyView="No duplicate fields"
      />
    </>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
