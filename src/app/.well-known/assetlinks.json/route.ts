// Digital Asset Links: proves to Android that the Play Store app and this website belong together, so the app opens full screen with no browser bar.
// Public by design. Set these two Vercel environment variables after Google Play shows your signing key:
//   ANDROID_PACKAGE_NAME             e.g. com.zovixhub.app
//   ANDROID_SHA256_CERT_FINGERPRINTS comma-separated SHA-256 fingerprints (Play app signing key, plus your upload key)
import { buildAssetLinks } from '@/lib/landing/assetlinks';

export function GET() {
  const body = buildAssetLinks(process.env.ANDROID_PACKAGE_NAME, process.env.ANDROID_SHA256_CERT_FINGERPRINTS);
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' } });
}
