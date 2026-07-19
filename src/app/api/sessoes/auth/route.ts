import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST — autenticar professor por código + PIN
export async function POST(req: NextRequest) {
  const { codigo, pin } = await req.json();

  if (!codigo || !pin) {
    return NextResponse.json({ erro: "Código e PIN são obrigatórios" }, { status: 400 });
  }

  const sessao = await prisma.sessao.findUnique({
    where: { codigo: codigo.toUpperCase() },
    select: { id: true, professorPin: true, titulo: true },
  });

  if (!sessao || sessao.professorPin !== pin) {
    return NextResponse.json({ erro: "Código ou PIN incorreto" }, { status: 401 });
  }

  return NextResponse.json({ id: sessao.id, titulo: sessao.titulo });
}
