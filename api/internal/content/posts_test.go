package content

import (
	"testing"

	"portfolio/api/internal/model"
)

func TestMergePostsRejectsDuplicates(t *testing.T) {
	a := model.Post{Slug: "a", Number: "01", PublishedAt: "2026-10-22"}
	if _, err := MergePosts([]model.Post{{Slug: "a", Number: "02"}}, []model.Post{a}); err == nil {
		t.Error("slug repetido deveria ser erro")
	}
	if _, err := MergePosts([]model.Post{{Slug: "b", Number: "01"}}, []model.Post{a}); err == nil {
		t.Error("número repetido deveria ser erro")
	}
}

func TestMergePostsOrdersByDateThenNumber(t *testing.T) {
	posts, err := MergePosts([]model.Post{
		{Slug: "nove", Number: "9", PublishedAt: "2026-10-01"},
		{Slug: "antigo", Number: "1", PublishedAt: "2026-01-01"},
	}, []model.Post{{Slug: "dez", Number: "10", PublishedAt: "2026-10-01"}})
	if err != nil {
		t.Fatal(err)
	}
	got := []string{posts[0].Slug, posts[1].Slug, posts[2].Slug}
	if got[0] != "dez" || got[1] != "nove" || got[2] != "antigo" {
		t.Fatalf("ordem errada: %v (10 vem antes de 9 no mesmo dia; o mais antigo por último)", got)
	}
	for _, p := range posts {
		if p.Charts == nil {
			t.Errorf("%s: Charts nil viraria null no JSON", p.Slug)
		}
	}
}
