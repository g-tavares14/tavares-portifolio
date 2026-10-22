// Servidor da API do portfólio. Em desenvolvimento, o Vite (porta 5173)
// encaminha /api para cá. Em produção, este mesmo servidor também entrega o
// build do front (web/dist), então front e API ficam no mesmo domínio.
package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"
	_ "time/tzdata" // fusos embutidos: "hoje" do Spotify funciona em qualquer máquina

	"portfolio/api/internal/articles"
	"portfolio/api/internal/config"
	"portfolio/api/internal/content"
	"portfolio/api/internal/github"
	"portfolio/api/internal/model"
	"portfolio/api/internal/spotify"
)

// Tempo máximo esperando GitHub/Spotify antes de responder com o que já tem.
const integrationTimeout = 4 * time.Second

func main() {
	if err := config.LoadDotEnv(".env"); err != nil {
		log.Fatalf("erro lendo .env: %v", err)
	}
	cfg := config.FromEnv()

	loc, err := time.LoadLocation(content.Profile.Timezone)
	if err != nil {
		log.Printf("fuso %q inválido, usando UTC: %v", content.Profile.Timezone, err)
		loc = time.UTC
	}

	var gh *github.Client
	if cfg.GitHubEnabled() {
		gh = github.New(cfg.GitHubUser, cfg.GitHubToken)
		log.Printf("GitHub: ligado (%s)", cfg.GitHubUser)
	} else {
		log.Print("GitHub: desligado (falta GITHUB_USERNAME ou GITHUB_TOKEN no .env)")
	}
	var sp *spotify.Client
	if cfg.SpotifyEnabled() {
		sp = spotify.New(cfg.SpotifyClientID, cfg.SpotifyClientSecret, cfg.SpotifyRefreshToken, loc)
		log.Print("Spotify: ligado")
	} else {
		log.Print("Spotify: desligado (faltam chaves no .env; veja README)")
	}

	articlePosts, err := articles.Load(cfg.ArticlesDir)
	if err != nil {
		log.Fatalf("erro lendo os textos em Markdown: %v", err)
	}
	posts, err := content.MergePosts(content.Posts, articlePosts)
	if err != nil {
		log.Fatalf("erro juntando os textos: %v", err)
	}
	log.Printf("Escrita: %d textos (%d de %s)", len(posts), len(articlePosts), cfg.ArticlesDir)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/profile", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, buildProfile(r.Context(), gh, sp))
	})
	mux.HandleFunc("GET /api/now-playing", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, nowPlaying(r.Context(), sp))
	})
	mux.HandleFunc("GET /api/posts", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, posts)
	})
	// Imagens dos textos: o Markdown cita images/x.png e o front pede /articles/<slug>/images/x.png.
	mux.HandleFunc("GET /articles/{slug}/images/{file}", func(w http.ResponseWriter, r *http.Request) {
		slug, file := r.PathValue("slug"), r.PathValue("file")
		if !filepath.IsLocal(slug) || !filepath.IsLocal(file) {
			http.NotFound(w, r)
			return
		}
		http.ServeFile(w, r, filepath.Join(cfg.ArticlesDir, slug, "images", file))
	})
	mux.HandleFunc("GET /api/projects", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, content.Projects)
	})
	mux.HandleFunc("/api/", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "rota não encontrada"})
	})
	mux.Handle("/", spa(cfg.WebDist))

	addr := ":" + cfg.Port
	log.Printf("API em http://localhost%s (front estático de %s)", addr, cfg.WebDist)
	log.Fatal(http.ListenAndServe(addr, mux))
}

// integrationContext não herda o cancelamento do visitante: a busca abastece um
// cache compartilhado, então um visitante que fecha a aba não deve abortá-la.
func integrationContext(ctx context.Context) (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.WithoutCancel(ctx), integrationTimeout)
}

// buildProfile parte do conteúdo fixo e completa com GitHub e Spotify em paralelo.
// Se uma integração falhar, o campo dela fica como no conteúdo fixo.
func buildProfile(ctx context.Context, gh *github.Client, sp *spotify.Client) model.Profile {
	p := content.Profile
	ctx, cancel := integrationContext(ctx)
	defer cancel()

	var wg sync.WaitGroup
	if gh != nil {
		wg.Go(func() {
			act, err := gh.Activity(ctx)
			if err != nil {
				log.Printf("GitHub: %v", err)
			}
			if act != nil {
				total := act.TotalLastYear
				p.Telemetry.ContributionsPerYear = &total
				p.Telemetry.Heatmap = act.Heatmap
			}
		})
	}
	if sp != nil {
		wg.Go(func() { p.NowPlaying = nowPlaying(ctx, sp) })
	}
	wg.Wait()
	return p
}

func nowPlaying(ctx context.Context, sp *spotify.Client) *model.NowPlaying {
	if sp == nil {
		return nil
	}
	ctx, cancel := integrationContext(ctx)
	defer cancel()
	np, err := sp.NowPlaying(ctx)
	if err != nil {
		log.Printf("Spotify: %v", err)
	}
	return np
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		log.Printf("erro ao escrever JSON: %v", err)
	}
}

// spa entrega os arquivos do build e devolve index.html para rotas do front
// (/escrita, /projetos...), que o React Router resolve no navegador.
func spa(dir string) http.Handler {
	files := http.FileServer(http.Dir(dir))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := filepath.Join(dir, filepath.Clean(r.URL.Path))
		if info, err := os.Stat(path); err == nil && !info.IsDir() {
			files.ServeHTTP(w, r)
			return
		}
		http.ServeFile(w, r, filepath.Join(dir, "index.html"))
	})
}
