defmodule RealtimeWeb.BroadcastController do
  use RealtimeWeb, :controller

  def create(conn, %{"topic" => topic, "event" => event, "payload" => payload}) do
    RealtimeWeb.Endpoint.broadcast!(topic, event, payload)
    json(conn, %{status: "ok"})
  end

  def create(conn, _params) do
    conn
    |> put_status(:bad_request)
    |> json(%{error: "Missing required fields: topic, event, payload"})
  end
end
