import type { NextConfig } from "next";
import { withSerwist } from "@serwist/turbopack";

const nextConfig: NextConfig = {
  /* config options here */
};

// PWA: el service worker lo sirve src/app/serwist/[path]/route.ts
export default withSerwist(nextConfig);
