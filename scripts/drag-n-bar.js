var H5P = H5P || {};

/**
 * Constructor. Initializes the drag and drop menu bar.
 * 
 * @param {Array} buttons
 * @param {jQuery} $container
 * @returns {undefined}
 */
H5P.DragNBar = function (buttons, $container) {
  var that = this;
  
  this.buttons = buttons;
  this.$container = $container;
  this.dnd = new H5P.DragNDrop($container);
  
  this.dnd.startMovingCallback = function (event) {
    that.dnd.adjust.x = 10;
    that.dnd.adjust.y = 10;
    
    return true;
  };
  
  this.dnd.stopMovingCallback = function (event) {
    that.stopMoving(event);
  };
};

/**
 * Attaches the menu bar to the given wrapper.
 * 
 * @param {jQuery} $wrapper
 * @returns {undefined}
 */
H5P.DragNBar.prototype.attach = function ($wrapper) {
  var that = this;
  $wrapper.html('');
  
  var $list = H5P.jQuery('<ul class="h5p-dragnbar-ul"></ul>').appendTo($wrapper);
    
  for (var i = 0; i < this.buttons.length; i++) {
    var button = this.buttons[i];
    H5P.jQuery('<li class="h5p-dragnbar-li"><a href="#" title="' + button.title + '" class="h5p-dragnbar-a h5p-dragnbar-' + button.id + '-button"></a></li>').appendTo($list).children().click(function () {
      return false;
    }).mousedown(function (event) {
      that.dnd.press(that.buttons[H5P.jQuery(this).data('id')].createElement().appendTo(that.$container), event.pageX, event.pageY);
      return false;
    }).data('id', i);
  }
};

/**
 * Handler for when the dragging stops. Makes sure the element is inside its container.
 * 
 * @param {Object} event
 * @returns {undefined} 
 */
H5P.DragNBar.prototype.stopMoving = function (event) {
  var top, left;
  
  var x = event.pageX - 10;
  var y = event.pageY - 10;
    
  var offset = this.$container.offset();
    
  // Check if element is above or below the container.
  var containerHeight = this.$container.height();
  var elementHeight = this.dnd.$element.height() + 3;
  if (y < offset.top) {
    top = 0;
  }
  else if (y + elementHeight > offset.top + containerHeight) {
    top = containerHeight - elementHeight;
  }
  else {
    top = y - offset.top;
  }
    
  // Check if element is to the left or to the right of the container.
  var paddingLeft = parseInt(this.$container.css('padding-left'));
  var containerWidth = this.$container.width() + paddingLeft;
  var elementWidth = this.dnd.$element.width() + 2;
  
  if (x < offset.left + paddingLeft) {
    left = paddingLeft;
  }
  else if (x + elementWidth > offset.left + containerWidth) {
    left = containerWidth - elementWidth;
  }
  else {
    left = x - offset.left;
  }
  
  // Calculate percentage
  top = top / (containerHeight / 100);
  left = left / (containerWidth / 100);
  
  this.dnd.$element.css({top: top + '%', left: left + '%'});
  
  // Give others the result
  if (this.stopMovingCallback !== undefined) {
    paddingLeft = paddingLeft / (containerWidth / 100);
    this.stopMovingCallback(left - paddingLeft, top);
  }
};