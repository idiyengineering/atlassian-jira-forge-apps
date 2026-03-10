import React, { useEffect, useState } from 'react';
import ForgeReconciler, {
  Label,
  DynamicTable,
  Textfield,
  Tabs,
  TabList,
  Tab,
  TabPanel,
  Box,
  Tooltip,
} from '@forge/react';
import { invoke } from '@forge/bridge';

export const App = () => {
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [fieldOptionState, setFieldOptionState] = useState({});

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

  const isOptionBasedField = (field) => {
    const type = field?.schema?.type?.toLowerCase?.() || '';
    const items = field?.schema?.items?.toLowerCase?.() || '';
    const custom = field?.schema?.custom?.toLowerCase?.() || '';

    return (
      type === 'option' ||
      items === 'option' ||
      custom.includes('select') ||
      custom.includes('checkbox') ||
      custom.includes('radio') ||
      custom.includes('cascading')
    );
  };

  useEffect(() => {
    const optionFields = fields.filter(isOptionBasedField);

    optionFields.forEach((field) => {
      const fieldId = field?.id;
      if (!fieldId) {
        return;
      }

      setFieldOptionState((prev) => {
        if (prev[fieldId]) {
          return prev;
        }
        return {
          ...prev,
          [fieldId]: { status: 'loading', options: [] },
        };
      });

      invoke('getFieldOptions', { fieldId })
        .then((options) => {
          setFieldOptionState((prev) => ({
            ...prev,
            [fieldId]: { status: 'loaded', options: Array.isArray(options) ? options : [] },
          }));
        })
        .catch(() => {
          setFieldOptionState((prev) => ({
            ...prev,
            [fieldId]: { status: 'error', options: [] },
          }));
        });
    });
  }, [fields]);

  const getOptionsTooltipText = (fieldId) => {
    const fieldState = fieldOptionState[fieldId];

    if (!fieldState) {
      return 'Loading options...';
    }

    if (fieldState.status === 'loading') {
      return 'Loading options...';
    }

    if (fieldState.status === 'error') {
      return 'Unable to load options';
    }

    if (fieldState.status === 'loaded') {
      if (!fieldState.options.length) {
        return 'No options found for this field';
      }

      const visibleOptions = fieldState.options.slice(0, 20);
      const hiddenCount = fieldState.options.length - visibleOptions.length;
      const optionText = visibleOptions.join(', ');

      return hiddenCount > 0 ? `${optionText} (+${hiddenCount} more)` : optionText;
    }

    return 'Loading options...';
  };

  const getFieldTypeContent = (field) => {
    const fieldType = field.schema?.type || 'N/A';
    if (!isOptionBasedField(field)) {
      return fieldType;
    }

    const fieldId = field?.id;
    const fieldState = fieldOptionState[fieldId];
    const optionCount = fieldState?.status === 'loaded' ? fieldState.options.length : null;
    const isLoading = !fieldState || fieldState?.status === 'loading';
    const isError = fieldState?.status === 'error';
    const label = optionCount && optionCount > 0 ? `${fieldType} (${optionCount})` : fieldType;
    const text = isLoading
      ? `${label} (loading...)`
      : isError
        ? `${label} (options unavailable)`
        : label;

    return (
      <Tooltip text={getOptionsTooltipText(fieldId)}>
        {text}
      </Tooltip>
    );
  };

  const mapFieldsToRows = (fields) => {
    return fields.map((field, index) => ({
      key: field.id || `row-${index}`,
      cells: [
        { key: 'number', content: index + 1 },
        { key: 'name', content: field.name },
        { key: 'key', content: field.key },
        { key: 'type', content: getFieldTypeContent(field) },
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
