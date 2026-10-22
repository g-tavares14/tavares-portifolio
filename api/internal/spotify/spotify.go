// Package spotify monta o card do toca-discos a partir da conta do dono do
// site: música tocando agora (ou a última), artista mais ouvido recentemente
// e quanto tempo de música já tocou hoje.
package spotify

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"portfolio/api/internal/model"
)

const (
	tokenURL = "https://accounts.spotify.com/api/token"
	apiBase  = "https://api.spotify.com/v1"
	cacheTTL = 20 * time.Second
)

// Scopes são as permissões pedidas no login (só leitura do que você ouve).
const Scopes = "user-read-currently-playing user-read-recently-played"

type Client struct {
	clientID string
	secret   string
	loc      *time.Location
	http     *http.Client

	mu           sync.Mutex
	refreshToken string
	accessToken  string
	expiresAt    time.Time
	cached       *model.NowPlaying
	fetchedAt    time.Time
}

// New recebe o fuso usado para decidir o que conta como "hoje".
func New(clientID, secret, refreshToken string, loc *time.Location) *Client {
	return &Client{
		clientID:     clientID,
		secret:       secret,
		refreshToken: refreshToken,
		loc:          loc,
		http:         &http.Client{Timeout: 8 * time.Second},
	}
}

// NowPlaying devolve o card (em cache por 20 s). nil significa nada para mostrar.
// Se o Spotify falhar, devolve o último resultado bom junto com o erro.
func (c *Client) NowPlaying(ctx context.Context) (*model.NowPlaying, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if !c.fetchedAt.IsZero() && time.Since(c.fetchedAt) < cacheTTL {
		return c.cached, nil
	}
	np, err := c.fetch(ctx)
	if err != nil {
		return c.cached, err
	}
	c.cached, c.fetchedAt = np, time.Now()
	return np, nil
}

type track struct {
	Name       string `json:"name"`
	DurationMs int    `json:"duration_ms"`
	Artists    []struct {
		Name string `json:"name"`
	} `json:"artists"`
}

func (t track) artist() string {
	if len(t.Artists) == 0 {
		return ""
	}
	return t.Artists[0].Name
}

func (c *Client) fetch(ctx context.Context) (*model.NowPlaying, error) {
	token, err := c.token(ctx)
	if err != nil {
		return nil, err
	}

	var current struct {
		IsPlaying  bool   `json:"is_playing"`
		ProgressMs int    `json:"progress_ms"`
		Item       *track `json:"item"`
	}
	// 204 = nada tocando; aí `current.Item` fica nil.
	if err := c.get(ctx, token, "/me/player/currently-playing", &current); err != nil {
		return nil, err
	}

	var recent struct {
		Items []struct {
			Track    track     `json:"track"`
			PlayedAt time.Time `json:"played_at"`
		} `json:"items"`
	}
	if err := c.get(ctx, token, "/me/player/recently-played?limit=50", &recent); err != nil {
		return nil, err
	}

	var np model.NowPlaying
	switch {
	case current.Item != nil:
		np.Title, np.Artist = current.Item.Name, current.Item.artist()
		np.DurationSeconds = current.Item.DurationMs / 1000
		np.ProgressSeconds = current.ProgressMs / 1000
		np.IsPlaying = current.IsPlaying
	case len(recent.Items) > 0:
		last := recent.Items[0].Track
		np.Title, np.Artist = last.Name, last.artist()
		np.DurationSeconds = last.DurationMs / 1000
	default:
		return nil, nil
	}

	// Rotação: o artista que mais aparece nas últimas 50 músicas.
	counts := map[string]int{}
	for _, it := range recent.Items {
		if a := it.Track.artist(); a != "" {
			counts[a]++
			if counts[a] > np.RotationCount {
				np.RotationArtist, np.RotationCount = a, counts[a]
			}
		}
	}

	// Hoje: soma das músicas tocadas desde a meia-noite no fuso do perfil.
	now := time.Now().In(c.loc)
	midnight := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, c.loc)
	var todayMs int
	for _, it := range recent.Items {
		if it.PlayedAt.After(midnight) {
			todayMs += it.Track.DurationMs
		}
	}
	np.TodayLabel = durationLabel(time.Duration(todayMs) * time.Millisecond)
	return &np, nil
}

// durationLabel: 2h32m → "2H 32M"; 32m → "32M".
func durationLabel(d time.Duration) string {
	h, m := int(d.Hours()), int(d.Minutes())%60
	if h == 0 {
		return fmt.Sprintf("%dM", m)
	}
	return fmt.Sprintf("%dH %02dM", h, m)
}

func (c *Client) get(ctx context.Context, token, path string, out any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, apiBase+path, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	res, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("spotify: %w", err)
	}
	defer res.Body.Close()
	switch {
	case res.StatusCode == http.StatusNoContent:
		return nil
	case res.StatusCode == http.StatusUnauthorized:
		c.accessToken = "" // força renovar na próxima tentativa
		return fmt.Errorf("spotify: token recusado em %s", path)
	case res.StatusCode != http.StatusOK:
		return fmt.Errorf("spotify: status %d em %s", res.StatusCode, path)
	}
	return json.NewDecoder(res.Body).Decode(out)
}

// token troca o refresh token por um access token (vale ~1 h) quando preciso.
func (c *Client) token(ctx context.Context) (string, error) {
	if c.accessToken != "" && time.Until(c.expiresAt) > time.Minute {
		return c.accessToken, nil
	}
	tok, err := Exchange(ctx, c.http, c.clientID, c.secret, url.Values{
		"grant_type":    {"refresh_token"},
		"refresh_token": {c.refreshToken},
	})
	if err != nil {
		return "", err
	}
	c.accessToken = tok.AccessToken
	c.expiresAt = time.Now().Add(time.Duration(tok.ExpiresIn) * time.Second)
	if tok.RefreshToken != "" {
		c.refreshToken = tok.RefreshToken // o Spotify às vezes rotaciona o refresh token
	}
	return c.accessToken, nil
}

// Token é a resposta do endpoint de tokens do Spotify.
type Token struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int    `json:"expires_in"`
}

// Exchange chama o endpoint de tokens; usado na renovação e no login inicial.
func Exchange(ctx context.Context, hc *http.Client, clientID, secret string, form url.Values) (*Token, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, tokenURL, strings.NewReader(form.Encode()))
	if err != nil {
		return nil, err
	}
	req.SetBasicAuth(clientID, secret)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	res, err := hc.Do(req)
	if err != nil {
		return nil, fmt.Errorf("spotify: %w", err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		var e struct {
			Error       string `json:"error"`
			Description string `json:"error_description"`
		}
		_ = json.NewDecoder(res.Body).Decode(&e)
		return nil, fmt.Errorf("spotify: não deu para obter token (%d %s %s)", res.StatusCode, e.Error, e.Description)
	}
	var tok Token
	if err := json.NewDecoder(res.Body).Decode(&tok); err != nil {
		return nil, fmt.Errorf("spotify: resposta de token inválida: %w", err)
	}
	return &tok, nil
}
