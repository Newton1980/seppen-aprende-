import QRCode from "qrcode";

export async function gerarQRCode(codigo: string): Promise<string> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const url = `${baseUrl}/entrar/${codigo}`;
  return QRCode.toDataURL(url, {
    width: 300,
    margin: 2,
    color: { dark: "#063852", light: "#ffffff" },
  });
}
