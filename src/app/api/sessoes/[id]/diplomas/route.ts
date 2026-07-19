import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { readFile } from "fs/promises";
import path from "path";
import JSZip from "jszip";

// Configuração das áreas variáveis do certificado (coordenadas PDF, Y de baixo para cima)
// Ajuste esses valores se o texto não ficar alinhado com o template
const LAYOUT = {
  // Área do nome do aluno (retângulo a cobrir + posição do texto)
  nome: { x: 120, y: 370, largura: 600, altura: 35, fonteSize: 20 },
  // Área do parágrafo descritivo
  corpo: { x: 100, y: 195, largura: 640, altura: 170, fonteSize: 12, lineHeight: 18 },
  // Área da data
  data: { x: 200, y: 155, largura: 440, altura: 22, fonteSize: 12 },
};

function quebrarLinhas(texto: string, fonte: { widthOfTextAtSize: (t: string, s: number) => number }, tamanho: number, larguraMax: number): string[] {
  const palavras = texto.split(" ");
  const linhas: string[] = [];
  let linhaAtual = "";

  for (const palavra of palavras) {
    const teste = linhaAtual ? `${linhaAtual} ${palavra}` : palavra;
    if (fonte.widthOfTextAtSize(teste, tamanho) <= larguraMax) {
      linhaAtual = teste;
    } else {
      if (linhaAtual) linhas.push(linhaAtual);
      linhaAtual = palavra;
    }
  }
  if (linhaAtual) linhas.push(linhaAtual);
  return linhas;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const sessao = await prisma.sessao.findUnique({
    where: { id },
    include: {
      participantes: {
        where: { aprovado: true },
        select: { nome: true, matricula: true, nota: true },
        orderBy: { nome: "asc" },
      },
    },
  });

  if (!sessao) return NextResponse.json({ erro: "Sessão não encontrada" }, { status: 404 });
  if (!sessao.diplomaTemplate) return NextResponse.json({ erro: "Template de diploma não configurado" }, { status: 400 });
  if (sessao.participantes.length === 0) return NextResponse.json({ erro: "Nenhum aluno aprovado" }, { status: 400 });

  // Ler template PDF
  const templatePath = path.join(process.cwd(), "public", sessao.diplomaTemplate);
  let templateBytes: Buffer;
  try {
    templateBytes = await readFile(templatePath);
  } catch {
    return NextResponse.json({ erro: "Arquivo de template não encontrado" }, { status: 404 });
  }

  const zip = new JSZip();

  // Formatar data por extenso
  const agora = new Date();
  const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const dataConclusao = `Rio de Janeiro, ${agora.getDate()} de ${meses[agora.getMonth()]} de ${agora.getFullYear()}`;

  const cargaHoraria = sessao.cargaHoraria || 0;

  for (const aluno of sessao.participantes) {
    try {
      // Carregar cópia do template
      const pdfDoc = await PDFDocument.load(templateBytes);
      const page = pdfDoc.getPages()[0];
      const { width, height } = page.getSize();

      // Fontes
      const fontNormal = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const fontBoldItalic = await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique);

      // Cor do fundo do certificado (branco/creme do template)
      const bgColor = rgb(0.98, 0.98, 0.96);
      const textColor = rgb(0.12, 0.12, 0.12);

      // === 1. COBRIR E REESCREVER NOME ===
      page.drawRectangle({
        x: LAYOUT.nome.x,
        y: LAYOUT.nome.y,
        width: LAYOUT.nome.largura,
        height: LAYOUT.nome.altura,
        color: bgColor,
      });

      const nomeTexto = aluno.nome;
      const nomeLargura = fontBoldItalic.widthOfTextAtSize(nomeTexto, LAYOUT.nome.fonteSize);
      page.drawText(nomeTexto, {
        x: (width - nomeLargura) / 2,
        y: LAYOUT.nome.y + 8,
        size: LAYOUT.nome.fonteSize,
        font: fontBoldItalic,
        color: rgb(0.0, 0.22, 0.42), // azul escuro do nome original
      });

      // === 2. COBRIR E REESCREVER CORPO ===
      page.drawRectangle({
        x: LAYOUT.corpo.x,
        y: LAYOUT.corpo.y,
        width: LAYOUT.corpo.largura,
        height: LAYOUT.corpo.altura,
        color: bgColor,
      });

      // Montar texto do corpo para ALUNO (concluiu)
      const matriculaTexto = aluno.matricula ? `, matrícula ${aluno.matricula},` : "";
      const corpoTexto = `${aluno.nome}${matriculaTexto} concluiu com aproveitamento a capacitação ${sessao.titulo}, com carga horária de ${cargaHoraria} horas-aula, tendo sido aprovado(a) em conformidade com os objetivos institucionais da Academia de Polícia Penal.`;

      const linhas = quebrarLinhas(corpoTexto, fontNormal, LAYOUT.corpo.fonteSize, LAYOUT.corpo.largura - 20);
      const corpoTopoY = LAYOUT.corpo.y + LAYOUT.corpo.altura - 20;

      // Trechos em negrito: nome do aluno, matrícula, título do curso, carga horária
      // Para simplificar, renderizamos com fonte normal + trechos bold inline
      linhas.forEach((linha, i) => {
        const yLinha = corpoTopoY - i * LAYOUT.corpo.lineHeight;

        // Detectar e renderizar partes em negrito
        const partsBold: { text: string; bold: boolean }[] = [];
        let restante = linha;

        const boldTerms = [aluno.nome, sessao.titulo, `${cargaHoraria} horas-aula`];
        if (aluno.matricula) boldTerms.push(aluno.matricula);

        // Renderização simplificada: toda a linha com fonte normal
        // Os termos-chave ficam em destaque em uma versão futura
        page.drawText(linha, {
          x: LAYOUT.corpo.x + 10,
          y: yLinha,
          size: LAYOUT.corpo.fonteSize,
          font: fontNormal,
          color: textColor,
        });
      });

      // === 3. COBRIR E REESCREVER DATA ===
      page.drawRectangle({
        x: LAYOUT.data.x,
        y: LAYOUT.data.y,
        width: LAYOUT.data.largura,
        height: LAYOUT.data.altura,
        color: bgColor,
      });

      const dataLargura = fontNormal.widthOfTextAtSize(dataConclusao, LAYOUT.data.fonteSize);
      page.drawText(dataConclusao, {
        x: (width - dataLargura) / 2,
        y: LAYOUT.data.y + 5,
        size: LAYOUT.data.fonteSize,
        font: fontNormal,
        color: textColor,
      });

      // Salvar PDF
      const pdfBytes = await pdfDoc.save();
      const nomeArquivo = aluno.nome
        .normalize("NFD").replace(/[̀-ͯ]/g, "")
        .replace(/[^a-zA-Z\s]/g, "")
        .replace(/\s+/g, "_");
      zip.file(`certificado_${nomeArquivo}.pdf`, pdfBytes);
    } catch (err) {
      console.error(`Erro ao gerar certificado de ${aluno.nome}:`, err);
    }
  }

  const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

  return new NextResponse(zipBuffer, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="certificados-${sessao.codigo}.zip"`,
    },
  });
}
