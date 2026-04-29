import type { NextConfig } from "next";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  output: 'export',
  // Turbopack is the default in Next 16 for both dev and build.
  // - `canvas`: pdfjs-dist optionally imports Node's `canvas` — we're purely
  //   client-side so skip it.
  // - `module`: mupdf's WASM shim does `await import("module")` inside a
  //   `typeof process.versions.node === "string"` guard that's false in the
  //   browser but which Turbopack still resolves statically. Alias it to a
  //   tiny empty-module stub so the client bundle resolves clean.
  turbopack: {
    root: projectRoot,
    resolveAlias: {
      canvas: { browser: './lib/stubs/empty.js' },
      module: { browser: './lib/stubs/empty.js' },
    },
  },
  // Webpack hook is retained for non-Turbopack builds (e.g. `next build
  // --webpack`). Same intent as above, expressed in webpack's alias dialect.
  webpack: (config) => {
    config.resolve ||= {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      canvas: false,
      module: false,
    };
    return config;
  },
};

export default nextConfig;
