import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@langopia/shared", "@langopia/ai-pipeline", "@langopia/api-client"],
  serverExternalPackages: ["typeorm", "reflect-metadata", "pg", "livekit-server-sdk", "openai", "stripe", "elevenlabs", "@aws-sdk/client-s3", "pdf-parse", "pdfjs-dist", "resend", "pgvector", "officeparser"],

};

export default nextConfig;
