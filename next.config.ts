import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Request letters (PDF) and Excel imports are capped at 5 MB; leave room for multipart overhead.
    serverActions: { bodySizeLimit: "6mb" },
    // Keep visited pages in the browser for 30 s: going back to a page is instant.
    // (Any change you make — approve, save, import — refreshes the affected pages immediately.)
    staleTimes: { dynamic: 30 },
  },
};

export default nextConfig;
