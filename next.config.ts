import type { NextConfig } from 'next'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const withPWA = require('next-pwa')

const nextConfig: NextConfig = {
  serverExternalPackages: ['node-ical'],
  turbopack: {},
  // Allow loading the dev server from your phone over the LAN (same Wi-Fi).
  allowedDevOrigins: ['192.168.1.224'],
}

export default withPWA({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
})(nextConfig)