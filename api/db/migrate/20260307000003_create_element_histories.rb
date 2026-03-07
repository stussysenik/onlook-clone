# Element history — changelog of all mutations for audit and undo.
#
# Each record captures:
# - `changes`: the delta (what fields changed, from→to)
# - `snapshot`: full element state at that version
# - `source`: who/what triggered the change (user, api, system)
class CreateElementHistories < ActiveRecord::Migration[8.0]
  def change
    create_table :element_histories, id: :uuid do |t|
      t.uuid    :element_id, null: false
      t.integer :version,    null: false
      t.jsonb   :changes,    null: false, default: {}
      t.jsonb   :snapshot,   null: false, default: {}
      t.string  :source,     default: "api"

      t.timestamps
    end

    add_index :element_histories, :element_id
    add_index :element_histories, [:element_id, :version], unique: true
  end
end
