/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow tunnel hosts (cloudflare / localtunnel / serveo) during demos.
  experimental: {
    // Next 14.2+ may restrict cross-origin requests to /_next in some setups.
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
        ],
      },
    ];
  },
};

export default nextConfig;
