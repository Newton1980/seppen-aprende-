"use client";

import { useEffect, useRef, useState } from "react";

type OpcaoResultado = {
  id: string;
  letra: string;
  texto: string;
  correta: boolean;
  votos: number;
  percentual: number;
};

type Props = {
  enunciado: string;
  tipo: string;
  resultado: OpcaoResultado[];
  totalRespostas: number;
  totalParticipantes: number;
  onFechar: () => void;
};

export default function ResultadoFullscreen({
  enunciado,
  tipo,
  resultado,
  totalRespostas,
  totalParticipantes,
  onFechar,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [animado, setAnimado] = useState(false);
  const [mostrarCorreta, setMostrarCorreta] = useState(false);
  const [confetes, setConfetes] = useState<{ id: number; x: number; y: number; cor: string; delay: number; rotacao: number }[]>([]);

  const maxPercentual = Math.max(...resultado.map((r) => r.percentual), 1);
  const temCorreta = resultado.some((r) => r.correta);
  const tipoLabel =
    tipo === "enquete" ? "ENQUETE" :
    tipo === "conhecimento" ? "QUESTÃO DE CONHECIMENTO" :
    tipo === "avaliacao" ? "AVALIAÇÃO" : "PESQUISA";

  useEffect(() => {
    // Entrar em fullscreen
    if (containerRef.current) {
      containerRef.current.requestFullscreen?.().catch(() => {});
    }

    // Disparar animação das barras após montar
    const t1 = setTimeout(() => setAnimado(true), 100);

    // NÃO revelar automaticamente — só pelo botão do professor

    // Listener para sair do fullscreen
    const handleFsChange = () => {
      if (!document.fullscreenElement) onFechar();
    };
    document.addEventListener("fullscreenchange", handleFsChange);

    // Listener ESC
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        document.exitFullscreen?.().catch(() => {});
        onFechar();
      }
    };
    document.addEventListener("keydown", handleKey);

    return () => {
      clearTimeout(t1);
      document.removeEventListener("fullscreenchange", handleFsChange);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onFechar]);

  function revelarCorreta() {
    setMostrarCorreta(true);
    const novosConfetes = Array.from({ length: 40 }, (_, i) => ({
      id: i,
      x: 20 + Math.random() * 60,
      y: 5 + Math.random() * 25,
      cor: ["#1ca59a", "#e4b968", "#087aa1", "#ee744f", "#5ed1b6", "#fff"][Math.floor(Math.random() * 6)],
      delay: Math.random() * 0.6,
      rotacao: Math.random() * 360,
    }));
    setConfetes(novosConfetes);
  }

  function corBarra(opcao: OpcaoResultado) {
    if (!mostrarCorreta) return "var(--rf-bar-default)";
    if (opcao.correta) return "var(--rf-bar-correta)";
    return "var(--rf-bar-errada)";
  }

  return (
    <div ref={containerRef} className="rf-overlay">
      {/* Fundo com partículas decorativas */}
      <div className="rf-bg-particles">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rf-particle" style={{ animationDelay: `${i * 1.2}s`, left: `${10 + i * 15}%`, top: `${20 + (i % 3) * 25}%` }} />
        ))}
      </div>

      {/* Confetes ao revelar correta */}
      {confetes.map((c) => (
        <div key={c.id} className="rf-confete" style={{
          left: `${c.x}%`,
          top: `${c.y}%`,
          background: c.cor,
          animationDelay: `${c.delay}s`,
          transform: `rotate(${c.rotacao}deg)`,
        }} />
      ))}

      <div className="rf-content">
        {/* Header */}
        <div className="rf-header">
          <span className="rf-tipo-badge">{tipoLabel}</span>
          <h1 className="rf-enunciado">{enunciado}</h1>
          <p className="rf-stats">
            <span className="rf-stat-num">{totalRespostas}</span> {totalRespostas === 1 ? "resposta" : "respostas"} de <span className="rf-stat-num">{totalParticipantes}</span> participantes
            <span className="rf-stat-pct">({totalParticipantes > 0 ? Math.round((totalRespostas / totalParticipantes) * 100) : 0}% de participação)</span>
          </p>
        </div>

        {/* Barras de resultado */}
        <div className="rf-barras">
          {resultado.map((opcao, idx) => {
            const isCorreta = mostrarCorreta && opcao.correta;
            const isErrada = mostrarCorreta && !opcao.correta && temCorreta;
            const isMaisVotada = opcao.percentual === maxPercentual && opcao.percentual > 0 && !mostrarCorreta;

            return (
              <div
                key={opcao.id}
                className={`rf-opcao ${isCorreta ? "rf-correta" : ""} ${isErrada ? "rf-errada" : ""} ${isMaisVotada ? "rf-mais-votada" : ""}`}
                style={{ animationDelay: `${idx * 0.15}s` }}
              >
                <div className="rf-opcao-header">
                  <span className={`rf-letra ${isCorreta ? "rf-letra-correta" : ""}`}>
                    {opcao.letra}
                    {isCorreta && <span className="rf-check">✓</span>}
                  </span>
                  <span className="rf-texto">{opcao.texto}</span>
                  <span className={`rf-percentual ${isCorreta ? "rf-pct-correta" : ""}`}>
                    {opcao.percentual}%
                  </span>
                </div>
                <div className="rf-barra-track">
                  <div
                    className="rf-barra-fill"
                    style={{
                      width: animado ? `${opcao.percentual}%` : "0%",
                      background: corBarra(opcao),
                      transitionDelay: `${idx * 0.15 + 0.3}s`,
                    }}
                  />
                </div>
                <div className="rf-votos-label">
                  {opcao.votos} {opcao.votos === 1 ? "voto" : "votos"}
                </div>
              </div>
            );
          })}
        </div>

        {/* Rodapé — sempre visível */}
        <div className="rf-footer">
          {temCorreta && !mostrarCorreta && (
            <button className="rf-btn-revelar" onClick={revelarCorreta}>
              ★ Revelar resposta correta
            </button>
          )}
          {mostrarCorreta && temCorreta && (
            <div className="rf-resposta-certa-banner">
              ✓ Resposta correta: <strong>{resultado.find((r) => r.correta)?.letra} — {resultado.find((r) => r.correta)?.texto}</strong>
            </div>
          )}
          <button className="rf-btn-fechar" onClick={() => {
            document.exitFullscreen?.().catch(() => {});
            onFechar();
          }}>
            Sair da projeção
          </button>
        </div>
      </div>

      {/* Marca d'água */}
      <div className="rf-watermark">SEPPEN Aprende</div>
    </div>
  );
}
