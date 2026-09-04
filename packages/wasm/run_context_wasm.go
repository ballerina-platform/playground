package main

import (
	"ballerina/platform/pal"
	"ballerina/runtime"
	"fmt"
	"net"
	"net/http"
	"sort"
	"sync"
)

var activeRun = &runContext{}

type runContext struct {
	mu sync.RWMutex

	rt        *runtime.Runtime
	signals   *signalSource
	listeners map[string]http.Handler
	started   bool
}

func (c *runContext) begin(signals *signalSource) bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.signals != nil || c.rt != nil {
		return false
	}
	c.signals = signals
	c.listeners = make(map[string]http.Handler)
	c.started = false
	return true
}

func (c *runContext) end(signals *signalSource) {
	c.mu.Lock()
	if c.signals == signals {
		c.rt = nil
		c.signals = nil
		c.listeners = nil
		c.started = false
	}
	c.mu.Unlock()
	signals.cleanup()
}

func (c *runContext) setRuntime(signals *signalSource, rt *runtime.Runtime) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.signals == signals {
		c.rt = rt
	}
}

func (c *runContext) ensureStarted() bool {
	c.mu.Lock()
	if c.rt == nil {
		c.mu.Unlock()
		return false
	}
	if c.started {
		c.mu.Unlock()
		return true
	}
	rt := c.rt
	c.started = true
	c.mu.Unlock()

	rt.Listen()
	return true
}

func (c *runContext) isStarted() bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.started
}

func (c *runContext) sendSignal(sig pal.Signal) bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	if c.signals == nil {
		return false
	}
	return c.signals.send(sig)
}

func (c *runContext) registerListener(cfg pal.ServerConfig, handler http.Handler) (pal.ServerHandle, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.listeners == nil {
		return nil, fmt.Errorf("no active Ballerina run")
	}
	host := listenerHost(cfg)
	if _, exists := c.listeners[host]; exists {
		return nil, fmt.Errorf("listener already registered for host %s", host)
	}
	c.listeners[host] = handler
	return &wasmListenerHandle{run: c, cfg: cfg}, nil
}

func (c *runContext) unregisterListener(cfg pal.ServerConfig) {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.listeners, listenerHost(cfg))
}

func (c *runContext) getHandler(host string) (http.Handler, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	handler, ok := c.listeners[host]
	return handler, ok
}

func (c *runContext) hosts() []any {
	c.mu.RLock()
	defer c.mu.RUnlock()

	listenerHosts := make([]string, 0, len(c.listeners))
	for host := range c.listeners {
		listenerHosts = append(listenerHosts, host)
	}
	sort.Strings(listenerHosts)

	hosts := make([]any, len(listenerHosts))
	for i, host := range listenerHosts {
		hosts[i] = host
	}
	return hosts
}

func listenerHost(cfg pal.ServerConfig) string {
	return net.JoinHostPort(cfg.Host, fmt.Sprintf("%d", cfg.Port))
}
