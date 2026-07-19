"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type Opcao = { id: string; letra: string; texto: string };
type Pergunta = { id: string; enunciado: string; opcoes: Opcao[] };

export default function AvaliacaoPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [perguntas, setPerguntas] = useState<Pergunta[]>([]);
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [atual, setAtual] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [titulo, setTitulo] = useState("");

  const carregarPerguntas = useCallback(async () => {
    const res = await fetch(`/api/sessoes/${id}`);
    if (!res.ok) return;
    const sessao = await res.json();
    setTitulo(sessao.titulo);
    const avaliacoes = sessao.perguntas
      .filter((p: { tipo: string }) => p.tipo === "avaliacao")
      .map((p: { id: string; enunciado: string; opcoes: { id: string; letra: string; texto: string }[] }) => ({
        id: p.id,
        enunciado: p.enunciado,
        opcoes: p.opcoes.map((o) => ({ id: o.id, letra: o.letra, texto: o.texto })),
      }));
    setPerguntas(avaliacoes);
  }, [id]);

  useEffect(() => { carregarPerguntas(); }, [carregarPerguntas]);

  function selecionarResposta(opcaoId: string) {
    if (!perguntas[atual]) return;
    setRespostas((prev) => ({ ...prev, [perguntas[atual].id]: opcaoId }));
  }

  function proximo() {
    if (atual < perguntas.length - 1) setAtual(atual + 1);
  }

  function anterior() {
    if (atual > 0) setAtual(atual - 1);
  }

  async function enviarAvaliacao() {
    if (Object.keys(respostas).length < perguntas.length) {
      setErro("Responda todas as questões antes de enviar.");
      return;
    }

    setEnviando(true);
    setErro("");

    const token = sessionStorage.getItem("participanteToken");
    const payload = {
      participanteToken: token,
      tipo: "avaliacao",
      respostas: Object.entries(respostas).map(([perguntaId, opcaoId]) => ({ perguntaId, opcaoId })),
    };

    const res = await fetch("/api/avaliacoes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (res.ok) {
      // Salvar resultado no sessionStorage para a tela de conclusão
      sessionStorage.setItem("avaliacaoResultado", JSON.stringify(data));
      router.push(`/sessao/${id}/pesquisa`);
    } else {
      setErro(data.erro || "Erro ao enviar avaliação");
      if (data.erro === "Você já respondeu esta etapa") {
        setTimeout(() => router.push(`/sessao/${id}/pesquisa`), 1500);
      }
    }
    setEnviando(false);
  }

  const perguntaAtual = perguntas[atual];
  const respondidas = Object.keys(respostas).length;
  const progresso = perguntas.length > 0 ? Math.round((respondidas / perguntas.length) * 100) : 0;

  if (perguntas.length === 0) {
    return (
      <div className="app-shell">
        <header className="topbar">
          <div className="brand"><span className="brand-mark">S</span><span>SEPPEN <b>Aprende</b></span></div>
        </header>
        <div className="login-container"><p>Carregando avaliação...</p></div>
      </div>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">S</span><span>SEPPEN <b>Aprende</b></span></div>
        <div className="session-state"><span className="status-dot" /> Avaliação em andamento</div>
      </header>

      <div className="aval-container">
        <div className="aval-card">
          {/* Progresso */}
          <div className="aval-progress-header">
            <span className="eyebrow">AVALIAÇÃO FINAL</span>
            <span className="aval-progress-text">{respondidas}/{perguntas.length} respondidas</span>
          </div>
          <div className="aval-progress-bar">
            <div className="aval-progress-fill" style={{ width: `${progresso}%` }} />
          </div>
          <h2 className="aval-titulo">{titulo}</h2>

          {/* Questão */}
          <div className="aval-questao">
            <div className="aval-questao-num">
              <span className="aval-num-badge">{atual + 1}</span>
              <span className="aval-num-total">de {perguntas.length}</span>
            </div>
            <h3 className="aval-enunciado">{perguntaAtual.enunciado}</h3>

            <div className="answer-options">
              {perguntaAtual.opcoes.map((opcao) => (
                <button
                  key={opcao.id}
                  className={respostas[perguntaAtual.id] === opcao.id ? "answer selected-answer" : "answer"}
                  onClick={() => selecionarResposta(opcao.id)}
                >
                  <b>{opcao.letra}</b>
                  <span>{opcao.texto}</span>
                  {respostas[perguntaAtual.id] === opcao.id && <i>✓</i>}
                </button>
              ))}
            </div>
          </div>

          {erro && <p className="erro-msg">{erro}</p>}

          {/* Navegação */}
          <div className="aval-nav">
            <button className="outline-button" onClick={anterior} disabled={atual === 0}>← Anterior</button>

            {/* Indicadores de questão */}
            <div className="aval-dots">
              {perguntas.map((p, i) => (
                <button
                  key={p.id}
                  className={`aval-dot ${i === atual ? "aval-dot-atual" : ""} ${respostas[p.id] ? "aval-dot-respondida" : ""}`}
                  onClick={() => setAtual(i)}
                  title={`Questão ${i + 1}`}
                >
                  {i + 1}
                </button>
              ))}
            </div>

            {atual < perguntas.length - 1 ? (
              <button className="primary-button" onClick={proximo}>Próxima →</button>
            ) : (
              <button
                className="primary-button"
                onClick={enviarAvaliacao}
                disabled={enviando || respondidas < perguntas.length}
                style={{ background: respondidas === perguntas.length ? "#0fa97a" : undefined }}
              >
                {enviando ? "Enviando..." : "Finalizar avaliação ✓"}
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
