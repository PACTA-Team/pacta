package config

import (
	"strings"
	"testing"
)

func TestDefaultConfig_BindsToLocalhost(t *testing.T) {
	cfg := Default()
	if !strings.HasPrefix(cfg.Addr, "127.0.0.1:") && !strings.HasPrefix(cfg.Addr, "[::1]:") {
		t.Fatalf("Expected localhost bind, got %s", cfg.Addr)
	}
}
