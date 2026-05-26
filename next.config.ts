import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['@xenova/transformers', 'onnxruntime-node', 'sharp'],
  experimental: {
    serverActions: { bodySizeLimit: '10mb' },
  },
}

export default nextConfig
