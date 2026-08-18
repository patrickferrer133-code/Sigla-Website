import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Matches the 100MB video cap in lib/content/service.ts's uploadPostMedia —
    // the default 1MB Server Action body limit rejects any real video upload.
    serverActions: {
      bodySizeLimit: "100mb",
    },
  },
};

export default nextConfig;
