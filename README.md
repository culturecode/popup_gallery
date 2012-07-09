popup_gallery
=============

A Canvas powered Javascript image gallery

installation
------------

### In Gemfile
gem 'popup_gallery'
group :assets do
  gem 'jquery-ui-rails'
end

### In application.js
//= require popup_gallery

### In application.css
//= require popup_gallery

usage
-----

<a href='large_image1.jpg' class='myimagelinkclass'><img src='small_image1.jpg' /></a>
<a href='large_image2.jpg' class='myimagelinkclass'><img src='small_image2.jpg' /></a>

new PopupGallery('.myimagelinkclass')