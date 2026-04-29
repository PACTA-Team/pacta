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

	// Initialize AI encryption key if provided
	if cfg.AIEncryptionKey != "" {
		keyLen := len(cfg.AIEncryptionKey)
		if keyLen != 16 && keyLen != 24 && keyLen != 32 {
			log.Fatalf("AI_ENCRYPTION_KEY must be 16, 24, or 32 bytes (AES key size); got %d bytes", keyLen)
		}
		ai.SetEncryptionKey([]byte(cfg.AIEncryptionKey))
	}

	// Start server (rate limiter created internally with DB)
	if err := server.Start(cfg, staticFS); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
