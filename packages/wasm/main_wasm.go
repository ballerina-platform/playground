// Copyright (c) 2026, WSO2 LLC. (http://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

package main

import (
	_ "ballerina/lib/rt"
	"ballerina/platform/pal"
	"ballerina/projects"
	"ballerina/runtime"
	"ballerina/tools/diagnostics"
	"fmt"
	"io"
	"io/fs"
	"net/http"
	"net/http/httptest"
	"net/url"
	"path"
	"strings"
	"syscall/js"
)

func main() {
	js.Global().Set("run", js.FuncOf(run))

	js.Global().Set("sendStopSignal", js.FuncOf(sendStopSignal))
	js.Global().Set("dispatchHttpRequest", js.FuncOf(dispatchHttpRequest))

	js.Global().Set("getDiagnostics", js.FuncOf(getDiagnostics))

	select {}
}

func runOutcome(stdout, stderr string) map[string]any {
	return map[string]any{
		"stdout": stdout,
		"stderr": stderr,
	}
}

func getWorkingDir(fsys fs.FS, p string) string {
	info, err := fs.Stat(fsys, p)
	if err == nil && info.IsDir() {
		return p
	}
	return path.Dir(p)
}

func run(_ js.Value, args []js.Value) any {
	return newPromise(func(resolve js.Value, _ js.Value) {
		go func() {
			onEvent := js.Null()
			if len(args) >= 3 {
				onEvent = args[2]
			}

			stderr := outputWriter{onEvent: onEvent, stream: "stderr"}
			stdout := outputWriter{onEvent: onEvent, stream: "stdout"}
			done := func() { resolve.Invoke(js.Undefined()) }

			signalSource, signals := newSignalSource()
			if !activeRun.begin(signalSource) {
				signalSource.cleanup()
				fmt.Fprintf(stderr, "A Ballerina program is already running.\n")
				done()
				return
			}
			defer activeRun.end(signalSource)

			defer func() {
				if r := recover(); r != nil {
					fmt.Fprintf(stderr, "%v\n", r)
				}
				done()
			}()

			if len(args) < 2 {
				fmt.Fprintf(stderr, "expected at least 2 arguments: (fsProxy, path[, onEvent])\n")
				return
			}

			proxy := args[0]
			runPath := args[1].String()
			fsys := NewBridgeFS(proxy)

			result, err := projects.Load(fsys, runPath)
			if err != nil {
				fmt.Fprintf(stderr, "%v\n", err)
				return
			}

			if diags := result.Diagnostics(); diags.HasErrors() {
				printDiagnostics(fsys, runPath, stderr, diags, diagnostics.NewDiagnosticEnv())
				return
			}

			compilation := result.Project().CurrentPackage().Compilation()
			if diags := compilation.DiagnosticResult(); diags.HasErrors() {
				printDiagnostics(fsys, runPath, stderr, diags, compilation.DiagnosticEnv())
				return
			}

			project := result.Project()

			birPkgs := projects.NewBallerinaBackend(compilation).BIRPackages()
			if len(birPkgs) == 0 {
				fmt.Fprintf(stderr, "BIR generation failed: no BIR package produced\n")
				return
			}

			workingDir := getWorkingDir(fsys, runPath)
			pal := wasmPal(fsys, workingDir, stderr, stdout, signals)
			rt := runtime.NewRuntime(pal, project.Environment().TypeEnv())
			activeRun.setRuntime(signalSource, rt)
			for _, birPkg := range birPkgs {
				if err := rt.Init(*birPkg); err != nil {
					fmt.Fprintf(stderr, "%v\n", err)
					return
				}
			}
			activeRun.ensureStarted()
			emitEvent(onEvent, map[string]any{
				"type":  "listeners",
				"hosts": activeRun.hosts(),
			})
			_ = <-rt.ExitStatus
		}()
	})
}

func sendStopSignal(_ js.Value, _ []js.Value) any {
	return activeRun.sendSignal(pal.GracefulStop)
}

func dispatchHttpRequest(_ js.Value, args []js.Value) any {
	return newPromise(func(resolve js.Value, reject js.Value) {
		defer func() {
			if r := recover(); r != nil {
				reject.Invoke(js.ValueOf(fmt.Sprintf("%v", r)))
			}
		}()

		if len(args) < 1 || args[0].Type() != js.TypeObject || args[0].IsNull() {
			reject.Invoke(js.ValueOf("dispatchHttpRequest: expected an object argument"))
			return
		}

		reqObj := args[0]
		req, err := httpRequestFromJS(reqObj)
		if err != nil {
			reject.Invoke(js.ValueOf(err.Error()))
			return
		}

		handler, ok := findLocalHandler(activeRun, req.URL)
		if !ok {
			reject.Invoke(js.ValueOf(fmt.Sprintf("no service listening on %s", req.Host)))
			return
		}

		recorder := httptest.NewRecorder()
		handler.ServeHTTP(recorder, req)
		resp := recorder.Result()
		defer resp.Body.Close()

		body, err := io.ReadAll(resp.Body)
		if err != nil {
			reject.Invoke(js.ValueOf(err.Error()))
			return
		}

		resolve.Invoke(js.ValueOf(map[string]any{
			"statusCode": resp.StatusCode,
			"headers":    headersToJS(resp.Header),
			"body":       string(body),
		}))
	})
}

func httpRequestFromJS(reqObj js.Value) (*http.Request, error) {
	method := strings.ToUpper(getString(reqObj, "method", http.MethodGet))
	host := getString(reqObj, "host", "0.0.0.0")
	path := getString(reqObj, "path", "/")
	if path == "" {
		path = "/"
	} else if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}
	query := getString(reqObj, "query", "")
	query = strings.TrimPrefix(query, "?")
	body := getString(reqObj, "body", "")

	parsedPath, err := url.ParseRequestURI(path)
	if err != nil {
		return nil, fmt.Errorf("invalid request path: %w", err)
	}
	// TODO: Support HTTPS listener dispatch.
	reqURL := &url.URL{
		Scheme:   "http",
		Host:     host,
		Path:     parsedPath.Path,
		RawPath:  parsedPath.RawPath,
		RawQuery: query,
	}
	req, err := http.NewRequest(method, reqURL.String(), strings.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.RequestURI = req.URL.RequestURI()
	req.Host = host
	req.Header = parseHeaders(getObject(reqObj, "headers"))
	req.ContentLength = int64(len(body))
	return req, nil
}

func getString(obj js.Value, key string, fallback string) string {
	value := obj.Get(key)
	if value.Type() == js.TypeString {
		return value.String()
	}
	return fallback
}

func getObject(obj js.Value, key string) js.Value {
	value := obj.Get(key)
	if value.Type() == js.TypeObject && !value.IsNull() {
		return value
	}
	return js.Null()
}

func parseHeaders(headersObj js.Value) http.Header {
	headers := http.Header{}
	if headersObj.Type() != js.TypeObject || headersObj.IsNull() {
		return headers
	}

	keys := js.Global().Get("Object").Call("keys", headersObj)
	for i := 0; i < keys.Length(); i++ {
		key := keys.Index(i).String()
		value := headersObj.Get(key)
		switch value.Type() {
		case js.TypeString:
			headers.Add(key, value.String())
		case js.TypeObject:
			if js.Global().Get("Array").Call("isArray", value).Bool() {
				for j := 0; j < value.Length(); j++ {
					item := value.Index(j)
					if item.Type() == js.TypeString {
						headers.Add(key, item.String())
					}
				}
			}
		}
	}
	return headers
}

func headersToJS(headers http.Header) map[string]any {
	mapped := make(map[string]any, len(headers))
	for key, values := range headers {
		items := make([]any, len(values))
		for i, value := range values {
			items[i] = value
		}
		mapped[key] = items
	}
	return mapped
}

func getDiagnostics(_ js.Value, args []js.Value) any {
	return newPromise(func(resolve js.Value, reject js.Value) {
		defer func() {
			if r := recover(); r != nil {
				resolve.Invoke(js.ValueOf([]any{}))
			}
		}()

		if len(args) < 2 {
			resolve.Invoke(js.ValueOf([]any{}))
			return
		}

		proxy := args[0]
		path := args[1].String()
		fsys := NewBridgeFS(proxy)

		result, err := projects.Load(fsys, path)
		if err != nil {
			resolve.Invoke(js.ValueOf([]any{}))
			return
		}

		if result.Diagnostics().HasErrors() {
			resolve.Invoke(mapDiagnostics(result.Diagnostics().Diagnostics(), diagnostics.NewDiagnosticEnv()))
			return
		}

		compilation := result.Project().CurrentPackage().Compilation()
		if compilation.DiagnosticResult().HasErrors() {
			resolve.Invoke(mapDiagnostics(compilation.DiagnosticResult().Diagnostics(), compilation.DiagnosticEnv()))
			return
		}

		resolve.Invoke(js.ValueOf([]any{}))
	})
}

type outputWriter struct {
	onEvent js.Value
	stream  string
}

func (w outputWriter) Write(p []byte) (int, error) {
	emitEvent(w.onEvent, map[string]any{
		"type":   "output",
		"stream": w.stream,
		"text":   string(p),
	})
	return len(p), nil
}

func emitEvent(onEvent js.Value, event map[string]any) {
	if onEvent.Type() != js.TypeFunction {
		return
	}
	onEvent.Invoke(event)
}

func mapDiagnostics(diags []diagnostics.Diagnostic, de *diagnostics.DiagnosticEnv) []any {
	mapped := make([]any, 0, len(diags))
	for _, d := range diags {
		location := d.Location()
		if diagnostics.IsLocationEmpty(location) || !diagnostics.LocationHasSource(location) {
			continue
		}

		start := map[string]any{"line": de.StartLine(location), "character": de.StartColumn(location)}
		end := map[string]any{"line": de.EndLine(location), "character": de.EndColumn(location)}
		mapped = append(mapped, map[string]any{
			"range": map[string]any{
				"start": start,
				"end":   end,
			},
			"severity": 1,
			"message":  d.Message(),
		})
	}
	return mapped
}
