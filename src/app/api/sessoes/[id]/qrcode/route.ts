import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { gerarQRCode } from "@/lib/qrcode";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const sessao = await prisma.sessao.findUnique({ where: { id }, select: { codigo: true } });
  if (!sessao) return NextResponse.json({ erro: "Sessão não encontrada" }, { status: 404 });

  const qrDataUrl = await gerarQRCode(sessao.codigo);
  return NextResponse.json({ codigo: sessao.codigo, qrDataUrl });
}
