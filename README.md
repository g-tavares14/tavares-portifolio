# Portfólio

Três páginas (**Sobre**, **Escrita** e **Projetos**) num visual neo-brutalista, com cards 3D que seguem o mouse, uma pasta que abre na leitura e um menu em roda para os projetos.

```
api/      back-end em Go: a fonte da verdade dos dados
  internal/model/    structs = contrato da API (geram os tipos do front)
  internal/content/  conteúdo atual (escrito no código; troque por banco/Markdown)
  internal/github/   calendário de contribuições (API GraphQL)
  internal/spotify/  música tocando agora, rotação e tempo ouvido hoje
  internal/config/   leitura do api/.env
  cmd/server/        servidor HTTP: /api/* e, em produção, o build do front
  cmd/spotify-auth/  login único no Spotify (grava o refresh token no .env)
web/      front-end em React + TypeScript + Vite
  src/types/api.gen.ts   GERADO a partir de api/internal/model (não edite)
  src/pages/             About (Sobre), Writing (Escrita), Projects (Projetos)
articles/ textos da Escrita em Markdown: articles/<slug>/index.md (+ graficos/ e images/)
```

## Rodar em desenvolvimento

Dois terminais:

```bash
cd api && go run ./cmd/server        # API em http://localhost:8080
```

```bash
cd web && npm install && npm run dev  # site em http://localhost:5173
```

O Vite encaminha `/api/*` para o Go, então o navegador fala só com `localhost:5173`, sem precisar configurar CORS.

## Escrever um texto (articles/)

Cada texto é uma pasta em `articles/`, e o nome da pasta vira a URL (`/escrita/<pasta>`):

```
articles/preditor/
  index.md       cabeçalho + texto
  graficos/      um JSON por gráfico (formato em api/internal/model, struct Chart)
  images/        imagens citadas como images/arquivo.png
```

O `index.md` começa com o cabeçalho e cada `## ` abre uma seção do sumário:

````markdown
---
number: 04
title: Título do texto
tag: dados
publishedAt: 2026-10-22
excerpt: Frase que aparece no papel amarelo da pasta.
tldr: Resumo em duas ou três linhas.
---

## Primeira seção

Texto em Markdown, com listas, tabelas e ![imagem](images/foto.png).

```grafico
f1-macro
```
````

O bloco `grafico` é trocado pelo gráfico interativo de `graficos/f1-macro.json`. Uma imagem sozinha no parágrafo sai numa moldura de janela:
`![descrição para leitor de tela](images/print.png "texto da barra | legenda embaixo")`. Imagem no meio do texto fica sem moldura. O servidor lê tudo ao subir e
**não sobe** se a pasta `articles/` não existir, se faltar um campo do cabeçalho, se a tag não existir, se um gráfico
citado não tiver arquivo ou se dois textos tiverem o mesmo slug ou número: o erro diz qual. Mudou um texto ou um número de gráfico? Edite o `index.md` ou o
JSON em `graficos/` e reinicie o servidor.

## Integrações (GitHub e Spotify)

As chaves ficam em `api/.env`, que nunca vai para o git. Comece copiando o modelo:

```bash
cd api && cp .env.example .env
```

**GitHub** (mapa de contribuições e total do ano):

1. Crie um token em https://github.com/settings/personal-access-tokens/new: tipo *fine-grained*, acesso *Public repositories (read-only)*, sem permissões extras.
2. Cole em `GITHUB_TOKEN=` no `api/.env` (o `GITHUB_USERNAME` já vem preenchido).

**Spotify** (toca-discos):

1. Em https://developer.spotify.com/dashboard, clique em **Create app**:
   - Redirect URI: `http://127.0.0.1:8888/callback`
   - API: **Web API**
2. Copie o **Client ID** e o **Client Secret** para `SPOTIFY_CLIENT_ID=` e `SPOTIFY_CLIENT_SECRET=` no `api/.env`.
3. Faça o login uma vez: `cd api && go run ./cmd/spotify-auth`. O navegador abre, você autoriza e o comando grava `SPOTIFY_REFRESH_TOKEN` no `.env` sozinho.

Reinicie o servidor. No começo do log aparece `GitHub: ligado` / `Spotify: ligado`. Se algo falhar depois, o motivo aparece no log e o card continua mostrando o último dado bom.

O toca-discos mostra "Nada tocando"? Rode `cd api && go run ./cmd/spotify-check`: ele mostra a conta conectada e o que o Spotify devolve (sem imprimir tokens). Sessões privadas não entram no histórico, e o Spotify só registra músicas tocadas por pelo menos ~30 s.

Os dados ficam em cache no Go (GitHub por 1 h, Spotify por 20 s). O card do toca-discos pergunta `/api/now-playing` a cada 30 s.

## Mudou o contrato?

1. Edite as structs em `api/internal/model/model.go`.
2. `cd api && go tool tygo generate` (atualiza `web/src/types/api.gen.ts`).
3. `cd web && npm run typecheck` aponta o que ajustar no front.

## Produção

```bash
cd web && npm run build              # gera web/dist
cd api && go build -o portfolio ./cmd/server
./portfolio                          # serve a API e o site na porta 8080
```

Variáveis: `PORT` (padrão 8080), `WEB_DIST` (padrão `../web/dist`) e `ARTICLES_DIR` (padrão `../articles`).
A pasta `articles/` precisa ir junto para o servidor: os textos são lidos dela ao subir.
Rotas do front como `/escrita/um-texto` caem no `index.html` e o React Router resolve.
