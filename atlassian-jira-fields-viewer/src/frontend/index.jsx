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

const fetchFieldOptionEntry = async (field) => {
  const fieldId = field.id;
  try {
    const options = await invoke('getFieldOptions', {
      fieldId,
      projectId: field?.scope?.project?.id,
    });
    return [fieldId, { status: 'loaded', options: Array.isArray(options) ? options : [] }];
  } catch {
    return [fieldId, { status: 'error', options: [] }];
  }
};

const fetchMissingFieldOptions = async (missingFields) => {
  const results = await Promise.all(missingFields.map(fetchFieldOptionEntry));
  return Object.fromEntries(results);
};

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
      { key: 'options', content: 'Options' },
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
    const optionFields = fields.filter(isOptionBasedField).filter((field) => field?.id);
    const missingFields = optionFields.filter((field) => !fieldOptionState[field.id]);

    if (!missingFields.length) {
      return;
    }

    let isCancelled = false;

    const loadingStateByFieldId = Object.fromEntries(
      missingFields.map((field) => [field.id, { status: 'loading', options: [] }])
    );
    setFieldOptionState((prev) => ({
      ...prev,
      ...loadingStateByFieldId,
    }));

    fetchMissingFieldOptions(missingFields).then((resolvedFieldOptionState) => {
      if (isCancelled) {
        return;
      }

      setFieldOptionState((prev) => ({
        ...prev,
        ...resolvedFieldOptionState,
      }));
    });

    return () => {
      isCancelled = true;
    };
  }, [fields, fieldOptionState]);

  const formatOptionValues = (options, limit) => {
    if (!options.length) {
      return null;
    }

    const visibleOptions = options.slice(0, limit);
    const hiddenCount = options.length - visibleOptions.length;
    const optionText = visibleOptions.join(', ');
    return hiddenCount > 0 ? `${optionText} (+${hiddenCount} more)` : optionText;
  };

  const getOptionDisplayModel = (field) => {
    if (!isOptionBasedField(field)) {
      return null;
    }

    const fieldType = field.schema?.type || 'N/A';
    const fieldState = fieldOptionState[field?.id];

    if (fieldState?.status === 'error') {
      return {
        typeText: `${fieldType} (options unavailable)`,
        optionsText: 'Options unavailable',
        tooltipText: 'Unable to load options',
      };
    }

    if (fieldState?.status === 'loaded') {
      const options = fieldState.options || [];
      const optionCount = options.length;

      return {
        typeText: `${fieldType} (${optionCount})`,
        optionsText: formatOptionValues(options, 3) || 'No options',
        tooltipText: formatOptionValues(options, 20) || 'No options found for this field',
      };
    }

    return {
      typeText: `${fieldType} (loading...)`,
      optionsText: 'Loading options...',
      tooltipText: 'Loading options...',
    };
  };

  const mapFieldsToRows = (fields) => {
    return fields.map((field, index) => {
      const optionDisplayModel = getOptionDisplayModel(field);
      return {
        key: field.id || `row-${index}`,
        cells: [
          { key: 'number', content: index + 1 },
          { key: 'name', content: field.name },
          { key: 'key', content: field.key },
          {
            key: 'type',
            content: optionDisplayModel ? (
              <Tooltip text={optionDisplayModel.tooltipText}>
                {optionDisplayModel.typeText}
              </Tooltip>
            ) : (
              field.schema?.type || 'N/A'
            ),
          },
          { key: 'options', content: optionDisplayModel?.optionsText || '-' },
          { key: 'projectName', content: field.projectName || 'Company Managed Fields' },
        ],
      };
    });
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
