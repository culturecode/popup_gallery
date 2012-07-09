//= require jquery.ui.slider
//= require jquery.mousewheel

// TODO: Adjust max zoom to be 5x the size of the largest image (once the size is actually known)
// TODO: Don't hardcode image dimension hints

function PopupGallery(gallerySelector){
    var options = {
        fps: 24 // Rate at which to perform redraw at if they are necessary
    }    
    var maxZoomDelta    = 0.1      // How quickly the zoom can change
    var minZoom         = 0.75     // How far can we zoom out proportional to the viewport
    var maxZoom         = 5        // How far can we zoom in proportional to the viewport
    var imageScale      = null     // How much larger or smaller the actual image is compared to the viewport

    var images          = []        // Image metadata
    var currentIndex    = null      // The index of the current image
    var currentZoom     = null      // The current zoom Level of the image
    var lastDelta       = 1         // The last amount the wheel moved
    var visible         = false     // Whether or not the gallery is showing
    var _redrawRequired = false     // Keep track of when we need to redraw the screen
    var _dragging       = false     // Is the user currently dragging the canvas?
    var _queuedImageHref;           // The image we're going to show when it's loaded
    var _imageXOrigin               // X Coordinates of the image on the canvas
    var _imageYOrigin               // Y Coordinates of the image on the canvas
    var _renderInterval             // Interval for the main render loop
    var _lastX, _lastY;             // Last x and y position of the mouse during a drag

    // Init Elements

    var overlay          = $('<div class="pg_overlay" style="height: 100%; width: 100%; position:fixed; z-index: 1000000; top:0; left:0; display:none" />');
    var headerContainer  = $('<div class="pg_header_container" style="width: 100%; position: absolute; top: 0" />');
    var header           = $('<div class="pg_header" />');
    var headerRight      = $('<div class="pg_header_right" />');    
    var title            = $('<span class="pg_title" />');
    var headerShadow     = $('<div class="pg_header_shadow" />');
    var exitButton       = $('<span class="pg_exit_button" />');
    var zoomReadout      = $('<span class="pg_zoom_readout" />');
    var zoomRange        = $('<div class="pg_zoom_range" />');
    var viewWindow       = $('<div class="pg_view_window" style="height: 100%; width: 100%; overflow: hidden" />');
    var carousel         = $('<div class="pg_carousel" />');
    var carouselImages   = $('<div class="pg_carousel_images" />');
    var copyright        = $('<div class="pg_copyright" />');
    var loadingIndicator = $('<div class="pg_loading_indicator" style="display:none">Loading...</div>');
    var canvas           = $('<canvas class="pg_canvas" />')[0];

    // INIT CANVAS
    // If we're using the excanvas plugin, we need to init the context like so
    if (!canvas.getContext && window.G_vmlCanvasManager){
        G_vmlCanvasManager.initElement(canvas);
    } 
    var ctx = canvas.getContext('2d');

    // Append elements

    overlay.append(headerContainer);
    headerContainer.append(header);
    header.append(title);
    header.append(headerRight);
    headerRight.append(zoomReadout);
    headerRight.append(zoomRange);
    headerRight.append(exitButton);
    headerContainer.append(headerShadow);
    headerContainer.append(carousel);
    carousel.append(carouselImages);
    overlay.append(viewWindow);
    overlay.append(copyright);
    overlay.append(loadingIndicator);
    viewWindow.append(canvas)        
    $(document.body).append(overlay);

    // Init the images
    $(gallerySelector).each(function(index, trigger){
        trigger = $(trigger);
        var metadata = {
            trigger:   trigger,
            title:     trigger.data('title') || trigger.attr('title'),
            copyright: trigger.data('copyright'),
            sources:   [{width: 800, height:600, href: trigger.data('preview') || trigger.attr('href')}, {width: 1600, height: 1200, href: trigger.data('full') || trigger.attr('href')}],
            thumbnail: $('<img class="thumbnail" />').attr('src', trigger.data('thumbnail') || trigger.find('img').attr('src'))
        }
        images.push(metadata);
        carouselImages.append(metadata.thumbnail);

        var imageClicked = function(event){showImage(index); event.preventDefault()};
        trigger.click(imageClicked)
        metadata.thumbnail.click(imageClicked)
    });
    
    // If we have more than one image, show the carousel
    if (images.length > 1){
        carousel.show();
    } else {
        carousel.hide();
    }

    // Init the zoom handle
    zoomRange.slider({min: minZoom, max: maxZoom, step: 0.1, slide: function(event, ui){ setZoom(ui.value)}});

    // OBSERVERS
    
    // Close everything if the user clicks the exit button
    exitButton.click(_hideOverlay);

    // Close the overlay if the user presses ESC
    $(window).keyup(function(event){
        if (event.keyCode == 27 && visible){
            _hideOverlay();                    
        }
    });

    // Drag events on canvas
    $(canvas).mousedown(_startCanvasDragHandler);
    $(canvas).mousemove(_dragCanvasHandler);
    $(canvas).mouseup(_endCanvasDragHandler); // Observe the window for mouse up so we don't missed the event when the user drags the canvas past the 
        
    // Zoom in when double clicked
    $(canvas).dblclick(function(event){
        var mouse = _normalizedMousePosition(event);
        setZoom(currentZoom * 1.5, mouse.x, mouse.y);
    });

    // Use Bind instead of helper method to the mousewheel event in case the jquery mousewheel library is not available
    overlay.bind('mousewheel', _mouseWheelHandler);

    // We should resize the canvas if the browser window is resized
    $(window).resize(function(){
        if (visible){
            _resizeCanvasToFit();
            _redraw();                
        }
    });


    // FUNCTIONS

    // Teardown the gallery
    function remove(){
        // Unbind observers on triggers
        $(images).each(function(){
            this.trigger.unbind('click')
        })

        _hideOverlay();
        overlay.remove();
    }

    // Sets the zoom level of the current image
    // centerX and centerY are with respect to the topleft of the viewport
    function setZoom(zoomLevel, centerX, centerY){

        // Don't zoom if the current image isn't loaded;
        if (!currentImage.complete){
            return;
        }
        
        // If no origin is give, just in into the center of the canvas
        if (!centerX || !centerY){
            centerX = canvas.width / 2 ;
            centerY = canvas.height / 2 ;
        }
        
        // Bound the Zoom
        if (zoomLevel < minZoom){
            zoomLevel = minZoom;
        } else if (maxZoom < zoomLevel){
            zoomLevel = maxZoom;
        }

        var scaleFactor = zoomLevel / currentZoom

        currentWidth = currentWidth * scaleFactor;
        currentHeight = currentHeight * scaleFactor;
        currentZoom = zoomLevel;

        // Vector from topleft of viewport to center - Vector from topleft of image to mouse * (1 + wheel)
        _imageXOrigin = (centerX - (centerX - _imageXOrigin) * scaleFactor)
        _imageYOrigin = (centerY - (centerY - _imageYOrigin) * scaleFactor)

        _redraw();

        // Check if we should get a better image size based on the size of the image we're displaying
        // If there is a better size and it's not the one we're loading, load it and when it's ready,
        // Or, if we're showing the best image, but another one is queued, override that and show the best image.
        // set the image to it.
        var bestImageHref = _getBestSrcForCurrentImage();
        if ((bestImageHref != currentImage.src && _queuedImageHref != bestImageHref) || (bestImageHref == currentImage.src && _queuedImageHref != currentImage.src)){
            _queuedImageHref = bestImageHref;
            _setCurrentImageWhenLoaded(bestImageHref);
        }

        _updateZoomHandle()
    }

    // Shows the image at index
    function showImage(index){
        if (images[index]){
            _showOverlay();
            _showImageAt(index);
        }
    }

    // PRIVATE

    // Displays the image at the given index
    function _showImageAt(index){
        if (currentIndex == index){
            return;
        }
        
        _showLoadingIndicator();

        // IE FIX
        // For some reason there's a div with no height or width, and absolute positioning below
        // We need to remove those styles
        $(canvas).find('div').css({height:'', width:'', position:''});

        if (currentIndex !== null){
            _hideCurrentImage();
        }
        currentIndex = index;

        currentImage = new Image();
        
        // When the image is done loading, do this
        currentImage.onload = function(){
            // Disable the onload otherwise successive changes to the image when zooming will trigger the onload
            currentImage.onload = null;
            
            // Check if we actually got an image
            if (currentImage.height == 0){
                alert('Error loading image')
                return;
            }

            // Reset the normalized mouse wheel delta so we don't retain 'momentum' from the previous image
            lastDelta = 0
            
            // Zoom the image to fit the canvas
            imageScale = _getImageScaleToFit(currentImage);
            currentWidth = currentImage.width * imageScale;
            currentHeight = currentImage.height * imageScale;
            // Place the image in the center of the canvas
            _imageXOrigin = (canvas.width - currentWidth)/2;
            _imageYOrigin = (canvas.height - currentHeight)/2;
            
            // Draw it
            currentZoom = 1
            _updateZoomHandle()
            _redraw();
            _hideLoadingIndicator();
        };
                
        // Assign the src after we add the onload listener to avoid any race condition issue
        // Use the smallest image possible so we can show something right away
        _setSmallestSrcForCurrentImage();

        // Update the Header Text
        title.html(images[index].title);

        // Update the Copyright Text
        copyright.html(images[index].copyright);

        // Since the header might have changed size, resize the canvas
        _resizeCanvasToFit();

        // Highlight the selected thumbnail
        images[index].thumbnail.addClass('selected');
        
        // _updateWindowLocation();
    }

    function _updateZoomHandle(){
        var percent = ((currentZoom - minZoom) / (maxZoom - minZoom) * 100).toFixed(0);        
        zoomReadout.html('Zoom ' + percent + '%');
        zoomRange.slider({value: currentZoom});        
    }


    // Hides the image currently displayed
    function _hideCurrentImage(){
        if (currentIndex !== null){
            images[currentIndex].thumbnail.removeClass('selected');
            currentIndex = null;
        }
    }

    // Finds the smallest image in the set
    function _setSmallestSrcForCurrentImage(){
        var sortedImageData = images[currentIndex].sources.sort(function(a,b){
            return a.width * a.height - b.width * b.height;
        });

        currentImage.src = sortedImageData[0].href;
    }

    // Finds the closest resolution image to the current image zoom
    function _getBestSrcForCurrentImage(){
        var sortedImageData = images[currentIndex].sources.sort(function(a,b){
            return Math.abs(currentWidth * currentHeight - a.width * a.height) - Math.abs(currentWidth * currentHeight - b.width * b.height);
        });

        return sortedImageData[0].href;
    }

    // Loads the image specified by href, and if when it is loaded it is still the best match for the desired image size, use it
    function _setCurrentImageWhenLoaded(href){

        _showLoadingIndicator();        
        var image = new Image()
        image.onload = function(){
            image.onload = null;
            _hideLoadingIndicator();
            if (_getBestSrcForCurrentImage() == href){
                currentImage = image;
                _redraw();
            }
        }
        image.src = href
    }

    function _showLoadingIndicator(){
        loadingIndicator.fadeIn();
    }

    function _hideLoadingIndicator(){
        loadingIndicator.stop(true).fadeOut();
    }

    // Shows the overlay
    function _showOverlay(index){
        if (!visible){
            overlay.fadeIn(200)
            
            visible = true;
            
            // Start the main render loop
            _renderInterval = setInterval(_renderCanvas, 1000/options.fps);
        }
    }

    // Hides the overlay
    function _hideOverlay(){
        // Stop the main render loop
        clearInterval(_renderInterval);
        
        // Hide the window
        overlay.fadeOut(170);
        visible = false;
        //_updateWindowLocation();
    }

    // CANVAS FUNCTIONS
    // Makes the canvas fit the view window
    function _resizeCanvasToFit(){
       canvas.height = viewWindow.height();
       canvas.width = viewWindow.width();
    }

    // Returns the value to scale the image by to make it fit the canvas
    function _getImageScaleToFit(image){
        return Math.min(canvas.height/image.height, canvas.width/image.width);
    }


    // Handles the beginning of a drag
    function _startCanvasDragHandler(){
        if (visible){
            _dragging = true;        
        }
    }

    // Hanldes the drag itself
    function _dragCanvasHandler(event){
        if (_dragging){
            // Get the mouse position.
            var mouse = _normalizedMousePosition(event);
        
            // If we have a delta, move the image that much
            if (_lastX && _lastY){

                _imageXOrigin += mouse.x - _lastX;
                _imageYOrigin += mouse.y - _lastY;

                // Ensure that at least some part of the image will be touching the center of the canvas so the user can't 'lose' the image when dragging
                var leftEdge = _imageXOrigin + mouse.x - _lastX;
                var rightEdge = _imageXOrigin + mouse.x - _lastX + currentWidth;
                var topEdge = _imageYOrigin + mouse.y - _lastY
                var bottomEdge = _imageYOrigin + mouse.y - _lastY + currentHeight;
                var canvasCenterX = canvas.width / 2;
                var canvasCenterY = canvas.height / 2;

                if (leftEdge > canvasCenterX){
                    _imageXOrigin = canvasCenterX;
                } else if (rightEdge < canvasCenterX){
                    _imageXOrigin = canvasCenterX - currentWidth;
                }

                if (topEdge > canvasCenterY){
                    _imageYOrigin = canvasCenterY;
                } else if (bottomEdge < canvasCenterY){
                    _imageYOrigin = canvasCenterY - currentHeight;
                }

                // Draw it
                _redraw();
            }

            // Remember where the mouse was so when it moves we can tell how much
            _lastX = mouse.x;
            _lastY = mouse.y;
        }
    }

    // Handles the end of a drag
    function _endCanvasDragHandler(){
        if (visible){        
            _dragging = false;
            _lastX = null;
            _lastY = null;
        }
    }

    function _mouseWheelHandler(event, delta, deltaX, deltaY){
        if (visible){                    
            var mousex = event.clientX - canvas.offsetLeft;
            var mousey = event.clientY - canvas.offsetTop;

            if (delta > maxZoomDelta){
                delta = maxZoomDelta;
            } else if (delta < -maxZoomDelta){
                delta = -maxZoomDelta;
            }
            lastDelta = ((lastDelta || 0) * .5 + delta * .5)
            setZoom((currentZoom * 1 + lastDelta * (currentZoom / maxZoom * 2)), mousex, mousey)

            return false;
        }
    }

    // Redraws the contents of the canvas
    function _renderCanvas(){
        if (_redrawRequired){
            _redrawRequired = false;
            // Scale the image and place it at the current position
            _clearCanvas();            
            ctx.drawImage(currentImage, _imageXOrigin, _imageYOrigin, currentWidth, currentHeight);
        }
    }

    // Tells the main renderer that a redraw is required
    function _redraw(){
        _redrawRequired = true;
    }

    // Clears the rectangle that the image occupies
    function _clearImage() {
        ctx.clearRect(_imageXOrigin - 1, _imageYOrigin - 1, currentWidth + 2, currentHeight + 2);
    }

    // Clears the entire canvas
    function _clearCanvas() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    // Normalizes crossbrowser differences in mouse position, returns mouse position relative to top left of screen
    function _normalizedMousePosition(event){
        // Some browsers have pageXOffset, some have scrollLeft
        return {x:event.screenX, y:event.screenY}
        return {x:event.pointerX() - (window.pageXOffset || document.body.scrollLeft), y:event.pointerY() - (window.pageYOffset || document.body.scrollTop)};
    }

    // // Updates the window location with the current state.
    // // Currently this is used to make the back button close the popup gallery.
    // // If it was already visible, update without affecting history
    // // Else if it was just made visible for the first time, update and add to history
    // // Else it's not visible, remove the pg var from the hash, and overwrite its history entry
    // _updateWindowLocation: function(){
    //     if (visible && Helpers.hash.getState('pgi')){
    //         Helpers.hash.setStates({'pg':PopupGalleries.currentGallery, 'pgi':currentIndex}, false);
    //     } else if (visible) {
    //         Helpers.hash.setStates({'pg':PopupGalleries.currentGallery, 'pgi':currentIndex}, true);
    //     } else if (Helpers.hash.getState('pgi')){
    //         Helpers.hash.deleteStates(['pg', 'pgi'], false);
    //     }
    // },

    // Return the public interface
    return { remove:remove, setZoom:setZoom, showImage:showImage }
};