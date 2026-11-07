const path = require("node:path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: "standalone",
  // Send every page's <title> with its first bytes, not streamed in after them. A
  // screen reader says the title first, and Next's route announcer reads it on every
  // client navigation: with streamed metadata the title was blank for a moment on
  // each move, so the announcer spoke over the page's own status messages. A missing
  // detail item still answers 200, not 404, because its [slug]/loading.tsx boundary
  // flushes before the not-found takes effect; it has a not-found title and noindex.
  htmlLimitedBots: /.*/,
  // Next 15 promoted `outputFileTracingIncludes` out of `experimental`
  // and the file-based `instrumentation.ts` no longer needs an
  // `experimental.instrumentationHook` flag (the runtime picks it up
  // automatically). Keeping the legacy keys in `experimental` would
  // print warnings on every build.
  //
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
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  // Next 15.5 forgets the page Back leads to on a move within a page; the loader says how.
  webpack(config) {
    config.module.rules.push({
      test: /[\\/]next[\\/]dist[\\/](esm[\\/])?client[\\/]components[\\/]router-reducer[\\/]aliased-prefetch-navigations\.js$/,
      use: path.join(__dirname, "scripts/webpack/router-keeps-back-pages-loader.js"),
    });
    // Next 15.5's React can lose a client navigation; the loader says how, and when to drop it.
    config.module.rules.push({
      test: /[\\/]next[\\/]dist[\\/]compiled[\\/]react-dom(-experimental)?[\\/]cjs[\\/]react-dom-(client|profiling)\.[a-z]+\.js$/,
      use: path.join(__dirname, "scripts/webpack/react-lost-ping-loader.js"),
    });
    return config;
  },
  async redirects() {
    return [
      // The Marian section moved from /spiritual-guidance to /our-lady.
      // Preserve old links (and any cached search/parish links) with a
      // permanent redirect.
      { source: "/spiritual-guidance", destination: "/our-lady", permanent: true },
      { source: "/spiritual-guidance/:slug*", destination: "/our-lady/:slug*", permanent: true },
    ];
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
