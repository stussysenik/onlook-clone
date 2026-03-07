# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_03_07_000003) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"
  enable_extension "pgcrypto"

  create_table "element_histories", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.jsonb "changes", default: {}, null: false
    t.datetime "created_at", null: false
    t.uuid "element_id", null: false
    t.jsonb "snapshot", default: {}, null: false
    t.string "source", default: "api"
    t.datetime "updated_at", null: false
    t.integer "version", null: false
    t.index ["element_id", "version"], name: "index_element_histories_on_element_id_and_version", unique: true
    t.index ["element_id"], name: "index_element_histories_on_element_id"
  end

  create_table "elements", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "canvas_id", default: "default", null: false
    t.datetime "created_at", null: false
    t.string "element_type", default: "rectangle", null: false
    t.float "height", default: 100.0, null: false
    t.boolean "locked", default: false, null: false
    t.string "name", null: false
    t.float "rotation", default: 0.0, null: false
    t.jsonb "styles", default: {}, null: false
    t.datetime "updated_at", null: false
    t.integer "version", default: 1, null: false
    t.boolean "visible", default: true, null: false
    t.float "width", default: 100.0, null: false
    t.float "x", default: 0.0, null: false
    t.float "y", default: 0.0, null: false
    t.integer "z_index", default: 0, null: false
    t.index ["canvas_id", "z_index"], name: "index_elements_on_canvas_id_and_z_index"
    t.index ["canvas_id"], name: "index_elements_on_canvas_id"
  end
end
