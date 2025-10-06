# Test Directory

This directory contains all test files and test configuration for the Jira Fields Viewer application.

## Structure

```
test/
├── .babelrc           # Babel configuration for test transpilation
├── jest.config.js     # Jest test runner configuration
├── jest.setup.js      # Jest setup file (imports test utilities)
├── index.test.jsx     # Tests for src/frontend/index.jsx
├── TEST_SETUP.md      # Detailed test setup documentation
└── README.md          # This file
```

## Quick Start

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Adding New Tests

1. Create a new `.test.jsx` file in this directory
2. Import the component/module you want to test from `../src/`
3. Write your tests following the patterns in `index.test.jsx`

## Documentation

See [TEST_SETUP.md](./TEST_SETUP.md) for detailed documentation about:
- Test structure and organization
- Mocking strategies
- Coverage thresholds
- Troubleshooting tips
