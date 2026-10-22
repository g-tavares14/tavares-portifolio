// Package content guarda o conteúdo do portfólio. Por enquanto é escrito direto
// no código; troque por um banco ou por arquivos Markdown quando quiser.
// Tudo entre [colchetes] é marcador a preencher.
package content

import "portfolio/api/internal/model"

var Profile = model.Profile{
	Name:          "Guilherme Tavares",
	Initials:      "GT",
	Role:          "Pricing Strategy & Operations Intern at LinkedIn",
	City:          "São Paulo · BR",
	Origin:        nil,
	Destination:   nil,
	Timezone:      "America/Sao_Paulo",
	TimezoneLabel: "BRT",
	Available:     true,
	AvailableFrom: nil,
	PhotoURL:      nil,
	CVURL:         nil, // currículo: vem depois
	Socials: []model.Social{
		{Kind: model.SocialGitHub, Label: "GitHub", URL: "https://github.com/g-tavares14"},
		{Kind: model.SocialLinkedIn, Label: "LinkedIn", URL: "https://www.linkedin.com/in/gtavares14"},
		{Kind: model.SocialX, Label: "X (Twitter)", URL: "https://x.com/14gtavares"},
		{Kind: model.SocialEmail, Label: "E-mail", URL: "mailto:g.tavares14@icloud.com"},
	},
	Letter: model.Letter{
		Greeting: "Oi, você puxou minha ficha.",
		Paragraphs: []string{
			"Sou o Guilherme, de São Paulo. Hoje sou Pricing Strategy & Operations Intern no LinkedIn, onde passo boa parte do dia entre números, preços e as operações que fazem tudo isso funcionar.",
			"Fora do expediente, eu construo. Este portfólio é um exemplo: back-end em Go, front-end em TypeScript, e cada card feito para responder ao seu mouse.",
			"Gosto de entender como as coisas funcionam por dentro, seja uma estratégia de preço, seja uma API. Se quiser trocar uma ideia, os links estão no cartão.",
		},
		Signature: "Guilherme Tavares",
	},
	// Preenchido pela integração com o Spotify; sem ela o card mostra "Nada tocando".
	NowPlaying: nil,
	Telemetry: model.Telemetry{
		Position: "São Paulo · BR",
		// Preenchidos pela integração com o GitHub; sem ela o card mostra "sem dados".
		ContributionsPerYear: nil,
		Heatmap:              []int{},
	},
}

// Posts escritos direto no código. Os textos agora vêm de articles/ (um .md por texto, ver README);
// deixe vazio, ou use para um texto curto que não precise de pasta própria.
var Posts = []model.Post{}

var Projects = []model.Project{
	{
		Slug:        "preditor-de-falhas",
		Number:      "01",
		Name:        "Preditor de falhas de rede",
		Category:    "DADOS",
		Year:        "2026",
		Role:        "Arquitetura de dados e especificação",
		Description: "Prevê, 12 minutos antes, se uma conexão de internet vai entrar em risco ou em falha, a partir de medições públicas de ping do RIPE Atlas.",
		Stack:       []string{"Python", "PySpark", "scikit-learn", "Go", "React", "AWS"},
		ImageURL:    ptr("/static/projetos/preditor.png"),
		ImageLabel:  ptr("preditor · ao vivo · 22/10/2026"),
		LiveURL:     nil, // o serviço ao vivo ficou no ar por um período e foi desligado
		RepoURL:     ptr("https://github.com/g-tavares14/preditor-de-falhas-ml"),
	},
}

func ptr(s string) *string { return &s }
