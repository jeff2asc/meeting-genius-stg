/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Prevent Webpack from bundling these packages on the server.
  // pdf-parse v2 uses dynamic worker imports that break when bundled by Webpack.
  // NOTE: Do NOT add pdfjs-dist here — it's ESM-only and must remain bundled normally.
  serverExternalPackages: ['pdf-parse', '@napi-rs/canvas'],
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
