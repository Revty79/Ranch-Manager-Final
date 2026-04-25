const nextConfig = {
  reactCompiler: true,
  experimental: {
    serverActions: {
      // Keep server action payload limit above our 5 MB photo validator.
      bodySizeLimit: "8mb",
    },
  },
};

export default nextConfig;
