# Creates the elements table — the core persistence layer for canvas objects.
#
# Design decisions:
# - UUID PK: conflict-free IDs across distributed clients
# - JSONB styles: extensible styling without schema migrations
# - Composite index on (canvas_id, z_index): fast ordered layer queries
class CreateElements < ActiveRecord::Migration[8.0]
  def change
    create_table :elements, id: :uuid do |t|
      t.string  :canvas_id,    null: false, default: "default"
      t.string  :name,         null: false
      t.string  :element_type, null: false, default: "rectangle"

      # Spatial properties
      t.float   :x,            null: false, default: 0
      t.float   :y,            null: false, default: 0
      t.float   :width,        null: false, default: 100
      t.float   :height,       null: false, default: 100
      t.float   :rotation,     null: false, default: 0

      # Layer ordering
      t.integer :z_index,      null: false, default: 0

      # Flexible styling — stored as JSONB for schema-free extensibility
      t.jsonb   :styles,       null: false, default: {}

      # Visibility and interaction flags
      t.boolean :locked,       null: false, default: false
      t.boolean :visible,      null: false, default: true

      # Optimistic concurrency control
      t.integer :version,      null: false, default: 1

      t.timestamps
    end

    add_index :elements, :canvas_id
    add_index :elements, [:canvas_id, :z_index]
  end
end
