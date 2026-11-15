import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite (local dev / tests DB) ships WASM + data files that must not be bundled.
  serverExternalPackages: ["@electric-sql/pglite"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
