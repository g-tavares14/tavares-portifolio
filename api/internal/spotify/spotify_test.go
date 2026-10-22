package spotify

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"
)

type roundTrip func(*http.Request) *http.Response

func (f roundTrip) RoundTrip(r *http.Request) (*http.Response, error) { return f(r), nil }

func respond(status int, body string) *http.Response {
	return &http.Response{StatusCode: status, Body: io.NopCloser(strings.NewReader(body)), Header: http.Header{}}
}

func trackJSON(name, artist string, ms int) string {
	return fmt.Sprintf(`{"name":%q,"duration_ms":%d,"artists":[{"name":%q}]}`, name, ms, artist)
}

// fakeSpotify responde como a API: token, "tocando agora" e "últimas tocadas".
func fakeSpotify(t *testing.T, current string, recent string) roundTrip {
	return func(r *http.Request) *http.Response {
		switch {
		case r.URL.Host == "accounts.spotify.com":
			if id, secret, _ := r.BasicAuth(); id != "id" || secret != "secret" {
				t.Errorf("basic auth = %q/%q", id, secret)
			}
			return respond(200, `{"access_token":"acc","expires_in":3600}`)
		case r.Header.Get("Authorization") != "Bearer acc":
			return respond(401, `{}`)
		case strings.HasSuffix(r.URL.Path, "/currently-playing"):
			if current == "" {
				return respond(204, "")
			}
			return respond(200, current)
		case strings.HasSuffix(r.URL.Path, "/recently-played"):
			return respond(200, recent)
		}
		t.Errorf("rota inesperada: %s", r.URL)
		return respond(404, `{}`)
	}
}

func TestNowPlayingUsesCurrentTrack(t *testing.T) {
	loc := time.UTC
	// Horários ancorados na meia-noite de hoje: o teste não depende da hora em que roda.
	now := time.Now().In(loc)
	midnight := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc)
	recent := fmt.Sprintf(`{"items":[
		{"track":%s,"played_at":%q},
		{"track":%s,"played_at":%q},
		{"track":%s,"played_at":%q}
	]}`,
		trackJSON("A", "Djavan", 60*60*1000), midnight.Add(2*time.Minute).Format(time.RFC3339),
		trackJSON("B", "Djavan", 32*60*1000), midnight.Add(time.Minute).Format(time.RFC3339),
		trackJSON("C", "Gal Costa", 10*60*1000), midnight.Add(-48*time.Hour).Format(time.RFC3339),
	)
	current := fmt.Sprintf(`{"is_playing":true,"progress_ms":72000,"item":%s}`, trackJSON("Oceano", "Djavan", 197000))

	c := New("id", "secret", "refresh", loc)
	c.http.Transport = fakeSpotify(t, current, recent)

	np, err := c.NowPlaying(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if np.Title != "Oceano" || np.Artist != "Djavan" || !np.IsPlaying {
		t.Errorf("música = %+v", np)
	}
	if np.ProgressSeconds != 72 || np.DurationSeconds != 197 {
		t.Errorf("progresso = %d/%d, quer 72/197", np.ProgressSeconds, np.DurationSeconds)
	}
	if np.RotationArtist != "Djavan" || np.RotationCount != 2 {
		t.Errorf("rotação = %s ×%d, quer Djavan ×2", np.RotationArtist, np.RotationCount)
	}
	if np.TodayLabel != "1H 32M" {
		t.Errorf("hoje = %q, quer 1H 32M (a música de 2 dias atrás não conta)", np.TodayLabel)
	}
}

func TestNowPlayingFallsBackToLastPlayed(t *testing.T) {
	recent := fmt.Sprintf(`{"items":[{"track":%s,"played_at":"2020-01-01T00:00:00Z"}]}`, trackJSON("Velha", "Artista", 120000))
	c := New("id", "secret", "refresh", time.UTC)
	c.http.Transport = fakeSpotify(t, "", recent)

	np, err := c.NowPlaying(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if np == nil || np.Title != "Velha" || np.IsPlaying {
		t.Fatalf("esperava a última tocada sem 'tocando agora', veio %+v", np)
	}
	if np.TodayLabel != "0M" {
		t.Errorf("hoje = %q, quer 0M", np.TodayLabel)
	}
}

func TestNowPlayingNothingAtAll(t *testing.T) {
	c := New("id", "secret", "refresh", time.UTC)
	c.http.Transport = fakeSpotify(t, "", `{"items":[]}`)
	np, err := c.NowPlaying(context.Background())
	if err != nil || np != nil {
		t.Fatalf("esperava nil sem erro, veio %+v, %v", np, err)
	}
}

func TestDurationLabel(t *testing.T) {
	for d, want := range map[time.Duration]string{
		0:                           "0M",
		32 * time.Minute:            "32M",
		2*time.Hour + 5*time.Minute: "2H 05M",
	} {
		if got := durationLabel(d); got != want {
			t.Errorf("durationLabel(%v) = %q, quer %q", d, got, want)
		}
	}
}
