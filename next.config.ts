import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfkit", "docxtemplater", "pizzip"],
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
