import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { emitirEvento } from "@/lib/pusher-server";

// PATCH — abrir/fechar pergunta
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  const pergunta = await prisma.pergunta.update({
    where: { id },
    data: body,
    include: { opcoes: true },
  });

  // Emitir evento para alunos
  if (body.aberta !== undefined) {
    await emitirEvento(pergunta.sessaoId, "pergunta-status", {
      perguntaId: pergunta.id,
      aberta: pergunta.aberta,
      enunciado: pergunta.enunciado,
      tipo: pergunta.tipo,
      opcoes: pergunta.opcoes.map((o) => ({ id: o.id, letra: o.letra, texto: o.texto })),
    });
  }

  return NextResponse.json(pergunta);
}

// GET — resultado da pergunta (com contagem por opção)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const pergunta = await prisma.pergunta.findUnique({
    where: { id },
    include: {
      opcoes: {
        include: { _count: { select: { respostas: true } } },
      },
      _count: { select: { respostas: true } },
    },
  });

  if (!pergunta) return NextResponse.json({ erro: "Pergunta não encontrada" }, { status: 404 });

  const totalRespostas = pergunta._count.respostas;
  const resultado = pergunta.opcoes.map((o) => ({
    id: o.id,
    letra: o.letra,
    texto: o.texto,
    correta: o.correta,
    votos: o._count.respostas,
    percentual: totalRespostas > 0 ? Math.round((o._count.respostas / totalRespostas) * 100) : 0,
  }));

  return NextResponse.json({
    id: pergunta.id,
    enunciado: pergunta.enunciado,
    tipo: pergunta.tipo,
    aberta: pergunta.aberta,
    totalRespostas,
    resultado,
  });
}
