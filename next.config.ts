import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: false,
  images: {
    unoptimized: true,
  },
  // Skip the in-build TypeScript pass — it can take 15+ min on the staging
  // VPS and times out the deploy. Type errors are caught locally via
  // `npx tsc --noEmit` before each push, so the production build doesn't
  // need to re-run the type-checker.
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
