import React, { useEffect, useState } from 'react';
import ForgeReconciler, { Text, DynamicTable } from '@forge/react';
import { invoke } from '@forge/bridge';

const App = () => {
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState('name');
  const [sortOrder, setSortOrder] = useState('ASC');

  useEffect(() => {
    invoke('getAllFields')
      .then(setFields)
      .finally(() => setLoading(false));
  }, []);

  const head = {
    cells: [
      { key: 'name', content: 'Name'},
      { key: 'key', content: 'Key'},
      { key: 'type', content: 'Type'},
    ],
  };

  // Sorting logic
  const sortedFields = [...fields].sort((a, b) => {
    const aValue = sortKey === 'type' ? a.schema?.type || '' : a[sortKey] || '';
    const bValue = sortKey === 'type' ? b.schema?.type || '' : b[sortKey] || '';
    if (aValue < bValue) return sortOrder === 'ASC' ? -1 : 1;
    if (aValue > bValue) return sortOrder === 'ASC' ? 1 : -1;
    return 0;
  });

  const rows = sortedFields.map(field => ({
    key: field.id,
    cells: [
      { key: 'name', content: field.name },
      { key: 'key', content: field.key },
      { key: 'type', content: field.schema?.type || 'N/A' },
    ],
  }));

  return (
    <>
      <DynamicTable
        caption="List of Jira Fields in this Jira instance"
        head={head}
        rows={rows}
        isLoading={loading}
        emptyView="No fields to display"
        defaultSortKey="name"
        defaultSortOrder="ASC"
      />
    </>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);