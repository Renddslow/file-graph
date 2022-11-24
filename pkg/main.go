package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/adrg/frontmatter"
)

type fileData struct {
	id       string
	typename string
	filepath string
}

type ptr struct {
	Typename string `json:"typename"`
	Filepath string `json:"filepath"`
}

func openFile(p string, ch chan<- fileData) {
	data, _ := os.ReadFile(p)
	metadata := parseFrontMatter(data)
	ch <- fileData{
		id:       metadata.ID,
		typename: metadata.Typename,
		filepath: p,
	}
}

type fm struct {
	ID       string `yaml:"id"`
	Typename string `yaml:"type"`
}

func parseFrontMatter(content []byte) fm {
	r := strings.NewReader(string(content))
	var data fm
	frontmatter.Parse(r, &data)

	return data
}

// Create
func createSchema() map[string]ptr {
	shallowMatches, _ := filepath.Glob("content/*.md")
	deepMatches, _ := filepath.Glob("content/**/*.md")

	matches := []string{}
	matches = append(matches, shallowMatches...)
	matches = append(matches, deepMatches...)

	ch := make(chan fileData)

	for _, k := range matches {
		go openFile(k, ch)
	}

	results := make([]fileData, len(matches))
	for i := range results {
		results[i] = <-ch
	}

	tree := make(map[string]ptr)

	for _, k := range results {
		tree[k.id] = ptr{
			Typename: k.typename,
			Filepath: k.filepath,
		}
	}

	return tree
}

func main() {
	tree := createSchema()
	stringified, _ := json.Marshal(tree)
	fmt.Println(string(stringified))
}
