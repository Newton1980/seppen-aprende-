import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SEPPEN Aprende",
  description: "Apresentações interativas para capacitação institucional",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
