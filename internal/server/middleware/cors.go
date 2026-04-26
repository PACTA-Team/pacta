package middleware

import (
	"net/http"
	"os"
	"strings"

	"github.com/go-chi/cors"
)

func NewCORS() func(http.Handler) http.Handler {
	origins := []string{
		"http://127.0.0.1:3000",
		"https://app.pacta.local",
	}
	if envOrigins := os.Getenv("ALLOWED_ORIGINS"); envOrigins != "" {
		origins = strings.Split(envOrigins, ",")
		for i := range origins {
			origins[i] = strings.TrimSpace(origins[i])
		}
	}
	c := cors.New(cors.Options{
		AllowedOrigins: origins,
		AllowedMethods: []string{
			http.MethodGet, http.MethodPost, http.MethodPut,
			http.MethodDelete, http.MethodOptions,
		},
		AllowedHeaders: []string{
			"Accept", "Authorization", "Content-Type",
			"X-CSRF-Token", "X-Requested-With",
		},
		AllowCredentials: true,
		MaxAge:           3600,
		ExposedHeaders:   []string{"X-Total-Count", "X-Request-ID"},
	})
	return c.Handler
}
