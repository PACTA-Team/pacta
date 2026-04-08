package main

import (
	"log"

	"github.com/PACTA-Team/pacta/internal/config"
	"github.com/PACTA-Team/pacta/internal/server"
)

func main() {
	cfg := config.Default()
	log.Printf("PACTA v%s starting...", cfg.Version)
	if err := server.Start(cfg); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
