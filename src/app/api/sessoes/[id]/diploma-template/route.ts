import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

// POST — upload do template de diploma (PDF editável)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const sessao = await prisma.sessao.findUnique({ where: { id } });
  if (!sessao) return NextResponse.json({ erro: "Sessão não encontrada" }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get("template") as File | null;
  const cargaHoraria = formData.get("cargaHoraria") as string | null;

  if (!file || file.type !== "application/pdf") {
    return NextResponse.json({ erro: "Envie um arquivo PDF válido" }, { status: 400 });
  }

  // Salvar arquivo
  const uploadDir = path.join(process.cwd(), "public", "uploads", id);
  await mkdir(uploadDir, { recursive: true });
  const filePath = path.join(uploadDir, "diploma-template.pdf");

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buffer);

  // Atualizar sessão
  const updateData: Record<string, unknown> = { diplomaTemplate: `/uploads/${id}/diploma-template.pdf` };
  if (cargaHoraria) updateData.cargaHoraria = parseInt(cargaHoraria, 10);

  await prisma.sessao.update({ where: { id }, data: updateData });

  return NextResponse.json({ ok: true, path: updateData.diplomaTemplate });
}

// DELETE — remover template
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.sessao.update({ where: { id }, data: { diplomaTemplate: null } });
  return NextResponse.json({ ok: true });
}
