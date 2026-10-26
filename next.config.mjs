/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  images: { formats: ["image/avif", "image/webp"] },
  serverExternalPackages: ["mongoose", "bcryptjs", "cloudinary"],
  experimental: {
    serverActions: { bodySizeLimit: "6mb" },
  },
};
export default nextConfig;
