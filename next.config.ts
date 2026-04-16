import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack is the default in Next 16 for both dev and build. We keep its
  // config empty for now; Task 10 may add `turbopack.resolveAlias` if the
  // client-side PDF.js worker needs it. The empty object also silences Next's
  // "webpack config without turbopack config" build error.
  turbopack: {},
  // Webpack hook is retained for non-Turbopack builds (e.g. `next build
  // --webpack`). `pdfjs-dist` optionally imports Node's `canvas` package; we
  // only use PDF.js client-side, so alias it to `false` to skip that import.
  webpack: (config) => {
    config.resolve ||= {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      canvas: false,
    };
    return config;
  },
};

export default nextConfig;
