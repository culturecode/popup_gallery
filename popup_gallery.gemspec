$:.push File.expand_path("../lib", __FILE__)

# Maintain your gem's version:
require "popup_gallery/version"

# Describe your gem and declare its dependencies:
Gem::Specification.new do |s|
  s.name        = "popup_gallery"
  s.version     = PopupGallery::VERSION
  s.authors     = ["Ryan Wallace", "Nicholas Jakobsen"]
  s.email       = ["contact@culturecode.ca"]
  s.summary     = "jquery + canvas image zoomer"
  s.description = "jquery + canvas image zoomer"

  s.files = Dir["{app,config,db,lib}/**/*"] + ["Rakefile", "README.md"]
  s.test_files = Dir["test/**/*"]

  s.add_dependency "rails", [">= 3.1"]
  s.add_dependency "jquery-rails"
  s.add_dependency "jquery-ui-rails"
end
