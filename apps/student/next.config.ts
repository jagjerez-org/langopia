import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@langopia/shared", "@langopia/api-client"],
};

export default nextConfig;
