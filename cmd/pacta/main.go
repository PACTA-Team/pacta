package main

import (
	"log"

	"github.com/PACTA-Team/pacta/internal/ai"
	"github.com/PACTA-Team/pacta/internal/config"
	"github.com/PACTA-Team/pacta/internal/server"
)

func main() {
	cfg := config.Default()
	log.Printf("PACTA v%s starting...", cfg.Version)

	// Initialize AI encryption key if configured
	if cfg.AIEncryptionKey != "" {
		ai.SetEncryptionKey([]byte(cfg.AIEncryptionKey))
	}

	if err := server.Start(cfg, staticFS); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
