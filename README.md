# SEPPEN Aprende

**Sistema de Educação Penitenciária — Plataforma de Capacitação Interativa**

Desenvolvido para a **Secretaria de Estado de Administração Penitenciária do Rio de Janeiro (SEAP-RJ)**, o SEPPEN Aprende é uma plataforma web de capacitação presencial interativa voltada para a formação de policiais penais na **Academia de Administração Penitenciária (ACADEPEN)**.

O sistema permite que um professor conduza uma sessão de treinamento ao vivo com apresentação de slides, enquetes em tempo real, avaliação final, pesquisa de satisfação e emissão de diplomas — tudo em uma interface web acessível por qualquer dispositivo.

---

## Sumário

1. [Visão Geral](#visão-geral)
2. [Stack Tecnológica](#stack-tecnológica)
3. [Arquitetura](#arquitetura)
4. [Estrutura de Arquivos](#estrutura-de-arquivos)
5. [Modelos de Dados (Prisma)](#modelos-de-dados-prisma)
6. [API Routes](#api-routes)
7. [Páginas da Aplicação](#páginas-da-aplicação)
8. [Funcionalidades](#funcionalidades)
9. [Formato de Perguntas (.md)](#formato-de-perguntas-md)
10. [Instalação e Execução](#instalação-e-execução)
11. [Variáveis de Ambiente](#variáveis-de-ambiente)
12. [Deploy em Produção](#deploy-em-produção)
13. [Histórico de Versões](#histórico-de-versões)

---

## Visão Geral

O fluxo completo de uma sessão de capacitação:

1. **Professor cria a sessão** na tela inicial, definindo título, código de acesso, PIN e carga horária
2. **Alunos acessam** via código ou QR Code pelo celular/computador
3. **Professor conduz a aula** com slides PDF sincronizados em tempo real para todos os alunos
4. **Enquetes e perguntas** são disparadas durante a apresentação e os alunos respondem ao vivo
5. **Avaliação final** com questões de múltipla escolha e cálculo automático de nota
6. **Pesquisa de satisfação** anônima sobre a qualidade da capacitação
7. **Tela de conclusão** com resultado individual (nota, aprovação, percentual)
8. **Relatórios** com dados consolidados, exportação em Excel e PDF
9. **Diplomas** gerados em lote a partir de template Word (.docx)
10. **Ebook** disponibilizado para download pelos alunos

---

## Stack Tecnológica

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| Framework | Next.js (App Router) | 16.2.10 |
| Linguagem | TypeScript | 5.x |
| UI/CSS | Tailwind CSS + CSS customizado | 4.x |
| ORM | Prisma | 6.9.x |
| Banco de Dados (dev) | SQLite | — |
| Banco de Dados (prod) | PostgreSQL | — |
| Tempo Real | Pusher Channels (WebSocket) | pusher 5.2 / pusher-js 8.4 |
| PDF Viewer | pdfjs-dist | 4.10.x |
| PDF Generation | pdf-lib + PDFKit | 1.17 / 0.19 |
| Excel Export | ExcelJS | 4.4.x |
| Diplomas | docxtemplater + PizZip | 3.69 / 3.2 |
| QR Code | qrcode | 1.5.x |
| ZIP | JSZip | 3.10.x |
| Runtime | React | 19.2.4 |

---

## Arquitetura

```
┌─────────────────────────────────────────────────┐
│                  NAVEGADOR                       │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │  Aluno   │  │Professor │  │   Home/Login   │  │
│  │ (sessao) │  │(professor│  │   (page.tsx)   │  │
│  │          │  │ /relat.) │  │                │  │
│  └────┬─────┘  └────┬─────┘  └───────┬───────┘  │
│       │              │                │          │
│       └──────┬───────┘                │          │
│              │ Pusher (WebSocket)     │          │
│              │ + REST API             │          │
└──────────────┼────────────────────────┼──────────┘
               │                        │
┌──────────────▼────────────────────────▼──────────┐
│              NEXT.JS SERVER (App Router)          │
│  ┌────────────────────────────────────────────┐   │
│  │           API Routes (/api/...)             │   │
│  │  sessoes · entrar · perguntas · respostas  │   │
│  │  avaliacoes · relatorios · exportar        │   │
│  │  diplomas · ebook · qrcode                 │   │
│  └──────────────────┬─────────────────────────┘   │
│                     │                             │
│  ┌──────────────────▼─────────────────────────┐   │
│  │         Prisma ORM                          │   │
│  │  SQLite (dev) / PostgreSQL (prod)           │   │
│  └─────────────────────────────────────────────┘   │
│                                                    │
│  ┌─────────────────────────────────────────────┐   │
│  │  Pusher Server SDK → Broadcast de eventos   │   │
│  │  • slide-changed   • enquete-aberta         │   │
│  │  • enquete-resultado • fase-changed         │   │
│  └─────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────┘
```

---

## Estrutura de Arquivos

```
src/
├── app/
│   ├── globals.css                    # Estilos globais (todo o CSS da aplicação)
│   ├── layout.tsx                     # Layout raiz (html, body)
│   ├── page.tsx                       # Tela inicial (criar/retomar sessão)
│   ├── entrar/
│   │   └── [codigo]/page.tsx          # Login do aluno via código da sessão
│   ├── professor/
│   │   └── [id]/
│   │       ├── page.tsx               # Painel do professor (slides, enquetes, controles)
│   │       └── relatorios/page.tsx    # Relatórios e exportações
│   ├── sessao/
│   │   └── [id]/
│   │       ├── page.tsx               # Visão do aluno (slides + respostas ao vivo)
│   │       ├── avaliacao/page.tsx     # Avaliação final do aluno
│   │       ├── pesquisa/page.tsx      # Pesquisa de satisfação
│   │       └── conclusao/page.tsx     # Tela de conclusão com resultado
│   └── api/
│       ├── sessoes/
│       │   ├── route.ts               # POST criar sessão / GET listar
│       │   ├── auth/route.ts          # POST autenticar professor (PIN)
│       │   └── [id]/
│       │       ├── route.ts           # GET/PATCH dados da sessão
│       │       ├── qrcode/route.ts    # GET gerar QR Code (PNG)
│       │       ├── upload-pdf/route.ts       # POST upload de slides PDF
│       │       ├── upload-perguntas/route.ts # POST upload de perguntas .md
│       │       ├── relatorios/route.ts       # GET dados consolidados
│       │       ├── reiniciar-avaliacao/route.ts # POST reiniciar avaliação
│       │       ├── diploma-template/route.ts    # POST upload template .docx
│       │       ├── diplomas/route.ts            # GET gerar diplomas ZIP
│       │       ├── ebook/route.ts               # POST upload / GET download
│       │       └── exportar/
│       │           ├── xlsx/route.ts  # GET exportar relatório Excel
│       │           └── pdf/route.ts   # GET exportar relatório PDF
│       ├── entrar/route.ts            # POST aluno entrar na sessão
│       ├── perguntas/
│       │   ├── route.ts               # POST criar pergunta
│       │   └── [id]/route.ts          # PATCH abrir/fechar enquete
│       ├── respostas/route.ts         # POST registrar resposta do aluno
│       └── avaliacoes/route.ts        # POST enviar avaliação/pesquisa
├── components/
│   ├── PdfViewer.tsx                  # Renderizador de PDF com pdfjs-dist
│   └── ResultadoFullscreen.tsx        # Overlay fullscreen de resultados
├── lib/
│   ├── prisma.ts                      # Instância singleton do Prisma Client
│   ├── pusher-server.ts               # getPusher() — SDK server do Pusher
│   ├── pusher-client.ts               # getPusherClient() — SDK client do Pusher
│   ├── parser-perguntas.ts            # Parser de arquivo .md para perguntas
│   └── qrcode.ts                      # Gerador de QR Code (base64 PNG)
├── prisma/
│   └── schema.prisma                  # Schema do banco de dados
└── public/
    ├── images/
    │   ├── brasao-pp-rj.png           # Brasão da Polícia Penal do RJ
    │   └── fundo-acadepen.jpg         # Foto panorâmica da ACADEPEN
    ├── exemplo-perguntas.md           # Arquivo modelo de perguntas
    └── uploads/                       # Arquivos enviados (PDFs, templates)
```

---

## Modelos de Dados (Prisma)

O schema usa 6 modelos principais:

- **Sessao** — representa uma capacitação com título, código de acesso, PIN do professor, controle de slides, fase atual (`aula` → `avaliacao` → `pesquisa` → `concluida`), carga horária, template de diploma e ebook.
- **Slide** — slides extraídos do PDF, com ordem, título, subtítulo e módulo.
- **Participante** — aluno inscrito na sessão, com nome, matrícula, token de sessão, nota e status de aprovação.
- **Pergunta** — questão vinculada a um slide ou à sessão, com tipo (`enquete`, `conhecimento`, `avaliacao`, `pesquisa`).
- **OpcaoResposta** — alternativas de cada pergunta, com letra, texto e flag `correta`.
- **RespostaParticipante** — resposta individual do aluno a uma pergunta específica.
- **AvaliacaoResposta** — registro consolidado da avaliação final ou pesquisa de satisfação.

---

## API Routes

| Rota | Método | Descrição |
|------|--------|-----------|
| `/api/sessoes` | POST | Criar nova sessão de capacitação |
| `/api/sessoes` | GET | Listar sessões existentes |
| `/api/sessoes/auth` | POST | Autenticar professor via PIN |
| `/api/sessoes/[id]` | GET | Obter dados completos da sessão |
| `/api/sessoes/[id]` | PATCH | Atualizar sessão (slide atual, fase, encerrar) |
| `/api/sessoes/[id]/qrcode` | GET | Gerar QR Code da sessão (PNG base64) |
| `/api/sessoes/[id]/upload-pdf` | POST | Upload de apresentação em PDF |
| `/api/sessoes/[id]/upload-perguntas` | POST | Upload de perguntas em formato .md |
| `/api/sessoes/[id]/relatorios` | GET | Dados consolidados para relatórios |
| `/api/sessoes/[id]/reiniciar-avaliacao` | POST | Zerar respostas da avaliação |
| `/api/sessoes/[id]/diploma-template` | POST | Upload de template de diploma (.docx) |
| `/api/sessoes/[id]/diplomas` | GET | Gerar diplomas em lote (ZIP com .docx) |
| `/api/sessoes/[id]/ebook` | POST | Upload de ebook |
| `/api/sessoes/[id]/ebook` | GET | Download de ebook pelo aluno |
| `/api/sessoes/[id]/exportar/xlsx` | GET | Exportar relatório em Excel |
| `/api/sessoes/[id]/exportar/pdf` | GET | Exportar relatório em PDF |
| `/api/entrar` | POST | Aluno entrar na sessão |
| `/api/perguntas` | POST | Criar pergunta |
| `/api/perguntas/[id]` | PATCH | Abrir/fechar enquete (dispara Pusher) |
| `/api/respostas` | POST | Registrar resposta do aluno |
| `/api/avaliacoes` | POST | Enviar avaliação final ou pesquisa |

---

## Páginas da Aplicação

| Rota | Usuário | Descrição |
|------|---------|-----------|
| `/` | Professor | Tela inicial — criar nova sessão ou retomar existente |
| `/entrar/[codigo]` | Aluno | Login na sessão via nome e matrícula |
| `/professor/[id]` | Professor | Painel de controle — slides, enquetes, participantes |
| `/professor/[id]/relatorios` | Professor | Relatórios, exportações, diplomas e ebook |
| `/sessao/[id]` | Aluno | Acompanhar sessão ao vivo — slides e respostas |
| `/sessao/[id]/avaliacao` | Aluno | Avaliação final de múltipla escolha |
| `/sessao/[id]/pesquisa` | Aluno | Pesquisa de satisfação anônima |
| `/sessao/[id]/conclusao` | Aluno | Resultado final com nota e status |

---

## Funcionalidades

### Professor

- Criar sessões com código personalizado e PIN de segurança
- Retomar sessão existente a partir de qualquer dispositivo (código + PIN)
- Upload de apresentação em PDF com visualização integrada
- Upload de perguntas via arquivo Markdown estruturado
- Navegação de slides sincronizada em tempo real com todos os alunos
- Disparo e encerramento de enquetes ao vivo com resultado fullscreen
- Visualização em tempo real de quem está presente
- Controle de fases: aula → avaliação → pesquisa → conclusão
- Reinício de avaliação final para permitir nova tentativa
- Encerrar sessão e criar nova automaticamente
- Upload de template de diploma (.docx) com variáveis dinâmicas
- Geração de diplomas em lote (ZIP) com docxtemplater
- Upload e disponibilização de ebook para download
- Relatórios com estatísticas consolidadas
- Exportação em Excel (.xlsx) com dados detalhados
- Exportação em PDF formatado

### Aluno

- Acesso via código da sessão ou QR Code
- Login por nome + matrícula ou apenas nome
- Slides sincronizados em tempo real com o professor
- Responder enquetes e questões interativas
- Avaliação final com navegação entre questões
- Pesquisa de satisfação anônima
- Tela de conclusão com nota, percentual e status (aprovado/reprovado)
- Download de material complementar (ebook)

### Tempo Real (Pusher)

Eventos WebSocket transmitidos pelo Pusher Channels:

- `slide-changed` — professor avança/retrocede slide
- `enquete-aberta` — professor abre enquete para votação
- `enquete-resultado` — resultados consolidados de uma enquete
- `fase-changed` — transição entre fases da sessão

### Autenticação e Retomar Sessão

O sistema possui um mecanismo de autenticação simples por código + PIN para o professor:

- Ao criar uma sessão, o professor define um **código** (gerado automaticamente ou personalizado) e um **PIN numérico**
- O código é compartilhado com os alunos para que acessem a sessão
- O PIN é usado exclusivamente pelo professor para **retomar uma sessão existente** após fechar o navegador ou trocar de dispositivo
- O botão "Retomar sessão existente" na tela inicial abre um formulário que valida código + PIN via `POST /api/sessoes/auth`
- Se os dados forem válidos, o professor é redirecionado ao painel de controle da sessão com todos os dados preservados (slides, participantes, respostas, fase atual)
- Se inválidos, exibe mensagem de erro sem revelar se o código existe ou não

### Efeitos Visuais

**Efeito holográfico (sweep teal gradient no hover)** — aplicado nos seguintes elementos:

| Elemento | Escopo | Descrição |
|----------|--------|-----------|
| `.primary-button` | Professor e Aluno | Todos os botões primários (criar, enviar, próximo, etc.) |
| `.answer` | Aluno | Opções de resposta em enquetes e avaliação |
| `.presentation-panel` | Professor e Aluno | Painel de slides/apresentação |
| `.live-panel` | Professor | Painel de enquete ao vivo |
| `.answer-panel` | Professor e Aluno | Painel de respostas |
| `.login-card` | Todos | Cards da tela inicial e login |
| `.aval-card` | Aluno | Card da avaliação final |
| `.conclusao-card` | Aluno | Card da tela de conclusão |
| `.rel-card-stat` | Professor | Cards de estatísticas nos relatórios |
| `.rel-questao-card` | Professor | Cards de questões nos relatórios |
| `.bottom-cards article` | Professor | Cards de resumo (participantes, perguntas, etc.) |
| `.notice-card` | Professor | Card de avisos na sidebar |

Botões secundários (`.outline-button`, `.danger-button`, botões de navegação de slides) não possuem o efeito holográfico por design — são elementos de ação secundária.

**Outros efeitos visuais:**

- Background com foto da ACADEPEN em toda a aplicação (efeito frosted glass com `backdrop-filter: blur`)
- Todos os painéis usam `rgba(255,255,255,.88)` com blur para transparência sutil
- Brasão da Polícia Penal do RJ no topbar de todas as páginas e como logo na tela inicial
- Animações CSS de entrada na tela de conclusão (fade-in + translate)
- Resultado fullscreen com animação de expansão para enquetes
- Glow sutil nos cards de relatório e estatísticas ao hover
- Transições suaves em todos os elementos interativos (box-shadow, transform, border-color)
- Design responsivo completo para mobile, tablet e desktop (breakpoints: 900px, 700px, 480px)

---

## Formato de Perguntas (.md)

As perguntas são importadas via arquivo Markdown com a seguinte estrutura:

```markdown
# enquete

## Texto da pergunta de enquete?
slide: 3
- [ ] Alternativa A
- [x] Alternativa correta
- [ ] Alternativa C
- [ ] Alternativa D

# conhecimento

## Texto da pergunta de conhecimento?
slide: 5
- [ ] Alternativa A
- [x] Alternativa correta
- [ ] Alternativa C
- [ ] Alternativa D

# avaliacao

## Texto da questão da avaliação final?
- [x] Alternativa correta
- [ ] Alternativa B
- [ ] Alternativa C
- [ ] Alternativa D

# pesquisa

## Como você avalia esta capacitação?
- [ ] Excelente
- [ ] Boa
- [ ] Regular
- [ ] Precisa melhorar
```

Tipos disponíveis: `enquete`, `conhecimento`, `avaliacao`, `pesquisa`. Use `[x]` para marcar a alternativa correta (obrigatório em `conhecimento` e `avaliacao`; irrelevante em `pesquisa`). O campo `slide: N` é opcional e vincula a pergunta a um slide específico.

---

## Instalação e Execução

### Pré-requisitos

- Node.js 18+
- npm ou yarn

### Instalação

```bash
git clone <url-do-repositorio>
cd apresentacao-interativa

# Instalar dependências
npm install

# Gerar o Prisma Client
npx prisma generate

# Criar o banco de dados (SQLite em dev)
npx prisma db push
```

### Configurar variáveis de ambiente

Criar arquivo `.env` na raiz do projeto (ver seção abaixo).

### Executar em desenvolvimento

```bash
npm run dev
```

Acesse em `http://localhost:3000`.

### Build para produção

```bash
npm run build
npm start
```

---

## Variáveis de Ambiente

Criar arquivo `.env` na raiz:

```env
# Banco de dados
DATABASE_URL="file:./dev.db"

# Pusher (tempo real via WebSocket)
PUSHER_APP_ID="seu_app_id"
PUSHER_KEY="sua_key"
PUSHER_SECRET="seu_secret"
PUSHER_CLUSTER="sa1"

# Pusher client (prefixo NEXT_PUBLIC_ para acesso no browser)
NEXT_PUBLIC_PUSHER_KEY="sua_key"
NEXT_PUBLIC_PUSHER_CLUSTER="sa1"
```

Para produção com PostgreSQL, altere `DATABASE_URL` para a connection string do PostgreSQL e ajuste o `provider` no `prisma/schema.prisma` de `sqlite` para `postgresql`.

---

## Deploy em Produção

### Vercel + Neon PostgreSQL (recomendado)

O projeto está configurado para deploy serverless na Vercel. Todos os arquivos (PDFs, templates, ebooks) são armazenados no banco de dados como campos binários (`Bytes`), eliminando dependência de filesystem local.

**Passo 1 — Criar banco PostgreSQL gratuito no Neon:**

1. Acesse [neon.tech](https://neon.tech) e crie uma conta gratuita
2. Crie um novo projeto (ex: "seppen-aprende")
3. Copie a **connection string** que será exibida (formato: `postgresql://user:pass@host/dbname?sslmode=require`)

**Passo 2 — Configurar a Vercel:**

1. Acesse [vercel.com](https://vercel.com) e crie uma conta (pode usar o login do GitHub)
2. Clique em "Add New Project" e importe o repositório do GitHub
3. Na tela de configuração, adicione as **Environment Variables**:

| Variável | Valor |
|----------|-------|
| `DATABASE_URL` | `postgresql://user:pass@host/dbname?sslmode=require` (do Neon) |
| `PUSHER_APP_ID` | Seu App ID do Pusher |
| `PUSHER_KEY` | Sua Key do Pusher |
| `PUSHER_SECRET` | Seu Secret do Pusher |
| `PUSHER_CLUSTER` | `sa1` |
| `NEXT_PUBLIC_PUSHER_KEY` | Mesma Key do Pusher |
| `NEXT_PUBLIC_PUSHER_CLUSTER` | `sa1` |

4. Clique em "Deploy" — a Vercel vai fazer build e publicar automaticamente
5. Após o deploy, acesse o terminal da Vercel ou rode localmente: `npx prisma db push` com a DATABASE_URL do Neon para criar as tabelas

**Passo 3 — Acessar:**

A Vercel fornece uma URL pública (ex: `seppen-aprende.vercel.app`). Os alunos acessam por essa URL de qualquer dispositivo com internet.

### Execução Local (alternativa)

Para rodar na rede local durante a aula (sem internet):

```bash
# No prisma/schema.prisma, troque provider para "sqlite"
# No .env, use DATABASE_URL="file:./dev.db"

npm install
npx prisma db push
npx next dev --hostname 0.0.0.0
```

Os alunos acessam pelo IP da máquina na rede local (ex: `http://192.168.1.100:3000`).

---

## Histórico de Versões

### v1.0.0 — Fundação (Fase 1)
- Estrutura do projeto Next.js 16 com App Router e TypeScript
- Schema Prisma com modelos Sessao, Participante, Pergunta, OpcaoResposta, RespostaParticipante
- API Routes para CRUD de sessões, entrada de alunos, perguntas e respostas
- Tela inicial para criar/retomar sessão com código e PIN
- Tela de login do aluno via código da sessão
- Painel do professor com navegação de slides
- Visão do aluno com slides sincronizados

### v1.1.0 — Tempo Real (Fase 2)
- Integração com Pusher Channels para WebSocket
- Sincronização de slides em tempo real (professor → alunos)
- Enquetes ao vivo com disparo e encerramento
- Notificação em tempo real de novas enquetes para alunos
- Remoção de polling — tudo via WebSocket

### v1.2.0 — Conteúdo e Avaliação (Fase 3)
- Upload e renderização de apresentação PDF (pdfjs-dist)
- Parser de perguntas em formato Markdown (.md)
- Componente PdfViewer com navegação integrada
- Modo tela cheia para apresentação
- Componente ResultadoFullscreen com efeitos visuais para enquetes
- Avaliação final com questões de múltipla escolha e navegação entre questões
- Pesquisa de satisfação anônima
- API de avaliação com cálculo automático de nota (0-10)
- Tela de conclusão do aluno com nota, percentual e status

### v1.3.0 — Relatórios e Diplomas (Fase 4)
- API de relatórios com dados consolidados (estatísticas por pergunta, por aluno)
- Página de relatórios do professor com visualização completa
- Exportação em Excel (.xlsx) com ExcelJS
- Exportação em PDF formatado com PDFKit
- Schema atualizado para suportar diplomas (template, carga horária)
- Upload de template de diploma (.docx) com variáveis: `{nome}`, `{matricula}`, `{titulo}`, `{data}`, `{cargaHoraria}`, `{nota}`
- Geração de diplomas em lote usando docxtemplater + PizZip (ZIP com .docx)
- Upload e download de ebook (material complementar)
- Controles do professor para transição de fases (aula → avaliação → pesquisa)
- Reinício de avaliação final pelo professor
- Opção de criar novo curso ao encerrar sessão

### v1.4.0 — Responsividade e Polish (Fase 5)
- Responsividade mobile completa (breakpoints 900px, 700px, 480px)
- Layout adaptativo para sidebar, grids, painéis e formulários
- Polimento da tela inicial e branding institucional SEPPEN
- Melhorias no painel do professor (ícones, layout, status)
- Animações e micro-interações CSS (transições suaves, hovers, focus)

### v1.5.0 — Identidade Visual SEAP-RJ (Fase 6)
- Efeito holográfico (sweep teal gradient) em cards, botões e opções de resposta
- Inserção do brasão da Polícia Penal do RJ no topbar de todas as páginas
- Brasão na tela inicial como logo principal
- Foto panorâmica da ACADEPEN como background de toda a aplicação
- Efeito frosted glass (backdrop-filter blur) em todos os painéis
- Painéis semi-transparentes para a foto de fundo aparecer sutilmente
- Gradiente com foto de fundo na hero section da tela inicial

### v2.0.0 — Deploy Vercel / PostgreSQL (Fase 7)
- Migração do banco de dados de SQLite para PostgreSQL (compatível com Vercel/Neon)
- Armazenamento de arquivos (PDF, template de diploma, ebook) no banco como campos `Bytes` em vez de filesystem local
- Nova API route `GET /api/sessoes/[id]/pdf` para servir PDFs do banco
- Refatoração de todas as rotas de upload para gravar no banco de dados
- Exclusão de campos binários das respostas JSON (performance)
- Configuração de limite de upload de 10MB para serverless
- Projeto pronto para deploy serverless na Vercel

---

## Licença

Uso interno — Secretaria de Estado de Administração Penitenciária do Rio de Janeiro (SEAP-RJ).

---

## Créditos

Desenvolvido para o **SEPPEN — Subsecretaria de Ensino, Pesquisa e Perícia** da SEAP-RJ, para uso na **ACADEPEN — Academia de Administração Penitenciária**.
