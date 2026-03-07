package publisher

import (
	"bytes"
	"encoding/json"
	"log"
	"net/http"
	"time"
)

type PhoenixPublisher struct {
	baseURL string
	client  *http.Client
}

func New(baseURL string) *PhoenixPublisher {
	return &PhoenixPublisher{
		baseURL: baseURL,
		client: &http.Client{
			Timeout: 5 * time.Second,
		},
	}
}

type BroadcastMessage struct {
	Topic   string      `json:"topic"`
	Event   string      `json:"event"`
	Payload interface{} `json:"payload"`
}

func (p *PhoenixPublisher) Broadcast(topic, event string, payload interface{}) {
	msg := BroadcastMessage{
		Topic:   topic,
		Event:   event,
		Payload: payload,
	}

	body, err := json.Marshal(msg)
	if err != nil {
		log.Printf("[publisher] Failed to marshal: %v", err)
		return
	}

	url := p.baseURL + "/api/broadcast"
	resp, err := p.client.Post(url, "application/json", bytes.NewReader(body))
	if err != nil {
		log.Printf("[publisher] Failed to POST to Phoenix: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		log.Printf("[publisher] Phoenix returned %d", resp.StatusCode)
	}
}
