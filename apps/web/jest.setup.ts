/**
 * Global Jest setup for the web app - runs once per test file, after the
 * test framework is installed.
 *
 * Adds jest-dom's DOM matchers (toBeInTheDocument, etc.) to `expect`. Without
 * this, any test calling `.toBeInTheDocument()` fails with
 * "TypeError: expect(...).toBeInTheDocument is not a function" rather than a
 * real assertion failure - see fund-ledger-card.test.tsx, the first web test
 * in this repo to need it.
 */
import '@testing-library/jest-dom';
