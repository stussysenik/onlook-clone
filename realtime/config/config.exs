import Config

config :realtime, RealtimeWeb.Endpoint,
  url: [host: "localhost"],
  adapter: Bandit.PhoenixAdapter,
  render_errors: [formats: [json: RealtimeWeb.ErrorJSON]],
  pubsub_server: Realtime.PubSub,
  live_view: [signing_salt: "visual_editor"],
  secret_key_base: "dev-only-secret-key-base-that-is-at-least-64-bytes-long-for-development"

config :realtime,
  generators: [timestamp_type: :utc_datetime]

config :logger, :console,
  format: "$time $metadata[$level] $message\n",
  metadata: [:request_id]

config :phoenix, :json_library, Jason
