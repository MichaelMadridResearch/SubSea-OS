/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@subsea/ui", "@subsea/contracts", "@subsea/demo-data"],
  async rewrites() {
    const target = process.env.API_PROXY_TARGET ?? "http://localhost:8000";
    return [{ source: "/backend/:path*", destination: `${target}/:path*` }];
  },
};

export default nextConfig;
