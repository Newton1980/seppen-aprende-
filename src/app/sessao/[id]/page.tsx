"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSessaoRealtime, usePusherDisponivel } from "@/lib/pusher-client";
import PdfViewer from "@/components/PdfViewer";

type Opcao = { id: string; letra: string; texto: string; correta: boolean };
type Pergunta = { id: string; enunciado: string; tipo: string; aberta: boolean; opcoes: Opcao[]; _count: { respostas: number } };
type Slide = { id: string; ordem: number; titulo: string; subtitulo: string | null; conteudo: string | null; modulo: string | null };
type Sessao = { id: string; titulo: string; codigo: string; slideAtual: number; totalSlides: number; ativa: boolean; faseAtual: string; slides: Slide[]; perguntas: Pergunta[] };

export default function SessaoAluno() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [sessao, setSessao] = useState<Sessao | null>(null);
  const [resposta, setResposta] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ correta?: boolean } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [nomeParticipante, setNomeParticipante] = useState("");
  const [conteudoAberto, setConteudoAberto] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [telaCheia, setTelaCheia] = useState(false);
  const slideAreaRef = useRef<HTMLDivElement>(null);
  const temPusher = usePusherDisponivel();

  const carregarSessao = useCallback(async () => {
    const res = await fetch(`/api/sessoes/${id}`);
    if (res.ok) {
      const data = await res.json();
      setSessao(data);
      // Redirecionar se a fase mudou
      if (data.faseAtual === "avaliacao") router.push(`/sessao/${id}/avaliacao`);
      else if (data.faseAtual === "pesquisa") router.push(`/sessao/${id}/pesquisa`);
      else if (data.faseAtual === "concluida") router.push(`/sessao/${id}/conclusao`);
    }
  }, [id, router]);

  useSessaoRealtime(id, {
    "slide-mudou": (dados) => {
      setSessao((prev) => prev ? { ...prev, slideAtual: dados.slideAtual as number } : prev);
      setConteudoAberto(false);
    },
    "sessao-status": (dados) => {
      const ativa = dados.ativa as boolean;
      setSessao((prev) => prev ? { ...prev, ativa } : prev);
      if (!ativa) {
        // Sessão encerrada — limpar dados do aluno e redirecionar
        sessionStorage.removeItem("participanteToken");
        sessionStorage.removeItem("participanteNome");
        sessionStorage.removeItem("participanteId");
        sessionStorage.removeItem("avaliacaoResultado");
        router.push("/");
      }
    },
    "pergunta-status": () => {
      carregarSessao();
      setResposta(null);
      setFeedback(null);
    },
    "fase-mudou": (dados) => {
      const fase = dados.faseAtual as string;
      if (fase === "avaliacao") router.push(`/sessao/${id}/avaliacao`);
      else if (fase === "pesquisa") router.push(`/sessao/${id}/pesquisa`);
      else if (fase === "concluida") router.push(`/sessao/${id}/conclusao`);
    },
  });

  useEffect(() => {
    carregarSessao();
    setNomeParticipante(sessionStorage.getItem("participanteNome") || "");
    // Verificar se tem PDF
    fetch(`/uploads/${id}/apresentacao.pdf`, { method: "HEAD" }).then((r) => {
      if (r.ok) setPdfUrl(`/uploads/${id}/apresentacao.pdf`);
    }).catch(() => {});
    if (!temPusher) {
      const interval = setInterval(carregarSessao, 3000);
      return () => clearInterval(interval);
    }
  }, [carregarSessao, temPusher, id]);

  useEffect(() => {
    const handler = () => { if (!document.fullscreenElement) setTelaCheia(false); };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  function toggleTelaCheia() {
    if (!slideAreaRef.current) return;
    if (!document.fullscreenElement) { slideAreaRef.current.requestFullscreen(); setTelaCheia(true); }
    else { document.exitFullscreen(); setTelaCheia(false); }
  }

  const slideAtual = sessao?.slides?.find((s) => s.ordem === sessao.slideAtual);
  const perguntaAtiva = sessao?.perguntas?.find((p) => p.aberta);

  async function enviarResposta(opcaoId: string) {
    if (!perguntaAtiva) return;
    setEnviando(true);
    const token = sessionStorage.getItem("participanteToken");
    const res = await fetch("/api/respostas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participanteToken: token, perguntaId: perguntaAtiva.id, opcaoId }),
    });
    if (res.ok) {
      const data = await res.json();
      setResposta(opcaoId);
      if (data.correta !== undefined) setFeedback({ correta: data.correta });
    }
    setEnviando(false);
  }

  if (!sessao) return <div className="app-shell"><header className="topbar"><div className="brand"><img src="/images/brasao-pp-rj.png" alt="Brasão" className="brand-mark" /><span>SEPPEN <b>Aprende</b></span></div></header><div className="login-container"><p>Carregando sessão...</p></div></div>;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><img src="/images/brasao-pp-rj.png" alt="Brasão" className="brand-mark" /><span>SEPPEN <b>Aprende</b></span></div>
        <div className="session-state"><span className={sessao.ativa ? "status-dot" : "status-dot muted"} /> {sessao.ativa ? "Sessão ao vivo" : "Sessão encerrada"}</div>
        <button className="avatar" aria-label="Perfil">{nomeParticipante.slice(0, 2).toUpperCase()}</button>
      </header>

      <section className="content-area student-view" style={{ maxWidth: 960, margin: "0 auto" }}>
        <div className="page-heading">
          <div><p className="eyebrow">SESSÃO AO VIVO</p><h2>{sessao.titulo}</h2></div>
          <div className="identity">{nomeParticipante}</div>
        </div>

        <div className="student-grid">
          <section className="presentation-panel" ref={slideAreaRef}>
            {pdfUrl ? (
              <PdfViewer pdfUrl={pdfUrl} pagina={sessao.slideAtual} telaCheia={telaCheia} />
            ) : (
              <div className="slide-preview" aria-label={`Slide ${sessao.slideAtual}`}>
                <div className="slide-topline" />
                {slideAtual?.modulo && <span className="slide-kicker">{slideAtual.modulo}</span>}
                <h2>{slideAtual?.titulo || `Slide ${sessao.slideAtual}`}<br />{slideAtual?.subtitulo && <em>{slideAtual.subtitulo}</em>}</h2>
                <div className="slide-number">{String(sessao.slideAtual).padStart(2, "0")}</div>
                <div className="slide-shape shape-one" /><div className="slide-shape shape-two" />
              </div>
            )}
            <div className={`student-slide-footer ${telaCheia ? "slide-controls-fullscreen" : ""}`}>
              <span>Slide {sessao.slideAtual} de {sessao.totalSlides} · Sincronizado com o professor</span>
              <div style={{ display: "flex", gap: 10 }}>
                {slideAtual?.conteudo && (
                  <button className="link-button" onClick={() => setConteudoAberto(!conteudoAberto)}>
                    {conteudoAberto ? "Fechar" : "Detalhes"} {conteudoAberto ? "↑" : "↗"}
                  </button>
                )}
                <button className="link-button" onClick={toggleTelaCheia}>{telaCheia ? "Sair tela cheia" : "⛶ Tela cheia"}</button>
              </div>
            </div>
            {conteudoAberto && slideAtual?.conteudo && (
              <div className="conteudo-detalhado"><div dangerouslySetInnerHTML={{ __html: slideAtual.conteudo }} /></div>
            )}
          </section>

          {perguntaAtiva && (
            <aside className="answer-panel">
              <p className="eyebrow">{perguntaAtiva.tipo === "enquete" ? "ENQUETE ABERTA" : "PERGUNTA ABERTA"}</p>
              <h3>{perguntaAtiva.enunciado}</h3>
              <p className="muted-text">Sua resposta será contabilizada uma única vez.</p>
              <div className="answer-options">
                {perguntaAtiva.opcoes.map((opcao) => (
                  <button key={opcao.id} disabled={!perguntaAtiva.aberta || resposta !== null || enviando} onClick={() => enviarResposta(opcao.id)} className={resposta === opcao.id ? "answer selected-answer" : "answer"}>
                    <b>{opcao.letra}</b><span>{opcao.texto}</span>{resposta === opcao.id && <i>✓</i>}
                  </button>
                ))}
              </div>
              {feedback && (
                <div className="private-feedback">
                  <strong>{feedback.correta ? "Resposta correta!" : "Resposta registrada"}</strong>
                  <span>{feedback.correta ? "Você acertou esta questão." : "O resultado será apresentado pelo professor."}</span>
                </div>
              )}
            </aside>
          )}
        </div>
      </section>
    </main>
  );
}
