import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: { authInterrupts: true, serverActions: { bodySizeLimit: "4mb" } },
  allowedDevOrigins: ["192.168.0.15", "*.ngrok-free.app"],
};

export default nextConfig;
