import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST — criar pergunta
export async function POST(req: NextRequest) {
  const { sessaoId, slideId, tipo, enunciado, opcoes } = await req.json();

  if (!sessaoId || !enunciado || !opcoes?.length) {
    return NextResponse.json({ erro: "sessaoId, enunciado e opcoes são obrigatórios" }, { status: 400 });
  }

  const maxOrdem = await prisma.pergunta.aggregate({
    where: { sessaoId },
    _max: { ordem: true },
  });

  const pergunta = await prisma.pergunta.create({
    data: {
      sessaoId,
      slideId: slideId || null,
      tipo: tipo || "enquete",
      enunciado,
      ordem: (maxOrdem._max.ordem || 0) + 1,
      opcoes: {
        create: opcoes.map((o: { letra: string; texto: string; correta?: boolean }) => ({
          letra: o.letra,
          texto: o.texto,
          correta: o.correta || false,
        })),
      },
    },
    include: { opcoes: true },
  });

  return NextResponse.json(pergunta, { status: 201 });
}
