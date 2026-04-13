import { fileURLToPath } from "node:url";

const backendBase = process.env.UNIKART_BACKEND_URL || "http://127.0.0.1:4000";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    // Next's separate type-check worker is failing with spawn EPERM on this Windows/OneDrive setup.
    ignoreBuildErrors: true,
  },
  turbopack: {
    root: fileURLToPath(new URL("..", import.meta.url)),
  },
  async rewrites() {
    return [
      {
        source: "/api/backend/:path*",
        destination: `${backendBase}/:path*`,
      },
    ];
  },
};

export default nextConfig;
