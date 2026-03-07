require "net/http"

# DiffEngineNotifier — sends element state changes to the Go diff engine.
#
# After every element mutation, Rails sends {previous, current} state
# to Go, which computes field-level deltas and pushes them to Phoenix.
#
# This is a fire-and-forget HTTP POST — if Go is down, we log and move on.
# The primary write (PostgreSQL) has already succeeded at this point.
class DiffEngineNotifier
  DIFF_ENGINE_URL = ENV.fetch("DIFF_ENGINE_URL", "http://localhost:8080")

  def self.available?
    true # Always attempt; failures are caught and logged
  end

  def self.notify(element)
    case element_event_type(element)
    when :created
      post_event("element.created", {
        current: serialize(element)
      })
    when :updated
      post_event("element.updated", {
        previous: element.previous_state,
        current: serialize(element)
      })
    when :destroyed
      post_event("element.deleted", {
        id: element.id
      })
    end
  end

  private

  def self.element_event_type(element)
    if element.destroyed?
      :destroyed
    elsif element.previously_new_record?
      :created
    else
      :updated
    end
  end

  def self.serialize(element)
    ElementSerializer.new(element).as_json
  end

  def self.post_event(event_type, payload)
    uri = URI("#{DIFF_ENGINE_URL}/api/v1/events")
    http = Net::HTTP.new(uri.host, uri.port)
    http.open_timeout = 2
    http.read_timeout = 5

    request = Net::HTTP::Post.new(uri)
    request["Content-Type"] = "application/json"
    request.body = { event: event_type, payload: payload }.to_json

    http.request(request)
  rescue Errno::ECONNREFUSED, Net::OpenTimeout, Net::ReadTimeout => e
    Rails.logger.info "[DiffEngineNotifier] Go engine unavailable: #{e.message}"
  end
end
