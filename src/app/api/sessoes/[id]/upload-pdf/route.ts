import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

// POST — upload de PDF da apresentação
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const sessao = await prisma.sessao.findUnique({ where: { id } });
  if (!sessao) return NextResponse.json({ erro: "Sessão não encontrada" }, { status: 404 });

  const formData = await req.formData();
  const arquivo = formData.get("pdf") as File | null;
  if (!arquivo || !arquivo.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ erro: "Envie um arquivo PDF válido" }, { status: 400 });
  }

  // Salvar PDF no diretório público
  const dirPdf = path.join(process.cwd(), "public", "uploads", id);
  await mkdir(dirPdf, { recursive: true });

  const buffer = Buffer.from(await arquivo.arrayBuffer());
  const caminhoArquivo = path.join(dirPdf, "apresentacao.pdf");
  await writeFile(caminhoArquivo, buffer);

  // Contar páginas do PDF via regex no conteúdo binário
  const totalPaginas = contarPaginasPdf(buffer);

  // Limpar slides antigos e criar novos
  await prisma.slide.deleteMany({ where: { sessaoId: id } });

  const slidesData = [];
  for (let i = 1; i <= totalPaginas; i++) {
    slidesData.push({
      sessaoId: id,
      ordem: i,
      titulo: `Slide ${i}`,
      subtitulo: null,
      conteudo: null,
      modulo: null,
    });
  }

  await prisma.slide.createMany({ data: slidesData });

  await prisma.sessao.update({
    where: { id },
    data: { totalSlides: totalPaginas, slideAtual: 1 },
  });

  return NextResponse.json({
    totalPaginas,
    pdfUrl: `/uploads/${id}/apresentacao.pdf`,
  });
}

// Conta páginas de um PDF analisando o conteúdo binário
function contarPaginasPdf(buffer: Buffer): number {
  const texto = buffer.toString("latin1");

  // Método 1: contar objetos /Type /Page (não /Pages)
  const matches = texto.match(/\/Type\s*\/Page(?!s)/g);
  if (matches && matches.length > 0) return matches.length;

  // Método 2: procurar /Count no dicionário /Pages
  const countMatch = texto.match(/\/Pages[\s\S]*?\/Count\s+(\d+)/);
  if (countMatch) return parseInt(countMatch[1], 10);

  // Fallback
  return 1;
}
