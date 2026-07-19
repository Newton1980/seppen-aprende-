import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readFile } from "fs/promises";
import path from "path";
import JSZip from "jszip";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

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

  // Ler template .docx
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
  const dataConclusao = `${agora.getDate()} de ${meses[agora.getMonth()]} de ${agora.getFullYear()}`;

  const cargaHoraria = sessao.cargaHoraria || 0;
  const anoAtual = agora.getFullYear();

  for (const aluno of sessao.participantes) {
    try {
      // Carregar cópia do template .docx via PizZip
      const pizzip = new PizZip(templateBytes);
      const doc = new Docxtemplater(pizzip, {
        paragraphLoop: true,
        linebreaks: true,
        delimiters: { start: "{", end: "}" },
      });

      // Substituir placeholders
      doc.render({
        Nome: aluno.nome,
        "id funcional": aluno.matricula || "—",
        CURSO: sessao.titulo,
        "CARGA-HORARIA": String(cargaHoraria),
        DATA: dataConclusao,
      });

      // Gerar .docx preenchido
      const docxBuffer = doc.getZip().generate({
        type: "nodebuffer",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });

      const nomeArquivo = aluno.nome
        .normalize("NFD").replace(/[̀-ͯ]/g, "")
        .replace(/[^a-zA-Z\s]/g, "")
        .replace(/\s+/g, "_");
      zip.file(`certificado_${nomeArquivo}.docx`, docxBuffer);
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
