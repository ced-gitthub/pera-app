import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAppIconApi, type AppIconName } from './appIcon';

type Pkg = typeof import('expo-alternate-app-icons');
// Loaded lazily and guarded so a missing native module (old build, web, iOS) can never crash the screen.
let pkg: Pkg | null = null;
if (Platform.OS === 'android') {
  try {
    pkg = require('expo-alternate-app-icons') as Pkg;
  } catch {
    pkg = null;
  }
}
const supported = !!pkg && pkg.supportsAlternateIcons === true;

const api = createAppIconApi({
  store: AsyncStorage,
  supported,
  setNative: (name: AppIconName) => pkg!.setAlternateAppIcon(name),
  getNative: () => pkg!.getAppIconName(),
});

export const canChangeAppIcon = api.supported;
export const setAppIcon = api.setAppIcon;
export const currentAppIcon = api.currentAppIcon;
