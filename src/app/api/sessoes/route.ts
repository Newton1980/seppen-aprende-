import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET — listar sessões do professor (por pin)
export async function GET(req: NextRequest) {
  const pin = req.nextUrl.searchParams.get("pin");
  if (!pin) return NextResponse.json({ erro: "PIN obrigatório" }, { status: 400 });

  const sessoes = await prisma.sessao.findMany({
    where: { professorPin: pin },
    orderBy: { criadaEm: "desc" },
    include: { _count: { select: { participantes: true } } },
  });

  return NextResponse.json(sessoes);
}

// POST — criar nova sessão
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { titulo, descricao, professorNome, professorPin, modoLogin, slides } = body;

  if (!titulo || !professorNome || !professorPin) {
    return NextResponse.json({ erro: "Campos obrigatórios: titulo, professorNome, professorPin" }, { status: 400 });
  }

  // Gerar código curto único
  const codigo = gerarCodigo();

  const sessao = await prisma.sessao.create({
    data: {
      titulo,
      descricao: descricao || null,
      codigo,
      professorNome,
      professorPin,
      modoLogin: modoLogin || "ambos",
      totalSlides: slides?.length || 1,
      slides: slides?.length
        ? {
            create: slides.map((s: { titulo: string; subtitulo?: string; conteudo?: string; modulo?: string }, i: number) => ({
              ordem: i + 1,
              titulo: s.titulo,
              subtitulo: s.subtitulo || null,
              conteudo: s.conteudo || null,
              modulo: s.modulo || null,
            })),
          }
        : undefined,
    },
    include: { slides: { orderBy: { ordem: "asc" } } },
  });

  return NextResponse.json(sessao, { status: 201 });
}

function gerarCodigo(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let codigo = "";
  for (let i = 0; i < 6; i++) codigo += chars[Math.floor(Math.random() * chars.length)];
  return codigo;
}
