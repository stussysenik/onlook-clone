# Element model — a visual object on the canvas.
#
# Uses UUID primary keys for conflict-free distributed ID generation.
# `styles` is stored as JSONB — extensible without schema migrations.
# `version` enables optimistic concurrency control (Phase 6).
class Element < ApplicationRecord
  validates :canvas_id, presence: true
  validates :name, presence: true
  validates :element_type, presence: true
  validates :x, :y, :width, :height, :rotation, numericality: true
  validates :z_index, numericality: { only_integer: true }
  validates :version, numericality: { only_integer: true, greater_than: 0 }

  before_validation :set_defaults, on: :create

  scope :for_canvas, ->(canvas_id) { where(canvas_id: canvas_id).order(:z_index) }

  # Track previous state for diff engine notifications
  attr_accessor :previous_state

  after_update :capture_previous_state
  after_commit :notify_diff_engine, on: [:create, :update, :destroy]

  private

  def set_defaults
    self.canvas_id ||= "default"
    self.element_type ||= "rectangle"
    self.x ||= 0
    self.y ||= 0
    self.width ||= 100
    self.height ||= 100
    self.rotation ||= 0
    self.z_index ||= 0
    self.styles ||= {}
    self.locked ||= false
    self.visible = true if visible.nil?
    self.version ||= 1
    self.name ||= "Element #{z_index}"
  end

  def capture_previous_state
    # Stored by the controller before update
  end

  def notify_diff_engine
    DiffEngineNotifier.notify(self) if DiffEngineNotifier.available?
  rescue => e
    Rails.logger.warn "[DiffEngineNotifier] Failed: #{e.message}"
  end
end
