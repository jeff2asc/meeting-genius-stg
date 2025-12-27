/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  webpack: (config, { isServer }) => {
    // Fix for pdfjs-dist in browser
    if (!isServer) {
      config.resolve.alias.canvas = false
      config.resolve.alias.encoding = false
    }
    return config
  },
}

export default nextConfig
