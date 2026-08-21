import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // الصورة الشخصية حتى 5MB + الغلاف حتى 8MB في نفس الفورم،
      // مع هامش بسيط لبيانات multipart وبقية الحقول.
      bodySizeLimit: "15mb",
    },
  },
};

export default nextConfig;
