import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parsePerguntasMd } from "@/lib/parser-perguntas";

// POST — upload de arquivo .md com perguntas
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const sessao = await prisma.sessao.findUnique({
    where: { id },
    include: { slides: { orderBy: { ordem: "asc" } } },
  });
  if (!sessao) return NextResponse.json({ erro: "Sessão não encontrada" }, { status: 404 });

  const formData = await req.formData();
  const arquivo = formData.get("md") as File | null;
  if (!arquivo || !arquivo.name.endsWith(".md")) {
    return NextResponse.json({ erro: "Envie um arquivo .md válido" }, { status: 400 });
  }

  const conteudo = await arquivo.text();
  const perguntasParsed = parsePerguntasMd(conteudo);

  if (perguntasParsed.length === 0) {
    return NextResponse.json({ erro: "Nenhuma pergunta encontrada no arquivo. Verifique o formato." }, { status: 400 });
  }

  // Obter ordem máxima atual
  const maxOrdem = await prisma.pergunta.aggregate({
    where: { sessaoId: id },
    _max: { ordem: true },
  });
  let ordem = (maxOrdem._max.ordem || 0);

  const criadas = [];
  for (const p of perguntasParsed) {
    ordem++;

    // Encontrar slide vinculado, se indicado
    let slideId: string | null = null;
    if (p.slideOrdem) {
      const slide = sessao.slides.find((s) => s.ordem === p.slideOrdem);
      if (slide) slideId = slide.id;
    }

    const pergunta = await prisma.pergunta.create({
      data: {
        sessaoId: id,
        slideId,
        tipo: p.tipo,
        enunciado: p.enunciado,
        ordem,
        opcoes: {
          create: p.opcoes.map((o) => ({
            letra: o.letra,
            texto: o.texto,
            correta: o.correta,
          })),
        },
      },
      include: { opcoes: true },
    });
    criadas.push(pergunta);
  }

  return NextResponse.json({
    totalImportadas: criadas.length,
    perguntas: criadas.map((p) => ({
      id: p.id,
      tipo: p.tipo,
      enunciado: p.enunciado,
      opcoes: p.opcoes.length,
    })),
  }, { status: 201 });
}
