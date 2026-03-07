Rails.application.routes.draw do
  namespace :api do
    namespace :v1 do
      resources :elements do
        collection do
          patch :batch_update
        end
      end
    end
  end

  get "up" => "rails/health#show", as: :rails_health_check
end
