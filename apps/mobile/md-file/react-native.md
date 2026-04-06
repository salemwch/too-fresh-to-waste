example of old react-native architecture : // ❌ Sync callback from Native Module
nativeModule.getValue(value => {
// ❌ value cannot reference a native object
nativeModule.doSomething(value);
}); and this is the new architecture practice : // ✅ Sync response from Native Module
const value = nativeModule.getValue();

// ✅ value can be a reference to a native object
nativeModule.doSomething(value); ,  
 anotehr example of old architecture : Removing the bridge improves startup time by avoiding bridge
initialization. For example, in the old architecture, in order to provide global methods to JavaScript, we would need to initialize a  
 module in JavaScript on startup, causing a small delay in app startup time:

// ❌ Slow initialization
import {NativeTimingModule} from 'NativeTimingModule';
global.setTimeout = timer => {
NativeTimingModule.setTimeout(timer);
};

// App.js
setTimeout(() => {}, 100); and the new : In the New Architecture, we can directly bind methods from C++:

// ✅ Initialize directly in C++
runtime.global().setProperty(runtime, "setTimeout", createTimer);

// App.js
setTimeout(() => {}, 100); Typically, for the best user experience, a single user input should result in both an urgent update and a  
 non-urgent one. Similar to ReactDOM, events like press or change are handled as urgent and rendered immediately. You can use the
startTransition API inside an input event to inform React which updates are “transitions” and can be deferred to the background:

import {startTransition} from 'react';

// Urgent: Show the slider value
setCount(input);

// Mark any state updates inside as transitions
startTransition(() => {
// Transition: Show the results
setNumberOfTiles(input);
});After using useTransition you avoid thrashing your app with updates and falling behind.

useLayoutEffect
Building on the Event Loop and the ability to read layout synchronously, in the New Architecture we added proper support for useLayoutEffect in React Native.

In the old architecture, you needed to use the asynchronous onLayout event to read layout information of a view (which was also asynchronous). As a result there would be at least one frame where the layout was incorrect until the layout was read and updated, causing issues like tooltips placed in the wrong position:

// ❌ async onLayout after commit
const onLayout = React.useCallback(event => {
// ❌ async callback to read layout
ref.current?.measureInWindow((x, y, width, height) => {
setPosition({x, y, width, height});
});
}, []);

// ...
<ViewWithTooltip
  onLayout={onLayout}
  ref={ref}
  position={position}
/>;

The New Architecture fixes this by allowing synchronous access to layout information in useLayoutEffect:

// ✅ sync layout effect during commit
useLayoutEffect(() => {
// ✅ sync call to read layout
const rect = ref.current?.getBoundingClientRect();
setPosition(rect);
}, []);

// ...
<ViewWithTooltip ref={ref} position={position} />;

This change allows you to read layout information synchronously and update the UI in the same frame, allowing you to position elements correctly before they are displayed to the user:
In the old architecture, layout was read asynchronously in onLayout, causing the position of the tooltip to be delayed.
A view that is moving to the corners of the viewport and center with a tooltip rendered either above or below it. The view and tooltip move in unison.
In the New Architecture, layout can be read in useLayoutEffect synchronously, updating the tooltip position before displaying.
https://reactnative.dev/docs/0.75/the-new-architecture/landing-page#synchronous-layout-and-effects
Automatic Batching
When upgrading to the New Architecture, you will benefit from automatic batching from React 18.

Automatic batching allows React to batch together more state updates when rendering to avoid the rendering of intermediate states. This allows React Native to be faster and less susceptible to lags, without any additional code from the developer.

A video demonstrating an app rendering many views according to a slider input. The slider value is adjusted from 0 to 1000 and the UI slowly catches up to rendering 1000 views.
Before: rendering frequent state updates with legacy renderer.
A video demonstrating an app rendering many views according to a slider input. The slider value is adjusted from 0 to 1000 and the UI resolves to 1000 views faster than the previous example, without as many intermediate states.
After: rendering frequent state updates with automatic batching.
In the old architecture, more intermediate states are rendered, and the UI keeps updating even when the slider stops moving. The New Architecture, renders fewer intermediate states and completes the rendering much sooner thanks to automatically batching the updates.

For more information, see Support for Concurrent Renderer and Features.
an app developer, to fully support the New Architecture, you will need to upgrade your libraries, custom Native Components, and custom Native Modules to fully support the New Architecture.

We've collaborated with the most popular React Native libraries to ensure support for the New Architecture. You can check library compatibility with the New Architecture on the [reactnative.directory](https://reactnative.directory/) website.
