"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useSessaoRealtime, usePusherDisponivel } from "@/lib/pusher-client";
import PdfViewer from "@/components/PdfViewer";
import ResultadoFullscreen from "@/components/ResultadoFullscreen";

type Opcao = { id: string; letra: string; texto: string; correta: boolean };
type Pergunta = { id: string; enunciado: string; tipo: string; aberta: boolean; opcoes: Opcao[]; _count: { respostas: number } };
type Participante = { id: string; nome: string; matricula: string | null; presente: boolean; nota: number | null; aprovado: boolean | null; concluiu: boolean };
type Slide = { id: string; ordem: number; titulo: string; subtitulo: string | null; conteudo: string | null; modulo: string | null };
type Sessao = {
  id: string; titulo: string; codigo: string; slideAtual: number; totalSlides: number; ativa: boolean; faseAtual: string;
  slides: Slide[]; perguntas: Pergunta[]; participantes: Participante[]; _count: { participantes: number };
};
type Resultado = { id: string; letra: string; texto: string; correta: boolean; votos: number; percentual: number };

export default function ProfessorPainel() {
  const { id } = useParams<{ id: string }>();
  const [sessao, setSessao] = useState<Sessao | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [mostrarQR, setMostrarQR] = useState(false);
  const [resultado, setResultado] = useState<{ totalRespostas: number; resultado: Resultado[] } | null>(null);
  const [respostasLive, setRespostasLive] = useState<Record<string, number>>({});
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState("");
  const [uploadMsg, setUploadMsg] = useState("");
  const [telaCheia, setTelaCheia] = useState(false);
  const [projetarResultado, setProjetarResultado] = useState(false);
  const [perguntaProjetada, setPerguntaProjetada] = useState<{ enunciado: string; tipo: string } | null>(null);
  const slideAreaRef = useRef<HTMLDivElement>(null);
  const temPusher = usePusherDisponivel();

  const carregarSessao = useCallback(async () => {
    const res = await fetch(`/api/sessoes/${id}`);
    if (res.ok) setSessao(await res.json());
  }, [id]);

  useSessaoRealtime(id, {
    "participante-entrou": (dados) => {
      setSessao((prev) => prev ? { ...prev, _count: { ...prev._count, participantes: dados.totalParticipantes as number } } : prev);
    },
    "nova-resposta": (dados) => {
      setRespostasLive((prev) => ({ ...prev, [dados.perguntaId as string]: dados.totalRespostas as number }));
    },
  });

  useEffect(() => {
    carregarSessao();
    // Verificar se já tem PDF
    fetch(`/uploads/${id}/apresentacao.pdf`, { method: "HEAD" }).then((r) => {
      if (r.ok) setPdfUrl(`/uploads/${id}/apresentacao.pdf`);
    }).catch(() => {});
    if (!temPusher) {
      const interval = setInterval(carregarSessao, 3000);
      return () => clearInterval(interval);
    }
  }, [carregarSessao, temPusher, id]);

  // Fullscreen API
  useEffect(() => {
    const handler = () => {
      if (!document.fullscreenElement) setTelaCheia(false);
    };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  function toggleTelaCheia() {
    if (!slideAreaRef.current) return;
    if (!document.fullscreenElement) {
      slideAreaRef.current.requestFullscreen();
      setTelaCheia(true);
    } else {
      document.exitFullscreen();
      setTelaCheia(false);
    }
  }

  async function uploadPdf(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading("pdf");
    setUploadMsg("");

    const formData = new FormData();
    formData.append("pdf", file);

    const res = await fetch(`/api/sessoes/${id}/upload-pdf`, { method: "POST", body: formData });
    const data = await res.json();

    if (res.ok) {
      setPdfUrl(data.pdfUrl);
      setUploadMsg(`PDF carregado: ${data.totalPaginas} páginas`);
      carregarSessao();
    } else {
      setUploadMsg(data.erro || "Erro no upload");
    }
    setUploading("");
    e.target.value = "";
  }

  async function uploadPerguntas(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading("md");
    setUploadMsg("");

    const formData = new FormData();
    formData.append("md", file);

    const res = await fetch(`/api/sessoes/${id}/upload-perguntas`, { method: "POST", body: formData });
    const data = await res.json();

    if (res.ok) {
      setUploadMsg(`${data.totalImportadas} perguntas importadas`);
      carregarSessao();
    } else {
      setUploadMsg(data.erro || "Erro no upload");
    }
    setUploading("");
    e.target.value = "";
  }

  async function carregarQR() {
    const res = await fetch(`/api/sessoes/${id}/qrcode`);
    if (res.ok) { const data = await res.json(); setQrCode(data.qrDataUrl); setMostrarQR(true); }
  }

  async function atualizarSessao(dados: Record<string, unknown>) {
    await fetch(`/api/sessoes/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(dados) });
    if (!temPusher) carregarSessao();
    else setSessao((prev) => prev ? { ...prev, ...dados } as Sessao : prev);
  }

  async function alternarPergunta(perguntaId: string, aberta: boolean) {
    // Guardar dados da pergunta antes de fechar (para projeção)
    if (!aberta) {
      const p = sessao?.perguntas.find((q) => q.id === perguntaId);
      if (p) setPerguntaProjetada({ enunciado: p.enunciado, tipo: p.tipo });
    }
    await fetch(`/api/perguntas/${perguntaId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ aberta }) });
    if (!aberta) await carregarResultado(perguntaId);
    carregarSessao();
  }

  async function carregarResultado(perguntaId: string) {
    const res = await fetch(`/api/perguntas/${perguntaId}`);
    if (res.ok) setResultado(await res.json());
  }

  if (!sessao) return <div className="app-shell"><header className="topbar"><div className="brand"><img src="/images/brasao-pp-rj.png" alt="Brasão" className="brand-mark" /><span>SEPPEN <b>Aprende</b></span></div></header><div className="login-container"><p>Carregando painel...</p></div></div>;

  const slideAtual = sessao.slides?.find((s) => s.ordem === sessao.slideAtual);
  const perguntaAtiva = sessao.perguntas?.find((p) => p.aberta);
  const totalParticipantes = sessao._count.participantes;
  const respostasAtivas = perguntaAtiva ? (respostasLive[perguntaAtiva.id] ?? perguntaAtiva._count.respostas) : 0;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><img src="/images/brasao-pp-rj.png" alt="Brasão" className="brand-mark" /><span>SEPPEN <b>Aprende</b></span></div>
        <div className="session-state"><span className={sessao.ativa ? "status-dot" : "status-dot muted"} /> {sessao.ativa ? "Sessão ao vivo" : "Sessão encerrada"}</div>
        <button className="avatar" aria-label="Professor">PR</button>
      </header>

      <section className="workspace">
        <aside className="sidebar">
          <p className="eyebrow">PAINEL DO PROFESSOR</p>
          <h1>{sessao.titulo}</h1>
          <p className="muted-text">Código: <b>{sessao.codigo}</b> · {totalParticipantes} participantes</p>

          <button className="primary-button wide" style={{ marginTop: 16 }} onClick={carregarQR}>Mostrar QR Code</button>

          {/* Upload de arquivos */}
          <div className="upload-section">
            <label className="upload-btn">
              {uploading === "pdf" ? "Enviando..." : "📄 Carregar PDF"}
              <input type="file" accept=".pdf" onChange={uploadPdf} disabled={!!uploading} />
            </label>
            <label className="upload-btn">
              {uploading === "md" ? "Enviando..." : "📝 Importar perguntas (.md)"}
              <input type="file" accept=".md" onChange={uploadPerguntas} disabled={!!uploading} />
            </label>
            {uploadMsg && <p className="upload-msg">{uploadMsg}</p>}
          </div>

          {temPusher && <p className="muted-text" style={{ marginTop: 8, fontSize: 10, color: "#16805f" }}>● Tempo real ativo</p>}

          <nav className="nav-list" aria-label="Navegação" style={{ marginTop: 16 }}>
            <a className="active" href="#aula">▣ Aula ao vivo</a>
            <a href="#participantes">▤ Participantes ({totalParticipantes})</a>
            <a href="#perguntas">▥ Perguntas ({sessao.perguntas.length})</a>
          </nav>

          <a href={`/professor/${id}/relatorios`} className="primary-button" style={{ textDecoration: "none", textAlign: "center", marginTop: 12, display: "block" }}>
            Relatórios e Exportação
          </a>

          <div className="notice-card">
            <strong>Certificação formal</strong>
            <span>Presença e avaliações registradas no banco de dados.</span>
          </div>

          {/* Controle de fases */}
          <div style={{ marginTop: 20, display: "grid", gap: 8 }}>
            <p className="eyebrow">FASES DA SESSÃO</p>
            <div style={{ display: "grid", gap: 6, fontSize: 12 }}>
              <span style={{ color: sessao.faseAtual === "aula" ? "#1ca59a" : "#6b7785", fontWeight: sessao.faseAtual === "aula" ? 700 : 400 }}>
                {sessao.faseAtual === "aula" ? "● " : "○ "}Aula ao vivo
              </span>
              <span style={{ color: sessao.faseAtual === "avaliacao" ? "#1ca59a" : "#6b7785", fontWeight: sessao.faseAtual === "avaliacao" ? 700 : 400 }}>
                {sessao.faseAtual === "avaliacao" ? "● " : "○ "}Avaliação final
              </span>
              <span style={{ color: sessao.faseAtual === "pesquisa" ? "#1ca59a" : "#6b7785", fontWeight: sessao.faseAtual === "pesquisa" ? 700 : 400 }}>
                {sessao.faseAtual === "pesquisa" ? "● " : "○ "}Pesquisa de satisfação
              </span>
              <span style={{ color: sessao.faseAtual === "concluida" ? "#1ca59a" : "#6b7785", fontWeight: sessao.faseAtual === "concluida" ? 700 : 400 }}>
                {sessao.faseAtual === "concluida" ? "● " : "○ "}Concluída
              </span>
            </div>
            {sessao.faseAtual === "aula" && (
              <button className="primary-button wide" style={{ marginTop: 8, background: "#e4b968", color: "#1a3040" }}
                onClick={() => atualizarSessao({ faseAtual: "avaliacao" })}>
                Liberar avaliação final
              </button>
            )}
            {sessao.faseAtual === "avaliacao" && (
              <>
                <button className="primary-button wide" style={{ marginTop: 8 }}
                  onClick={() => atualizarSessao({ faseAtual: "pesquisa" })}>
                  Liberar pesquisa de satisfação
                </button>
                <button className="outline-button wide" style={{ marginTop: 4, fontSize: 11, color: "#ee744f", borderColor: "#ee744f" }}
                  onClick={async () => {
                    if (!confirm("Reiniciar avaliação? Todas as respostas e notas dos alunos serão apagadas.")) return;
                    await fetch(`/api/sessoes/${id}/reiniciar-avaliacao`, { method: "POST" });
                    carregarSessao();
                  }}>
                  Reiniciar avaliação
                </button>
              </>
            )}
            {sessao.faseAtual === "pesquisa" && (
              <>
                <button className="danger-button" style={{ marginTop: 8 }}
                  onClick={() => atualizarSessao({ faseAtual: "concluida", ativa: false })}>
                  Encerrar capacitação
                </button>
                <button className="outline-button wide" style={{ marginTop: 4, fontSize: 11, color: "#ee744f", borderColor: "#ee744f" }}
                  onClick={async () => {
                    if (!confirm("Reiniciar avaliação? Todas as respostas e notas dos alunos serão apagadas e eles voltarão para a avaliação.")) return;
                    await fetch(`/api/sessoes/${id}/reiniciar-avaliacao`, { method: "POST" });
                    carregarSessao();
                  }}>
                  Reiniciar avaliação
                </button>
              </>
            )}
            {sessao.faseAtual === "concluida" && (
              <>
                <button className="primary-button wide" style={{ marginTop: 8, background: "#1ca59a" }}
                  onClick={() => window.location.href = "/"}>
                  Criar nova capacitação
                </button>
                <button className="outline-button wide" style={{ marginTop: 4, fontSize: 11, color: "#ee744f", borderColor: "#ee744f" }}
                  onClick={async () => {
                    if (!confirm("Reiniciar avaliação? Todas as respostas e notas serão apagadas e os alunos farão novamente.")) return;
                    await fetch(`/api/sessoes/${id}/reiniciar-avaliacao`, { method: "POST" });
                    carregarSessao();
                  }}>
                  Reiniciar avaliação
                </button>
              </>
            )}
          </div>
        </aside>

        <section className="content-area" id="aula">
          <div className="page-heading">
            <div><p className="eyebrow">CONDUÇÃO DA AULA</p><h2>Apresentação</h2></div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="outline-button" onClick={toggleTelaCheia}>⛶ Tela cheia</button>
              <button className="outline-button" onClick={() => atualizarSessao({ ativa: !sessao.ativa })}>{sessao.ativa ? "Encerrar sessão" : "Reabrir sessão"}</button>
            </div>
          </div>

          {mostrarQR && qrCode && (
            <div className="qr-overlay" onClick={() => setMostrarQR(false)}>
              <div className="qr-modal" onClick={(e) => e.stopPropagation()}>
                <h2>Escaneie para entrar</h2>
                <img src={qrCode} alt="QR Code da sessão" width={280} height={280} />
                <p className="muted-text">Código: <b>{sessao.codigo}</b></p>
                <p className="muted-text" style={{ fontSize: 11 }}>{typeof window !== "undefined" ? window.location.origin : ""}/entrar/{sessao.codigo}</p>
                <button className="outline-button" onClick={() => setMostrarQR(false)}>Fechar</button>
              </div>
            </div>
          )}

          <div className="teacher-grid">
            <section className="presentation-panel" ref={slideAreaRef}>
              {pdfUrl ? (
                <PdfViewer pdfUrl={pdfUrl} pagina={sessao.slideAtual} telaCheia={telaCheia} />
              ) : (
                <div className="slide-preview" aria-label={`Slide ${sessao.slideAtual}`}>
                  <div className="slide-topline" />
                  {slideAtual?.modulo && <span className="slide-kicker">{slideAtual.modulo}</span>}
                  <h2>{slideAtual?.titulo || `Slide ${sessao.slideAtual}`}<br />{slideAtual?.subtitulo && <em>{slideAtual.subtitulo}</em>}</h2>
                  <p style={{ color: "#a2ded1", marginTop: 20, fontSize: 14 }}>Carregue um PDF para exibir a apresentação</p>
                  <div className="slide-number">{String(sessao.slideAtual).padStart(2, "0")}</div>
                  <div className="slide-shape shape-one" /><div className="slide-shape shape-two" />
                </div>
              )}
              <div className={`slide-controls ${telaCheia ? "slide-controls-fullscreen" : ""}`}>
                <button onClick={() => atualizarSessao({ slideAtual: Math.max(1, sessao.slideAtual - 1) })} disabled={sessao.slideAtual === 1}>← Anterior</button>
                <span>Slide <b>{sessao.slideAtual}</b> de {sessao.totalSlides}</span>
                <div style={{ display: "flex", gap: 8 }}>
                  {telaCheia && <button className="outline-button" onClick={toggleTelaCheia} style={{ fontSize: 11 }}>Sair tela cheia</button>}
                  <button className="primary-button" onClick={() => atualizarSessao({ slideAtual: Math.min(sessao.totalSlides, sessao.slideAtual + 1) })} disabled={sessao.slideAtual === sessao.totalSlides}>Próximo →</button>
                </div>
              </div>
            </section>

            <aside className="live-panel" style={{ overflow: "auto", maxHeight: "calc(100vh - 200px)" }}>
              <div className="live-heading">
                <div>
                  <p className="eyebrow">INTERAÇÕES</p>
                  <h3>{perguntaAtiva ? perguntaAtiva.enunciado : resultado ? "Resultado" : "Nenhuma pergunta ativa"}</h3>
                </div>
                {perguntaAtiva && <span className="pill open">Aberta</span>}
              </div>

              {/* Pergunta aberta — aguardando respostas */}
              {perguntaAtiva && (
                <>
                  <div className="responses" style={{ margin: "16px 0" }}>
                    <span>{respostasAtivas} de {totalParticipantes} responderam</span>
                    <div className="progress"><i style={{ width: totalParticipantes > 0 ? `${(respostasAtivas / totalParticipantes) * 100}%` : "0%" }} /></div>
                  </div>
                  <button className="danger-button" onClick={() => alternarPergunta(perguntaAtiva.id, false)}>Encerrar e publicar resultado</button>
                </>
              )}

              {/* Resultado com percentuais inline */}
              {!perguntaAtiva && resultado && (
                <div style={{ marginTop: 16 }}>
                  <div className="result-list">
                    {resultado.resultado.map((r) => (
                      <div className="result-row" key={r.id}>
                        <span className="letter">{r.letra}</span>
                        <div style={{ minWidth: 0 }}>
                          <small style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
                            <span style={{ flex: 1 }}>{r.texto} {r.correta && "✓"}</span>
                            <strong style={{ whiteSpace: "nowrap", color: r.correta ? "#16805f" : "#435662" }}>{r.votos} ({r.percentual}%)</strong>
                          </small>
                          <div className="bar"><i style={{ width: `${r.percentual}%`, background: r.correta ? "#2ca798" : "#339caf" }} /></div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="muted-text" style={{ marginTop: 10 }}>{resultado.totalRespostas} respostas de {totalParticipantes} participantes</p>
                  <div className="live-panel-actions">
                    <button className="primary-button" onClick={() => setProjetarResultado(true)}>⛶ Projetar</button>
                    <button className="outline-button" onClick={() => setResultado(null)}>← Lista</button>
                  </div>
                </div>
              )}

              {/* Lista de perguntas */}
              {!perguntaAtiva && !resultado && sessao.perguntas.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <p className="muted-text" style={{ marginBottom: 8 }}>Perguntas disponíveis:</p>
                  <div className="pergunta-lista">
                    {sessao.perguntas.filter((p) => !p.aberta).map((p) => (
                      <div key={p.id} className="pergunta-item">
                        <div className="pergunta-item-info">
                          <span className={`pergunta-tipo-tag tipo-${p.tipo}`}>{p.tipo}</span>
                          <span className="pergunta-item-texto">{p.enunciado}</span>
                        </div>
                        <div className="pergunta-item-acoes">
                          <button className="primary-button" style={{ fontSize: 11, padding: "6px 12px", whiteSpace: "nowrap" }}
                            onClick={() => { setResultado(null); alternarPergunta(p.id, true); }}>
                            Abrir
                          </button>
                          <button className="outline-button" style={{ fontSize: 11, padding: "6px 10px", whiteSpace: "nowrap" }}
                            onClick={() => { setPerguntaProjetada({ enunciado: p.enunciado, tipo: p.tipo }); carregarResultado(p.id); }}>
                            Ver resultado
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!perguntaAtiva && !resultado && sessao.perguntas.length === 0 && (
                <p className="muted-text" style={{ marginTop: 16 }}>Importe perguntas via arquivo .md na sidebar.</p>
              )}
            </aside>
          </div>

          <section className="bottom-cards">
            <article><span className="card-icon">◉</span><div><strong>{totalParticipantes}</strong><small>participantes conectados</small></div></article>
            <article><span className="card-icon">✓</span><div><strong>{sessao.perguntas.filter((p) => p._count.respostas > 0).length}/{sessao.perguntas.length}</strong><small>questões respondidas / total</small></div></article>
            <article><span className="card-icon">▤</span><div><strong>{sessao.slideAtual}/{sessao.totalSlides}</strong><small>progresso dos slides</small></div></article>
          </section>
        </section>
      </section>

      {/* Projeção fullscreen do resultado */}
      {projetarResultado && resultado && perguntaProjetada && (
        <ResultadoFullscreen
          enunciado={perguntaProjetada.enunciado}
          tipo={perguntaProjetada.tipo}
          resultado={resultado.resultado}
          totalRespostas={resultado.totalRespostas}
          totalParticipantes={totalParticipantes}
          onFechar={() => { setProjetarResultado(false); setResultado(null); }}
        />
      )}
    </main>
  );
}
