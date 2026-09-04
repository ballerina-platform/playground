package main

import (
	"ballerina/platform/pal"
	"context"
	"io"
	"net/http"
	"reflect"
	"syscall/js"
	"testing"
)

func newTestRunContext() *runContext {
	return &runContext{listeners: make(map[string]http.Handler)}
}

func registerTestHandler(t *testing.T, ctx *runContext, cfg pal.ServerConfig, handler http.Handler) {
	t.Helper()

	if _, err := ctx.registerListener(cfg, handler); err != nil {
		t.Fatalf("register listener: %v", err)
	}
}

func TestExecuteLocalRequest(t *testing.T) {
	t.Parallel()
	ctx := newTestRunContext()
	cfg := pal.ServerConfig{Host: "0.0.0.0", Port: 9090}
	var received *http.Request
	var receivedBody []byte
	registerTestHandler(t, ctx, cfg, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		received = r
		receivedBody, _ = io.ReadAll(r.Body)
		w.Header().Add("X-Response", "one")
		w.Header().Add("X-Response", "two")
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write([]byte("response body"))
	}))

	client := &fetchHTTPClient{cfg: pal.ClientConfig{ResponseLimits: pal.ResponseLimitConfig{MaxEntityBodySize: -1}}, run: ctx}
	status, headers, body, handled, err := client.executeLocalRequest(
		context.Background(),
		http.MethodPost,
		"http://localhost:9090/resource?name=Jane",
		[]byte("request body"),
		"application/json",
		map[string][]string{
			"Content-Type": {"text/plain"},
			"X-Request":    {"one", "two"},
		},
	)
	if err != nil {
		t.Fatalf("execute local request: %v", err)
	}
	if !handled {
		t.Fatal("expected loopback request to be handled")
	}
	if status != http.StatusCreated {
		t.Errorf("status = %d, want %d", status, http.StatusCreated)
	}
	if got, want := headers["X-Response"], []string{"one", "two"}; !reflect.DeepEqual(got, want) {
		t.Errorf("response headers = %v, want %v", got, want)
	}
	gotBody, err := io.ReadAll(body)
	if err != nil {
		t.Fatalf("read response body: %v", err)
	}
	if got, want := string(gotBody), "response body"; got != want {
		t.Errorf("response body = %q, want %q", got, want)
	}

	if received == nil {
		t.Fatal("handler did not receive a request")
	}
	if got, want := received.Method, http.MethodPost; got != want {
		t.Errorf("method = %q, want %q", got, want)
	}
	if got, want := received.RequestURI, "/resource?name=Jane"; got != want {
		t.Errorf("request URI = %q, want %q", got, want)
	}
	if got, want := received.Host, "localhost:9090"; got != want {
		t.Errorf("host = %q, want %q", got, want)
	}
	if got, want := received.Header.Values("X-Request"), []string{"one", "two"}; !reflect.DeepEqual(got, want) {
		t.Errorf("request headers = %v, want %v", got, want)
	}
	if got, want := received.Header.Get("Content-Type"), "application/json"; got != want {
		t.Errorf("content type = %q, want %q", got, want)
	}
	if got, want := string(receivedBody), "request body"; got != want {
		t.Errorf("request body = %q, want %q", got, want)
	}
}

func TestExecuteLocalRequestResolvesLoopbackAliases(t *testing.T) {
	t.Parallel()
	ctx := newTestRunContext()
	registerTestHandler(t, ctx, pal.ServerConfig{Host: "0.0.0.0", Port: 9090}, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("ipv4"))
	}))
	registerTestHandler(t, ctx, pal.ServerConfig{Host: "::1", Port: 9091}, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("ipv6"))
	}))

	client := &fetchHTTPClient{cfg: pal.ClientConfig{ResponseLimits: pal.ResponseLimitConfig{MaxEntityBodySize: -1}}, run: ctx}
	for _, tc := range []struct {
		url  string
		want string
	}{
		{url: "http://localhost:9090", want: "ipv4"},
		{url: "http://127.0.0.1:9090", want: "ipv4"},
		{url: "http://[::1]:9091", want: "ipv6"},
	} {
		t.Run(tc.url, func(t *testing.T) {
			_, _, body, handled, err := client.executeLocalRequest(context.Background(), http.MethodGet, tc.url, nil, "", nil)
			if err != nil {
				t.Fatalf("execute local request: %v", err)
			}
			if !handled {
				t.Fatal("expected loopback request to be handled")
			}
			got, err := io.ReadAll(body)
			if err != nil {
				t.Fatalf("read response body: %v", err)
			}
			if string(got) != tc.want {
				t.Errorf("response body = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestExecuteLocalRequestFallsBackWhenNotHandled(t *testing.T) {
	t.Parallel()
	client := &fetchHTTPClient{cfg: pal.ClientConfig{ResponseLimits: pal.ResponseLimitConfig{MaxEntityBodySize: -1}}, run: newTestRunContext()}
	for _, tc := range []struct {
		name string
		url  string
	}{
		{name: "unregistered loopback host", url: "http://localhost:9090"},
		{name: "non-loopback host", url: "https://example.com"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			_, _, _, handled, err := client.executeLocalRequest(context.Background(), http.MethodGet, tc.url, nil, "", nil)
			if err != nil {
				t.Fatalf("execute local request: %v", err)
			}
			if handled {
				t.Fatal("expected request to fall back to browser fetch")
			}
		})
	}
}

func TestExecuteLocalRequestRejectsOversizedResponse(t *testing.T) {
	t.Parallel()
	ctx := newTestRunContext()
	registerTestHandler(t, ctx, pal.ServerConfig{Host: "localhost", Port: 9090}, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("too large"))
	}))

	client := &fetchHTTPClient{cfg: pal.ClientConfig{ResponseLimits: pal.ResponseLimitConfig{MaxEntityBodySize: 3}}, run: ctx}
	_, _, _, handled, err := client.executeLocalRequest(context.Background(), http.MethodGet, "http://localhost:9090", nil, "", nil)
	if !handled {
		t.Fatal("expected loopback request to be handled")
	}
	if err == nil {
		t.Fatal("expected oversized response to return an error")
	}
}

func TestHTTPRequestsFromJS(t *testing.T) {
	t.Parallel()
	req, err := httpRequestFromJS(js.ValueOf(map[string]any{
		"method": "post",
		"host":   "localhost:9090",
		"path":   "albums/Kind%20of%20Blue",
		"query":  "?genre=jazz",
		"body":   "request body",
		"headers": map[string]any{
			"X-Request":    []any{"one", "two"},
			"Content-Type": "text/plain",
		},
	}))
	if err != nil {
		t.Fatalf("create HTTP request: %v", err)
	}

	if got, want := req.Method, http.MethodPost; got != want {
		t.Errorf("method = %q, want %q", got, want)
	}
	if got, want := req.URL.Path, "/albums/Kind of Blue"; got != want {
		t.Errorf("path = %q, want %q", got, want)
	}
	if got, want := req.URL.EscapedPath(), "/albums/Kind%20of%20Blue"; got != want {
		t.Errorf("escaped path = %q, want %q", got, want)
	}
	if got, want := req.URL.RawQuery, "genre=jazz"; got != want {
		t.Errorf("query = %q, want %q", got, want)
	}
	if got, want := req.Header.Values("X-Request"), []string{"one", "two"}; !reflect.DeepEqual(got, want) {
		t.Errorf("request headers = %v, want %v", got, want)
	}
	if got, want := req.Header.Get("Content-Type"), "text/plain"; got != want {
		t.Errorf("content type = %q, want %q", got, want)
	}
	body, err := io.ReadAll(req.Body)
	if err != nil {
		t.Fatalf("read request body: %v", err)
	}
	if got, want := string(body), "request body"; got != want {
		t.Errorf("body = %q, want %q", got, want)
	}
}
