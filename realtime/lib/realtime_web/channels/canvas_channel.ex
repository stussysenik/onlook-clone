defmodule RealtimeWeb.CanvasChannel do
  use RealtimeWeb, :channel

  @impl true
  def join("canvas:" <> _canvas_id, _payload, socket) do
    {:ok, socket}
  end

  @impl true
  def handle_in("element:updated", payload, socket) do
    broadcast_from!(socket, "element:updated", payload)
    {:noreply, socket}
  end

  @impl true
  def handle_in("element:created", payload, socket) do
    broadcast_from!(socket, "element:created", payload)
    {:noreply, socket}
  end

  @impl true
  def handle_in("element:deleted", payload, socket) do
    broadcast_from!(socket, "element:deleted", payload)
    {:noreply, socket}
  end

  @impl true
  def handle_in("element:batch_updated", payload, socket) do
    broadcast_from!(socket, "element:batch_updated", payload)
    {:noreply, socket}
  end
end
