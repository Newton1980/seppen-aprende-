"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";

export default function EntrarSessao() {
  const { codigo } = useParams<{ codigo: string }>();
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [matricula, setMatricula] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) { setErro("Informe seu nome"); return; }
    setCarregando(true);
    setErro("");

    try {
      const res = await fetch("/api/entrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo, nome: nome.trim(), matricula: matricula.trim() || undefined }),
      });

      const data = await res.json();
      if (!res.ok) { setErro(data.erro || "Erro ao entrar"); setCarregando(false); return; }

      // Salvar token no sessionStorage
      sessionStorage.setItem("participanteToken", data.participante.token);
      sessionStorage.setItem("participanteNome", data.participante.nome);
      sessionStorage.setItem("sessaoId", data.sessao.id);

      router.push(`/sessao/${data.sessao.id}`);
    } catch {
      setErro("Erro de conexão. Tente novamente.");
      setCarregando(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">S</span><span>SEPPEN <b>Aprende</b></span></div>
      </header>
      <div className="login-container">
        <div className="login-card">
          <p className="eyebrow">ENTRAR NA SESSÃO</p>
          <h1>Código: {codigo}</h1>
          <p className="muted-text">Informe seus dados para participar da capacitação.</p>

          <form onSubmit={entrar} className="login-form">
            <label>
              <span>Nome completo *</span>
              <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" autoFocus />
            </label>
            <label>
              <span>Matrícula <small>(se aplicável)</small></span>
              <input type="text" value={matricula} onChange={(e) => setMatricula(e.target.value)} placeholder="Ex: 123.456-7" />
            </label>

            {erro && <div className="erro-msg">{erro}</div>}

            <button type="submit" className="primary-button wide" disabled={carregando}>
              {carregando ? "Entrando..." : "Entrar na sessão"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
