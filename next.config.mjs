/** @type {import('next').NextConfig} */
// Browsers talk to Supabase directly, so its origin has to be allowed by the CSP.
const supabaseUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co');
const supabaseOrigins = `${supabaseUrl.origin} wss://${supabaseUrl.host}`;

const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  serverExternalPackages: ['pdf-parse-fork'],

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Content-Security-Policy',
            value: `
              default-src 'self';
              script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdn.vercel-insights.com;
              style-src 'self' 'unsafe-inline';
              img-src 'self' data: blob: https:;
              font-src 'self' data:;
              connect-src 'self' ${supabaseOrigins};
              frame-ancestors 'none';
            `.replace(/\s{2,}/g, ' ').trim(),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
