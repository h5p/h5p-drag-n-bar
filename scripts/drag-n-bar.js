/*global H5PEditor */
var H5P = H5P || {};

/**
 * Drag n bar class
 * @class
 */
H5P.DragNBar = (function () {

  /**
   * Constructor. Initializes the drag and drop menu bar.
   *
   * @param {Array} buttons
   * @param {jQuery} $container
   * @param {Boolean} [isEditor] Determines if DragNBar should be displayed in view or editor mode
   * @returns {undefined}
   */
  function DragNBar (buttons, $container, isEditor) {
    this.overflowThreshold = 13; // How many buttons to display before we add the more button.
    this.buttons = buttons;
    this.$container = $container;
    this.dnd = new H5P.DragNDrop($container, true);
    this.dnd.snap = 10;
    this.newElement = false;
    this.isEditor = isEditor === undefined ? true : isEditor;

    /**
     * Keeps track of created DragNBar elements
     * @type {Array}
     */
    this.elements = [];

    // Create a popup dialog
    this.dialog = new H5P.DragNBarDialog($container, $container);

    if (this.isEditor) {
      this.initEditor();
      this.initClickListeners();
    }
  }

  return DragNBar;
})();

/**
 * Initializes editor functionality of DragNBar
 */
H5P.DragNBar.prototype.initEditor = function () {
  var that = this;
  var startX, startY;
  this.dnr = new H5P.DragNResize(this.$container);

  // Update coordinates when element is resized
  this.dnr.on('moveResizing', function () {
    var offset = that.$element.offset();
    var position = that.$element.position();
    that.updateCoordinates(offset.left, offset.top, position.left, position.top);
  });

  this.dnr.on('stoppedResizing',function () {
    // Queue refocus of element, since mousedown does not propagate
    setTimeout(function () {
      that.focus(that.$element);
    }, 0);
  });

  this.dnd.startMovingCallback = function (x, y) {
    that.dnd.min = {x: 0, y: 0};
    that.dnd.max = {
      x: that.$container.width() - that.$element.outerWidth(),
      y: that.$container.height() - that.$element.outerHeight()
    };

    if (that.newElement) {
      that.dnd.adjust.x = 10;
      that.dnd.adjust.y = 10;
      that.dnd.min.y -= that.$list.height();
    }

    startX = x;
    startY = y;

    return true;
  };

  this.dnd.moveCallback = function (x, y) {
    var paddingLeft = Math.round(parseFloat(that.$container.css('padding-left')));
    var left = Math.round(parseFloat(that.$element.css('left')));
    var top = Math.round(parseFloat(that.$element.css('top')));
    if (that.dnd.snap !== undefined) {
      x = Math.round(x / that.dnd.snap) * that.dnd.snap;
      y = Math.round(y / that.dnd.snap) * that.dnd.snap;
    }
    that.updateCoordinates(x, y, left - paddingLeft, top);

    if (that.newElement && top >= 0) {
      // Do not allow dragging back up
      that.dnd.min.y = 0;
    }
  };

  this.dnd.stopMovingCallback = function (event) {
    var x, y;

    if (that.newElement) {
      that.$container.css('overflow', '');
      if (Math.round(parseFloat(that.$element.css('top'))) < 0) {
        x = (that.dnd.max.x / 2);
        y = (that.dnd.max.y / 2);
      }
    }

    if (x === undefined || y === undefined) {
      x = Math.round(parseFloat(that.$element.css('left')));
      y = Math.round(parseFloat(that.$element.css('top')));
    }

    that.stopMoving(x, y);
    that.newElement = false;
    that.focus(that.$element);

    delete that.dnd.min;
    delete that.dnd.max;
  };
};

/**
 * Initialize click listeners
 */
H5P.DragNBar.prototype.initClickListeners = function () {
  var that = this;

  H5P.$body.keydown(function (event) {
    if (event.keyCode === 17 && that.dnd.snap !== undefined) {
      delete that.dnd.snap;
    }
  }).keyup(function (event) {
    if (event.keyCode === 17) {
      that.dnd.snap = 10;
    }
  }).click(function (e) {
    // Remove coordinates picker if we didn't press an element.
    if (that.pressed !== undefined) {
      delete that.pressed;
    }
    else {
      that.blurAll();
      if (that.focusedElement !== undefined) {
        delete that.focusedElement;
      }
    }
    return false;
  });
};

/**
 * Attaches the menu bar to the given wrapper.
 *
 * @param {jQuery} $wrapper
 * @returns {undefined}
 */
H5P.DragNBar.prototype.attach = function ($wrapper) {
  $wrapper.html('');

  var $list = H5P.jQuery('<ul class="h5p-dragnbar-ul"></ul>').appendTo($wrapper);
  this.$list = $list;

  /**
   * Stops current list animation, and toggles slide animation for 300ms
   * @param {H5P.jQuery} $list List element
   */
  var toggleListAnimation = function ($list) {
    $list.stop().slideToggle(300);
  };

  for (var i = 0; i < this.buttons.length; i++) {
    var button = this.buttons[i];

    if (i === this.overflowThreshold) {
      $list = H5P.jQuery('<li class="h5p-dragnbar-li"><a href="#" title="' + 'More elements' + '" class="h5p-dragnbar-a h5p-dragnbar-more-button"></a><ul class="h5p-dragnbar-li-ul"></ul></li>')
        .appendTo($list)
        .click(function () {
          return false;
        })
        .hover(toggleListAnimation($list), toggleListAnimation($list))
        .children(':first')
        .next();
    }

    this.addButton(button, $list);
  }
};

/**
 * Add button.
 *
 * @param {type} button
 * @param {type} $list
 * @returns {undefined}
 */
H5P.DragNBar.prototype.addButton = function (button, $list) {
  var that = this;

  H5P.jQuery('<li class="h5p-dragnbar-li"><a href="#" title="' + button.title + '" class="h5p-dragnbar-a h5p-dragnbar-' + button.id + '-button"></a></li>')
    .appendTo($list)
    .children()
    .click(function () {
      return false;
    }).mousedown(function (event) {
      if (event.which !== 1) {
        return;
      }

      that.newElement = true;
      that.pressed = true;
      var newElement = new H5P.DragNBarElement(that, button);
      that.elements.push(newElement);
      that.$container.css('overflow', 'visible');
      that.$element = button.createElement();
      that.focus(that.$element);
      that.dnd.press(that.$element, event.pageX, event.pageY);
    });
};

/**
 * Change container.
 *
 * @param {jQuery} $container
 * @returns {undefined}
 */
H5P.DragNBar.prototype.setContainer = function ($container) {
  this.$container = $container;
  this.dnd.$container = $container;
};

/**
 * Handler for when the dragging stops. Makes sure the element is inside its container.
 *
 * @param {Number} left
 * @param {Number} top
 * @returns {undefined}
 */
H5P.DragNBar.prototype.stopMoving = function (left, top) {
  // Calculate percentage
  top = top / (this.$container.height() / 100);
  left = left / (this.$container.width() / 100);
  this.dnd.$element.css({top: top + '%', left: left + '%'});

  // Give others the result
  if (this.stopMovingCallback !== undefined) {
    this.stopMovingCallback(left, top);
  }
};

/**
 * Makes it possible to focus and move the element around.
 * Must be inside $container.
 *
 * @param {H5P.jQuery} $element
 * @param {String} subContentId Unique string for subcontent that is added
 * @param {H5P.jQuery} $form Dialog form
 * @param {Object} [options]
 * @param {boolean} [options.disableResize] Resize disabled
 * @param {boolean} [options.lock] Lock ratio during resize
 * @returns {undefined}
 */
H5P.DragNBar.prototype.add = function ($element, subContentId, $form, options) {
  var self = this;
  this.dnr.add($element, options);
  var newElement = null;

  // Check if element already exist
  var elementExists = H5P.jQuery.grep(self.elements, function (element) {
    return element.getSubcontentId() === subContentId;
  });

  if (elementExists.length > 0) {
    // Set element as added element
    elementExists[0].setElement($element);
    newElement = elementExists[0];
  } else {
    newElement = new H5P.DragNBarElement(this, subContentId, $form, {element: $element});
    this.elements.push(newElement);
  }

  $element.addClass('h5p-dragnbar-element');

  if ($element.attr('tabindex') === undefined) {
    // Make it possible to tab between elements.
    $element.attr('tabindex', 1);
  }

  $element.mousedown(function (event) {
    if (event.which !== 1) {
      return;
    }

    self.pressed = true;
    self.focus($element);
    if (event.result !== false) { // Moving can be stopped if the mousedown is doing something else
      self.dnd.press($element, event.pageX, event.pageY);
    }
  }).focus(function () {
    self.focus($element);
  });

  return newElement;
};

/**
 * Remove given element in the UI.
 *
 * @param {jQuery} $element
 */
H5P.DragNBar.prototype.removeElement = function ($element) {
  var removeElement = this.getElementFromSubContentId($element);
  removeElement.removeElement();
};

/**
 * Select the given element in the UI.
 *
 * @param {jQuery} $element
 * @returns {undefined}
 */
H5P.DragNBar.prototype.focus = function ($element) {
  var self = this;

  // Blur last focused
  if (this.focusedElement && this.focusedElement.$element !== $element) {
    this.focusedElement.$element.blur();
    this.focusedElement.hideContextMenu();
  }

  // Keep track of the element we have in focus
  self.$element = $element;

  // Show and update coordinates picker
  this.focusedElement = this.getDragNBarElement($element);

  var offset = $element.offset();
  var position = $element.position();
  this.focusedElement.updateCoordinates(offset.left, offset.top, position.left, position.top);
  this.focusedElement.showContextMenu();
};

/**
 * Get dnbElement from $element
 * @param {jQuery} $element
 * @returns {H5P.DragNBarElement} dnbElement with matching $element
 */
H5P.DragNBar.prototype.getDragNBarElement = function ($element) {
  // Find object with matching element
  var elementResults = H5P.jQuery.grep(this.elements, function (element) {
    return element.getElement() === $element;
  });

  return elementResults[0];
};

/**
 * Get dnbElement from subContentId
 *
 * @param {String} subContentId
 * @returns {H5P.DragNBarElement} dnbElement with matching subContentId
 */
H5P.DragNBar.prototype.getElementFromSubContentId = function (subContentId) {
  var elementExists = H5P.jQuery.grep(this.elements, function (element) {
    return element.getSubcontentId() === subContentId;
  });

  return elementExists[0];
};

/**
 * Deselect all elements in the UI.
 *
 * @returns {undefined}
 */
H5P.DragNBar.prototype.blurAll = function () {
  this.elements.forEach(function (element) {
    element.blur();
  });
  delete this.focusedElement;
};

/**
 * Update the coordinates picker.
 *
 * @param {Number} left
 * @param {Number} top
 * @param {Number} x
 * @param {Number} y
 * @returns {undefined}
 */
H5P.DragNBar.prototype.updateCoordinates = function (left, top, x, y) {
  this.focusedElement.updateCoordinates(left, top, x, y);
};
