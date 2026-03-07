FROM elixir:1.17-alpine AS builder
WORKDIR /app

RUN mix local.hex --force && mix local.rebar --force

ENV MIX_ENV=prod

COPY mix.exs ./
RUN mix deps.get --only prod && mix deps.compile

COPY config config
COPY lib lib

RUN mix compile && mix release

FROM alpine:3.20
RUN apk --no-cache add libstdc++ openssl ncurses-libs
WORKDIR /app

COPY --from=builder /app/_build/prod/rel/realtime ./

EXPOSE 4000
CMD ["bin/realtime", "start"]
