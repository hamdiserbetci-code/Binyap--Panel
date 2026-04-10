/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.externals = [...(config.externals || []), { canvas: 'canvas' }]

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
