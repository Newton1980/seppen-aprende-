"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Distribuicao = { letra: string; texto: string; correta: boolean; votos: number; percentual: number };
type Questao = { enunciado: string; tipo: string; totalRespostas: number; acertos: number; percentualAcerto: number; distribuicao: Distribuicao[] };
type Presenca = { nome: string; matricula: string; entrada: string; presente: boolean; concluiu: boolean };
type Desempenho = { nome: string; matricula: string; nota: number | null; aprovado: boolean | null; totalRespostas: number };
type Resumo = { titulo: string; codigo: string; professor: string; criadaEm: string; totalParticipantes: number; totalPerguntas: number; mediaTurma: number | null; aprovados: number; reprovados: number; concluiram: number; diplomaTemplate: string | null; cargaHoraria: number | null };
type Relatorio = { resumo: Resumo; presenca: Presenca[]; desempenho: Desempenho[]; questoes: Questao[] };

type AbaAtiva = "resumo" | "presenca" | "desempenho" | "questoes" | "diplomas";

export default function RelatoriosPage() {
  const { id } = useParams<{ id: string }>();
  const [dados, setDados] = useState<Relatorio | null>(null);
  const [aba, setAba] = useState<AbaAtiva>("resumo");
  const [exportando, setExportando] = useState("");
  const [cargaHoraria, setCargaHoraria] = useState("");
  const [templateEnviado, setTemplateEnviado] = useState(false);
  const [uploadingTemplate, setUploadingTemplate] = useState(false);
  const [diplomaMsg, setDiplomaMsg] = useState("");

  const carregar = useCallback(async () => {
    const res = await fetch(`/api/sessoes/${id}/relatorios`);
    if (res.ok) {
      const data = await res.json();
      setDados(data);
      if (data.resumo.diplomaTemplate) setTemplateEnviado(true);
      if (data.resumo.cargaHoraria) setCargaHoraria(String(data.resumo.cargaHoraria));
    }
  }, [id]);

  useEffect(() => { carregar(); }, [carregar]);

  async function exportar(formato: "xlsx" | "pdf") {
    setExportando(formato);
    const res = await fetch(`/api/sessoes/${id}/exportar/${formato}`);
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `relatorio-${dados?.resumo.codigo || id}.${formato}`;
      a.click();
      URL.revokeObjectURL(url);
    }
    setExportando("");
  }

  if (!dados) return (
    <div className="app-shell">
      <header className="topbar"><div className="brand"><span className="brand-mark">S</span><span>SEPPEN <b>Aprende</b></span></div></header>
      <div className="login-container"><p>Carregando relatórios...</p></div>
    </div>
  );

  const { resumo, presenca, desempenho, questoes } = dados;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">S</span><span>SEPPEN <b>Aprende</b></span></div>
        <div className="session-state">Relatórios</div>
      </header>

      <div className="rel-container">
        {/* Header */}
        <div className="rel-header">
          <div>
            <p className="eyebrow">RELATÓRIOS DA CAPACITAÇÃO</p>
            <h1 className="rel-titulo">{resumo.titulo}</h1>
            <p className="muted-text">Código: {resumo.codigo} · Prof. {resumo.professor} · {new Date(resumo.criadaEm).toLocaleDateString("pt-BR")}</p>
          </div>
          <div className="rel-export-btns">
            <button className="primary-button" onClick={() => exportar("xlsx")} disabled={!!exportando}>
              {exportando === "xlsx" ? "Gerando..." : "Exportar Excel"}
            </button>
            <button className="outline-button" onClick={() => exportar("pdf")} disabled={!!exportando}>
              {exportando === "pdf" ? "Gerando..." : "Exportar PDF"}
            </button>
            <a className="outline-button" href={`/professor/${id}`} style={{ textDecoration: "none", textAlign: "center" }}>← Voltar</a>
          </div>
        </div>

        {/* Abas */}
        <div className="rel-abas">
          {(["resumo", "presenca", "desempenho", "questoes", "diplomas"] as AbaAtiva[]).map((a) => (
            <button key={a} className={`rel-aba ${aba === a ? "rel-aba-ativa" : ""}`} onClick={() => setAba(a)}>
              {a === "resumo" ? "Resumo" : a === "presenca" ? "Presença" : a === "desempenho" ? "Desempenho" : a === "questoes" ? "Questões" : "Diplomas"}
            </button>
          ))}
        </div>

        {/* Conteúdo */}
        <div className="rel-conteudo">

          {/* ABA RESUMO */}
          {aba === "resumo" && (
            <div className="rel-resumo-grid">
              <div className="rel-card-stat">
                <span className="rel-card-num">{resumo.totalParticipantes}</span>
                <span className="rel-card-label">Participantes</span>
              </div>
              <div className="rel-card-stat">
                <span className="rel-card-num">{resumo.totalPerguntas}</span>
                <span className="rel-card-label">Questões</span>
              </div>
              <div className="rel-card-stat">
                <span className="rel-card-num">{resumo.mediaTurma !== null ? resumo.mediaTurma.toFixed(1) : "—"}</span>
                <span className="rel-card-label">Média da turma</span>
              </div>
              <div className="rel-card-stat">
                <span className="rel-card-num rel-aprovado">{resumo.aprovados}</span>
                <span className="rel-card-label">Aprovados</span>
              </div>
              <div className="rel-card-stat">
                <span className="rel-card-num rel-reprovado">{resumo.reprovados}</span>
                <span className="rel-card-label">Reprovados</span>
              </div>
              <div className="rel-card-stat">
                <span className="rel-card-num">{resumo.concluiram}</span>
                <span className="rel-card-label">Concluíram</span>
              </div>
            </div>
          )}

          {/* ABA PRESENÇA */}
          {aba === "presenca" && (
            <div className="rel-tabela-wrap">
              <table className="rel-tabela">
                <thead>
                  <tr><th>Nome</th><th>Matrícula</th><th>Entrada</th><th>Presente</th><th>Concluiu</th></tr>
                </thead>
                <tbody>
                  {presenca.map((p, i) => (
                    <tr key={i}>
                      <td>{p.nome}</td>
                      <td>{p.matricula}</td>
                      <td>{new Date(p.entrada).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</td>
                      <td><span className={p.presente ? "rel-tag-ok" : "rel-tag-no"}>{p.presente ? "Sim" : "Não"}</span></td>
                      <td><span className={p.concluiu ? "rel-tag-ok" : "rel-tag-no"}>{p.concluiu ? "Sim" : "Não"}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ABA DESEMPENHO */}
          {aba === "desempenho" && (
            <div className="rel-tabela-wrap">
              <table className="rel-tabela">
                <thead>
                  <tr><th>Nome</th><th>Matrícula</th><th>Nota</th><th>Situação</th><th>Respostas</th></tr>
                </thead>
                <tbody>
                  {desempenho.map((d, i) => (
                    <tr key={i}>
                      <td>{d.nome}</td>
                      <td>{d.matricula}</td>
                      <td style={{ fontWeight: 700 }}>{d.nota !== null ? d.nota.toFixed(1) : "—"}</td>
                      <td>
                        {d.aprovado === null ? <span className="rel-tag-neutro">Pendente</span> :
                         d.aprovado ? <span className="rel-tag-ok">Aprovado</span> :
                         <span className="rel-tag-no">Reprovado</span>}
                      </td>
                      <td>{d.totalRespostas}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ABA DIPLOMAS */}
          {aba === "diplomas" && (
            <div className="rel-diploma-section">
              <div className="rel-questao-card">
                <h4 className="rel-questao-enunciado" style={{ marginBottom: 16 }}>Geração de Diplomas em Lote</h4>
                <p className="muted-text" style={{ marginBottom: 20, lineHeight: 1.5 }}>
                  Envie o PDF modelo do certificado. O sistema usa esse PDF como fundo e sobrescreve automaticamente o <strong>nome do aluno</strong>, o <strong>texto descritivo</strong> e a <strong>data de conclusão</strong> para cada aluno aprovado.
                </p>

                {/* Carga horária */}
                <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
                  <label style={{ fontSize: 13, fontWeight: 600 }}>Carga horária (horas):</label>
                  <input
                    type="number"
                    value={cargaHoraria}
                    onChange={(e) => setCargaHoraria(e.target.value)}
                    placeholder="Ex: 20"
                    style={{ width: 100, padding: "8px 12px", border: "1px solid #b8c8cd", borderRadius: 6, fontSize: 13 }}
                  />
                </div>

                {/* Upload template */}
                <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
                  <label className="outline-button" style={{ cursor: "pointer", display: "inline-block" }}>
                    {uploadingTemplate ? "Enviando..." : templateEnviado ? "Trocar template" : "Enviar template PDF"}
                    <input
                      type="file"
                      accept=".pdf"
                      style={{ display: "none" }}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setUploadingTemplate(true);
                        setDiplomaMsg("");
                        const fd = new FormData();
                        fd.append("template", file);
                        if (cargaHoraria) fd.append("cargaHoraria", cargaHoraria);
                        const res = await fetch(`/api/sessoes/${id}/diploma-template`, { method: "POST", body: fd });
                        if (res.ok) {
                          setTemplateEnviado(true);
                          setDiplomaMsg("Template enviado com sucesso!");
                        } else {
                          const err = await res.json();
                          setDiplomaMsg(err.erro || "Erro ao enviar template");
                        }
                        setUploadingTemplate(false);
                      }}
                    />
                  </label>
                  {templateEnviado && <span className="rel-tag-ok">Template configurado</span>}
                </div>

                {diplomaMsg && <p style={{ fontSize: 12, color: diplomaMsg.includes("sucesso") ? "#1ca59a" : "#ee744f", marginBottom: 12 }}>{diplomaMsg}</p>}

                {/* Gerar diplomas */}
                <div style={{ borderTop: "1px solid #edf1f2", paddingTop: 16 }}>
                  <p className="muted-text" style={{ marginBottom: 12 }}>
                    {resumo.aprovados} aluno(s) aprovado(s) receberão diploma.
                  </p>
                  <button
                    className="primary-button"
                    disabled={!templateEnviado || resumo.aprovados === 0 || exportando === "diplomas"}
                    onClick={async () => {
                      setExportando("diplomas");
                      setDiplomaMsg("");
                      const res = await fetch(`/api/sessoes/${id}/diplomas`);
                      if (res.ok) {
                        const blob = await res.blob();
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `diplomas-${resumo.codigo}.zip`;
                        a.click();
                        URL.revokeObjectURL(url);
                      } else {
                        const err = await res.json();
                        setDiplomaMsg(err.erro || "Erro ao gerar diplomas");
                      }
                      setExportando("");
                    }}
                  >
                    {exportando === "diplomas" ? "Gerando diplomas..." : "Gerar todos os diplomas (ZIP)"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ABA QUESTÕES */}
          {aba === "questoes" && (
            <div className="rel-questoes">
              {questoes.map((q, i) => (
                <div key={i} className="rel-questao-card">
                  <div className="rel-questao-header">
                    <span className={`pergunta-tipo-tag tipo-${q.tipo}`}>{q.tipo}</span>
                    <span className="rel-questao-acerto">{q.percentualAcerto}% acerto</span>
                  </div>
                  <h4 className="rel-questao-enunciado">{q.enunciado}</h4>
                  <p className="muted-text" style={{ fontSize: 11, margin: "4px 0 10px" }}>{q.totalRespostas} respostas</p>
                  <div className="rel-questao-barras">
                    {q.distribuicao.map((d) => (
                      <div key={d.letra} className="rel-dist-row">
                        <span className={`rel-dist-letra ${d.correta ? "rel-dist-correta" : ""}`}>{d.letra}</span>
                        <div className="rel-dist-info">
                          <div className="rel-dist-texto-row">
                            <span className="rel-dist-texto">{d.texto}</span>
                            <span className="rel-dist-pct">{d.votos} ({d.percentual}%)</span>
                          </div>
                          <div className="rel-dist-track">
                            <div className="rel-dist-fill" style={{ width: `${d.percentual}%`, background: d.correta ? "#1ca59a" : "#b8c8cd" }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
