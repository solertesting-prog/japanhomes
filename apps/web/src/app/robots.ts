import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export default function robots(): MetadataRoute.Robots {
  // Prototype with fictional listings: crawling stays off until launch.
  if (process.env.JPT_ALLOW_INDEXING !== 'true') {
    return { rules: [{ userAgent: '*', disallow: '/' }] };
  }
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/account', '/dashboard', '/admin'] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
