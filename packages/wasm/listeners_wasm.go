package main

import (
	"ballerina/platform/pal"
	"context"
	"net/http"
)

type wasmListenerHandle struct {
	run *runContext
	cfg pal.ServerConfig
}

func (w *wasmListenerHandle) Close() error {
	w.run.unregisterListener(w.cfg)
	return nil
}

func (w *wasmListenerHandle) Shutdown(ctx context.Context) error {
	w.run.unregisterListener(w.cfg)
	return nil
}

func listen(cfg pal.ServerConfig, handler http.Handler) (pal.ServerHandle, error) {
	return activeRun.registerListener(cfg, handler)
}
