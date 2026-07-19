"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type ResultadoAvaliacao = {
  acertos: number;
  total: number;
  nota: number;
  aprovado: boolean;
};

export default function ConclusaoPage() {
  const { id } = useParams<{ id: string }>();
  const [resultado, setResultado] = useState<ResultadoAvaliacao | null>(null);
  const [nomeParticipante, setNomeParticipante] = useState("");
  const [titulo, setTitulo] = useState("");
  const [animado, setAnimado] = useState(false);
  const [temEbook, setTemEbook] = useState(false);
  const [baixandoEbook, setBaixandoEbook] = useState(false);

  useEffect(() => {
    // Recuperar dados do sessionStorage
    const nome = sessionStorage.getItem("participanteNome") || "";
    setNomeParticipante(nome);

    const resultadoStr = sessionStorage.getItem("avaliacaoResultado");
    if (resultadoStr) {
      try { setResultado(JSON.parse(resultadoStr)); } catch { /* ok */ }
    }

    // Buscar título da sessão e verificar ebook
    fetch(`/api/sessoes/${id}`).then((r) => r.json()).then((s) => {
      setTitulo(s.titulo);
      if (s.ebookPath) setTemEbook(true);
    }).catch(() => {});

    // Trigger animação
    setTimeout(() => setAnimado(true), 200);
  }, [id]);

  const nota = resultado?.nota ?? 0;
  const aprovado = resultado?.aprovado ?? false;
  const percentual = resultado ? Math.round((resultado.acertos / resultado.total) * 100) : 0;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">S</span><span>SEPPEN <b>Aprende</b></span></div>
      </header>

      <div className="conclusao-container">
        <div className={`conclusao-card ${animado ? "conclusao-animada" : ""}`}>
          {/* Ícone de conclusão */}
          <div className={`conclusao-icone ${aprovado ? "conclusao-aprovado" : resultado ? "conclusao-reprovado" : "conclusao-neutro"}`}>
            {!resultado ? "🎓" : aprovado ? "🏆" : "📋"}
          </div>

          <h1 className="conclusao-titulo">
            {!resultado ? "Capacitação concluída!" : aprovado ? "Parabéns, você foi aprovado!" : "Capacitação concluída"}
          </h1>

          <p className="conclusao-nome">{nomeParticipante}</p>
          {titulo && <p className="conclusao-sessao">{titulo}</p>}

          {resultado && (
            <div className="conclusao-resultado">
              {/* Indicador circular de nota */}
              <div className="conclusao-nota-circle">
                <svg viewBox="0 0 120 120" className="conclusao-svg">
                  <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
                  <circle
                    cx="60" cy="60" r="52" fill="none"
                    stroke={aprovado ? "#0fa97a" : "#ee744f"}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 52}`}
                    strokeDashoffset={animado ? `${2 * Math.PI * 52 * (1 - nota / 10)}` : `${2 * Math.PI * 52}`}
                    transform="rotate(-90 60 60)"
                    style={{ transition: "stroke-dashoffset 1.5s ease-out 0.5s" }}
                  />
                </svg>
                <div className="conclusao-nota-valor">
                  <span className="conclusao-nota-num">{nota.toFixed(1)}</span>
                  <span className="conclusao-nota-max">/10</span>
                </div>
              </div>

              <div className="conclusao-detalhes">
                <div className="conclusao-detalhe">
                  <span className="conclusao-detalhe-label">Acertos</span>
                  <span className="conclusao-detalhe-valor">{resultado.acertos} de {resultado.total}</span>
                </div>
                <div className="conclusao-detalhe">
                  <span className="conclusao-detalhe-label">Aproveitamento</span>
                  <span className="conclusao-detalhe-valor">{percentual}%</span>
                </div>
                <div className="conclusao-detalhe">
                  <span className="conclusao-detalhe-label">Situação</span>
                  <span className={`conclusao-status ${aprovado ? "status-aprovado" : "status-reprovado"}`}>
                    {aprovado ? "APROVADO" : "NÃO ATINGIU A NOTA MÍNIMA"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {!resultado && (
            <div className="conclusao-msg-simples">
              <p>Obrigado por participar desta capacitação.</p>
              <p>Sua presença e suas respostas foram registradas.</p>
            </div>
          )}

          {/* Botão de download do ebook */}
          {temEbook && (
            <div style={{ margin: "24px 0 8px", textAlign: "center" }}>
              <button
                className="primary-button"
                disabled={baixandoEbook}
                onClick={async () => {
                  setBaixandoEbook(true);
                  const token = sessionStorage.getItem("participanteToken") || "";
                  const res = await fetch(`/api/sessoes/${id}/ebook?token=${token}`);
                  if (res.ok) {
                    const blob = await res.blob();
                    const disposition = res.headers.get("Content-Disposition") || "";
                    const match = disposition.match(/filename="(.+)"/);
                    const filename = match ? match[1] : "ebook.pdf";
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = filename;
                    a.click();
                    URL.revokeObjectURL(url);
                  }
                  setBaixandoEbook(false);
                }}
                style={{ fontSize: 15, padding: "12px 32px" }}
              >
                {baixandoEbook ? "Baixando..." : "📚 Baixar Material Complementar (Ebook)"}
              </button>
            </div>
          )}

          <div className="conclusao-footer">
            <p>Este registro ficará armazenado para fins de certificação institucional.</p>
            <p className="conclusao-seppen">SEPPEN Aprende · Sistema de Educação Penitenciária</p>
          </div>
        </div>
      </div>
    </main>
  );
}
