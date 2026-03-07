defmodule RealtimeWeb.Endpoint do
  use Phoenix.Endpoint, otp_app: :realtime

  socket "/socket", RealtimeWeb.UserSocket,
    websocket: [check_origin: false],
    longpoll: false

  plug Plug.RequestId
  plug Plug.Telemetry, event_prefix: [:phoenix, :endpoint]

  plug Plug.Parsers,
    parsers: [:json],
    pass: ["application/json"],
    json_decoder: Phoenix.json_library()

  plug CORSPlug, origin: ["http://localhost:5173", "http://localhost:8080", "http://localhost:3000"]
  plug RealtimeWeb.Router
end
