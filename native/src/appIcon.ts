// Launcher icon colour: pure rules (no react-native) so tests can check them. The phone call lives in appIconApi.ts.
import type { ThemeId } from './themeLogic.ts';

export const APP_ICON_NAMES = ['Lime', 'Ocean', 'Sunset', 'Grape', 'Rose', 'Mint'] as const;
export type AppIconName = (typeof APP_ICON_NAMES)[number];
export const DEFAULT_APP_ICON: AppIconName = 'Lime';
export const APP_ICON_KEY = 'zv_app_icon';

export const isAppIconName = (x: unknown): x is AppIconName => typeof x === 'string' && (APP_ICON_NAMES as readonly string[]).includes(x);
export const resolveAppIcon = (x: unknown): AppIconName => (isAppIconName(x) ? x : DEFAULT_APP_ICON);

const THEME_TO_ICON: Partial<Record<string, AppIconName>> = {
  lime: 'Lime',
  ocean: 'Ocean',
  sunset: 'Sunset',
  grape: 'Grape',
  rose: 'Rose',
  mint: 'Mint',
};
/** The icon that matches a theme. Themes without a colour twin (mono, daylight) and unknown ids use the default. */
export const iconForTheme = (id: ThemeId | string): AppIconName => THEME_TO_ICON[id] ?? DEFAULT_APP_ICON;

export type IconStore = { getItem(k: string): Promise<string | null>; setItem(k: string, v: string): Promise<void> };
export type IconDeps = {
  store: IconStore;
  supported: boolean;
  setNative: (name: AppIconName) => Promise<unknown>;
  getNative: () => string | null;
};

const UNSUPPORTED = 'Changing the app icon is only available in the Android app.';
const FAILED = 'Could not change the app icon. Please try again.';

/** Builds the icon API from injected parts. Nothing here throws; failures come back as a friendly message. */
export function createAppIconApi(d: IconDeps) {
  return {
    supported: d.supported,
    /** Returns null on success, otherwise a message to show. */
    async setAppIcon(name: unknown): Promise<string | null> {
      if (!d.supported) return UNSUPPORTED;
      if (!isAppIconName(name)) return 'That icon is not available.';
      try {
        await d.setNative(name);
      } catch {
        return FAILED;
      }
      try {
        await d.store.setItem(APP_ICON_KEY, name); // the phone's own value can be null after a cold start, so remember it too
      } catch {
        /* the icon did change; losing the memo only costs the checkmark after a restart */
      }
      return null;
    },
    /** The icon in use, or null when the original launcher icon is still showing. */
    async currentAppIcon(): Promise<AppIconName | null> {
      if (!d.supported) return null;
      try {
        const n = d.getNative();
        if (isAppIconName(n)) return n;
      } catch {
        /* fall through to the remembered choice */
      }
      try {
        const v = await d.store.getItem(APP_ICON_KEY);
        return isAppIconName(v) ? v : null;
      } catch {
        return null;
      }
    },
  };
}
