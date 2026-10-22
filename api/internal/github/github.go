// Package github busca o calendário de contribuições do perfil (o mesmo
// quadriculado verde do GitHub) pela API GraphQL.
package github

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"
)

const (
	endpoint = "https://api.github.com/graphql"
	// HeatmapDays é o tamanho do mapa no card de telemetria (26 semanas × 7 dias).
	HeatmapDays = 182
	cacheTTL    = time.Hour
)

const query = `query($login: String!) {
  user(login: $login) {
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionLevel } }
      }
    }
  }
}`

// Activity é o que o card de telemetria mostra.
type Activity struct {
	TotalLastYear int
	// Heatmap tem HeatmapDays níveis de 0 a 4, do dia mais antigo até hoje.
	Heatmap []int
}

type Client struct {
	user  string
	token string
	http  *http.Client

	mu        sync.Mutex
	cached    *Activity
	fetchedAt time.Time
}

func New(user, token string) *Client {
	return &Client{user: user, token: token, http: &http.Client{Timeout: 8 * time.Second}}
}

// Activity devolve os dados em cache (até 1 h). Se o GitHub falhar e houver
// um cache antigo, devolve o antigo junto com o erro para o servidor registrar.
func (c *Client) Activity(ctx context.Context) (*Activity, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.cached != nil && time.Since(c.fetchedAt) < cacheTTL {
		return c.cached, nil
	}
	act, err := c.fetch(ctx)
	if err != nil {
		return c.cached, err
	}
	c.cached, c.fetchedAt = act, time.Now()
	return act, nil
}

// O GitHub classifica cada dia em quartis; viram os níveis 0–4 do mapa.
var levels = map[string]int{
	"NONE":            0,
	"FIRST_QUARTILE":  1,
	"SECOND_QUARTILE": 2,
	"THIRD_QUARTILE":  3,
	"FOURTH_QUARTILE": 4,
}

func (c *Client) fetch(ctx context.Context) (*Activity, error) {
	body, _ := json.Marshal(map[string]any{"query": query, "variables": map[string]string{"login": c.user}})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "bearer "+c.token)
	req.Header.Set("Content-Type", "application/json")

	res, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("github: %w", err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("github: status %d (token válido?)", res.StatusCode)
	}

	var out struct {
		Data struct {
			User *struct {
				ContributionsCollection struct {
					ContributionCalendar struct {
						TotalContributions int `json:"totalContributions"`
						Weeks              []struct {
							ContributionDays []struct {
								Date              string `json:"date"`
								ContributionLevel string `json:"contributionLevel"`
							} `json:"contributionDays"`
						} `json:"weeks"`
					} `json:"contributionCalendar"`
				} `json:"contributionsCollection"`
			} `json:"user"`
		} `json:"data"`
		Errors []struct {
			Message string `json:"message"`
		} `json:"errors"`
	}
	if err := json.NewDecoder(res.Body).Decode(&out); err != nil {
		return nil, fmt.Errorf("github: resposta inválida: %w", err)
	}
	if len(out.Errors) > 0 {
		return nil, fmt.Errorf("github: %s", out.Errors[0].Message)
	}
	if out.Data.User == nil {
		return nil, fmt.Errorf("github: usuário %q não encontrado", c.user)
	}

	cal := out.Data.User.ContributionsCollection.ContributionCalendar
	var days []int
	for _, w := range cal.Weeks {
		for _, d := range w.ContributionDays {
			days = append(days, levels[d.ContributionLevel])
		}
	}
	if len(days) > HeatmapDays {
		days = days[len(days)-HeatmapDays:]
	}
	return &Activity{TotalLastYear: cal.TotalContributions, Heatmap: days}, nil
}
