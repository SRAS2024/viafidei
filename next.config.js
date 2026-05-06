/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: "standalone",
  experimental: {
    instrumentationHook: true,
    // The Next.js standalone tracer (NFT) only follows static `require`
    // calls, so it misses the platform-specific native binary that
    // `argon2` resolves at runtime via `node-gyp-build`. Without these
    // globs, every route that touches the auth library —
    // /api/auth/login, /api/auth/register, /admin/login, and any page
    // that imports from `@/lib/auth` — crashes with
    // "No native build was found for platform=linux ..." in production.
    outputFileTracingIncludes: {
      "*": [
        "./node_modules/argon2/prebuilds/**/*",
        "./node_modules/argon2/argon2.cjs",
        "./node_modules/argon2/package.json",
      ],
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
