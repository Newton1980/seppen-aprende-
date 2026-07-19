import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { emitirEvento } from "@/lib/pusher-server";

// GET — detalhes de uma sessão
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const sessao = await prisma.sessao.findUnique({
    where: { id },
    include: {
      slides: { orderBy: { ordem: "asc" } },
      participantes: { select: { id: true, nome: true, matricula: true, presente: true, nota: true, aprovado: true, concluiu: true, entradaEm: true } },
      perguntas: { include: { opcoes: true, _count: { select: { respostas: true } } }, orderBy: { ordem: "asc" } },
      _count: { select: { participantes: true } },
    },
  });

  if (!sessao) return NextResponse.json({ erro: "Sessão não encontrada" }, { status: 404 });
  return NextResponse.json(sessao);
}

// PATCH — atualizar sessão (avançar slide, encerrar, etc.)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  const sessao = await prisma.sessao.update({
    where: { id },
    data: body,
  });

  // Emitir eventos em tempo real
  if (body.slideAtual !== undefined) {
    await emitirEvento(id, "slide-mudou", { slideAtual: sessao.slideAtual });
  }
  if (body.ativa !== undefined) {
    await emitirEvento(id, "sessao-status", { ativa: sessao.ativa });
  }
  if (body.faseAtual !== undefined) {
    await emitirEvento(id, "fase-mudou", { faseAtual: sessao.faseAtual });
  }

  return NextResponse.json(sessao);
}
