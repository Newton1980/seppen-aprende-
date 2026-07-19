import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { emitirEvento } from "@/lib/pusher-server";

// POST — aluno entra na sessão
export async function POST(req: NextRequest) {
  const { codigo, nome, matricula } = await req.json();

  if (!codigo || !nome) {
    return NextResponse.json({ erro: "Código e nome são obrigatórios" }, { status: 400 });
  }

  const sessao = await prisma.sessao.findUnique({ where: { codigo } });
  if (!sessao) return NextResponse.json({ erro: "Sessão não encontrada" }, { status: 404 });
  if (!sessao.ativa) return NextResponse.json({ erro: "Esta sessão já foi encerrada" }, { status: 403 });

  // Validar modo de login
  if (sessao.modoLogin === "matricula" && !matricula) {
    return NextResponse.json({ erro: "Matrícula obrigatória para esta sessão" }, { status: 400 });
  }

  // Verificar se já existe participante com mesma matrícula nesta sessão (reconexão)
  if (matricula) {
    const existente = await prisma.participante.findUnique({
      where: { sessaoId_matricula: { sessaoId: sessao.id, matricula } },
    });
    if (existente) {
      return NextResponse.json({
        participante: existente,
        sessao: { id: sessao.id, titulo: sessao.titulo, codigo: sessao.codigo },
      });
    }
  }

  const participante = await prisma.participante.create({
    data: {
      sessaoId: sessao.id,
      nome,
      matricula: matricula || null,
    },
  });

  // Notificar professor: novo participante entrou
  const totalParticipantes = await prisma.participante.count({ where: { sessaoId: sessao.id } });
  await emitirEvento(sessao.id, "participante-entrou", {
    nome: participante.nome,
    totalParticipantes,
  });

  return NextResponse.json({
    participante,
    sessao: { id: sessao.id, titulo: sessao.titulo, codigo: sessao.codigo },
  }, { status: 201 });
}
