// Where the Android app is downloaded from. One line to change when the native app replaces the wrapper APK.
// Hosted on this site (free, never expires, no ads); a GitHub Release link would also work.
export const APK_URL = '/zovix.apk';
export const APP_NAME = 'Zovix';
// THE CUTOVER SWITCH. true = the website still works as a money tracker (login, dashboard...). false = the website is only the
// landing page for the native app and every tracker route redirects to "/". Flip it to false once the native APK is installable.
// For testing landing-only mode without a code change, set the server env var WEB_APP_ENABLED=false.
export const WEB_APP_ENABLED = true;
export function webAppEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.WEB_APP_ENABLED === 'false' ? false : WEB_APP_ENABLED;
}
