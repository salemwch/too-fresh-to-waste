Running "FoodWasteApp" with {"rootTag":11} environment.ts:177 [Environment] API
Configuration: Object console.js:661 The app is running using the Legacy
Architecture. The Legacy Architecture is deprecated and will be removed in a
future version of React Native. Please consider migrating to the New
Architecture. For more information, please see
https://reactnative.dev/blog/2024/10/23/the-new-architecture-is-here anonymous @
console.js:661 overrideMethod @ backend.js:17416 anonymous @
setUpDeveloperTools.js:42 registerWarning @ LogBox.js:222 anonymous @
LogBox.js:84 warnOnce @ warnOnce.js:27 renderApplication @
renderApplication.js:111 anonymous @ AppRegistryImpl.js:89 runApplication @
AppRegistryImpl.js:178 **callFunction @ MessageQueue.js:435 anonymous @
MessageQueue.js:114 **guard @ MessageQueue.js:369 callFunctionReturnFlushedQueue
@ MessageQueue.js:113 index.ts:113 Store state updated: Object logger.ts:88
[2025-12-22T16:57:50.902Z] [INFO] Initializing TanStack Query Provider
logger.ts:88 [2025-12-22T16:57:50.904Z] [INFO] Initializing TanStack Query
platform managers logger.ts:88 [2025-12-22T16:57:50.905Z] [INFO] Setting up
TanStack Query Online Manager logger.ts:88 [2025-12-22T16:57:50.907Z] [INFO]
Online Manager setup complete logger.ts:88 [2025-12-22T16:57:50.909Z] [INFO]
Setting up TanStack Query Focus Manager logger.ts:88 [2025-12-22T16:57:50.910Z]
[INFO] Focus Manager setup complete logger.ts:88 [2025-12-22T16:57:50.911Z]
[INFO] Platform managers initialized successfully logger.ts:88
[2025-12-22T16:57:50.912Z] [INFO] TanStack Query Provider initialized
index.ts:113 Store state updated: Object authSlice.ts:532 [STATE-DRIVEN NAV] No
stored session, flowState = unauthenticated index.ts:113 Store state updated:
Object RootNavigator.tsx:166 [STATE-DRIVEN NAV] Current flowState:
unauthenticated index.ts:113 Store state updated: Objectauth: {user: {…},
tokens: null, isAuthenticated: false, lastLoginTime: null, sessionExpiresAt:
null, flowState: 'unauthenticated', pendingVerificationEmail:
'salemwachwacha@outlook.fr', isLoading: false, error: undefined}error:
undefinedflowState: "unauthenticated"isAuthenticated: falseisLoading:
falselastLoginTime: nullpendingVerificationEmail:
"salemwachwacha@outlook.fr"sessionExpiresAt: nulltokens: nulluser: {email:
'salemwachwacha@outlook.fr', firstName: 'salem', lastName: 'wachwacha', role:
'consumer', status: 'pending', isEmailVerified: false, isPhoneVerified: false,
tokenRevocationVersion: 0, phoneVerificationAttempts: 0, profileImage:
null, …}[[Prototype]]: Object*persist: {version: -1, rehydrated:
true}[[Prototype]]: Object Welcome to React Native DevTools Debugger
integration: Android Bridge (ReactInstanceManagerInspectorTarget)
RegisterScreen.tsx:48 🔵 RegisterScreen RENDERED RegisterScreen.tsx:89 🟢
RegisterScreen MOUNTED RegisterScreen.tsx:197 RegisterScreen: Form validation
failed RegisterScreen.tsx:48 🔵 RegisterScreen RENDERED RegisterScreen.tsx:197
RegisterScreen: Form validation failed RegisterScreen.tsx:48 🔵 RegisterScreen
RENDERED RegisterScreen.tsx:197 RegisterScreen: Form validation failed
RegisterScreen.tsx:48 🔵 RegisterScreen RENDERED RegisterScreen.tsx:197
RegisterScreen: Form validation failed RegisterScreen.tsx:48 🔵 RegisterScreen
RENDERED RegisterScreen.tsx:197 RegisterScreen: Form validation failed
RegisterScreen.tsx:48 🔵 RegisterScreen RENDERED 61RegisterScreen.tsx:48 🔵
RegisterScreen RENDERED RegisterScreen.tsx:48 🔵 RegisterScreen RENDERED
RegisterScreen.tsx:48 🔵 RegisterScreen RENDERED RegisterScreen.tsx:211 =====
REGISTRATION FLOW START ===== RegisterScreen.tsx:212 RegisterScreen: Starting
registration for: salemwachwacha@outlook.fr RegisterScreen.tsx:213
RegisterScreen: Full registration data (password hidden): {email:
'salemwachwacha@outlook.fr', password: '[HIDDEN]', firstName: 'salem', lastName:
'wachwacha', role: 'consumer'} index.ts:113 Store state updated: {auth: {…},
\_persist: {…}} authSlice.ts:70 ===== REDUX THUNK: registerAsync started =====
logger.ts:88 [2025-12-22T16:59:15.495Z] [INFO] Registration attempt started |
Context: {"email":"salemwachwacha@outlook.fr"} authSlice.ts:72 AuthSlice:
Calling authService.register()... authService.ts:252 ===== AUTH SERVICE:
register() called ===== logger.ts:88 [2025-12-22T16:59:15.531Z] [INFO]
Attempting user registration | Context: {"email":"salemwachwacha@outlook.fr"}
authService.ts:255 AuthService: Sending registration request to backend...
RegisterScreen.tsx:93 🔴 RegisterScreen UNMOUNTING logger.ts:91
[2025-12-22T16:59:15.623Z] [WARN] Network response received: 409 | Context:
{"url":"http://10.0.2.2:3000/api/v1/auth/register","status":409,"duration":85}
undefined anonymous @ console.js:661 overrideMethod @ backend.js:17416 anonymous
@ setUpDeveloperTools.js:42 registerWarning @ LogBox.js:222 anonymous @
LogBox.js:84 logToConsole @ logger.ts:91 warn @ logger.ts:162 logResponse @
logger.ts:310 handleRequestError @ authService.ts:95 ?anon_0* @
authService.ts:84 asyncGeneratorStep @ asyncToGenerator.js:3 _throw @
asyncToGenerator.js:20 anonymous @ JSTimers.js:249 \_callTimer @ JSTimers.js:112
\_callReactNativeMicrotasksPass @ JSTimers.js:162 callReactNativeMicrotasks @
JSTimers.js:417 **callReactNativeMicrotasks @ MessageQueue.js:394 anonymous @
MessageQueue.js:133 **guard @ MessageQueue.js:369 flushedQueue @
MessageQueue.js:132 callFunctionReturnFlushedQueue @ MessageQueue.js:117
authService.ts:147 [authService] Extracted error message: User with this email
already exists authService.ts:148 [authService] Status: 409 authSlice.ts:90
===== REDUX THUNK: registerAsync caught error ===== authSlice.ts:91 AuthSlice:
Registration error caught: Error: User with this email already exists at
handleHttpError
(http://10.0.2.2:8081/index.bundle//&platform=android&dev=true&lazy=true&minify=false&app=com.foodwasteapp&modulesOnly=false&runModule=true&excludeSource=true&sourcePaths=url-server:151685:26)
at handleRequestError
(http://10.0.2.2:8081/index.bundle//&platform=android&dev=true&lazy=true&minify=false&app=com.foodwasteapp&modulesOnly=false&runModule=true&excludeSource=true&sourcePaths=url-server:151597:31)
at ?anon_0_
(http://10.0.2.2:8081/index.bundle//&platform=android&dev=true&lazy=true&minify=false&app=com.foodwasteapp&modulesOnly=false&runModule=true&excludeSource=true&sourcePaths=url-server:151578:36)
at throw (native) at asyncGeneratorStep
(http://10.0.2.2:8081/index.bundle//&platform=android&dev=true&lazy=true&minify=false&app=com.foodwasteapp&modulesOnly=false&runModule=true&excludeSource=true&sourcePaths=url-server:22847:19)
at _throw
(http://10.0.2.2:8081/index.bundle//&platform=android&dev=true&lazy=true&minify=false&app=com.foodwasteapp&modulesOnly=false&runModule=true&excludeSource=true&sourcePaths=url-server:22864:29)
at tryCallOne (address at InternalBytecode.js:1:1180) at anonymous (address at
InternalBytecode.js:1:1874) at apply (native) at anonymous
(http://10.0.2.2:8081/index.bundle//&platform=android&dev=true&lazy=true&minify=false&app=com.foodwasteapp&modulesOnly=false&runModule=true&excludeSource=true&sourcePaths=url-server:26647:26)
at \_callTimer
(http://10.0.2.2:8081/index.bundle//&platform=android&dev=true&lazy=true&minify=false&app=com.foodwasteapp&modulesOnly=false&runModule=true&excludeSource=true&sourcePaths=url-server:26565:17)
at \_callReactNativeMicrotasksPass
(http://10.0.2.2:8081/index.bundle//&platform=android&dev=true&lazy=true&minify=false&app=com.foodwasteapp&modulesOnly=false&runModule=true&excludeSource=true&sourcePaths=url-server:26595:17)
at callReactNativeMicrotasks
(http://10.0.2.2:8081/index.bundle//&platform=android&dev=true&lazy=true&minify=false&app=com.foodwasteapp&modulesOnly=false&runModule=true&excludeSource=true&sourcePaths=url-server:26759:44)
at **callReactNativeMicrotasks
(http://10.0.2.2:8081/index.bundle//&platform=android&dev=true&lazy=true&minify=false&app=com.foodwasteapp&modulesOnly=false&runModule=true&excludeSource=true&sourcePaths=url-server:2768:48)
at anonymous
(http://10.0.2.2:8081/index.bundle//&platform=android&dev=true&lazy=true&minify=false&app=com.foodwasteapp&modulesOnly=false&runModule=true&excludeSource=true&sourcePaths=url-server:2579:45)
at **guard
(http://10.0.2.2:8081/index.bundle//&platform=android&dev=true&lazy=true&minify=false&app=com.foodwasteapp&modulesOnly=false&runModule=true&excludeSource=true&sourcePaths=url-server:2751:15)
at flushedQueue
(http://10.0.2.2:8081/index.bundle//&platform=android&dev=true&lazy=true&minify=false&app=com.foodwasteapp&modulesOnly=false&runModule=true&excludeSource=true&sourcePaths=url-server:2578:21)
at callFunctionReturnFlushedQueue
(http://10.0.2.2:8081/index.bundle//&platform=android&dev=true&lazy=true&minify=false&app=com.foodwasteapp&modulesOnly=false&runModule=true&excludeSource=true&sourcePaths=url-server:2563:33)
anonymous @ console.js:661 overrideMethod @ backend.js:17416
reactConsoleErrorHandler @ ExceptionsManager.js:184 anonymous @
setUpDeveloperTools.js:42 ?anon_0_ @ authSlice.ts:91 asyncGeneratorStep @
asyncToGenerator.js:3 _throw @ asyncToGenerator.js:20 anonymous @
JSTimers.js:249 \_callTimer @ JSTimers.js:112 \_callReactNativeMicrotasksPass @
JSTimers.js:162 callReactNativeMicrotasks @ JSTimers.js:417
**callReactNativeMicrotasks @ MessageQueue.js:394 anonymous @
MessageQueue.js:133 **guard @ MessageQueue.js:369 flushedQueue @
MessageQueue.js:132 callFunctionReturnFlushedQueue @ MessageQueue.js:117
authSlice.ts:92 AuthSlice: Error type: object anonymous @ console.js:661
overrideMethod @ backend.js:17416 reactConsoleErrorHandler @
ExceptionsManager.js:184 anonymous @ setUpDeveloperTools.js:42 ?anon_0_ @
authSlice.ts:92 asyncGeneratorStep @ asyncToGenerator.js:3 _throw @
asyncToGenerator.js:20 anonymous @ JSTimers.js:249 \_callTimer @ JSTimers.js:112
\_callReactNativeMicrotasksPass @ JSTimers.js:162 callReactNativeMicrotasks @
JSTimers.js:417 **callReactNativeMicrotasks @ MessageQueue.js:394 anonymous @
MessageQueue.js:133 **guard @ MessageQueue.js:369 flushedQueue @
MessageQueue.js:132 callFunctionReturnFlushedQueue @ MessageQueue.js:117
authSlice.ts:93 AuthSlice: Error message: User with this email already exists
anonymous @ console.js:661 overrideMethod @ backend.js:17416
reactConsoleErrorHandler @ ExceptionsManager.js:184 anonymous @
setUpDeveloperTools.js:42 ?anon_0_ @ authSlice.ts:93 asyncGeneratorStep @
asyncToGenerator.js:3 _throw @ asyncToGenerator.js:20 anonymous @
JSTimers.js:249 \_callTimer @ JSTimers.js:112 \_callReactNativeMicrotasksPass @
JSTimers.js:162 callReactNativeMicrotasks @ JSTimers.js:417
**callReactNativeMicrotasks @ MessageQueue.js:394 anonymous @
MessageQueue.js:133 **guard @ MessageQueue.js:369 flushedQueue @
MessageQueue.js:132 callFunctionReturnFlushedQueue @ MessageQueue.js:117
logger.ts:94 [2025-12-22T16:59:15.633Z] [ERROR] Registration failed | Context:
{"email":"salemwachwacha@outlook.fr"} Error: User with this email already exists
at handleHttpError
(http://10.0.2.2:8081/index.bundle//&platform=android&dev=true&lazy=true&minify=false&app=com.foodwasteapp&modulesOnly=false&runModule=true&excludeSource=true&sourcePaths=url-server:151685:26)
at handleRequestError
(http://10.0.2.2:8081/index.bundle//&platform=android&dev=true&lazy=true&minify=false&app=com.foodwasteapp&modulesOnly=false&runModule=true&excludeSource=true&sourcePaths=url-server:151597:31)
at ?anon_0_
(http://10.0.2.2:8081/index.bundle//&platform=android&dev=true&lazy=true&minify=false&app=com.foodwasteapp&modulesOnly=false&runModule=true&excludeSource=true&sourcePaths=url-server:151578:36)
at throw (native) at asyncGeneratorStep
(http://10.0.2.2:8081/index.bundle//&platform=android&dev=true&lazy=true&minify=false&app=com.foodwasteapp&modulesOnly=false&runModule=true&excludeSource=true&sourcePaths=url-server:22847:19)
at _throw
(http://10.0.2.2:8081/index.bundle//&platform=android&dev=true&lazy=true&minify=false&app=com.foodwasteapp&modulesOnly=false&runModule=true&excludeSource=true&sourcePaths=url-server:22864:29)
at tryCallOne (address at InternalBytecode.js:1:1180) at anonymous (address at
InternalBytecode.js:1:1874) at apply (native) at anonymous
(http://10.0.2.2:8081/index.bundle//&platform=android&dev=true&lazy=true&minify=false&app=com.foodwasteapp&modulesOnly=false&runModule=true&excludeSource=true&sourcePaths=url-server:26647:26)
at \_callTimer
(http://10.0.2.2:8081/index.bundle//&platform=android&dev=true&lazy=true&minify=false&app=com.foodwasteapp&modulesOnly=false&runModule=true&excludeSource=true&sourcePaths=url-server:26565:17)
at \_callReactNativeMicrotasksPass
(http://10.0.2.2:8081/index.bundle//&platform=android&dev=true&lazy=true&minify=false&app=com.foodwasteapp&modulesOnly=false&runModule=true&excludeSource=true&sourcePaths=url-server:26595:17)
at callReactNativeMicrotasks
(http://10.0.2.2:8081/index.bundle//&platform=android&dev=true&lazy=true&minify=false&app=com.foodwasteapp&modulesOnly=false&runModule=true&excludeSource=true&sourcePaths=url-server:26759:44)
at **callReactNativeMicrotasks
(http://10.0.2.2:8081/index.bundle//&platform=android&dev=true&lazy=true&minify=false&app=com.foodwasteapp&modulesOnly=false&runModule=true&excludeSource=true&sourcePaths=url-server:2768:48)
at anonymous
(http://10.0.2.2:8081/index.bundle//&platform=android&dev=true&lazy=true&minify=false&app=com.foodwasteapp&modulesOnly=false&runModule=true&excludeSource=true&sourcePaths=url-server:2579:45)
at **guard
(http://10.0.2.2:8081/index.bundle//&platform=android&dev=true&lazy=true&minify=false&app=com.foodwasteapp&modulesOnly=false&runModule=true&excludeSource=true&sourcePaths=url-server:2751:15)
at flushedQueue
(http://10.0.2.2:8081/index.bundle//&platform=android&dev=true&lazy=true&minify=false&app=com.foodwasteapp&modulesOnly=false&runModule=true&excludeSource=true&sourcePaths=url-server:2578:21)
at callFunctionReturnFlushedQueue
(http://10.0.2.2:8081/index.bundle//&platform=android&dev=true&lazy=true&minify=false&app=com.foodwasteapp&modulesOnly=false&runModule=true&excludeSource=true&sourcePaths=url-server:2563:33)
anonymous @ console.js:661 overrideMethod @ backend.js:17416
reactConsoleErrorHandler @ ExceptionsManager.js:184 anonymous @
setUpDeveloperTools.js:42 logToConsole @ logger.ts:94 error @ logger.ts:176
?anon_0_ @ authSlice.ts:98 asyncGeneratorStep @ asyncToGenerator.js:3 _throw @
asyncToGenerator.js:20 anonymous @ JSTimers.js:249 \_callTimer @ JSTimers.js:112
\_callReactNativeMicrotasksPass @ JSTimers.js:162 callReactNativeMicrotasks @
JSTimers.js:417 **callReactNativeMicrotasks @ MessageQueue.js:394 anonymous @
MessageQueue.js:133 **guard @ MessageQueue.js:369 flushedQueue @
MessageQueue.js:132 callFunctionReturnFlushedQueue @ MessageQueue.js:117
authSlice.ts:105 AuthSlice: Rejecting with value: {message: 'User with this
email already exists'} authSlice.ts:106 ===== REDUX THUNK: registerAsync
returning rejection ===== index.ts:113 Store state updated: {auth: {…},
\_persist: {…}} RootNavigator.tsx:166 [STATE-DRIVEN NAV] Current flowState:
unauthenticated RegisterScreen.tsx:219 RegisterScreen: Dispatch result: {type:
'auth/register/rejected', payload: {…}, meta: {…}, error: {…}}
RegisterScreen.tsx:220 RegisterScreen: Dispatch result type:
auth/register/rejected RegisterScreen.tsx:221 RegisterScreen: Dispatch result
payload: {message: 'User with this email already exists'} RegisterScreen.tsx:224
RegisterScreen: Extracted payload: {message: 'User with this email already
exists'} RegisterScreen.tsx:227 RegisterScreen: Registration was REJECTED by
Redux anonymous @ console.js:661 overrideMethod @ backend.js:17416
reactConsoleErrorHandler @ ExceptionsManager.js:184 anonymous @
setUpDeveloperTools.js:42 ?anon_0_ @ RegisterScreen.tsx:227 asyncGeneratorStep @
asyncToGenerator.js:3 _next @ asyncToGenerator.js:17 anonymous @ JSTimers.js:249
\_callTimer @ JSTimers.js:112 \_callReactNativeMicrotasksPass @ JSTimers.js:162
callReactNativeMicrotasks @ JSTimers.js:417 **callReactNativeMicrotasks @
MessageQueue.js:394 anonymous @ MessageQueue.js:133 **guard @
MessageQueue.js:369 flushedQueue @ MessageQueue.js:132
callFunctionReturnFlushedQueue @ MessageQueue.js:117 RegisterScreen.tsx:261
========================================== RegisterScreen.tsx:262 =====
REGISTRATION FLOW ERROR ===== RegisterScreen.tsx:263
========================================== RegisterScreen.tsx:267
RegisterScreen: Registration CAUGHT ERROR: User with this email already exists
RegisterScreen.tsx:268 RegisterScreen: Full error object: Error: User with this
email already exists at ?anon_0_
(http://10.0.2.2:8081/index.bundle//&platform=android&dev=true&lazy=true&minify=false&app=com.foodwasteapp&modulesOnly=false&runModule=true&excludeSource=true&sourcePaths=url-server:243170:26)
at next (native) at asyncGeneratorStep
(http://10.0.2.2:8081/index.bundle//&platform=android&dev=true&lazy=true&minify=false&app=com.foodwasteapp&modulesOnly=false&runModule=true&excludeSource=true&sourcePaths=url-server:22847:19)
at _next
(http://10.0.2.2:8081/index.bundle//&platform=android&dev=true&lazy=true&minify=false&app=com.foodwasteapp&modulesOnly=false&runModule=true&excludeSource=true&sourcePaths=url-server:22861:29)
at tryCallOne (address at InternalBytecode.js:1:1180) at anonymous (address at
InternalBytecode.js:1:1874) at apply (native) at anonymous
(http://10.0.2.2:8081/index.bundle//&platform=android&dev=true&lazy=true&minify=false&app=com.foodwasteapp&modulesOnly=false&runModule=true&excludeSource=true&sourcePaths=url-server:26647:26)
at \_callTimer
(http://10.0.2.2:8081/index.bundle//&platform=android&dev=true&lazy=true&minify=false&app=com.foodwasteapp&modulesOnly=false&runModule=true&excludeSource=true&sourcePaths=url-server:26565:17)
at \_callReactNativeMicrotasksPass
(http://10.0.2.2:8081/index.bundle//&platform=android&dev=true&lazy=true&minify=false&app=com.foodwasteapp&modulesOnly=false&runModule=true&excludeSource=true&sourcePaths=url-server:26595:17)
at callReactNativeMicrotasks
(http://10.0.2.2:8081/index.bundle//&platform=android&dev=true&lazy=true&minify=false&app=com.foodwasteapp&modulesOnly=false&runModule=true&excludeSource=true&sourcePaths=url-server:26759:44)
at **callReactNativeMicrotasks
(http://10.0.2.2:8081/index.bundle//&platform=android&dev=true&lazy=true&minify=false&app=com.foodwasteapp&modulesOnly=false&runModule=true&excludeSource=true&sourcePaths=url-server:2768:48)
at anonymous
(http://10.0.2.2:8081/index.bundle//&platform=android&dev=true&lazy=true&minify=false&app=com.foodwasteapp&modulesOnly=false&runModule=true&excludeSource=true&sourcePaths=url-server:2579:45)
at **guard
(http://10.0.2.2:8081/index.bundle//&platform=android&dev=true&lazy=true&minify=false&app=com.foodwasteapp&modulesOnly=false&runModule=true&excludeSource=true&sourcePaths=url-server:2751:15)
at flushedQueue
(http://10.0.2.2:8081/index.bundle//&platform=android&dev=true&lazy=true&minify=false&app=com.foodwasteapp&modulesOnly=false&runModule=true&excludeSource=true&sourcePaths=url-server:2578:21)
at callFunctionReturnFlushedQueue
(http://10.0.2.2:8081/index.bundle//&platform=android&dev=true&lazy=true&minify=false&app=com.foodwasteapp&modulesOnly=false&runModule=true&excludeSource=true&sourcePaths=url-server:2563:33)
anonymous @ console.js:661 overrideMethod @ backend.js:17416
reactConsoleErrorHandler @ ExceptionsManager.js:184 anonymous @
setUpDeveloperTools.js:42 ?anon_0_ @ RegisterScreen.tsx:268 asyncGeneratorStep @
asyncToGenerator.js:3 _next @ asyncToGenerator.js:17 anonymous @ JSTimers.js:249
\_callTimer @ JSTimers.js:112 \_callReactNativeMicrotasksPass @ JSTimers.js:162
callReactNativeMicrotasks @ JSTimers.js:417 **callReactNativeMicrotasks @
MessageQueue.js:394 anonymous @ MessageQueue.js:133 **guard @
MessageQueue.js:369 flushedQueue @ MessageQueue.js:132
callFunctionReturnFlushedQueue @ MessageQueue.js:117 RegisterScreen.tsx:269
RegisterScreen: Error type: object anonymous @ console.js:661 overrideMethod @
backend.js:17416 reactConsoleErrorHandler @ ExceptionsManager.js:184 anonymous @
setUpDeveloperTools.js:42 ?anon_0_ @ RegisterScreen.tsx:269 asyncGeneratorStep @
asyncToGenerator.js:3 _next @ asyncToGenerator.js:17 anonymous @ JSTimers.js:249
\_callTimer @ JSTimers.js:112 \_callReactNativeMicrotasksPass @ JSTimers.js:162
callReactNativeMicrotasks @ JSTimers.js:417 **callReactNativeMicrotasks @
MessageQueue.js:394 anonymous @ MessageQueue.js:133 **guard @
MessageQueue.js:369 flushedQueue @ MessageQueue.js:132
callFunctionReturnFlushedQueue @ MessageQueue.js:117 RegisterScreen.tsx:270
RegisterScreen: Error constructor: Error anonymous @ console.js:661
overrideMethod @ backend.js:17416 reactConsoleErrorHandler @
ExceptionsManager.js:184 anonymous @ setUpDeveloperTools.js:42 ?anon_0_ @
RegisterScreen.tsx:270 asyncGeneratorStep @ asyncToGenerator.js:3 \_next @
asyncToGenerator.js:17 anonymous @ JSTimers.js:249 \_callTimer @ JSTimers.js:112
\_callReactNativeMicrotasksPass @ JSTimers.js:162 callReactNativeMicrotasks @
JSTimers.js:417 **callReactNativeMicrotasks @ MessageQueue.js:394 anonymous @
MessageQueue.js:133 **guard @ MessageQueue.js:369 flushedQueue @
MessageQueue.js:132 callFunctionReturnFlushedQueue @ MessageQueue.js:117
RegisterScreen.tsx:271 RegisterScreen: About to set local errors state...
RegisterScreen.tsx:278 RegisterScreen: Component unmounted, skipping error state
update index.ts:113 Store state updated: {auth: {…}, \_persist: {…}}
