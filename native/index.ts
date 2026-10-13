import 'react-native-url-polyfill/auto';
import { registerRootComponent } from 'expo';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Load the saved theme BEFORE any screen module is evaluated (screens read colours when they load), then start the app.
// If storage fails or holds something unknown, the default theme is used.
async function start() {
  try {
    const id = await AsyncStorage.getItem('zv_theme');
    if (id) (await import('./src/uiTokens')).applyPalette(id);
  } catch {
    // default theme
  }
  const App = (await import('./src/App')).default;
  registerRootComponent(App);
}
start();
