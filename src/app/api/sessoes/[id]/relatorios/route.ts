import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET — dados consolidados para relatórios
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const sessao = await prisma.sessao.findUnique({
    where: { id },
    include: {
      participantes: {
        select: {
          id: true, nome: true, matricula: true, presente: true,
          nota: true, aprovado: true, concluiu: true, entradaEm: true,
          respostas: { select: { perguntaId: true, opcaoId: true } },
        },
        orderBy: { nome: "asc" },
      },
      perguntas: {
        include: {
          opcoes: true,
          respostas: { select: { opcaoId: true } },
        },
        orderBy: { ordem: "asc" },
      },
    },
  });

  if (!sessao) return NextResponse.json({ erro: "Sessão não encontrada" }, { status: 404 });

  // === PRESENÇA ===
  const presenca = sessao.participantes.map((p) => ({
    nome: p.nome,
    matricula: p.matricula || "—",
    entrada: p.entradaEm,
    presente: p.presente,
    concluiu: p.concluiu,
  }));

  // === DESEMPENHO INDIVIDUAL ===
  const desempenho = sessao.participantes.map((p) => ({
    nome: p.nome,
    matricula: p.matricula || "—",
    nota: p.nota,
    aprovado: p.aprovado,
    totalRespostas: p.respostas.length,
  }));

  // === CONSOLIDADO POR QUESTÃO ===
  const questoes = sessao.perguntas.map((pergunta) => {
    const totalRespostas = pergunta.respostas.length;
    const opcaoCorreta = pergunta.opcoes.find((o) => o.correta);

    const acertos = opcaoCorreta
      ? pergunta.respostas.filter((r) => r.opcaoId === opcaoCorreta.id).length
      : 0;

    const distribuicao = pergunta.opcoes.map((opcao) => {
      const votos = pergunta.respostas.filter((r) => r.opcaoId === opcao.id).length;
      return {
        letra: opcao.letra,
        texto: opcao.texto,
        correta: opcao.correta,
        votos,
        percentual: totalRespostas > 0 ? Math.round((votos / totalRespostas) * 100) : 0,
      };
    });

    return {
      enunciado: pergunta.enunciado,
      tipo: pergunta.tipo,
      totalRespostas,
      acertos,
      percentualAcerto: totalRespostas > 0 ? Math.round((acertos / totalRespostas) * 100) : 0,
      distribuicao,
    };
  });

  // === RESUMO GERAL ===
  const participantesComNota = sessao.participantes.filter((p) => p.nota !== null);
  const mediaTurma = participantesComNota.length > 0
    ? Math.round((participantesComNota.reduce((s, p) => s + (p.nota || 0), 0) / participantesComNota.length) * 10) / 10
    : null;
  const aprovados = sessao.participantes.filter((p) => p.aprovado === true).length;
  const reprovados = sessao.participantes.filter((p) => p.aprovado === false).length;

  const resumo = {
    titulo: sessao.titulo,
    codigo: sessao.codigo,
    professor: sessao.professorNome,
    criadaEm: sessao.criadaEm,
    totalParticipantes: sessao.participantes.length,
    totalPerguntas: sessao.perguntas.length,
    mediaTurma,
    aprovados,
    reprovados,
    concluiram: sessao.participantes.filter((p) => p.concluiu).length,
    diplomaTemplate: sessao.diplomaTemplate,
    cargaHoraria: sessao.cargaHoraria,
    ebookPath: sessao.ebookPath,
  };

  return NextResponse.json({ resumo, presenca, desempenho, questoes });
}
