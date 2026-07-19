import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST — submeter avaliação final ou pesquisa de satisfação
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { participanteToken, tipo, respostas } = body as {
    participanteToken: string;
    tipo: "avaliacao" | "pesquisa";
    respostas: { perguntaId: string; opcaoId: string }[];
  };

  if (!participanteToken || !tipo || !respostas?.length) {
    return NextResponse.json({ erro: "Dados incompletos" }, { status: 400 });
  }

  const participante = await prisma.participante.findUnique({
    where: { token: participanteToken },
    include: { sessao: true },
  });

  if (!participante) {
    return NextResponse.json({ erro: "Participante não encontrado" }, { status: 404 });
  }

  // Verificar se já respondeu
  const tipoAval = tipo === "avaliacao" ? "avaliacao_final" : "pesquisa_satisfacao";
  const jaRespondeu = await prisma.avaliacaoResposta.findUnique({
    where: { participanteId_tipo: { participanteId: participante.id, tipo: tipoAval } },
  });

  if (jaRespondeu) {
    return NextResponse.json({ erro: "Você já respondeu esta etapa" }, { status: 409 });
  }

  // Salvar cada resposta individualmente (para relatórios detalhados)
  for (const resp of respostas) {
    await prisma.respostaParticipante.upsert({
      where: { participanteId_perguntaId: { participanteId: participante.id, perguntaId: resp.perguntaId } },
      update: { opcaoId: resp.opcaoId },
      create: { participanteId: participante.id, perguntaId: resp.perguntaId, opcaoId: resp.opcaoId },
    });
  }

  // Calcular nota se for avaliação
  let nota: number | null = null;
  let aprovado: boolean | null = null;
  let acertos = 0;

  if (tipo === "avaliacao") {
    const perguntaIds = respostas.map((r) => r.perguntaId);
    const perguntas = await prisma.pergunta.findMany({
      where: { id: { in: perguntaIds } },
      include: { opcoes: true },
    });

    for (const resp of respostas) {
      const pergunta = perguntas.find((p) => p.id === resp.perguntaId);
      if (!pergunta) continue;
      const opcaoCorreta = pergunta.opcoes.find((o) => o.correta);
      if (opcaoCorreta && opcaoCorreta.id === resp.opcaoId) acertos++;
    }

    const total = respostas.length;
    nota = total > 0 ? Math.round((acertos / total) * 100) / 10 : 0; // nota de 0 a 10
    aprovado = nota >= 6; // aprovado com 60%+

    await prisma.participante.update({
      where: { id: participante.id },
      data: { nota, aprovado },
    });
  }

  // Salvar registro consolidado da avaliação
  await prisma.avaliacaoResposta.create({
    data: {
      participanteId: participante.id,
      tipo: tipoAval,
      dados: JSON.stringify({
        respostas,
        ...(tipo === "avaliacao" ? { acertos, total: respostas.length, nota, aprovado } : {}),
      }),
    },
  });

  // Se pesquisa, marcar como concluiu
  if (tipo === "pesquisa") {
    await prisma.participante.update({
      where: { id: participante.id },
      data: { concluiu: true },
    });
  }

  return NextResponse.json({
    sucesso: true,
    ...(tipo === "avaliacao" ? { acertos, total: respostas.length, nota, aprovado } : {}),
  });
}
