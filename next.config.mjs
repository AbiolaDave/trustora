/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  images: { formats: ["image/avif", "image/webp"] },
  serverExternalPackages: ["mongoose", "bcryptjs"],
};
export default nextConfig;
