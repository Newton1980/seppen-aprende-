import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfkit", "docxtemplater", "pizzip"],
  turbopack: {
    root: __dirname,
  },
  // Aumentar limite de upload para PDFs e templates (padrão é 1MB)
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
