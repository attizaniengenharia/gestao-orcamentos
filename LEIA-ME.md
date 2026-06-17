# 🏗 Gestão de Orçamentos — Attizani Engenharia
## Guia de Instalação e Uso

---

## PRÉ-REQUISITOS (instale uma vez só)

1. **Node.js LTS** → https://nodejs.org  
   Baixe a versão LTS (botão verde). Execute o instalador normalmente.

2. **Visual Studio Code** → https://code.visualstudio.com  
   Opcional, mas recomendado para editar o código.

---

## ESTRUTURA DOS ARQUIVOS

Copie todos os arquivos nesta estrutura:

```
gestao-orcamentos/
├── electron.js          ← motor do app Windows
├── preload.js           ← ponte segura com o sistema
├── package.json         ← configurações e dependências
├── public/
│   └── index.html
└── src/
    ├── index.js
    └── App.jsx          ← toda a interface e lógica
```

---

## INSTALAÇÃO — PASSO A PASSO

### 1. Abrir o terminal na pasta do projeto

No Windows Explorer, navegue até a pasta `gestao-orcamentos`,  
clique com botão direito → **"Abrir no Terminal"** (ou Powershell).

### 2. Instalar as dependências

```bash
npm install
```

Aguarde — vai baixar tudo automaticamente (~2-3 minutos na primeira vez).

---

## RODAR O APP

### Opção A — No navegador (mais rápido para testar)
```bash
npm start
```
Abre em http://localhost:3000 automaticamente.

### Opção B — Como app Windows (janela própria)
```bash
npm run electron-dev
```
Abre uma janela de app separada, igual a um programa instalado.

---

## GERAR O INSTALADOR .EXE

Para criar um instalador que você pode distribuir ou instalar em outro PC:

```bash
npm run electron-build
```

O instalador será gerado em:
```
dist/
└── Gestão de Orçamentos Setup 1.0.0.exe
```

Execute o `.exe` para instalar o programa no Windows normalmente.

---

## ONDE OS DADOS FICAM SALVOS

Quando rodando como app Electron (Windows), os dados ficam em:
```
C:\Users\[seu usuário]\AppData\Roaming\gestao-orcamentos\orcamentos.json
```

Quando rodando no navegador, os dados ficam no localStorage do browser.

**Os dados são salvos automaticamente** a cada alteração — não precisa clicar em salvar.

---

## FUNCIONALIDADES

| Função | Como usar |
|---|---|
| Novo orçamento | Botão "+ Novo Orçamento" no cabeçalho |
| Editar | Clique em "Editar" na linha ou no card do Kanban |
| Mudar status | Abrir o orçamento → campo Status |
| Filtrar | Clique nos botões de status (Enviado, Aprovado...) |
| Buscar | Campo de busca no canto superior direito |
| Ordenar | Clique no cabeçalho de qualquer coluna |
| Excluir | Botão ✕ vermelho na linha |

---

## VIEWS DISPONÍVEIS

- **📋 Lista** — tabela completa com filtros, busca e ordenação
- **🗂 Kanban** — pipeline visual por status
- **📊 Análise** — gráficos de volume por status, tipo e responsável

---

## ALERTAS AUTOMÁTICOS

- Orçamentos com **prazo vencido** aparecem em vermelho na lista
- Orçamentos vencendo em **7 dias** mostram aviso no cabeçalho

---

## PROBLEMAS COMUNS

**"npm não reconhecido"**  
→ Node.js não foi instalado corretamente. Reinstale e reinicie o terminal.

**Tela em branco ao rodar electron-dev**  
→ Aguarde o React iniciar (pode demorar 15-20 segundos na primeira vez).

**Erro ao gerar o .exe**  
→ Execute `npm install` novamente antes de rodar `npm run electron-build`.

---

## SUPORTE E EVOLUÇÃO

Próximas funcionalidades possíveis:
- Exportar lista para Excel (.xlsx)
- Geração de PDF do orçamento
- Backup automático na nuvem (Google Drive)
- Histórico de mudanças de status
- Múltiplos usuários (Rafael + Rodrigo com login)

---

*Attizani Engenharia LTDA — CREA-RJ 2020102073*
