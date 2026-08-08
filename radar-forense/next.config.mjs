/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["better-sqlite3"],
  },
  webpack: (config) => {
    // @react-pdf/renderer y react-force-graph solo corren en cliente;
    // evita que webpack intente resolver módulos de Node en el bundle del navegador.
    config.resolve.fallback = { ...config.resolve.fallback, fs: false, path: false };
    return config;
  },
};

export default nextConfig;
