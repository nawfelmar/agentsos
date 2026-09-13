/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Browser talks to same origin; Next proxies to the control plane.
  // Required when only :3000 is port-forwarded (user laptop ≠ VM localhost).
  async rewrites() {
    const upstream = process.env.AGENTOS_API_UPSTREAM || "http://127.0.0.1:8080";
    return [
      {
        source: "/cp-api/:path*",
        destination: `${upstream}/:path*`,
      },
    ];
  },
};
module.exports = nextConfig;
