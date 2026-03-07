# Simple serializer — converts Element AR objects to JSON hashes.
# Keeps the API response shape consistent and explicit.
class ElementSerializer
  def initialize(element)
    @element = element
  end

  def as_json(_options = {})
    {
      id: @element.id,
      canvas_id: @element.canvas_id,
      name: @element.name,
      element_type: @element.element_type,
      x: @element.x,
      y: @element.y,
      width: @element.width,
      height: @element.height,
      rotation: @element.rotation,
      z_index: @element.z_index,
      styles: @element.styles,
      locked: @element.locked,
      visible: @element.visible,
      version: @element.version,
      created_at: @element.created_at,
      updated_at: @element.updated_at
    }
  end

  # Convenience for serializing collections
  def self.serialize_collection(elements)
    elements.map { |el| new(el).as_json }
  end
end
