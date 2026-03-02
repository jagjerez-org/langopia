import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@langopia/shared", "@langopia/ai-pipeline"],
  serverExternalPackages: ["typeorm", "reflect-metadata", "pg", "livekit-server-sdk", "openai", "stripe", "bcryptjs", "elevenlabs", "@aws-sdk/client-s3", "pdf-parse", "resend"],

};

export default nextConfig;
