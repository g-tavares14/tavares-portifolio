// spotify-check mostra o que o Spotify está devolvendo para a sua conta, sem
// imprimir tokens. Útil quando o card mostra "Nada tocando" e você não sabe por quê.
// Rode dentro de api/:  go run ./cmd/spotify-check
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"time"

	"portfolio/api/internal/config"
	"portfolio/api/internal/spotify"
)

func main() {
	if err := config.LoadDotEnv(".env"); err != nil {
		log.Fatal(err)
	}
	cfg := config.FromEnv()
	if !cfg.SpotifyEnabled() {
		log.Fatal("Faltam chaves do Spotify em api/.env.")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	tok, err := spotify.Exchange(ctx, http.DefaultClient, cfg.SpotifyClientID, cfg.SpotifyClientSecret, url.Values{
		"grant_type":    {"refresh_token"},
		"refresh_token": {cfg.SpotifyRefreshToken},
	})
	if err != nil {
		log.Fatalf("token: %v", err)
	}
	fmt.Println("token: ok")

	var me struct {
		DisplayName string `json:"display_name"`
		Product     string `json:"product"`
	}
	show(ctx, tok.AccessToken, "/me", &me)
	fmt.Printf("  conta: %q (plano: %s)\n", me.DisplayName, me.Product)

	var cur struct {
		IsPlaying bool   `json:"is_playing"`
		Type      string `json:"currently_playing_type"`
		Item      *struct {
			Name string `json:"name"`
		} `json:"item"`
	}
	if show(ctx, tok.AccessToken, "/me/player/currently-playing", &cur) == http.StatusOK {
		name := "<sem item>"
		if cur.Item != nil {
			name = cur.Item.Name
		}
		fmt.Printf("  tocando: %v · tipo: %s · %s\n", cur.IsPlaying, cur.Type, name)
	}

	var rec struct {
		Items []struct {
			PlayedAt string `json:"played_at"`
			Track    struct {
				Name string `json:"name"`
			} `json:"track"`
		} `json:"items"`
	}
	if show(ctx, tok.AccessToken, "/me/player/recently-played?limit=50", &rec) == http.StatusOK {
		fmt.Printf("  últimas tocadas: %d\n", len(rec.Items))
		if len(rec.Items) > 0 {
			fmt.Printf("  mais recente: %s (%s)\n", rec.Items[0].Track.Name, rec.Items[0].PlayedAt)
		}
	}
}

// show faz o GET, imprime o status e decodifica o corpo quando é 200.
func show(ctx context.Context, token, path string, out any) int {
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, "https://api.spotify.com/v1"+path, nil)
	req.Header.Set("Authorization", "Bearer "+token)
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		fmt.Printf("%s: erro de rede: %v\n", path, err)
		return 0
	}
	defer res.Body.Close()
	body, _ := io.ReadAll(res.Body)
	fmt.Printf("%s: %d\n", path, res.StatusCode)
	if res.StatusCode == http.StatusOK {
		_ = json.Unmarshal(body, out)
	} else if len(body) > 0 {
		fmt.Printf("  corpo: %.200s\n", body)
	}
	return res.StatusCode
}
