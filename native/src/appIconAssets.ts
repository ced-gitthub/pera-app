import type { ImageSourcePropType } from 'react-native';
import type { AppIconName } from './appIcon';

// Static requires only (Metro needs literal paths).
export const APP_ICON_PREVIEWS: Record<AppIconName, ImageSourcePropType> = {
  Lime: require('../assets/icons/lime/preview.png'),
  Ocean: require('../assets/icons/ocean/preview.png'),
  Sunset: require('../assets/icons/sunset/preview.png'),
  Grape: require('../assets/icons/grape/preview.png'),
  Rose: require('../assets/icons/rose/preview.png'),
  Mint: require('../assets/icons/mint/preview.png'),
};
