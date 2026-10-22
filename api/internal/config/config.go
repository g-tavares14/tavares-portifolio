// Package config lê a configuração do servidor: variáveis de ambiente e,
// em desenvolvimento, o arquivo api/.env (que nunca vai para o git).
package config

import (
	"bufio"
	"errors"
	"os"
	"path/filepath"
	"strings"
)

type Config struct {
	Port    string
	WebDist string
	// ArticlesDir é a pasta dos textos em Markdown (uma subpasta por texto).
	ArticlesDir string

	GitHubUser  string
	GitHubToken string

	SpotifyClientID     string
	SpotifyClientSecret string
	SpotifyRefreshToken string
}

func FromEnv() Config {
	return Config{
		Port:                envOr("PORT", "8080"),
		WebDist:             envOr("WEB_DIST", filepath.Join("..", "web", "dist")),
		ArticlesDir:         envOr("ARTICLES_DIR", filepath.Join("..", "articles")),
		GitHubUser:          os.Getenv("GITHUB_USERNAME"),
		GitHubToken:         os.Getenv("GITHUB_TOKEN"),
		SpotifyClientID:     os.Getenv("SPOTIFY_CLIENT_ID"),
		SpotifyClientSecret: os.Getenv("SPOTIFY_CLIENT_SECRET"),
		SpotifyRefreshToken: os.Getenv("SPOTIFY_REFRESH_TOKEN"),
	}
}

func (c Config) GitHubEnabled() bool { return c.GitHubUser != "" && c.GitHubToken != "" }

func (c Config) SpotifyEnabled() bool {
	return c.SpotifyClientID != "" && c.SpotifyClientSecret != "" && c.SpotifyRefreshToken != ""
}

// LoadDotEnv lê linhas CHAVE=valor do arquivo e define as que ainda não existem
// no ambiente (o ambiente real sempre vence). Arquivo ausente não é erro.
func LoadDotEnv(path string) error {
	f, err := os.Open(path)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}
	defer f.Close()

	sc := bufio.NewScanner(f)
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, value, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		key = strings.TrimSpace(key)
		value = strings.Trim(strings.TrimSpace(value), `"'`)
		if _, set := os.LookupEnv(key); !set {
			os.Setenv(key, value)
		}
	}
	return sc.Err()
}

// SetDotEnv grava CHAVE=valor no arquivo, substituindo a linha se ela já existir.
func SetDotEnv(path, key, value string) error {
	data, err := os.ReadFile(path)
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}
	lines := strings.Split(strings.TrimRight(string(data), "\n"), "\n")
	if len(lines) == 1 && lines[0] == "" {
		lines = nil
	}
	entry := key + "=" + value
	replaced := false
	for i, l := range lines {
		if k, _, ok := strings.Cut(strings.TrimSpace(l), "="); ok && strings.TrimSpace(k) == key {
			lines[i] = entry
			replaced = true
		}
	}
	if !replaced {
		lines = append(lines, entry)
	}
	return os.WriteFile(path, []byte(strings.Join(lines, "\n")+"\n"), 0o600)
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
