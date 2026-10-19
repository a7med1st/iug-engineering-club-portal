import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(self), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Keep fewer inactive routes in memory on development machines.
  onDemandEntries: {
    maxInactiveAge: 30_000,
    pagesBufferLength: 1,
  },
  serverExternalPackages: ["@resvg/resvg-js"],
  outputFileTracingIncludes: {
    "/admin/certificates": ["./public/fonts/certificates/*.ttf"],
  },

  experimental: {
    webpackMemoryOptimizations: true,
    middlewareClientMaxBodySize: "128mb",
    serverActions: {
      // الصورة الشخصية حتى 5MB + الغلاف حتى 8MB في نفس الفورم،
      // مع هامش بسيط لبيانات multipart وبقية الحقول.
      bodySizeLimit: "15mb",
    },
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
