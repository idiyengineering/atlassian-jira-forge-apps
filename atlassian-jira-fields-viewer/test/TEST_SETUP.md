# Test Setup for Jira Fields Viewer

This document explains the test setup for the Jira Fields Viewer frontend application.

## Test Files

All test files are located in the `test/` directory at the project root:

1. **test/index.test.jsx** - Main test file for the App component
2. **test/jest.config.js** - Jest configuration
3. **test/jest.setup.js** - Jest setup file
4. **test/.babelrc** - Babel configuration for transpiling JSX
5. **test/TEST_SETUP.md** - This documentation file

## Running Tests

### Install Dependencies

First, install the required test dependencies:

```bash
cd atlassian-jira-fields-viewer
npm install
```

### Run Tests

```bash
# Run tests once
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

## Test Coverage

The test suite covers:

- **Component Rendering**: Verifies tabs, labels, and UI elements render correctly
- **Data Fetching**: Tests the `getAllFields` invoke call and data loading
- **Filtering**: Tests case-insensitive filtering by field name
- **Duplicate Detection**: Verifies duplicate fields are identified correctly
- **Sorting**: Ensures fields are sorted alphabetically
- **Table Structure**: Tests table headers, row numbering, and data display
- **Edge Cases**: Empty states, missing data, error handling

## Test Structure

### Mocks

The tests mock:
- `@forge/bridge` - Mocks the `invoke` function
- `@forge/react` - Mocks all Forge UI components (DynamicTable, Tabs, etc.)

### Test Data

Mock field data includes:
- Fields with different names, keys, and types
- Duplicate field names to test duplicate detection
- Fields with and without project names
- Fields with and without schema types

### Coverage Thresholds

Configured in `test/jest.config.js`:
- Branches: 70%
- Functions: 70%
- Lines: 70%
- Statements: 70%

## Modifying Tests

When adding new features to the App component:

1. Add test data to `mockFields` in `test/index.test.jsx` if needed
2. Create a new `describe` block for the feature
3. Write test cases using `test()` or `it()`
4. Use `@testing-library/react` utilities:
   - `render()` - Render components
   - `screen` - Query rendered elements
   - `fireEvent` - Simulate user interactions
   - `waitFor()` - Wait for async updates

## Example Test Pattern

```javascript
test('should do something', async () => {
  // Arrange: Setup mocks
  invoke.mockResolvedValue(mockFields);

  // Act: Render component and interact
  render(<App />);

  await waitFor(() => {
    // Assert: Check expectations
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });
});
```

## Troubleshooting

### Tests failing to import modules

Make sure all dependencies are installed:
```bash
npm install
```

### Babel errors

Ensure `test/.babelrc` is present with the correct presets.

### Module not found errors

Check that `test/jest.config.js` has the correct `moduleNameMapper` configuration.

### Async warnings

Always use `waitFor()` when testing async behavior (data fetching, state updates).
