import { APK_URL } from '@/lib/site';
import { SITE_URL } from '@/lib/siteUrl';
import { SITE_NAME, TAGLINE } from '@/lib/landingCopy';
// Structured data for search engines. Only facts that are true: no ratings or reviews.
export const jsonLd = () =>
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
  }).replace(/</g, '\u003c');
