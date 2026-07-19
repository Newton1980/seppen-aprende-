import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir, readFile } from "fs/promises";
import path from "path";

// POST — professor faz upload do ebook
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const sessao = await prisma.sessao.findUnique({ where: { id } });
  if (!sessao) return NextResponse.json({ erro: "Sessão não encontrada" }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get("ebook") as File | null;

  if (!file) {
    return NextResponse.json({ erro: "Envie um arquivo válido" }, { status: 400 });
  }

  // Aceitar PDF e EPUB
  const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";
  const allowedExts = ["pdf", "epub"];
  if (!allowedExts.includes(ext)) {
    return NextResponse.json({ erro: "Formato não suportado. Envie PDF ou EPUB." }, { status: 400 });
  }

  // Salvar arquivo
  const uploadDir = path.join(process.cwd(), "public", "uploads", id);
  await mkdir(uploadDir, { recursive: true });
  const filePath = path.join(uploadDir, `ebook.${ext}`);

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buffer);

  const ebookPath = `/uploads/${id}/ebook.${ext}`;
  await prisma.sessao.update({ where: { id }, data: { ebookPath } });

  return NextResponse.json({ ok: true, path: ebookPath, nome: file.name });
}

// GET — aluno que concluiu baixa o ebook
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Verificar token do participante
  const token = req.nextUrl.searchParams.get("token");

  const sessao = await prisma.sessao.findUnique({
    where: { id },
    select: { ebookPath: true },
  });

  if (!sessao || !sessao.ebookPath) {
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

  // Ler e retornar o arquivo
  const filePath = path.join(process.cwd(), "public", sessao.ebookPath);
  try {
    const fileBuffer = await readFile(filePath);
    const ext = sessao.ebookPath.split(".").pop()?.toLowerCase();
    const contentType = ext === "epub" ? "application/epub+zip" : "application/pdf";
    const filename = `ebook.${ext}`;

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch {
    return NextResponse.json({ erro: "Arquivo não encontrado" }, { status: 404 });
  }
}

// DELETE — professor remove o ebook
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.sessao.update({ where: { id }, data: { ebookPath: null } });
  return NextResponse.json({ ok: true });
}
