"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [modo, setModo] = useState<"inicio" | "criar" | "entrar" | "retomar">("inicio");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  // Criar sessão
  const [titulo, setTitulo] = useState("");
  const [professorNome, setProfessorNome] = useState("");
  const [professorPin, setProfessorPin] = useState("");
  const [modoLogin, setModoLogin] = useState("ambos");

  // Entrar como aluno
  const [codigoEntrar, setCodigoEntrar] = useState("");

  // Retomar sessão
  const [codigoRetomar, setCodigoRetomar] = useState("");
  const [pinRetomar, setPinRetomar] = useState("");

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

  async function retomar(e: React.FormEvent) {
    e.preventDefault();
    if (!codigoRetomar || !pinRetomar) { setErro("Preencha código e PIN"); return; }
    setCarregando(true);
    setErro("");

    const res = await fetch("/api/sessoes/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigo: codigoRetomar.toUpperCase(), pin: pinRetomar }),
    });

    if (res.ok) {
      const data = await res.json();
      router.push(`/professor/${data.id}`);
    } else {
      setErro("Código ou PIN incorreto");
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
        <div className="session-state">
          <span style={{ fontSize: 11, opacity: .7 }}>Sistema de Educação Penitenciária</span>
        </div>
      </header>

      <div className="home-hero">
        {modo === "inicio" && (
          <div className="login-card" style={{ textAlign: "center" }}>
            <div className="home-logo">S</div>
            <span className="home-badge">PLATAFORMA DE CAPACITAÇÃO INTERATIVA</span>
            <h1 style={{ fontSize: 26, margin: "8px 0 4px", letterSpacing: "-.5px" }}>SEPPEN Aprende</h1>
            <p className="home-subtitle" style={{ margin: "8px auto 0" }}>
              Apresentações ao vivo com enquetes interativas, avaliações de conhecimento, relatórios de desempenho e certificação institucional.
            </p>
            <div style={{ display: "grid", gap: 12, marginTop: 28 }}>
              <button className="primary-button wide" onClick={() => setModo("criar")} style={{ padding: "14px 16px", fontSize: 15 }}>
                Criar nova capacitação
              </button>
              <button className="outline-button wide" onClick={() => setModo("retomar")} style={{ padding: "12px 16px" }}>
                Retomar sessão existente
              </button>
              <div className="home-divider">OU</div>
              <button className="outline-button wide" onClick={() => setModo("entrar")} style={{ padding: "12px 16px" }}>
                Entrar como aluno
              </button>
            </div>
          </div>
        )}

        {modo === "criar" && (
          <div className="login-card">
            <button className="link-button" onClick={() => { setModo("inicio"); setErro(""); }}>← Voltar</button>
            <span className="home-badge">PROFESSOR / INSTRUTOR</span>
            <h1>Criar capacitação</h1>
            <p className="muted-text" style={{ marginBottom: 4 }}>Configure os dados iniciais da nova sessão de ensino.</p>
            <form onSubmit={criarSessao} className="login-form">
              <label><span>Título da capacitação *</span><input type="text" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: Proteção de Dados - Turma 02" autoFocus /></label>
              <label><span>Seu nome *</span><input type="text" value={professorNome} onChange={(e) => setProfessorNome(e.target.value)} placeholder="Nome do professor/instrutor" /></label>
              <label><span>PIN de acesso *</span><small>Usado para retomar a sessão depois</small><input type="password" value={professorPin} onChange={(e) => setProfessorPin(e.target.value)} placeholder="PIN numérico (ex: 1234)" maxLength={6} /></label>
              <label>
                <span>Modo de login dos alunos</span>
                <select value={modoLogin} onChange={(e) => setModoLogin(e.target.value)} className="select-input">
                  <option value="ambos">Matrícula ou nome</option>
                  <option value="matricula">Somente matrícula</option>
                  <option value="nome">Somente nome</option>
                </select>
              </label>
              {erro && <div className="erro-msg">{erro}</div>}
              <button type="submit" className="primary-button wide" disabled={carregando} style={{ padding: "13px 16px", fontSize: 15 }}>
                {carregando ? "Criando..." : "Criar sessão"}
              </button>
            </form>
          </div>
        )}

        {modo === "retomar" && (
          <div className="login-card">
            <button className="link-button" onClick={() => { setModo("inicio"); setErro(""); }}>← Voltar</button>
            <span className="home-badge">PROFESSOR / INSTRUTOR</span>
            <h1>Retomar sessão</h1>
            <p className="muted-text" style={{ marginBottom: 4 }}>Informe o código e o PIN para acessar uma sessão existente.</p>
            <form onSubmit={retomar} className="login-form">
              <label><span>Código da sessão *</span><input type="text" value={codigoRetomar} onChange={(e) => setCodigoRetomar(e.target.value.toUpperCase())} placeholder="Ex: ABC123" maxLength={6} autoFocus style={{ textTransform: "uppercase", letterSpacing: 3, fontSize: 18, textAlign: "center" }} /></label>
              <label><span>PIN de acesso *</span><input type="password" value={pinRetomar} onChange={(e) => setPinRetomar(e.target.value)} placeholder="PIN definido na criação" maxLength={6} /></label>
              {erro && <div className="erro-msg">{erro}</div>}
              <button type="submit" className="primary-button wide" disabled={carregando} style={{ padding: "13px 16px", fontSize: 15 }}>
                {carregando ? "Verificando..." : "Acessar sessão"}
              </button>
            </form>
          </div>
        )}

        {modo === "entrar" && (
          <div className="login-card">
            <button className="link-button" onClick={() => { setModo("inicio"); setErro(""); }}>← Voltar</button>
            <span className="home-badge">ALUNO / PARTICIPANTE</span>
            <h1>Participar</h1>
            <p className="muted-text">Digite o código informado pelo professor ou escaneie o QR Code.</p>
            <form onSubmit={irEntrar} className="login-form">
              <label><span>Código da sessão *</span><input type="text" value={codigoEntrar} onChange={(e) => setCodigoEntrar(e.target.value.toUpperCase())} placeholder="Ex: ABC123" maxLength={6} autoFocus style={{ textTransform: "uppercase", letterSpacing: 3, fontSize: 20, textAlign: "center" }} /></label>
              {erro && <div className="erro-msg">{erro}</div>}
              <button type="submit" className="primary-button wide" style={{ padding: "13px 16px", fontSize: 15 }}>Continuar</button>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}
