package main

import (
	"ballerina/platform/pal"
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"syscall/js"
	"time"
)

type fetchHTTPClient struct {
	cfg pal.ClientConfig
	run *runContext
}

type requestContext struct {
	controller js.Value
	timer      *time.Timer
	cancelDone chan struct{}
}

func (ctx *requestContext) cleanup() {
	if ctx.timer != nil {
		ctx.timer.Stop()
	}
	if ctx.cancelDone != nil {
		close(ctx.cancelDone)
	}
}

func (c *fetchHTTPClient) Execute(ctx context.Context, method, targetURL string, body io.Reader, _ int64, contentType string, reqHeaders map[string][]string) (int, map[string][]string, io.ReadCloser, error) {
	bodyBytes, err := readRequestBody(method, body)
	if err != nil {
		return 0, nil, nil, err
	}

	if status, headers, respBody, handled, err := c.executeLocalRequest(ctx, method, targetURL, bodyBytes, contentType, reqHeaders); handled || err != nil {
		return status, headers, respBody, err
	}

	fetch := js.Global().Get("fetch")
	if !fetch.Truthy() {
		return 0, nil, nil, fmt.Errorf("browser fetch API is not available")
	}

	reqCtx := &requestContext{}
	defer reqCtx.cleanup()

	options := c.buildFetchOptions(ctx, method, bodyBytes, contentType, reqHeaders, reqCtx)
	resp, err := c.executeRequest(fetch, targetURL, options)
	if err != nil {
		return 0, nil, nil, err
	}

	respHeaders := c.extractHeaders(resp)
	respBody, err := c.extractBody(resp)
	if err != nil {
		return 0, nil, nil, err
	}
	if c.cfg.ResponseLimits.MaxEntityBodySize != -1 && int64(len(respBody)) > c.cfg.ResponseLimits.MaxEntityBodySize {
		return 0, nil, nil, fmt.Errorf("response entity body size exceeds: %d bytes", c.cfg.ResponseLimits.MaxEntityBodySize)
	}

	return resp.Get("status").Int(), respHeaders, io.NopCloser(bytes.NewReader(respBody)), nil
}

func (c *fetchHTTPClient) executeLocalRequest(ctx context.Context, method, targetURL string, body []byte, contentType string, reqHeaders map[string][]string) (int, map[string][]string, io.ReadCloser, bool, error) {
	parsed, err := url.Parse(targetURL)
	if err != nil || !isLocalHTTPHost(parsed.Hostname()) {
		return 0, nil, nil, false, err
	}

	// Intentionally ignore the scheme for loopback requests; TLS is not supported.
	handler, ok := findLocalHandler(c.run, parsed)
	if !ok {
		return 0, nil, nil, false, nil
	}

	if ctx == nil {
		ctx = context.Background()
	}
	req, err := http.NewRequestWithContext(ctx, method, parsed.String(), bytes.NewReader(body))
	if err != nil {
		return 0, nil, nil, true, err
	}
	req.RequestURI = req.URL.RequestURI()
	req.Host = parsed.Host
	req.Header = http.Header{}
	for key, values := range reqHeaders {
		for _, value := range values {
			req.Header.Add(key, value)
		}
	}
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}
	req.ContentLength = int64(len(body))

	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, req)
	resp := recorder.Result()
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return 0, nil, nil, true, err
	}
	if c.cfg.ResponseLimits.MaxEntityBodySize != -1 && int64(len(respBody)) > c.cfg.ResponseLimits.MaxEntityBodySize {
		return 0, nil, nil, true, fmt.Errorf("response entity body size exceeds: %d bytes", c.cfg.ResponseLimits.MaxEntityBodySize)
	}

	return resp.StatusCode, resp.Header, io.NopCloser(bytes.NewReader(respBody)), true, nil
}

func isLocalHTTPHost(host string) bool {
	switch strings.ToLower(host) {
	case "localhost", "127.0.0.1", "0.0.0.0", "::1":
		return true
	default:
		return false
	}
}

func findLocalHandler(run *runContext, parsed *url.URL) (http.Handler, bool) {
	if run == nil {
		run = activeRun
	}

	candidates := []string{parsed.Host}
	if port := parsed.Port(); port != "" {
		candidates = append(
			candidates,
			"0.0.0.0:"+port,
			"localhost:"+port,
			"127.0.0.1:"+port,
		)
	}
	for _, candidate := range candidates {
		if handler, ok := run.getHandler(candidate); ok {
			return handler, true
		}
	}
	return nil, false
}

func readRequestBody(method string, body io.Reader) ([]byte, error) {
	if body == nil || !methodAllowsBody(method) {
		return nil, nil
	}
	return io.ReadAll(body)
}

func (c *fetchHTTPClient) buildFetchOptions(ctx context.Context, method string, body []byte, contentType string, reqHeaders map[string][]string, reqCtx *requestContext) map[string]any {
	options := map[string]any{
		"method":   method,
		"headers":  c.buildHeaders(contentType, reqHeaders),
		"redirect": redirectMode(c.cfg.FollowRedirects.Enabled),
	}

	if body != nil {
		options["body"] = c.encodeBody(body)
	}
	if signal := c.setupAbortSignal(ctx, reqCtx); signal.Truthy() {
		options["signal"] = signal
	}

	return options
}

func methodAllowsBody(method string) bool {
	switch strings.ToUpper(method) {
	case "GET", "HEAD":
		return false
	default:
		return true
	}
}

func (c *fetchHTTPClient) buildHeaders(contentType string, reqHeaders map[string][]string) js.Value {
	headers := js.Global().Get("Headers").New()

	for k, vals := range reqHeaders {
		if len(vals) == 0 {
			continue
		}
		headers.Call("set", k, vals[0])
		for _, v := range vals[1:] {
			headers.Call("append", k, v)
		}
	}

	if contentType != "" {
		headers.Call("set", "Content-Type", contentType)
	}

	return headers
}

func (c *fetchHTTPClient) encodeBody(body []byte) js.Value {
	bodyBytes := js.Global().Get("Uint8Array").New(len(body))
	js.CopyBytesToJS(bodyBytes, body)
	return bodyBytes
}

func (c *fetchHTTPClient) setupAbortSignal(ctx context.Context, reqCtx *requestContext) js.Value {
	if ctx == nil {
		ctx = context.Background()
	}
	if c.cfg.Timeout <= 0 && ctx.Done() == nil {
		return js.Undefined()
	}

	reqCtx.controller = js.Global().Get("AbortController").New()
	if c.cfg.Timeout > 0 {
		reqCtx.timer = time.AfterFunc(c.cfg.Timeout, func() {
			reqCtx.controller.Call("abort")
		})
	}
	if ctx.Done() != nil {
		reqCtx.cancelDone = make(chan struct{})
		go func() {
			select {
			case <-ctx.Done():
				reqCtx.controller.Call("abort")
			case <-reqCtx.cancelDone:
			}
		}()
	}
	return reqCtx.controller.Get("signal")
}

func (c *fetchHTTPClient) executeRequest(fetch js.Value, url string, options map[string]any) (js.Value, error) {
	return awaitPromise(fetch.Invoke(url, js.ValueOf(options)))
}

func (c *fetchHTTPClient) extractHeaders(resp js.Value) map[string][]string {
	respHeaders := map[string][]string{}
	forEach := js.FuncOf(func(_ js.Value, args []js.Value) any {
		value := args[0].String()
		name := args[1].String()
		respHeaders[name] = append(respHeaders[name], value)
		return nil
	})
	defer forEach.Release()

	resp.Get("headers").Call("forEach", forEach)
	return respHeaders
}

func (c *fetchHTTPClient) extractBody(resp js.Value) ([]byte, error) {
	arrayBuffer, err := awaitPromise(resp.Call("arrayBuffer"))
	if err != nil {
		return nil, err
	}

	uint8Array := js.Global().Get("Uint8Array").New(arrayBuffer)
	respBody := make([]byte, uint8Array.Get("byteLength").Int())
	js.CopyBytesToGo(respBody, uint8Array)

	return respBody, nil
}

func redirectMode(enabled bool) string {
	if enabled {
		return "follow"
	}
	return "manual"
}
