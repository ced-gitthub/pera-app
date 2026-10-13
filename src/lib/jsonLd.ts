import { APK_URL } from '@/lib/site';
import { SITE_URL } from '@/lib/siteUrl';
import { SITE_NAME, TAGLINE } from '@/lib/landingCopy';
// Safe to put inside a <script type="application/ld+json"> tag: no "<", ">", "&" or line-separator characters can appear, so no value can close the tag.
export const escapeJsonForHtml = (json: string) =>
  json.replace(/[<>&\u2028\u2029]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
// Structured data for search engines. Only facts that are true: no ratings or reviews.
export const jsonLd = () =>
  escapeJsonForHtml(
    JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: SITE_NAME,
      description: TAGLINE + ' A free money tracker for Filipinos.',
      applicationCategory: 'FinanceApplication',
      operatingSystem: 'Android',
      inLanguage: 'en-PH',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'PHP' },
      downloadUrl: SITE_URL + APK_URL,
      url: SITE_URL,
    }),
  );
