"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [modo, setModo] = useState<"inicio" | "criar" | "entrar">("inicio");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  // Criar sessão
  const [titulo, setTitulo] = useState("");
  const [professorNome, setProfessorNome] = useState("");
  const [professorPin, setProfessorPin] = useState("");
  const [modoLogin, setModoLogin] = useState("ambos");

  // Entrar como aluno
  const [codigoEntrar, setCodigoEntrar] = useState("");

  async function criarSessao(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo || !professorNome || !professorPin) { setErro("Preencha todos os campos"); return; }
    setCarregando(true);
    setErro("");

    const res = await fetch("/api/sessoes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        titulo, professorNome, professorPin, modoLogin,
        slides: [
          { titulo: "Bem-vindos", subtitulo: "Capacitação Institucional", modulo: "ABERTURA" },
          { titulo: "Objetivos", subtitulo: "O que vamos aprender", modulo: "MÓDULO 01" },
        ],
      }),
    });

    if (res.ok) {
      const sessao = await res.json();
      router.push(`/professor/${sessao.id}`);
    } else {
      setErro("Erro ao criar sessão");
      setCarregando(false);
    }
  }

  function irEntrar(e: React.FormEvent) {
    e.preventDefault();
    if (!codigoEntrar.trim()) { setErro("Informe o código"); return; }
    router.push(`/entrar/${codigoEntrar.trim().toUpperCase()}`);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">S</span><span>SEPPEN <b>Aprende</b></span></div>
      </header>

      <div className="login-container">
        {modo === "inicio" && (
          <div className="login-card" style={{ textAlign: "center" }}>
            <p className="eyebrow">PLATAFORMA DE CAPACITAÇÃO INTERATIVA</p>
            <h1>SEPPEN Aprende</h1>
            <p className="muted-text">Apresentações ao vivo com enquetes, avaliações e relatórios de conclusão.</p>
            <div style={{ display: "grid", gap: 12, marginTop: 28 }}>
              <button className="primary-button wide" onClick={() => setModo("criar")}>Criar nova sessão (Professor)</button>
              <button className="outline-button wide" onClick={() => setModo("entrar")}>Entrar em sessão (Aluno)</button>
            </div>
          </div>
        )}

        {modo === "criar" && (
          <div className="login-card">
            <button className="link-button" onClick={() => { setModo("inicio"); setErro(""); }}>← Voltar</button>
            <p className="eyebrow">NOVA SESSÃO</p>
            <h1>Criar capacitação</h1>
            <form onSubmit={criarSessao} className="login-form">
              <label><span>Título da capacitação *</span><input type="text" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: Proteção de Dados - Turma 02" autoFocus /></label>
              <label><span>Seu nome *</span><input type="text" value={professorNome} onChange={(e) => setProfessorNome(e.target.value)} placeholder="Nome do professor/instrutor" /></label>
              <label><span>PIN de acesso *</span><input type="password" value={professorPin} onChange={(e) => setProfessorPin(e.target.value)} placeholder="PIN numérico para retomar" maxLength={6} /></label>
              <label>
                <span>Modo de login dos alunos</span>
                <select value={modoLogin} onChange={(e) => setModoLogin(e.target.value)} className="select-input">
                  <option value="ambos">Matrícula ou nome</option>
                  <option value="matricula">Somente matrícula</option>
                  <option value="nome">Somente nome</option>
                </select>
              </label>
              {erro && <div className="erro-msg">{erro}</div>}
              <button type="submit" className="primary-button wide" disabled={carregando}>{carregando ? "Criando..." : "Criar sessão"}</button>
            </form>
          </div>
        )}

        {modo === "entrar" && (
          <div className="login-card">
            <button className="link-button" onClick={() => { setModo("inicio"); setErro(""); }}>← Voltar</button>
            <p className="eyebrow">ENTRAR NA SESSÃO</p>
            <h1>Participar</h1>
            <p className="muted-text">Digite o código informado pelo professor ou escaneie o QR Code.</p>
            <form onSubmit={irEntrar} className="login-form">
              <label><span>Código da sessão *</span><input type="text" value={codigoEntrar} onChange={(e) => setCodigoEntrar(e.target.value.toUpperCase())} placeholder="Ex: ABC123" maxLength={6} autoFocus style={{ textTransform: "uppercase", letterSpacing: 3, fontSize: 20, textAlign: "center" }} /></label>
              {erro && <div className="erro-msg">{erro}</div>}
              <button type="submit" className="primary-button wide">Continuar</button>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}
