// The public address of the website, for sitemap, social previews and search engines. Pinned by NEXT_PUBLIC_SITE_URL (same variable the auth links use).
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://pera-app-beta.vercel.app').replace(/\/$/, '');
