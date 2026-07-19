import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST — professor faz upload do ebook (armazena no banco)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const sessao = await prisma.sessao.findUnique({ where: { id } });
  if (!sessao) return NextResponse.json({ erro: "Sessão não encontrada" }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get("ebook") as File | null;

  if (!file) {
    return NextResponse.json({ erro: "Envie um arquivo válido" }, { status: 400 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";
  const allowedExts = ["pdf", "epub"];
  if (!allowedExts.includes(ext)) {
    return NextResponse.json({ erro: "Formato não suportado. Envie PDF ou EPUB." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  await prisma.sessao.update({
    where: { id },
    data: {
      ebookData: buffer,
      ebookPath: `ebook.${ext}`,
      ebookNome: file.name,
    },
  });

  return NextResponse.json({ ok: true, path: `ebook.${ext}`, nome: file.name });
}

// GET — aluno que concluiu baixa o ebook (do banco)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const token = req.nextUrl.searchParams.get("token");

  const sessao = await prisma.sessao.findUnique({
    where: { id },
    select: { ebookData: true, ebookPath: true, ebookNome: true },
  });

  if (!sessao || !sessao.ebookData) {
    return NextResponse.json({ erro: "Ebook não disponível" }, { status: 404 });
  }

  // Se token fornecido, verificar se o aluno concluiu
  if (token) {
    const participante = await prisma.participante.findUnique({
      where: { token },
      select: { concluiu: true, sessaoId: true },
    });

    if (!participante || participante.sessaoId !== id || !participante.concluiu) {
      return NextResponse.json({ erro: "Acesso não autorizado. Conclua a capacitação primeiro." }, { status: 403 });
    }
  }

  const ext = sessao.ebookPath?.split(".").pop()?.toLowerCase() || "pdf";
  const contentType = ext === "epub" ? "application/epub+zip" : "application/pdf";
  const filename = sessao.ebookNome || `ebook.${ext}`;

  return new NextResponse(sessao.ebookData, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

// DELETE — professor remove o ebook
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.sessao.update({
    where: { id },
    data: { ebookPath: null, ebookData: null, ebookNome: null },
  });
  return NextResponse.json({ ok: true });
}
