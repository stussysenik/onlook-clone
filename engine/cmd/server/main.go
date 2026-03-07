package main

import (
	"log"
	"net/http"
	"os"

	"github.com/onlook-clone/engine/internal/handlers"
	"github.com/onlook-clone/engine/internal/publisher"
	"github.com/rs/cors"
)

func main() {
	phoenixURL := os.Getenv("PHOENIX_URL")
	if phoenixURL == "" {
		phoenixURL = "http://localhost:4000"
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	pub := publisher.New(phoenixURL)
	handler := handlers.NewWebhookHandler(pub)

	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/v1/events", handler.HandleEvent)
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok","service":"engine"}`))
	})

	c := cors.New(cors.Options{
		AllowedOrigins: []string{"http://localhost:3000", "http://localhost:4000", "http://localhost:5173"},
		AllowedMethods: []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders: []string{"Content-Type", "Accept"},
	})

	log.Printf("[engine] Starting diff engine on :%s", port)
	log.Printf("[engine] Phoenix URL: %s", phoenixURL)

	if err := http.ListenAndServe(":"+port, c.Handler(mux)); err != nil {
		log.Fatalf("[engine] Server failed: %v", err)
	}
}
