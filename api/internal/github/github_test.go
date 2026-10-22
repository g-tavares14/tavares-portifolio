package github

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"testing"
)

type roundTrip func(*http.Request) *http.Response

func (f roundTrip) RoundTrip(r *http.Request) (*http.Response, error) { return f(r), nil }

func jsonResponse(status int, body string) *http.Response {
	return &http.Response{StatusCode: status, Body: io.NopCloser(strings.NewReader(body)), Header: http.Header{}}
}

func calendarJSON(days int, level string) string {
	type day struct {
		Date              string `json:"date"`
		ContributionLevel string `json:"contributionLevel"`
	}
	var weeks []map[string][]day
	for i := 0; i < days; i += 7 {
		var w []day
		for j := i; j < i+7 && j < days; j++ {
			lvl := level
			if j == days-1 {
				lvl = "FOURTH_QUARTILE" // hoje
			}
			w = append(w, day{Date: "2026-01-01", ContributionLevel: lvl})
		}
		weeks = append(weeks, map[string][]day{"contributionDays": w})
	}
	b, _ := json.Marshal(map[string]any{"data": map[string]any{"user": map[string]any{
		"contributionsCollection": map[string]any{"contributionCalendar": map[string]any{
			"totalContributions": 1234, "weeks": weeks,
		}},
	}}})
	return string(b)
}

func TestActivityTrimsToLast182DaysAndCaches(t *testing.T) {
	calls := 0
	c := New("g-tavares14", "token")
	c.http.Transport = roundTrip(func(r *http.Request) *http.Response {
		calls++
		if got := r.Header.Get("Authorization"); got != "bearer token" {
			t.Errorf("Authorization = %q", got)
		}
		return jsonResponse(200, calendarJSON(365, "SECOND_QUARTILE"))
	})

	act, err := c.Activity(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if act.TotalLastYear != 1234 {
		t.Errorf("total = %d, quer 1234", act.TotalLastYear)
	}
	if len(act.Heatmap) != HeatmapDays {
		t.Fatalf("heatmap tem %d dias, quer %d", len(act.Heatmap), HeatmapDays)
	}
	if act.Heatmap[0] != 2 || act.Heatmap[HeatmapDays-1] != 4 {
		t.Errorf("níveis = %d…%d, quer 2…4 (o último é hoje)", act.Heatmap[0], act.Heatmap[HeatmapDays-1])
	}

	if _, err := c.Activity(context.Background()); err != nil || calls != 1 {
		t.Errorf("segunda chamada deveria vir do cache: calls=%d err=%v", calls, err)
	}
}

func TestActivityUnknownUser(t *testing.T) {
	c := New("ninguem", "token")
	c.http.Transport = roundTrip(func(*http.Request) *http.Response {
		return jsonResponse(200, `{"data":{"user":null}}`)
	})
	if _, err := c.Activity(context.Background()); err == nil {
		t.Fatal("esperava erro para usuário inexistente")
	}
}

func TestActivityBadToken(t *testing.T) {
	c := New("g-tavares14", "errado")
	c.http.Transport = roundTrip(func(*http.Request) *http.Response { return jsonResponse(401, `{}`) })
	if _, err := c.Activity(context.Background()); err == nil || !strings.Contains(err.Error(), "401") {
		t.Fatalf("esperava erro 401, veio %v", err)
	}
}
