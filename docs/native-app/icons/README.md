# Changing the launcher icon colour (Android) - feasibility + prototype

Verdict: **GO, low-to-medium risk.** Prototype built in an isolated copy (`C:\zb2\native`). `assembleRelease` (arm64-v8a) succeeded and the built APK's manifest contains the 6 `activity-alias` entries. **Not run on a phone** (no device or emulator available), so runtime behaviour is untested; see the test plan.

## Approach
Package: **`expo-alternate-app-icons@8.0.0`** (pchalupa, MIT, published 2026-02-25, peer `expo >= 53`, Android + iOS, config plugin included, **no eject needed**, works with `expo prebuild`).
It writes one `<activity-alias>` per icon (disabled), generates the mipmap and adaptive-icon XML per icon, and ships a ~70-line Kotlin Expo module that calls `PackageManager.setComponentEnabledSetting(..., DONT_KILL_APP)`.

Rejected: `@abumalick/expo-dynamic-app-icon` (peer `expo ^52`, last release 2025-05) and `expo-dynamic-app-icon` (last release 2023-07). Writing our own plugin + module would be ~150 lines (the package is exactly that), so no reason to; it is small enough to vendor if the package is ever abandoned.

## Prototype result
- `npx expo prebuild --platform android --no-install --clean`: OK. `native/android` is git-ignored, so generated files are not committed.
- `./gradlew.bat assembleRelease -PreactNativeArchitectures=arm64-v8a --no-daemon` in `C:\zb2\native\android`: **BUILD SUCCESSFUL** (2m47s), APK 27.7 MB, package still `com.zovixhub.pera`.
- `aapt2 dump xmltree --file AndroidManifest.xml app-release.apk`: 6 `activity-alias` (`MainActivityLime/Ocean/Sunset/Grape/Rose/Mint`), all `enabled=false`. Full dump in `built-apk-manifest.txt`.
- The copy needed `C:\zb2\src\{core,lib}` because `native/metro.config.js` watches `../src/core` and `../src/lib` (copy artefact only).

## Exact diff to apply to `native/`
`package.json` (`npx expo install expo-alternate-app-icons`, or pin):
```
"expo-alternate-app-icons": "8.0.0",
```
`app.json`:
```jsonc
"android": {
  // ...existing...
  // REQUIRED (see deep link gotcha): copies the zovix:// filter onto every alias
  "intentFilters": [{ "action": "VIEW", "category": ["DEFAULT", "BROWSABLE"], "data": [{ "scheme": "zovix" }] }]
},
"plugins": [
  "expo-web-browser",
  ["expo-build-properties", { "android": { "usesCleartextTraffic": false } }],
  ["expo-alternate-app-icons", [
    { "name": "Lime", "android": {
        "foregroundImage": "./assets/icons/lime-foreground.png",
        "backgroundImage": "./assets/icons/lime-background.png",
        "monochromeImage": "./assets/icons/lime-monochrome.png" } }
    // ...Ocean, Sunset, Grape, Rose, Mint, same shape
  ]]
]
```
Names must be PascalCase (the plugin warns otherwise). Copy `source/<name>/{foreground,background,monochrome}.png` to `native/assets/icons/<name>-{foreground,background,monochrome}.png`.

JS (`native/src/appIcon.ts`):
```ts
import { Platform } from 'react-native';
import { getAppIconName, setAlternateAppIcon, supportsAlternateIcons } from 'expo-alternate-app-icons';
export const APP_ICONS = ['Lime', 'Ocean', 'Sunset', 'Grape', 'Rose', 'Mint'] as const;
export const canChangeIcon = Platform.OS === 'android' && supportsAlternateIcons;
export const currentIcon = () => getAppIconName(); // null = default icon
export const setAppIcon = (n: (typeof APP_ICONS)[number] | null) => setAlternateAppIcon(n); // null = default
// usage: await setAppIcon('Ocean');
```
Add an "App icon" row in Settings (default + 6 swatches), wrap the call in try/catch, and show "The icon may take a few seconds to update".

## Deep link gotcha (important, found by reading the module)
Switching icons **disables the currently active component**. From the default state that is `MainActivity` itself, which is where the `zovix://` VIEW filter lives. `native/src/auth.ts` uses `zovix://auth/callback` for Google sign-in, so without the `intentFilters` lines above the callback would resolve to nothing after an icon change. With them, the filter is on every alias (verified in the built manifest: the scheme appears on MainActivity and all 6 aliases). This is the first thing to test on a phone.

## Existing assets finding
`native/assets/icon.png` and `android-icon-*.png` are still the **default Expo template art** (blue chevron). Consider shipping a real default (e.g. Grape, the brand violet `#5B2EE0`) as the base icon. `generate-icons.mjs` draws a placeholder "Z"; swap the glyph path for the real logo.

## Package id / upgrade path
No change: `com.zovixhub.pera`, same signing key, just a versionCode bump. Install-over upgrade is unaffected; existing users keep the default icon (no alias enabled by default). No new permissions.

## Limitations
- The launcher refreshes after ~1-10 s, not instantly. The app is not killed (`DONT_KILL_APP`), but some OEM launchers (Samsung, Xiaomi) may briefly close or restart the app.
- A shortcut pinned to the home screen may **disappear** on some launchers when its component is disabled (the app stays in the drawer). Tell the user in the UI. Pixel launcher normally swaps it in place.
- Android 8+ adaptive icons work; the themed (monochrome) icon works on Android 13+; Android 7 and below get a legacy square PNG.
- Only the launcher icon changes: notification icon, splash and in-app colours are independent. The label stays "Zovix".
- `getAppIconName()` reads the current Activity's component; after a cold start via a deep link straight to `.MainActivity` it may return null. Also persist the choice (AsyncStorage) and treat the native value as a hint.

## Test plan (real phone, release APK)
1. Install over an existing build: app opens, data intact, default icon unchanged.
2. Settings > App icon > Ocean: drawer icon changes within ~10 s, app keeps running. Repeat for each colour, then back to default.
3. Kill and relaunch from the new icon: opens normally; `getAppIconName()` returns the chosen name.
4. Reboot: choice persists and only ONE launcher entry exists (no duplicates).
5. Google sign-in after changing the icon: the callback returns to the app and signs in.
6. `adb shell am start -a android.intent.action.VIEW -d "zovix://auth/callback"` with an alias enabled opens the app.
7. Pinned home-screen shortcut: does it survive on the test phone(s)?
8. Android 13+ themed icons show the monochrome Z.
9. Install a later build over one with an alias enabled: the chosen icon persists.

## Risk summary
Low: small, MIT, recently released package; Android release build proven. Medium: OEM launcher quirks (pinned shortcut vanishes, brief restart), the deep-link filter (mitigated, needs phone test), single maintainer (mitigation: vendor the Kotlin module). Cost stays $0. Estimated effort: about half a day including Settings UI and phone test.

## Files
- `generate-icons.mjs` (needs `sharp`: `NODE_PATH=<native>/node_modules node generate-icons.mjs`)
- `source/<lime|ocean|sunset|grape|rose|mint>/{foreground,background,monochrome,preview}.png` (1024x1024)
- `built-apk-manifest.txt` (aapt2 dump of the built APK manifest)
