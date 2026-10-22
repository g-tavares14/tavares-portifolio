package articles

import (
	"os"
	"path/filepath"
	"testing"
)

func TestSplitFrontmatterKeepsColonsInValues(t *testing.T) {
	meta, body, err := splitFrontmatter("---\ntitle: Uma pergunta: dá?\ntag: dados\n---\n\n## A\n\ntexto\n")
	if err != nil {
		t.Fatal(err)
	}
	if meta["title"] != "Uma pergunta: dá?" || meta["tag"] != "dados" {
		t.Fatalf("cabeçalho lido errado: %#v", meta)
	}
	if body != "\n## A\n\ntexto\n" {
		t.Fatalf("corpo errado: %q", body)
	}
}

func TestSplitSectionsIgnoresHeadingsInsideCode(t *testing.T) {
	sections, err := splitSections("## Um\n\ntexto\n\n```\n## não é seção\n```\n\n## Dois\n\nfim\n")
	if err != nil {
		t.Fatal(err)
	}
	if len(sections) != 2 || sections[0].Title != "Um" || sections[1].Title != "Dois" {
		t.Fatalf("seções erradas: %#v", sections)
	}
	if *sections[1].Markdown != "fim" {
		t.Fatalf("markdown da seção 2: %q", *sections[1].Markdown)
	}
}

func TestSplitSectionsRejectsTextBeforeFirstHeading(t *testing.T) {
	if _, err := splitSections("texto solto\n\n## Um\n\nok\n"); err == nil {
		t.Fatal("texto antes do primeiro ## deveria ser erro")
	}
}

func TestLoadFailsWhenChartFileIsMissing(t *testing.T) {
	dir := t.TempDir()
	art := filepath.Join(dir, "teste")
	if err := os.MkdirAll(art, 0o755); err != nil {
		t.Fatal(err)
	}
	md := "---\nnumber: 01\ntitle: T\ntag: dados\npublishedAt: 2026-10-22\nexcerpt: e\ntldr: t\n---\n\n## A\n\n```grafico\nsumiu\n```\n"
	if err := os.WriteFile(filepath.Join(art, "index.md"), []byte(md), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := Load(dir); err == nil {
		t.Fatal("gráfico citado sem arquivo deveria ser erro")
	}
}

func TestLoadFailsWhenDirIsMissing(t *testing.T) {
	if _, err := Load(filepath.Join(t.TempDir(), "nao-existe")); err == nil {
		t.Fatal("pasta de textos ausente deveria ser erro, não uma Escrita vazia")
	}
}

// Um bloco que o front desenha como gráfico (linha em branco antes do id) também precisa ser conferido.
func TestLoadChecksChartBlocksWrittenLoosely(t *testing.T) {
	dir := t.TempDir()
	art := filepath.Join(dir, "teste")
	if err := os.MkdirAll(art, 0o755); err != nil {
		t.Fatal(err)
	}
	md := "---\nnumber: 01\ntitle: T\ntag: dados\npublishedAt: 2026-10-22\nexcerpt: e\ntldr: t\n---\n\n## A\n\n```grafico\n\nSumiu_2\n```\n"
	if err := os.WriteFile(filepath.Join(art, "index.md"), []byte(md), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := Load(dir); err == nil {
		t.Fatal("bloco grafico com id sem arquivo deveria ser erro, mesmo com linha em branco")
	}
}

// Os textos reais do repositório precisam carregar: é o mesmo que o servidor faz ao subir.
func TestLoadRepositoryArticles(t *testing.T) {
	posts, err := Load(filepath.Join("..", "..", "..", "articles"))
	if err != nil {
		t.Fatal(err)
	}
	for _, p := range posts {
		if len(p.Sections) == 0 {
			t.Errorf("%s: sem seções", p.Slug)
		}
	}
}
