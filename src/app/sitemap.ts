import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/landing/siteUrl';
import { landingPath } from '@/lib/landing/site';
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL + landingPath(), changeFrequency: 'monthly', priority: 1 },
    { url: SITE_URL + '/privacy', changeFrequency: 'yearly', priority: 0.3 },
  ];
}
