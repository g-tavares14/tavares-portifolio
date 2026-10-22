// Package model define o contrato da API: estas structs são a fonte da verdade.
// Os tipos TypeScript do front (web/src/types/api.gen.ts) são gerados daqui com
// `go tool tygo generate` (rode dentro de api/). Mudou um campo ou uma tag json? Gere de novo.
package model

// SocialKind identifica qual ícone o front desenha para o link.
type SocialKind string

const (
	SocialX         SocialKind = "x"
	SocialInstagram SocialKind = "instagram"
	SocialGitHub    SocialKind = "github"
	SocialLinkedIn  SocialKind = "linkedin"
	SocialEmail     SocialKind = "email"
)

type Social struct {
	Kind  SocialKind `json:"kind"`
	Label string     `json:"label"`
	URL   string     `json:"url"`
}

// Letter é a carta que abre no botão "Sobre mim".
type Letter struct {
	Greeting   string   `json:"greeting"`
	Paragraphs []string `json:"paragraphs"`
	Signature  string   `json:"signature"`
}

// NowPlaying alimenta o card do toca-discos.
type NowPlaying struct {
	Title  string `json:"title"`
	Artist string `json:"artist"`
	// IsPlaying é true quando a música está tocando agora; false quando é a última tocada.
	IsPlaying       bool   `json:"isPlaying"`
	ProgressSeconds int    `json:"progressSeconds"`
	DurationSeconds int    `json:"durationSeconds"`
	RotationArtist  string `json:"rotationArtist"`
	RotationCount   int    `json:"rotationCount"`
	TodayLabel      string `json:"todayLabel"`
}

// Telemetry alimenta o card de telemetria.
type Telemetry struct {
	Position string `json:"position"`
	// ContributionsPerYear soma commits, PRs, issues e reviews do último ano (como no perfil do GitHub).
	ContributionsPerYear *int `json:"contributionsPerYear"`
	// Heatmap tem 182 níveis de 0 a 4 (26 semanas × 7 dias), do mais antigo ao mais recente.
	// Vazio quando ainda não há dados (o front mostra "sem dados").
	Heatmap []int `json:"heatmap"`
}

type Profile struct {
	Name     string `json:"name"`
	Initials string `json:"initials"`
	Role     string `json:"role"`
	City     string `json:"city"`
	// Origin e Destination formam a rota "origem → destino" do cartão; sem elas, o front mostra só City.
	Origin      *string `json:"origin"`
	Destination *string `json:"destination"`
	// Timezone é um fuso IANA, ex.: "America/Sao_Paulo".
	Timezone      string      `json:"timezone"`
	TimezoneLabel string      `json:"timezoneLabel"`
	Available     bool        `json:"available"`
	AvailableFrom *string     `json:"availableFrom"`
	PhotoURL      *string     `json:"photoUrl"`
	CVURL         *string     `json:"cvUrl"`
	Socials       []Social    `json:"socials"`
	Letter        Letter      `json:"letter"`
	NowPlaying    *NowPlaying `json:"nowPlaying"`
	Telemetry     Telemetry   `json:"telemetry"`
}

// PostTag é o tema usado nos filtros da página Escrita.
type PostTag string

const (
	TagWeb         PostTag = "web"
	TagDesign      PostTag = "design"
	TagMotion      PostTag = "motion"
	TagFerramentas PostTag = "ferramentas"
	TagVida        PostTag = "vida"
	TagDados       PostTag = "dados"
)

type PostSection struct {
	Title      string   `json:"title"`
	Paragraphs []string `json:"paragraphs"`
	// Markdown é o corpo da seção quando o texto vem de articles/ (aí Paragraphs fica vazio).
	// Um bloco ```grafico com o id de um item de Post.Charts vira um gráfico interativo.
	Markdown *string `json:"markdown"`
}

type Post struct {
	Slug   string  `json:"slug"`
	Number string  `json:"number"`
	Title  string  `json:"title"`
	Tag    PostTag `json:"tag"`
	// PublishedAt é uma data ISO, ex.: "2026-09-16".
	PublishedAt string        `json:"publishedAt"`
	Excerpt     string        `json:"excerpt"`
	TLDR        string        `json:"tldr"`
	Sections    []PostSection `json:"sections"`
	// Charts são os gráficos citados no Markdown das seções; vazio nos textos sem gráfico.
	Charts []Chart `json:"charts"`
}

// ChartKind diz qual desenho o front usa para o gráfico.
type ChartKind string

const (
	// ChartBars: uma barra horizontal por linha (Rows[i].Values tem um valor).
	ChartBars ChartKind = "barras"
	// ChartGroups: barras verticais agrupadas; cada linha é um grupo e cada valor, uma série.
	ChartGroups ChartKind = "grupos"
	// ChartStack: uma barra horizontal de 100 % por linha, dividida pelos valores.
	ChartStack ChartKind = "pilha"
	// ChartInterval: um ponto com intervalo [Low, High] por linha, em volta de uma linha no zero.
	ChartInterval ChartKind = "intervalo"
)

// Chart é um gráfico de um artigo, lido de articles/<slug>/graficos/<id>.json.
type Chart struct {
	// ID vem do nome do arquivo e é o que o Markdown cita no bloco ```grafico.
	ID    string    `json:"id"`
	Kind  ChartKind `json:"kind"`
	Title string    `json:"title"`
	// Source é a linha pequena embaixo do gráfico: de onde vêm os números.
	Source string `json:"source"`
	// Accent é a série (em "grupos" e "pilha") ou a linha (em "barras" e "intervalo") pintada de amarelo.
	Accent *string `json:"accent"`
	// Unit vai depois de cada número, ex.: "%"; vazio para números sem unidade.
	Unit     string `json:"unit"`
	Decimals int    `json:"decimals"`
	// Views tem uma vista por botão (ex.: Validação e Teste); com uma só, o front não mostra botões.
	Views []ChartView `json:"views"`
}

type ChartView struct {
	Label string     `json:"label"`
	Rows  []ChartRow `json:"rows"`
}

type ChartRow struct {
	Label  string       `json:"label"`
	Values []ChartValue `json:"values"`
}

type ChartValue struct {
	// Series é o nome da série; vazio em "barras" e "intervalo", que têm um valor por linha.
	Series string  `json:"series"`
	Value  float64 `json:"value"`
	// Low e High são as pontas do intervalo (só em "intervalo").
	Low  *float64 `json:"low"`
	High *float64 `json:"high"`
	// Note é o texto extra do hover, ex.: "299 de 592 falhas".
	Note *string `json:"note"`
}

type Project struct {
	Slug        string   `json:"slug"`
	Number      string   `json:"number"`
	Name        string   `json:"name"`
	Category    string   `json:"category"`
	Year        string   `json:"year"`
	Role        string   `json:"role"`
	Description string   `json:"description"`
	Stack       []string `json:"stack"`
	ImageURL    *string  `json:"imageUrl"`
	// ImageLabel é o texto da barra da moldura em volta da imagem (ex.: "preditor · ao vivo · 22/10/2026");
	// em null, a imagem aparece sem moldura.
	ImageLabel *string `json:"imageLabel"`
	LiveURL    *string `json:"liveUrl"`
	RepoURL    *string `json:"repoUrl"`
}
