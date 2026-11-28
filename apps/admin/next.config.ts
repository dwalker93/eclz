import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  transpilePackages: ["@workspace/ui", "@workspace/api", "@workspace/auth", "@workspace/db", "@workspace/domain"],
  // postgres-js opens sockets; keep it out of the bundle.
  serverExternalPackages: ["postgres"],
}

export default nextConfig
