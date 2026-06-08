import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "http://192.168.8.140:3000",
    "192.168.8.140",
  ],
};

export default nextConfig;