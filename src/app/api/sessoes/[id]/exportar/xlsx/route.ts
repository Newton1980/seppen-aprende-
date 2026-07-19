import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const sessao = await prisma.sessao.findUnique({
    where: { id },
    include: {
      participantes: {
        select: { nome: true, matricula: true, presente: true, nota: true, aprovado: true, concluiu: true, entradaEm: true, respostas: { select: { perguntaId: true, opcaoId: true } } },
        orderBy: { nome: "asc" },
      },
      perguntas: {
        include: { opcoes: true, respostas: { select: { opcaoId: true } } },
        orderBy: { ordem: "asc" },
      },
    },
  });

  if (!sessao) return NextResponse.json({ erro: "Sessão não encontrada" }, { status: 404 });

  const wb = new ExcelJS.Workbook();
  wb.creator = "SEPPEN Aprende";

  // === ABA PRESENÇA ===
  const wsPresenca = wb.addWorksheet("Presença");
  wsPresenca.columns = [
    { header: "Nome", key: "nome", width: 30 },
    { header: "Matrícula", key: "matricula", width: 18 },
    { header: "Entrada", key: "entrada", width: 18 },
    { header: "Presente", key: "presente", width: 12 },
    { header: "Concluiu", key: "concluiu", width: 12 },
  ];
  const headerStyle: Partial<ExcelJS.Style> = { font: { bold: true, color: { argb: "FFFFFFFF" } }, fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF087AA1" } } };
  wsPresenca.getRow(1).eachCell((c) => { c.style = headerStyle as ExcelJS.Style; });

  sessao.participantes.forEach((p) => {
    wsPresenca.addRow({
      nome: p.nome,
      matricula: p.matricula || "—",
      entrada: new Date(p.entradaEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      presente: p.presente ? "Sim" : "Não",
      concluiu: p.concluiu ? "Sim" : "Não",
    });
  });

  // === ABA DESEMPENHO ===
  const wsDesemp = wb.addWorksheet("Desempenho");
  wsDesemp.columns = [
    { header: "Nome", key: "nome", width: 30 },
    { header: "Matrícula", key: "matricula", width: 18 },
    { header: "Nota", key: "nota", width: 10 },
    { header: "Situação", key: "situacao", width: 14 },
    { header: "Total Respostas", key: "respostas", width: 16 },
  ];
  wsDesemp.getRow(1).eachCell((c) => { c.style = headerStyle as ExcelJS.Style; });

  sessao.participantes.forEach((p) => {
    wsDesemp.addRow({
      nome: p.nome,
      matricula: p.matricula || "—",
      nota: p.nota !== null ? p.nota : "—",
      situacao: p.aprovado === null ? "Pendente" : p.aprovado ? "Aprovado" : "Reprovado",
      respostas: p.respostas.length,
    });
  });

  // === ABA QUESTÕES ===
  const wsQ = wb.addWorksheet("Questões");
  wsQ.columns = [
    { header: "#", key: "num", width: 5 },
    { header: "Enunciado", key: "enunciado", width: 50 },
    { header: "Tipo", key: "tipo", width: 14 },
    { header: "Respostas", key: "respostas", width: 12 },
    { header: "% Acerto", key: "acerto", width: 12 },
  ];
  wsQ.getRow(1).eachCell((c) => { c.style = headerStyle as ExcelJS.Style; });

  sessao.perguntas.forEach((perg, i) => {
    const total = perg.respostas.length;
    const correta = perg.opcoes.find((o) => o.correta);
    const acertos = correta ? perg.respostas.filter((r) => r.opcaoId === correta.id).length : 0;
    wsQ.addRow({
      num: i + 1,
      enunciado: perg.enunciado,
      tipo: perg.tipo,
      respostas: total,
      acerto: total > 0 ? `${Math.round((acertos / total) * 100)}%` : "—",
    });
  });

  // === ABA RESUMO ===
  const wsRes = wb.addWorksheet("Resumo");
  const participantesComNota = sessao.participantes.filter((p) => p.nota !== null);
  const media = participantesComNota.length > 0
    ? Math.round((participantesComNota.reduce((s, p) => s + (p.nota || 0), 0) / participantesComNota.length) * 10) / 10
    : null;

  const dados = [
    ["Capacitação", sessao.titulo],
    ["Código", sessao.codigo],
    ["Professor", sessao.professorNome],
    ["Data", new Date(sessao.criadaEm).toLocaleDateString("pt-BR")],
    [""],
    ["Total de participantes", sessao.participantes.length],
    ["Total de questões", sessao.perguntas.length],
    ["Média da turma", media !== null ? media : "—"],
    ["Aprovados", sessao.participantes.filter((p) => p.aprovado === true).length],
    ["Reprovados", sessao.participantes.filter((p) => p.aprovado === false).length],
    ["Concluíram", sessao.participantes.filter((p) => p.concluiu).length],
  ];
  dados.forEach((row) => wsRes.addRow(row));
  wsRes.getColumn(1).width = 25;
  wsRes.getColumn(2).width = 35;
  wsRes.getColumn(1).font = { bold: true };

  const buffer = await wb.xlsx.writeBuffer();

  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="relatorio-${sessao.codigo}.xlsx"`,
    },
  });
}
