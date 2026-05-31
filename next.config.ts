import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a minimal standalone server bundle for small production Docker images.
  output: "standalone",
};

export default nextConfig;
