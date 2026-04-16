/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {},
  webpack: (config, { dev }) => {
    config.resolve = { ...config.resolve, symlinks: false }
    config.externals = [...(config.externals || []), { canvas: 'canvas' }]
    if (!dev) config.cache = false

    // pdfjs worker .mjs dosyasını asset olarak kopyala, import.meta.url hatasını önle
    config.module.rules.push({
      test: /pdf\.worker(\.(min))?\.m?js$/,
      type: 'asset/resource',
      generator: { filename: 'static/worker/[name][ext]' },
    })

    return config
  },
}
module.exports = nextConfig
