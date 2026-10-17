import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Security: hide framework fingerprint
  poweredByHeader: false,

  // Performance: compress responses
  compress: true,

  // Image optimization: only allow trusted domains
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
    // Use WebP format by default
    formats: ["image/webp", "image/avif"],
  },

  // Strict mode for catching bugs early
  reactStrictMode: true,
};

export default nextConfig;
