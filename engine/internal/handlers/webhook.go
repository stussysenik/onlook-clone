package handlers

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/onlook-clone/engine/internal/diff"
	"github.com/onlook-clone/engine/internal/publisher"
)

type WebhookHandler struct {
	pub *publisher.PhoenixPublisher
}

func NewWebhookHandler(pub *publisher.PhoenixPublisher) *WebhookHandler {
	return &WebhookHandler{pub: pub}
}

type EventPayload struct {
	Event   string                 `json:"event"`
	Payload map[string]interface{} `json:"payload"`
}

func (h *WebhookHandler) HandleEvent(w http.ResponseWriter, r *http.Request) {
	var event EventPayload
	if err := json.NewDecoder(r.Body).Decode(&event); err != nil {
		http.Error(w, `{"error":"invalid json"}`, http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	log.Printf("[webhook] Received event: %s", event.Event)

	switch event.Event {
	case "element.created":
		current, _ := event.Payload["current"].(map[string]interface{})
		if current == nil {
			http.Error(w, `{"error":"missing current"}`, http.StatusBadRequest)
			return
		}
		canvasID, _ := current["canvas_id"].(string)
		if canvasID == "" {
			canvasID = "default"
		}
		h.pub.Broadcast("canvas:"+canvasID, "element:created", current)

	case "element.updated":
		previous, _ := event.Payload["previous"].(map[string]interface{})
		current, _ := event.Payload["current"].(map[string]interface{})

		delta := diff.ComputeDelta(previous, current)
		if delta == nil {
			w.Header().Set("Content-Type", "application/json")
			w.Write([]byte(`{"status":"no_changes"}`))
			return
		}

		canvasID, _ := current["canvas_id"].(string)
		if canvasID == "" {
			canvasID = "default"
		}
		h.pub.Broadcast("canvas:"+canvasID, "element:updated", delta)

	case "element.deleted":
		id, _ := event.Payload["id"].(string)
		if id == "" {
			http.Error(w, `{"error":"missing id"}`, http.StatusBadRequest)
			return
		}
		// Try to get canvas_id from payload, default to "default"
		canvasID := "default"
		h.pub.Broadcast("canvas:"+canvasID, "element:deleted", map[string]interface{}{"id": id})

	default:
		log.Printf("[webhook] Unknown event type: %s", event.Event)
		http.Error(w, `{"error":"unknown event"}`, http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"status":"ok"}`))
}
