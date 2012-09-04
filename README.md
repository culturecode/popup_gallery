popup_gallery
=============

A Canvas powered Javascript image gallery

Installation
------------

### In Gemfile
```ruby
gem 'popup_gallery'
group :assets do
  gem 'jquery-ui-rails'
end
```

### In application.js
```javascript
//= require popup_gallery
```

### In application.css
```javascript
//= require popup_gallery
```

Usage
-----

```html
<a href='large_image1.jpg' class='myimagelinkclass'><img src='small_image1.jpg' /></a>
<a href='large_image2.jpg' class='myimagelinkclass'><img src='small_image2.jpg' /></a>
```

```javascript
new PopupGallery('.myimagelinkclass')
```

Events
------

* PopupGallery:shown
* PopupGallery:hidden

$(document).bind('PopupGallery:shown', function(){ alert('shown!') })
$(document).bind('PopupGallery:hidden', function(){ alert('hidden!') })