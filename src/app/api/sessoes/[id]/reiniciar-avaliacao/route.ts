import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPusher } from "@/lib/pusher-server";

// POST — reinicia a avaliação final: limpa respostas, notas e volta a fase para "avaliacao"
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const sessao = await prisma.sessao.findUnique({
    where: { id },
    select: { id: true, participantes: { select: { id: true } } },
  });

  if (!sessao) return NextResponse.json({ erro: "Sessão não encontrada" }, { status: 404 });

  // 1. Deletar respostas de avaliação (tipo "avaliacao_final")
  await prisma.avaliacaoResposta.deleteMany({
    where: {
      participanteId: { in: sessao.participantes.map((p) => p.id) },
      tipo: "avaliacao_final",
    },
  });

  // 2. Deletar respostas individuais de perguntas de avaliação
  const perguntasAvaliacao = await prisma.pergunta.findMany({
    where: { sessaoId: id, tipo: "avaliacao" },
    select: { id: true },
  });

  if (perguntasAvaliacao.length > 0) {
    await prisma.respostaParticipante.deleteMany({
      where: {
        perguntaId: { in: perguntasAvaliacao.map((p) => p.id) },
      },
    });
  }

  // 3. Resetar nota/aprovado dos participantes
  await prisma.participante.updateMany({
    where: { sessaoId: id },
    data: { nota: null, aprovado: null, concluiu: false },
  });

  // 4. Voltar a fase para "avaliacao"
  await prisma.sessao.update({
    where: { id },
    data: { faseAtual: "avaliacao", ativa: true },
  });

  // 5. Notificar alunos via Pusher
  const pusher = getPusher();
  await pusher.trigger(`sessao-${id}`, "fase-mudou", { fase: "avaliacao" });

  return NextResponse.json({ ok: true, mensagem: "Avaliação reiniciada com sucesso" });
}
