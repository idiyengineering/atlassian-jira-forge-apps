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
  Text,
} from '@forge/react';
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
      { key: 'options', content: 'Options' },
      { key: 'projectName', content: 'Project Name' },
    ],
  };

  const sortFieldsByName = (fields) => {
    return [...fields].sort((a, b) => {
      const aName = a.name || '';
      const bName = b.name || '';
      return aName.localeCompare(bName);
    });
  };

  const formatOptionValues = (options) => {
    if (!options.length) {
      return null;
    }

    return options.join(', ');
  };

  const getOptionDisplayModel = (field) => {
    if (!field?.optionInfo) {
      return null;
    }

    const fieldType = field.schema?.type || 'N/A';
    if (field.optionInfo.status === 'error') {
      return {
        typeText: fieldType,
        optionsText: 'Options unavailable',
        tooltipText: 'Unable to load options',
      };
    }

    const options = field.optionInfo.options || [];
    return {
      typeText: fieldType,
      optionsText: formatOptionValues(options) || 'No options',
      tooltipText: formatOptionValues(options) || 'No options found for this field',
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
          {
            key: 'options',
            content: <Text size="small">{optionDisplayModel?.optionsText || '-'}</Text>,
          },
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

  const filteredFields = fields.filter(field =>
    field.name?.toLowerCase().includes(filter.toLowerCase())
  );

  const sortedFields = sortFieldsByName(filteredFields);
  const rows = mapFieldsToRows(sortedFields);

  const sortedDuplicateFields = sortFieldsByName(getDuplicateFields(fields));
  const duplicateRows = mapFieldsToRows(sortedDuplicateFields);

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
