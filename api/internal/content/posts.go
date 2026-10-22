package content

import (
	"fmt"
	"sort"
	"strconv"

	"portfolio/api/internal/model"
)

// MergePosts junta os textos escritos no código (seed) com os lidos de articles/
// e devolve a lista na ordem em que a página Escrita mostra as pastas.
// Slug ou número repetido é erro: a URL /escrita/<slug> e o "Nº" precisam apontar para um texto só.
func MergePosts(seed, fromArticles []model.Post) ([]model.Post, error) {
	all := make([]model.Post, 0, len(seed)+len(fromArticles))
	all = append(all, fromArticles...)
	all = append(all, seed...)

	slugs, numbers := map[string]bool{}, map[string]bool{}
	for i := range all {
		if all[i].Charts == nil {
			all[i].Charts = []model.Chart{} // o front espera uma lista, nunca null
		}
		if slugs[all[i].Slug] {
			return nil, fmt.Errorf("dois textos com o slug %q", all[i].Slug)
		}
		if numbers[all[i].Number] {
			return nil, fmt.Errorf("dois textos com o número %q", all[i].Number)
		}
		slugs[all[i].Slug], numbers[all[i].Number] = true, true
	}

	// Mais recente primeiro: a primeira pasta que o visitante vê é o texto novo.
	// Datas ISO ("2026-10-22") comparam certo como texto; o empate fica com o número maior.
	sort.SliceStable(all, func(i, j int) bool {
		if all[i].PublishedAt != all[j].PublishedAt {
			return all[i].PublishedAt > all[j].PublishedAt
		}
		return numberValue(all[i].Number) > numberValue(all[j].Number)
	})
	return all, nil
}

// numberValue lê "04" como 4, para "10" vir depois de "9"; um número que não é número fica por último.
func numberValue(s string) int {
	n, err := strconv.Atoi(s)
	if err != nil {
		return -1
	}
	return n
}
