import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { emitirEvento } from "@/lib/pusher-server";

// POST — aluno responde uma pergunta
export async function POST(req: NextRequest) {
  const { participanteToken, perguntaId, opcaoId } = await req.json();

  if (!participanteToken || !perguntaId || !opcaoId) {
    return NextResponse.json({ erro: "participanteToken, perguntaId e opcaoId são obrigatórios" }, { status: 400 });
  }

  const participante = await prisma.participante.findUnique({ where: { token: participanteToken } });
  if (!participante) return NextResponse.json({ erro: "Participante não encontrado" }, { status: 404 });

  const pergunta = await prisma.pergunta.findUnique({ where: { id: perguntaId }, include: { opcoes: true } });
  if (!pergunta) return NextResponse.json({ erro: "Pergunta não encontrada" }, { status: 404 });
  if (!pergunta.aberta) return NextResponse.json({ erro: "Esta pergunta não está aberta para respostas" }, { status: 403 });

  const opcao = pergunta.opcoes.find((o) => o.id === opcaoId);
  if (!opcao) return NextResponse.json({ erro: "Opção inválida" }, { status: 400 });

  const resposta = await prisma.respostaParticipante.upsert({
    where: { participanteId_perguntaId: { participanteId: participante.id, perguntaId } },
    create: { participanteId: participante.id, perguntaId, opcaoId },
    update: { opcaoId },
  });

  // Notificar professor: nova resposta recebida (sem revelar quem respondeu o quê)
  const totalRespostas = await prisma.respostaParticipante.count({ where: { perguntaId } });
  await emitirEvento(participante.sessaoId, "nova-resposta", { perguntaId, totalRespostas });

  const feedback = pergunta.tipo === "conhecimento" ? { correta: opcao.correta } : {};
  return NextResponse.json({ resposta, ...feedback });
}
