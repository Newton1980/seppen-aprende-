import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import PDFDocument from "pdfkit";

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

  // Cálculos
  const participantesComNota = sessao.participantes.filter((p) => p.nota !== null);
  const media = participantesComNota.length > 0
    ? Math.round((participantesComNota.reduce((s, p) => s + (p.nota || 0), 0) / participantesComNota.length) * 10) / 10
    : null;
  const aprovados = sessao.participantes.filter((p) => p.aprovado === true).length;
  const reprovados = sessao.participantes.filter((p) => p.aprovado === false).length;
  const concluiram = sessao.participantes.filter((p) => p.concluiu).length;

  const chunks: Buffer[] = [];
  const doc = new PDFDocument({ size: "A4", margin: 50, bufferPages: true });
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  const finished = new Promise<void>((resolve) => doc.on("end", resolve));

  const blue = "#087aa1";
  const teal = "#1ca59a";
  const dark = "#15283a";
  const muted = "#6b7785";

  // === CAPA ===
  doc.rect(0, 0, 595, 120).fill("#073a53");
  doc.fontSize(24).fillColor("#fff").text("SEPPEN Aprende", 50, 45, { lineGap: 4 });
  doc.fontSize(10).fillColor("#80d5c9").text("Relatório de Capacitação", 50, 78);

  doc.moveDown(4);
  doc.fontSize(18).fillColor(dark).text(sessao.titulo, 50, 150);
  doc.fontSize(10).fillColor(muted).text(`Código: ${sessao.codigo}  ·  Prof. ${sessao.professorNome}  ·  ${new Date(sessao.criadaEm).toLocaleDateString("pt-BR")}`, 50, 178);

  // === RESUMO ===
  doc.moveDown(2);
  const yRes = doc.y;
  doc.fontSize(13).fillColor(blue).text("Resumo Geral", 50, yRes);
  doc.moveTo(50, yRes + 18).lineTo(545, yRes + 18).strokeColor("#dbe3e8").stroke();

  const resumoData = [
    ["Participantes", String(sessao.participantes.length)],
    ["Questões", String(sessao.perguntas.length)],
    ["Média da turma", media !== null ? media.toFixed(1) : "—"],
    ["Aprovados", String(aprovados)],
    ["Reprovados", String(reprovados)],
    ["Concluíram", String(concluiram)],
  ];

  let yR = yRes + 28;
  resumoData.forEach(([label, val]) => {
    doc.fontSize(10).fillColor(muted).text(label, 60, yR);
    doc.fontSize(10).fillColor(dark).text(val, 250, yR);
    yR += 18;
  });

  // === PRESENÇA ===
  doc.addPage();
  doc.fontSize(13).fillColor(blue).text("Lista de Presença", 50, 50);
  doc.moveTo(50, 68).lineTo(545, 68).strokeColor("#dbe3e8").stroke();

  // Header
  let yP = 78;
  doc.fontSize(8).fillColor(muted);
  doc.text("NOME", 50, yP);
  doc.text("MATRÍCULA", 220, yP);
  doc.text("ENTRADA", 330, yP);
  doc.text("PRESENTE", 410, yP);
  doc.text("CONCLUIU", 480, yP);
  yP += 16;

  doc.fontSize(9).fillColor(dark);
  sessao.participantes.forEach((p) => {
    if (yP > 750) { doc.addPage(); yP = 50; }
    doc.text(p.nome, 50, yP, { width: 165 });
    doc.text(p.matricula || "—", 220, yP);
    doc.text(new Date(p.entradaEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }), 330, yP);
    doc.fillColor(p.presente ? teal : "#ee744f").text(p.presente ? "Sim" : "Não", 410, yP);
    doc.fillColor(p.concluiu ? teal : "#ee744f").text(p.concluiu ? "Sim" : "Não", 480, yP);
    doc.fillColor(dark);
    yP += 16;
  });

  // === DESEMPENHO ===
  doc.addPage();
  doc.fontSize(13).fillColor(blue).text("Desempenho Individual", 50, 50);
  doc.moveTo(50, 68).lineTo(545, 68).strokeColor("#dbe3e8").stroke();

  let yD = 78;
  doc.fontSize(8).fillColor(muted);
  doc.text("NOME", 50, yD);
  doc.text("MATRÍCULA", 220, yD);
  doc.text("NOTA", 340, yD);
  doc.text("SITUAÇÃO", 400, yD);
  doc.text("RESPOSTAS", 490, yD);
  yD += 16;

  doc.fontSize(9).fillColor(dark);
  sessao.participantes.forEach((p) => {
    if (yD > 750) { doc.addPage(); yD = 50; }
    doc.text(p.nome, 50, yD, { width: 165 });
    doc.text(p.matricula || "—", 220, yD);
    doc.text(p.nota !== null ? p.nota.toFixed(1) : "—", 340, yD);
    const sit = p.aprovado === null ? "Pendente" : p.aprovado ? "Aprovado" : "Reprovado";
    const sitColor = p.aprovado === null ? muted : p.aprovado ? teal : "#ee744f";
    doc.fillColor(sitColor).text(sit, 400, yD);
    doc.fillColor(dark).text(String(p.respostas.length), 490, yD);
    yD += 16;
  });

  // === QUESTÕES ===
  doc.addPage();
  doc.fontSize(13).fillColor(blue).text("Análise por Questão", 50, 50);
  doc.moveTo(50, 68).lineTo(545, 68).strokeColor("#dbe3e8").stroke();

  let yQ = 80;
  sessao.perguntas.forEach((perg, i) => {
    if (yQ > 680) { doc.addPage(); yQ = 50; }
    const total = perg.respostas.length;
    const correta = perg.opcoes.find((o) => o.correta);
    const acertos = correta ? perg.respostas.filter((r) => r.opcaoId === correta.id).length : 0;
    const pctAcerto = total > 0 ? Math.round((acertos / total) * 100) : 0;

    doc.fontSize(10).fillColor(dark).text(`${i + 1}. ${perg.enunciado}`, 50, yQ, { width: 420 });
    doc.fontSize(8).fillColor(teal).text(`${pctAcerto}% acerto`, 490, yQ);
    yQ = doc.y + 6;

    perg.opcoes.forEach((opcao) => {
      if (yQ > 750) { doc.addPage(); yQ = 50; }
      const votos = perg.respostas.filter((r) => r.opcaoId === opcao.id).length;
      const pct = total > 0 ? Math.round((votos / total) * 100) : 0;
      const letraColor = opcao.correta ? teal : muted;
      doc.fontSize(8).fillColor(letraColor).text(`${opcao.letra})`, 60, yQ);
      doc.fillColor(dark).text(opcao.texto, 80, yQ, { width: 350 });
      doc.fillColor(muted).text(`${votos} (${pct}%)`, 450, yQ);
      yQ = doc.y + 4;
    });
    yQ += 10;
  });

  // Rodapé em todas as páginas
  const totalPages = doc.bufferedPageRange().count;
  for (let i = 0; i < totalPages; i++) {
    doc.switchToPage(i);
    doc.fontSize(7).fillColor("#b8c8cd").text(
      `SEPPEN Aprende · Relatório gerado em ${new Date().toLocaleDateString("pt-BR")} · Página ${i + 1} de ${totalPages}`,
      50, 800, { width: 495, align: "center" }
    );
  }

  doc.end();
  await finished;

  const pdfBuffer = Buffer.concat(chunks);

  return new NextResponse(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="relatorio-${sessao.codigo}.pdf"`,
    },
  });
}
