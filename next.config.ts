import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Request letters (PDF) and Excel imports are capped at 5 MB; leave room for multipart overhead.
    serverActions: { bodySizeLimit: "6mb" },
  },
};

export default nextConfig;
