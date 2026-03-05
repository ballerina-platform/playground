# Ballerina Playground

Ballerina playground is a web based tool which allows trying out language features.

## Getting started

### Prerequisites

- Go 1.26 or later
- Bun

### Code structure

- `wasm/`: Go module that builds `ballerina.wasm` and exposes the Ballerina runtime to the browser.
- `wasm/ballerina-lang-go/`: `ballerina-lang-go` git submodule providing the compiler/frontend used by the WASM runtime.
- `web/`: Web frontend that loads `ballerina.wasm` and provides the editor/runner UI.
- `scripts/`: Supporting scripts used for development and maintenance tasks.

Build the WASM binary (outputs to `web/public/ballerina.wasm`):

```bash
cd wasm
GOOS=js GOARCH=wasm go build -o ../web/public/ballerina.wasm .
```

Run the web app:

```bash
cd web
bun install
bun run dev
```
