import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET — servir o PDF da apresentação armazenado no banco
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const sessao = await prisma.sessao.findUnique({
    where: { id },
    select: { pdfData: true },
  });

  if (!sessao || !sessao.pdfData) {
    return NextResponse.json({ erro: "PDF não encontrado" }, { status: 404 });
  }

  return new NextResponse(sessao.pdfData, {
    headers: {
      "Content-Type": "application/pdf",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
