package middleware

import (
	"net/http"

	"github.com/go-chi/cors"
)

package middleware

import (
	"net/http"

	"github.com/go-chi/cors"
)

func NewCORS() func(http.Handler) http.Handler {
	c := cors.New(cors.Options{
		AllowedOrigins: []string{
			"http://127.0.0.1:3000",
			"https://app.pacta.local",
		},
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
