# API::V1::ElementsController — CRUD for canvas elements.
#
# Svelte frontend calls these endpoints:
# - GET    /api/v1/elements?canvas_id=default  → load all elements
# - POST   /api/v1/elements                    → create new element
# - PATCH  /api/v1/elements/:id                → update after drag/resize
# - DELETE /api/v1/elements/:id                → remove element
# - PATCH  /api/v1/elements/batch_update       → reorder z-indices
module Api
  module V1
    class ElementsController < ApplicationController
      before_action :set_element, only: [:show, :update, :destroy]

      # GET /api/v1/elements?canvas_id=default
      def index
        canvas_id = params[:canvas_id] || "default"
        elements = Element.for_canvas(canvas_id)
        render json: ElementSerializer.serialize_collection(elements)
      end

      # GET /api/v1/elements/:id
      def show
        render json: ElementSerializer.new(@element).as_json
      end

      # POST /api/v1/elements
      def create
        element = Element.new(element_params)
        if element.save
          render json: ElementSerializer.new(element).as_json, status: :created
        else
          render json: { errors: element.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/elements/:id
      def update
        # Capture previous state for the diff engine
        @element.previous_state = ElementSerializer.new(@element).as_json

        if @element.update(element_params)
          render json: ElementSerializer.new(@element).as_json
        else
          render json: { errors: @element.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/elements/:id
      def destroy
        @element.destroy
        head :no_content
      end

      # PATCH /api/v1/elements/batch_update
      # Body: { elements: [{ id: "...", z_index: 1 }, ...] }
      def batch_update
        updates = params.require(:elements)
        updated_elements = []

        ActiveRecord::Base.transaction do
          updates.each do |update_params|
            element = Element.find(update_params[:id])
            element.previous_state = ElementSerializer.new(element).as_json
            element.update!(update_params.permit(:z_index, :x, :y, :width, :height, :rotation, :name, :locked, :visible, styles: {}))
            updated_elements << element
          end
        end

        render json: ElementSerializer.serialize_collection(updated_elements)
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: [e.message] }, status: :unprocessable_entity
      end

      private

      def set_element
        @element = Element.find(params[:id])
      end

      def element_params
        params.require(:element).permit(
          :canvas_id, :name, :element_type,
          :x, :y, :width, :height, :rotation,
          :z_index, :locked, :visible, :version,
          styles: [:backgroundColor, :borderRadius, :opacity, :borderWidth, :borderColor]
        )
      end
    end
  end
end
