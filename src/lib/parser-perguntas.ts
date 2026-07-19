/**
 * Parser de perguntas em formato Markdown.
 *
 * Formato esperado:
 *
 * # enquete | conhecimento | avaliacao | pesquisa
 *
 * ## Texto da pergunta aqui?
 * slide: 3
 * - [x] Resposta correta
 * - [ ] Resposta errada
 * - [ ] Outra resposta errada
 * - [ ] Mais uma errada
 *
 * ## Outra pergunta?
 * - [ ] Opção A
 * - [x] Opção B (correta)
 * - [ ] Opção C
 * - [ ] Opção D
 */

export type PerguntaParsed = {
  tipo: string;
  enunciado: string;
  slideOrdem: number | null;
  opcoes: { letra: string; texto: string; correta: boolean }[];
};

const LETRAS = ["A", "B", "C", "D", "E", "F", "G", "H"];
const TIPOS_VALIDOS = ["enquete", "conhecimento", "avaliacao", "pesquisa"];

export function parsePerguntasMd(conteudo: string): PerguntaParsed[] {
  const perguntas: PerguntaParsed[] = [];
  const linhas = conteudo.split("\n");

  let tipoAtual = "enquete";
  let perguntaAtual: PerguntaParsed | null = null;

  for (const linha of linhas) {
    const trimmed = linha.trim();

    // Tipo de pergunta: # enquete
    if (trimmed.startsWith("# ")) {
      const tipo = trimmed.slice(2).trim().toLowerCase();
      if (TIPOS_VALIDOS.includes(tipo)) {
        tipoAtual = tipo;
      }
      continue;
    }

    // Nova pergunta: ## Texto da pergunta
    if (trimmed.startsWith("## ")) {
      // Salvar pergunta anterior
      if (perguntaAtual && perguntaAtual.opcoes.length > 0) {
        perguntas.push(perguntaAtual);
      }
      perguntaAtual = {
        tipo: tipoAtual,
        enunciado: trimmed.slice(3).trim(),
        slideOrdem: null,
        opcoes: [],
      };
      continue;
    }

    // Metadado slide: slide: 3
    if (trimmed.startsWith("slide:") && perguntaAtual) {
      const num = parseInt(trimmed.slice(6).trim(), 10);
      if (!isNaN(num)) perguntaAtual.slideOrdem = num;
      continue;
    }

    // Opção correta: - [x] Texto
    if (trimmed.startsWith("- [x]") && perguntaAtual) {
      const texto = trimmed.slice(5).trim();
      perguntaAtual.opcoes.push({
        letra: LETRAS[perguntaAtual.opcoes.length] || "?",
        texto,
        correta: true,
      });
      continue;
    }

    // Opção errada: - [ ] Texto
    if (trimmed.startsWith("- [ ]") && perguntaAtual) {
      const texto = trimmed.slice(5).trim();
      perguntaAtual.opcoes.push({
        letra: LETRAS[perguntaAtual.opcoes.length] || "?",
        texto,
        correta: false,
      });
      continue;
    }
  }

  // Salvar última pergunta
  if (perguntaAtual && perguntaAtual.opcoes.length > 0) {
    perguntas.push(perguntaAtual);
  }

  return perguntas;
}
