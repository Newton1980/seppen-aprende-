import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST — upload do template de diploma (.docx) — armazena no banco
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const sessao = await prisma.sessao.findUnique({ where: { id } });
  if (!sessao) return NextResponse.json({ erro: "Sessão não encontrada" }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get("template") as File | null;
  const cargaHoraria = formData.get("cargaHoraria") as string | null;

  if (!file) {
    return NextResponse.json({ erro: "Envie um arquivo .docx válido" }, { status: 400 });
  }

  const isDocx = file.name.endsWith(".docx") || file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (!isDocx) {
    return NextResponse.json({ erro: "Envie um arquivo .docx válido" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Salvar no banco
  const updateData: Record<string, unknown> = {
    diplomaTemplateData: buffer,
    diplomaTemplate: file.name, // guardar nome do arquivo para referência
  };
  if (cargaHoraria) updateData.cargaHoraria = parseInt(cargaHoraria, 10);

  await prisma.sessao.update({ where: { id }, data: updateData });

  return NextResponse.json({ ok: true, path: file.name });
}

// DELETE — remover template
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.sessao.update({
    where: { id },
    data: { diplomaTemplate: null, diplomaTemplateData: null },
  });
  return NextResponse.json({ ok: true });
}
