import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // Proxy API calls from the browser to the backend during dev to avoid CORS issues.
  // Browser hits /api/proxy/v1/...; Next rewrites to $NEXT_PUBLIC_API_BASE_URL/...
  async rewrites() {
    const backend = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api/v1"
    return [
      {
        source: "/api/proxy/v1/:path*",
        destination: `${backend}/:path*`,
      },
    ]
  },
}

export default nextConfig
