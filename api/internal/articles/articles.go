// Package articles lê os textos da pasta articles/: uma subpasta por texto, com
//
//	articles/<slug>/index.md         cabeçalho entre linhas "---" e o texto em Markdown
//	articles/<slug>/graficos/*.json  um gráfico por arquivo (model.Chart sem o id)
//	articles/<slug>/images/*         imagens citadas no Markdown como images/arquivo.png
//
// O texto é cortado em seções a cada linha "## ", como o sumário da leitura espera.
// Qualquer problema (campo faltando, gráfico citado sem arquivo) para o servidor na
// subida: é melhor descobrir ao rodar do que com uma seção vazia no site.
package articles

import (
	"bufio"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"

	"portfolio/api/internal/model"
)

// chartBlocks acham os blocos ```grafico (ou ~~~grafico) e capturam tudo até o fechamento. O id é esse
// conteúdo sem espaços nas pontas, a mesma regra do front (ArticleMarkdown), para que todo bloco que o
// site desenha como gráfico também seja conferido aqui.
var chartBlocks = []*regexp.Regexp{
	regexp.MustCompile("(?ms)^```grafico[ \t]*\n(.*?)^```"),
	regexp.MustCompile("(?ms)^~~~grafico[ \t]*\n(.*?)^~~~"),
}

var validTags = map[model.PostTag]bool{
	model.TagWeb: true, model.TagDesign: true, model.TagMotion: true,
	model.TagFerramentas: true, model.TagVida: true, model.TagDados: true,
}

// Load lê todos os textos de dir. A pasta precisa existir: servidor rodando de outra pasta (ou um deploy
// que esqueceu articles/) subiria com a Escrita vazia sem avisar.
func Load(dir string) ([]model.Post, error) {
	entries, err := os.ReadDir(dir)
	if errors.Is(err, os.ErrNotExist) {
		return nil, fmt.Errorf("a pasta de textos %q não existe: rode o servidor de dentro de api/ ou defina ARTICLES_DIR", dir)
	}
	if err != nil {
		return nil, err
	}
	posts := []model.Post{}
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		post, err := loadOne(filepath.Join(dir, e.Name()), e.Name())
		if err != nil {
			return nil, fmt.Errorf("articles/%s: %w", e.Name(), err)
		}
		posts = append(posts, post)
	}
	return posts, nil
}

func loadOne(dir, slug string) (model.Post, error) {
	raw, err := os.ReadFile(filepath.Join(dir, "index.md"))
	if err != nil {
		return model.Post{}, err
	}
	meta, body, err := splitFrontmatter(string(raw))
	if err != nil {
		return model.Post{}, err
	}

	post := model.Post{
		Slug:        slug,
		Number:      meta["number"],
		Title:       meta["title"],
		Tag:         model.PostTag(meta["tag"]),
		PublishedAt: meta["publishedAt"],
		Excerpt:     meta["excerpt"],
		TLDR:        meta["tldr"],
	}
	for _, key := range []string{"number", "title", "tag", "publishedAt", "excerpt", "tldr"} {
		if meta[key] == "" {
			return model.Post{}, fmt.Errorf("index.md: falta %q no cabeçalho", key)
		}
	}
	if !validTags[post.Tag] {
		return model.Post{}, fmt.Errorf("index.md: tag %q não existe em model.PostTag", post.Tag)
	}

	if post.Sections, err = splitSections(body); err != nil {
		return model.Post{}, err
	}
	if post.Charts, err = loadCharts(filepath.Join(dir, "graficos")); err != nil {
		return model.Post{}, err
	}
	known := map[string]bool{}
	for _, c := range post.Charts {
		known[c.ID] = true
	}
	for _, re := range chartBlocks {
		for _, m := range re.FindAllStringSubmatch(body, -1) {
			id := strings.TrimSpace(m[1])
			if id == "" || strings.ContainsAny(id, " \t\n") {
				return model.Post{}, fmt.Errorf("index.md: um bloco grafico precisa ter só o id do gráfico, achei %q", id)
			}
			if !known[id] {
				return model.Post{}, fmt.Errorf("index.md cita o gráfico %q, mas não há graficos/%s.json", id, id)
			}
		}
	}
	return post, nil
}

// splitFrontmatter separa o cabeçalho (linhas "chave: valor" entre dois "---") do corpo.
// O valor é tudo depois do primeiro ":", então títulos com dois-pontos funcionam.
func splitFrontmatter(src string) (map[string]string, string, error) {
	src = strings.ReplaceAll(src, "\r\n", "\n")
	if !strings.HasPrefix(src, "---\n") {
		return nil, "", errors.New(`index.md precisa começar com o cabeçalho entre linhas "---"`)
	}
	head, body, ok := strings.Cut(src[len("---\n"):], "\n---\n")
	if !ok {
		return nil, "", errors.New(`index.md: cabeçalho sem a linha "---" de fechamento`)
	}
	meta := map[string]string{}
	sc := bufio.NewScanner(strings.NewReader(head))
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, value, ok := strings.Cut(line, ":")
		if !ok {
			return nil, "", fmt.Errorf("index.md: linha do cabeçalho sem \":\": %q", line)
		}
		meta[strings.TrimSpace(key)] = strings.TrimSpace(value)
	}
	return meta, body, nil
}

// splitSections corta o corpo a cada linha "## Título". Texto antes do primeiro
// "## " seria perdido (o título do texto já vem do cabeçalho), então é erro.
func splitSections(body string) ([]model.PostSection, error) {
	sections := []model.PostSection{}
	var title string
	var lines []string
	inFence := false
	flush := func() {
		md := strings.TrimSpace(strings.Join(lines, "\n"))
		sections = append(sections, model.PostSection{Title: title, Paragraphs: []string{}, Markdown: &md})
	}
	for _, line := range strings.Split(body, "\n") {
		if strings.HasPrefix(line, "```") || strings.HasPrefix(line, "~~~") {
			inFence = !inFence // "## " dentro de um bloco de código não abre seção
		}
		if !inFence && strings.HasPrefix(line, "## ") {
			if title != "" {
				flush()
			} else if strings.TrimSpace(strings.Join(lines, "\n")) != "" {
				return nil, errors.New(`index.md: há texto antes do primeiro "## "; ele não apareceria no site`)
			}
			title, lines = strings.TrimSpace(line[3:]), nil
			continue
		}
		lines = append(lines, line)
	}
	if title == "" {
		return nil, errors.New(`index.md: nenhuma seção "## " no texto`)
	}
	flush()
	return sections, nil
}

func loadCharts(dir string) ([]model.Chart, error) {
	files, err := filepath.Glob(filepath.Join(dir, "*.json"))
	if err != nil {
		return nil, err
	}
	sort.Strings(files)
	charts := []model.Chart{}
	for _, f := range files {
		raw, err := os.ReadFile(f)
		if err != nil {
			return nil, err
		}
		var c model.Chart
		dec := json.NewDecoder(strings.NewReader(string(raw)))
		dec.DisallowUnknownFields() // um campo com nome errado vira erro, não um gráfico em branco
		if err := dec.Decode(&c); err != nil {
			return nil, fmt.Errorf("%s: %w", filepath.Base(f), err)
		}
		c.ID = strings.TrimSuffix(filepath.Base(f), ".json")
		if len(c.Views) == 0 {
			return nil, fmt.Errorf("%s: o gráfico precisa de ao menos uma vista em \"views\"", filepath.Base(f))
		}
		charts = append(charts, c)
	}
	return charts, nil
}
