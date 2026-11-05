import type { NextConfig } from "next";

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""} https://app.midtrans.com https://app.sandbox.midtrans.com`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.supabase.co",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.midtrans.com https://api.sandbox.midtrans.com",
      "frame-src https://app.midtrans.com https://app.sandbox.midtrans.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  // Output directory: arahkan ke root .next agar sesuai ekspektasi Vercel
  distDir: '../.next',

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

  allowedDevOrigins: ["192.168.56.1"],

  async rewrites() {
    return [
      {
        source: "/favicon.ico",
        destination: "/Fluxa-Logo.webp",
      },
    ];
  },

  async redirects() {
    return [
      {
        source: "/landingpage",
        destination: "/",
        permanent: true,
      },
    ];
  },

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
