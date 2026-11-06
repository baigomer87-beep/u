/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Make sure the knowledge/ folder is bundled with the serverless function on Vercel.
  outputFileTracingIncludes: {
    "/api/chat": ["./knowledge/**/*"],
  },
};

export default nextConfig;
