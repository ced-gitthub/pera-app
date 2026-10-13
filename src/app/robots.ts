import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/siteUrl';
// Search engines may index the landing page and the privacy policy; everything else is the app or login.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/privacy'],
        disallow: [
          '/api/',
          '/auth/',
          '/login',
          '/register',
          '/code',
          '/forgot',
          '/verify',
          '/reset',
          '/2fa',
          '/export',
          '/transactions',
          '/accounts',
          '/budgets',
          '/reports',
          '/assistant',
          '/settings',
          '/security',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
