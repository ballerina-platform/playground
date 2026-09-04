package main

import (
	"ballerina/platform/pal"
	"context"
	"net/http"
	"net/http/httptest"
	"reflect"
	"testing"
)

func TestRunContextListenerLifecycle(t *testing.T) {
	t.Parallel()
	ctx := newTestRunContext()
	cfg := pal.ServerConfig{Host: "localhost", Port: 9090}
	firstHandler := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("first handler"))
	})
	secondHandler := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("second handler"))
	})

	handle, err := ctx.registerListener(cfg, firstHandler)
	if err != nil {
		t.Fatalf("register listener: %v", err)
	}
	if _, err := ctx.registerListener(cfg, secondHandler); err == nil {
		t.Fatal("expected duplicate listener registration to fail")
	}
	registeredHandler, ok := ctx.getHandler("localhost:9090")
	if !ok {
		t.Fatal("registered listener was not returned")
	}
	recorder := httptest.NewRecorder()
	registeredHandler.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/", nil))
	if got, want := recorder.Body.String(), "first handler"; got != want {
		t.Errorf("registered handler response = %q, want %q", got, want)
	}

	if err := handle.Close(); err != nil {
		t.Fatalf("close listener: %v", err)
	}
	if _, ok := ctx.getHandler("localhost:9090"); ok {
		t.Error("closed listener is still registered")
	}

	handle, err = ctx.registerListener(cfg, firstHandler)
	if err != nil {
		t.Fatalf("register listener again: %v", err)
	}
	if err := handle.Shutdown(context.Background()); err != nil {
		t.Fatalf("shutdown listener: %v", err)
	}
	if _, ok := ctx.getHandler("localhost:9090"); ok {
		t.Error("shutdown listener is still registered")
	}
}

func TestRunContextHostsAreSorted(t *testing.T) {
	t.Parallel()
	ctx := newTestRunContext()
	for _, cfg := range []pal.ServerConfig{
		{Host: "localhost", Port: 9091},
		{Host: "localhost", Port: 9090},
		{Host: "127.0.0.1", Port: 9090},
	} {
		registerTestHandler(t, ctx, cfg, http.NotFoundHandler())
	}

	want := []any{"127.0.0.1:9090", "localhost:9090", "localhost:9091"}
	if got := ctx.hosts(); !reflect.DeepEqual(got, want) {
		t.Errorf("hosts = %v, want %v", got, want)
	}
}

func TestListenerHostFormatsIPv6(t *testing.T) {
	t.Parallel()
	cfg := pal.ServerConfig{Host: "::1", Port: 9090}
	if got, want := listenerHost(cfg), "[::1]:9090"; got != want {
		t.Errorf("listener host = %q, want %q", got, want)
	}
}
