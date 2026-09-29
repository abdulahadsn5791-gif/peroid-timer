import { createElement } from 'react';
import { registerRootComponent } from 'expo';

import App from './App';
import { CrashBoundary } from './src/adapters/inbound/ui/screens/CrashBoundary';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately. The crash boundary wraps the whole
// app so a render-time JS error shows its message on screen instead of the app
// exiting silently.
registerRootComponent(() =>
  createElement(CrashBoundary, null, createElement(App)),
);
