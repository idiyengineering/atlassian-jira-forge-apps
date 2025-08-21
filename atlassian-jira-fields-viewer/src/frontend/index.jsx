import React, { useEffect, useState } from 'react';
import ForgeReconciler, { Text, DynamicTable } from '@forge/react';
import { invoke } from '@forge/bridge';

const App = () => {
  const [fields, setFields] = useState([]);

  useEffect(() => {
    invoke('getAllFields').then(setFields);
  }, []);

  // Prepare table headings
  const head = {
    cells: [
      { key: 'name', content: 'Name' },
      { key: 'key', content: 'Field ID' },
      { key: 'type', content: 'Data Type' },
    ],
  };

  // Prepare table rows
  const rows = fields.map(field => ({
    key: field.id,
    cells: [
      { key: 'name', content: field.name },
      { key: 'key', content: field.key },
      { key: 'type', content: field.schema?.type || 'N/A' },
    ],
  }));

  return (
    <>
      <Text>List of jira fields in this instance</Text>
      {fields.length === 0 ? (
        <Text>Loading...</Text>
      ) : (
        <DynamicTable
          head={head}
          rows={rows}
        />
      )}
    </>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);