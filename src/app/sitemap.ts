import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/siteUrl';
import { landingPath } from '@/lib/site';
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL + landingPath(), changeFrequency: 'monthly', priority: 1 },
    { url: SITE_URL + '/privacy', changeFrequency: 'yearly', priority: 0.3 },
  ];
}
