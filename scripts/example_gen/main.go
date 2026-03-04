package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

func main() {
	flag.CommandLine.SetOutput(os.Stderr)
	flag.Usage = func() {
		_, _ = fmt.Fprintf(
			os.Stderr,
			`Usage: %s <input_dir> <output_json>
			
Generates a FileNode[] JSON array from the direct children of <input_dir>.
Only includes .bal and .toml files; skips empty directories.
`,
			filepath.Base(os.Args[0]),
		)
		flag.PrintDefaults()
	}
	flag.Parse()

	if err := run(flag.Args()); err != nil {
		_, _ = fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
}

type Node struct {
	Kind     string
	Name     string
	Content  *string
	Children []Node
}

func File(name, content string) Node {
	return Node{Kind: "file", Name: name, Content: &content}
}

func Dir(name string, children []Node) Node {
	return Node{Kind: "dir", Name: name, Children: children}
}

func (n Node) MarshalJSON() ([]byte, error) {
	switch n.Kind {
	case "file":
		if n.Content == nil {
			return nil, fmt.Errorf("file node %q missing content", n.Name)
		}
		type fileNode struct {
			Kind    string `json:"kind"`
			Name    string `json:"name"`
			Content string `json:"content"`
		}
		return json.Marshal(fileNode{Kind: n.Kind, Name: n.Name, Content: *n.Content})
	case "dir":
		type dirNode struct {
			Kind     string `json:"kind"`
			Name     string `json:"name"`
			Children []Node `json:"children"`
		}
		children := n.Children
		if children == nil {
			children = []Node{}
		}
		return json.Marshal(dirNode{Kind: n.Kind, Name: n.Name, Children: children})
	default:
		return nil, fmt.Errorf("invalid node kind %q for %q", n.Kind, n.Name)
	}
}

func run(args []string) error {
	if len(args) != 2 {
		flag.Usage()
		return fmt.Errorf("expected 2 arguments, got %d", len(args))
	}

	inputDir := args[0]
	outputPath := args[1]

	if err := validateInputDir(inputDir); err != nil {
		return err
	}

	nodes, err := buildNodes(inputDir)
	if err != nil {
		return err
	}

	if err := writeJSON(outputPath, nodes); err != nil {
		return err
	}

	return nil
}

func buildNodes(dir string) ([]Node, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}

	type item struct {
		name string
		dir  bool
	}

	dirs := make([]item, 0, len(entries))
	files := make([]item, 0, len(entries))

	for _, e := range entries {
		name := e.Name()
		switch {
		case e.IsDir():
			dirs = append(dirs, item{name: name, dir: true})
		case e.Type().IsRegular() && isAllowedFileName(name):
			files = append(files, item{name: name, dir: false})
		}
	}

	sort.Slice(dirs, func(i, j int) bool { return dirs[i].name < dirs[j].name })
	sort.Slice(files, func(i, j int) bool { return files[i].name < files[j].name })

	nodes := make([]Node, 0, len(dirs)+len(files))

	for _, d := range dirs {
		full := filepath.Join(dir, d.name)
		children, err := buildNodes(full)
		if err != nil {
			return nil, err
		}
		if len(children) == 0 {
			continue
		}
		nodes = append(nodes, Dir(d.name, children))
	}

	for _, f := range files {
		full := filepath.Join(dir, f.name)
		contentBytes, err := os.ReadFile(full)
		if err != nil {
			return nil, err
		}
		nodes = append(nodes, File(f.name, string(contentBytes)))
	}

	return nodes, nil
}

func isAllowedFileName(name string) bool {
	switch strings.ToLower(filepath.Ext(name)) {
	case ".bal", ".toml":
		return true
	default:
		return false
	}
}

func validateInputDir(path string) error {
	info, err := os.Stat(path)
	if err != nil {
		return fmt.Errorf("stat input_dir: %w", err)
	}
	if !info.IsDir() {
		return fmt.Errorf("input_dir is not a directory: %s", path)
	}
	return nil
}

func writeJSON(path string, v []Node) error {
	outDir := filepath.Dir(path)
	if outDir != "." {
		if err := os.MkdirAll(outDir, 0o755); err != nil {
			return err
		}
	}

	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer func() { _ = f.Close() }()

	enc := json.NewEncoder(f)
	enc.SetIndent("", "  ")
	enc.SetEscapeHTML(false)
	return enc.Encode(v)
}
