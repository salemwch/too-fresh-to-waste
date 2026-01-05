/**
 * Redux Typed Hooks
 *
 * Pre-typed versions of React Redux hooks for use throughout the app.
 * Using these hooks instead of the plain `useDispatch` and `useSelector`
 * ensures proper TypeScript typing with your app's state and dispatch.
 *
 * Benefits:
 * - Automatic type inference for state in useSelector
 * - Correct dispatch types including middleware (thunks)
 * - Avoids circular import issues
 * - Simplifies component code
 *
 * @see https://react-redux.js.org/using-react-redux/usage-with-typescript
 */

import { useDispatch, useSelector, useStore } from 'react-redux';

import type { RootState, AppDispatch, AppStore } from '@/store';

/**
 * Typed version of useDispatch hook
 *
 * Use this hook throughout your app instead of the plain `useDispatch`.
 * It knows about thunks and other middleware.
 *
 * @example
 * const dispatch = useAppDispatch();
 * dispatch(loginAsync({ email, password })); // Type-safe!
 */
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();

/**
 * Typed version of useSelector hook
 *
 * Use this hook throughout your app instead of the plain `useSelector`.
 * It automatically knows your RootState type.
 *
 * @example
 * const user = useAppSelector(state => state.auth.user); // Type-safe!
 */
export const useAppSelector = useSelector.withTypes<RootState>();

/**
 * Typed version of useStore hook
 *
 * Use this hook if you need direct access to the store.
 * Generally, prefer useAppSelector and useAppDispatch instead.
 *
 * @example
 * const store = useAppStore();
 * const state = store.getState(); // Type-safe!
 */
export const useAppStore = useStore.withTypes<AppStore>();
