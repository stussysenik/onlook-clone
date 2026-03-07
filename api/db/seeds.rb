# Seed the canvas with initial elements for development.
# These match the hardcoded seed data in the Svelte frontend.

puts "Seeding elements..."

Element.find_or_create_by!(name: "Blue Square") do |el|
  el.canvas_id = "default"
  el.element_type = "rectangle"
  el.x = 100
  el.y = 100
  el.width = 150
  el.height = 150
  el.rotation = 0
  el.z_index = 1
  el.styles = { "backgroundColor" => "#4f46e5", "borderRadius" => 8, "opacity" => 1 }
  el.locked = false
  el.visible = true
  el.version = 1
end

Element.find_or_create_by!(name: "Green Rectangle") do |el|
  el.canvas_id = "default"
  el.element_type = "rectangle"
  el.x = 350
  el.y = 200
  el.width = 200
  el.height = 120
  el.rotation = 0
  el.z_index = 2
  el.styles = { "backgroundColor" => "#10b981", "borderRadius" => 4, "opacity" => 1 }
  el.locked = false
  el.visible = true
  el.version = 1
end

Element.find_or_create_by!(name: "Red Circle") do |el|
  el.canvas_id = "default"
  el.element_type = "rectangle"
  el.x = 600
  el.y = 150
  el.width = 120
  el.height = 120
  el.rotation = 0
  el.z_index = 3
  el.styles = { "backgroundColor" => "#ef4444", "borderRadius" => 60, "opacity" => 0.9 }
  el.locked = false
  el.visible = true
  el.version = 1
end

puts "Seeded #{Element.count} elements."
