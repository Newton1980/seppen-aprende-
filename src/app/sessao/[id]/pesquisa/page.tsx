"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type Opcao = { id: string; letra: string; texto: string };
type Pergunta = { id: string; enunciado: string; opcoes: Opcao[] };

export default function PesquisaPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [perguntas, setPerguntas] = useState<Pergunta[]>([]);
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [titulo, setTitulo] = useState("");

  const carregarPerguntas = useCallback(async () => {
    const res = await fetch(`/api/sessoes/${id}`);
    if (!res.ok) return;
    const sessao = await res.json();
    setTitulo(sessao.titulo);
    const pesquisas = sessao.perguntas
      .filter((p: { tipo: string }) => p.tipo === "pesquisa")
      .map((p: { id: string; enunciado: string; opcoes: { id: string; letra: string; texto: string }[] }) => ({
        id: p.id,
        enunciado: p.enunciado,
        opcoes: p.opcoes.map((o) => ({ id: o.id, letra: o.letra, texto: o.texto })),
      }));
    setPerguntas(pesquisas);
  }, [id]);

  useEffect(() => { carregarPerguntas(); }, [carregarPerguntas]);

  function selecionarResposta(perguntaId: string, opcaoId: string) {
    setRespostas((prev) => ({ ...prev, [perguntaId]: opcaoId }));
  }

  async function enviarPesquisa() {
    if (Object.keys(respostas).length < perguntas.length) {
      setErro("Por favor, responda todas as questões.");
      return;
    }

    setEnviando(true);
    setErro("");

    const token = sessionStorage.getItem("participanteToken");
    const payload = {
      participanteToken: token,
      tipo: "pesquisa",
      respostas: Object.entries(respostas).map(([perguntaId, opcaoId]) => ({ perguntaId, opcaoId })),
    };

    const res = await fetch("/api/avaliacoes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (res.ok) {
      router.push(`/sessao/${id}/conclusao`);
    } else {
      setErro(data.erro || "Erro ao enviar pesquisa");
      if (data.erro === "Você já respondeu esta etapa") {
        setTimeout(() => router.push(`/sessao/${id}/conclusao`), 1500);
      }
    }
    setEnviando(false);
  }

  const respondidas = Object.keys(respostas).length;

  if (perguntas.length === 0) {
    return (
      <div className="app-shell">
        <header className="topbar">
          <div className="brand"><img src="/images/brasao-pp-rj.png" alt="Brasão" className="brand-mark" /><span>SEPPEN <b>Aprende</b></span></div>
        </header>
        <div className="login-container"><p>Carregando pesquisa...</p></div>
      </div>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><img src="/images/brasao-pp-rj.png" alt="Brasão" className="brand-mark" /><span>SEPPEN <b>Aprende</b></span></div>
        <div className="session-state"><span className="status-dot" /> Pesquisa de satisfação</div>
      </header>

      <div className="aval-container">
        <div className="aval-card">
          <span className="eyebrow">PESQUISA DE SATISFAÇÃO</span>
          <h2 className="aval-titulo">{titulo}</h2>
          <p className="muted-text" style={{ marginBottom: 24 }}>
            Sua opinião é importante para melhorarmos as próximas capacitações. As respostas são anônimas.
          </p>

          {perguntas.map((pergunta, idx) => (
            <div key={pergunta.id} className="pesquisa-questao">
              <h3 className="pesquisa-enunciado">
                <span className="pesquisa-num">{idx + 1}.</span> {pergunta.enunciado}
              </h3>
              <div className="pesquisa-opcoes">
                {pergunta.opcoes.map((opcao) => (
                  <button
                    key={opcao.id}
                    className={respostas[pergunta.id] === opcao.id ? "pesquisa-opcao pesquisa-selecionada" : "pesquisa-opcao"}
                    onClick={() => selecionarResposta(pergunta.id, opcao.id)}
                  >
                    {opcao.texto}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {erro && <p className="erro-msg">{erro}</p>}

          <button
            className="primary-button wide"
            onClick={enviarPesquisa}
            disabled={enviando || respondidas < perguntas.length}
            style={{ marginTop: 24, padding: "14px 24px", fontSize: 15, background: respondidas === perguntas.length ? "#0fa97a" : undefined }}
          >
            {enviando ? "Enviando..." : `Enviar pesquisa (${respondidas}/${perguntas.length})`}
          </button>
        </div>
      </div>
    </main>
  );
}
