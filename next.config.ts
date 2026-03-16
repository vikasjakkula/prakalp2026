import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use project root for Turbopack (avoids "multiple lockfiles" warning on Vercel)
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
