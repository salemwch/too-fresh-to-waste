You are a Senior Software Tester at a professional, enterprise-grade company
(FAANG-level standards). Your task is to create production-ready, maintainable
E2E tests in TypeScript + Jest for the following function:

Target Function:

- Name: async register , verifyEMail , Login
- File: src\auth\auth.service.ts
- Lines: 37 to 115 ,116 to 140 , 141 to 234

Test File:

- add test to the empty file : src\auth\auth.service.spec.ts

Requirements:

1. **Testing Scope & Coverage** Include These Test Categories:

Positive Tests: Valid inputs producing expected outputs Negative Tests: Invalid
inputs, null/undefined handling Edge Cases: Empty arrays, zero values, maximum
limits Boundary Tests: Min/max values, off-by-one scenarios Exception Tests:
Error throwing and catching State Tests: Object state changes and mutations
Integration Points: Mock external dependencies Performance Tests: Timeout
handling, async operations Regression Tests: Previously found bugs

2. **Test Structure**
   - Use AAA (Arrange-Act-Assert) or Given-When-Then pattern.
   - One assertion per test when possible.
   - Descriptive test names following:
     `should_ExpectedBehavior_When_StateUnderTest()`.
   - Group related tests in `describe` blocks.

3. **Mocking & Isolation**
   - Mock all external dependencies (repositories, services, APIs, databases,
     push/notification services).
   - Only mock external dependencies; never mask real bugs inside the function.
   - Use `mockResolvedValue`, `mockRejectedValue`, spies, or stubs
     appropriately.
   - Ensure tests are deterministic and repeatable.

4. **Test Data**
   - Use realistic, hardcoded mock data for users, payloads, or any
     dependencies.
   - Example:
     ```ts
     const mockUser = {
       _id: '507f1f77bcf86c0012345678',
       name: 'Test User',
       devices: [{ deviceId: 'd1', token: 'tok_ios_1', platform: 'ios' }],
       pushOptIn: true,
     };
     const mockPayload = {
       title: 'Critical',
       body: 'System down',
       metadata: { foo: 'bar' },
     };
     ```

5. **Assertions & Side Effects**
   - Assert return values, state changes, and side effects (DB updates, metrics,
     flags, logging).
   - Verify calls to mocked dependencies (`jest.spyOn`, `toHaveBeenCalledWith`).
   - Avoid logging real secrets; use fake tokens and IDs.

6. **Async Handling**
   - Use `async/await` for all asynchronous code.
   - Properly handle rejected promises in tests.

7. **Test Hygiene**
   - Restore and clear mocks after each test (`jest.resetAllMocks()`,
     `jest.clearAllMocks()`).
   - Keep tests independent and readable.
   - Clean up any resources in `afterEach`.

8. **Critical Rule**
   - If tests reveal real bugs in the function → fix the function, not the test.
   - Never fake internal behavior with mocks to hide a bug.
   - Only mock external services or dependencies.

9. **Documentation**
   - After running tests, add to `auth.md` src\auth\auth.md with the following
     format:
     ```
     Description: ...
     My Testing: ...
     Test Cases:
     - Test1: Description: ... Input: ... Output: ... Expected: ... What Got: ... Status: PASS/FAIL
     - Test2: ...
     Test Quality Assessment: ...
     ```
     Short note (1–3 lines) summarizing any code fixes applied to the function.

**Output Expected**

- Full, ready-to-run Jest test file.
- 15-20 test cases minimum covering positive, negative, edge, boundary,
  exception, and performance scenarios.
- Comments explaining the strategy and reasoning behind each test.
