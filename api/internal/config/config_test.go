package config

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestSetDotEnvReplacesOrAppends(t *testing.T) {
	path := filepath.Join(t.TempDir(), ".env")
	os.WriteFile(path, []byte("# comentário\nGITHUB_TOKEN=abc\nSPOTIFY_REFRESH_TOKEN=velho\n"), 0o600)

	if err := SetDotEnv(path, "SPOTIFY_REFRESH_TOKEN", "novo"); err != nil {
		t.Fatal(err)
	}
	if err := SetDotEnv(path, "SPOTIFY_CLIENT_ID", "id"); err != nil {
		t.Fatal(err)
	}
	data, _ := os.ReadFile(path)
	got := string(data)
	for _, want := range []string{"# comentário", "GITHUB_TOKEN=abc", "SPOTIFY_REFRESH_TOKEN=novo", "SPOTIFY_CLIENT_ID=id"} {
		if !strings.Contains(got, want) {
			t.Errorf("faltou %q em:\n%s", want, got)
		}
	}
	if strings.Contains(got, "velho") {
		t.Errorf("o valor antigo deveria ter sido substituído:\n%s", got)
	}
	if info, _ := os.Stat(path); info.Mode().Perm() != 0o600 {
		t.Errorf("permissão = %v, quer 0600 (só você lê)", info.Mode().Perm())
	}
}

func TestLoadDotEnvKeepsRealEnvironment(t *testing.T) {
	path := filepath.Join(t.TempDir(), ".env")
	os.WriteFile(path, []byte("PORTFOLIO_TEST_A=\"do-arquivo\"\nPORTFOLIO_TEST_B=do-arquivo\n"), 0o600)
	t.Setenv("PORTFOLIO_TEST_B", "do-ambiente")

	if err := LoadDotEnv(path); err != nil {
		t.Fatal(err)
	}
	if got := os.Getenv("PORTFOLIO_TEST_A"); got != "do-arquivo" {
		t.Errorf("A = %q", got)
	}
	if got := os.Getenv("PORTFOLIO_TEST_B"); got != "do-ambiente" {
		t.Errorf("B = %q: o ambiente real deveria vencer o .env", got)
	}
	os.Unsetenv("PORTFOLIO_TEST_A")
}

func TestLoadDotEnvMissingFileIsFine(t *testing.T) {
	if err := LoadDotEnv(filepath.Join(t.TempDir(), "nao-existe")); err != nil {
		t.Fatal(err)
	}
}
