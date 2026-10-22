// spotify-auth faz o login no Spotify uma única vez e grava o refresh token em
// api/.env. Rode dentro de api/:  go run ./cmd/spotify-auth
//
// Antes: crie um app em https://developer.spotify.com/dashboard com o Redirect URI
// http://127.0.0.1:8888/callback e coloque SPOTIFY_CLIENT_ID e SPOTIFY_CLIENT_SECRET no .env.
package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"runtime"
	"time"

	"portfolio/api/internal/config"
	"portfolio/api/internal/spotify"
)

const (
	envFile     = ".env"
	listenAddr  = "127.0.0.1:8888"
	redirectURI = "http://" + listenAddr + "/callback"
)

func main() {
	if err := config.LoadDotEnv(envFile); err != nil {
		log.Fatalf("não deu para ler %s: %v", envFile, err)
	}
	cfg := config.FromEnv()
	if cfg.SpotifyClientID == "" || cfg.SpotifyClientSecret == "" {
		log.Fatal("Preencha SPOTIFY_CLIENT_ID e SPOTIFY_CLIENT_SECRET em api/.env antes de rodar este comando.")
	}

	state := randomState()
	authURL := "https://accounts.spotify.com/authorize?" + url.Values{
		"client_id":     {cfg.SpotifyClientID},
		"response_type": {"code"},
		"redirect_uri":  {redirectURI},
		"scope":         {spotify.Scopes},
		"state":         {state},
	}.Encode()

	done := make(chan error, 1)
	srv := &http.Server{Addr: listenAddr}
	http.HandleFunc("/callback", func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		if q.Get("state") != state {
			http.Error(w, "state inválido", http.StatusBadRequest)
			return
		}
		if e := q.Get("error"); e != "" {
			fmt.Fprintf(w, "Login cancelado (%s). Pode fechar esta aba.", e)
			done <- fmt.Errorf("login cancelado: %s", e)
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		tok, err := spotify.Exchange(ctx, http.DefaultClient, cfg.SpotifyClientID, cfg.SpotifyClientSecret, url.Values{
			"grant_type":   {"authorization_code"},
			"code":         {q.Get("code")},
			"redirect_uri": {redirectURI},
		})
		if err == nil {
			err = config.SetDotEnv(envFile, "SPOTIFY_REFRESH_TOKEN", tok.RefreshToken)
		}
		if err != nil {
			http.Error(w, "Algo deu errado; veja o terminal.", http.StatusInternalServerError)
			done <- err
			return
		}
		fmt.Fprint(w, "Pronto! O Spotify está conectado. Pode fechar esta aba e voltar ao terminal.")
		done <- nil
	})

	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			done <- err
		}
	}()

	fmt.Println("Abra este link, faça login no Spotify e autorize o acesso:")
	fmt.Println()
	fmt.Println("  " + authURL)
	fmt.Println()
	openBrowser(authURL)

	err := <-done
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	_ = srv.Shutdown(ctx)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println("Refresh token salvo em api/.env. Reinicie o servidor (go run ./cmd/server).")
}

func randomState() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		log.Fatal(err)
	}
	return hex.EncodeToString(b)
}

func openBrowser(u string) {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		cmd = exec.Command("open", u)
	case "linux":
		cmd = exec.Command("xdg-open", u)
	default:
		return
	}
	cmd.Stdout, cmd.Stderr = os.Stdout, os.Stderr
	_ = cmd.Start()
}
