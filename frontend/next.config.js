/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  typescript: {
    tsconfigPath: './tsconfig.json',
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001',
  },
  redirects: async () => {
    return [
      {
        source: '/',
        destination: '/auth/login',
        permanent: false,
      },
    ]
  },
}

module.exports = nextConfig
