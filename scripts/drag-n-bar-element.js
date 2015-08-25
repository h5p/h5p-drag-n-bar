/*global H5P*/

/**
 * Create Drag N Bar Element. Connects a DragNBar element to a context menu
 * @class
 */
H5P.DragNBarElement = (function ($, ContextMenu, EventDispatcher) {

  /**
   * Constructor DragNBarElement
   * @param {H5P.DragNBar} dragNBar Parent dragNBar toolbar
   * @param {String} subContentId Unique identifier for element/content.
   * @param {H5P.jQuery} $form Form element
   * @param {Object} [options] Button object that the element is created from
   * @param {Function} [options.createElement] Function for creating element from button
   * @param {boolean} [options.hasCoordinates] Decides if element will display coordinates
   * @param {H5P.jQuery} [options.element] Element
   * @constructor
   */
  function DragNBarElement(dragNBar, subContentId, $form, options) {
    var self = this;
    EventDispatcher.call(this);

    this.dnb = dragNBar;
    this.subContentId = subContentId;
    this.$form = $form;
    this.options = options || {};
    this.contextMenu = new ContextMenu(this, this.options.hasCoordinates);

    if (this.options.createElement) {
      this.$element = this.options.createElement().appendTo(dragNBar.$container);
    } else {
      this.$element = this.options.element;
    }

    // Let dnb know element has been pressed
    if (this.$element) {
      this.$element.mousedown(function () {
        self.dnb.pressed = true;
      });
    }
  }

  // Inheritance
  DragNBarElement.prototype = Object.create(EventDispatcher.prototype);
  DragNBarElement.prototype.constructor = DragNBarElement;

  /**
   * Add button to context menu
   * @param {String} buttonText
   * @param {String} eventName
   */
  DragNBarElement.prototype.addButton = function (buttonText, eventName) {
    this.contextMenu.addToMenu(buttonText, eventName);
  };

  /**
   * Get element
   * @returns {H5P.jQuery}
   */
  DragNBarElement.prototype.getElement = function () {
    return this.$element;
  };

  /**
   * Set element
   * @param {H5P.jQuery} $element
   */
  DragNBarElement.prototype.setElement = function ($element) {
    this.$element = $element;
  };

  /**
   * Show context menu
   */
  DragNBarElement.prototype.showContextMenu = function () {
    this.contextMenu.attach();
  };

  /**
   * Hide context menu
   */
  DragNBarElement.prototype.hideContextMenu = function () {
    this.contextMenu.detach();
  };

  /**
   * Update coordinates in context menu to current location
   *
   * @param {Number} left Left position of context menu
   * @param {Number} top Top position of context menu
   * @param {Number} x X coordinate of context menu
   * @param {Number} y Y coordinate of context menu
   */
  DragNBarElement.prototype.updateCoordinates = function (left, top, x, y) {
    this.contextMenu.updateCoordinates(left, top, x, y);
    this.resizeContextMenu(left);

  };

  /**
   * Float context menu left if width exceeds parent container.
   *
   * @param {Number} left Left position of context menu.
   */
  DragNBarElement.prototype.resizeContextMenu = function (left) {
    var containerWidth = this.dnb.$container.width();
    var contextMenuWidth = this.contextMenu.$contextMenu.outerWidth();
    var isTooWide = left + contextMenuWidth >= containerWidth;
    this.contextMenu.$contextMenu.toggleClass('left-aligned', isTooWide);
  };

  /**
   * Get subContentID used to uniquely identify a DragNBarElement
   *
   * @returns {String|*}
   */
  DragNBarElement.prototype.getSubcontentId = function () {
    return this.subContentId;
  };

  /**
   * Blur element and hide context menu.
   */
  DragNBarElement.prototype.blur = function () {
    if (this.$element) {
      this.$element.blur();
    }
    this.hideContextMenu();
  };

  /**
   * Focus element
   */
  DragNBarElement.prototype.focus = function () {
    this.$element.focus();
  };

  /**
   * Remove element and hide context menu
   */
  DragNBarElement.prototype.removeElement = function () {
    this.$element.detach();
    this.hideContextMenu();
  };

  return DragNBarElement;

})(H5P.jQuery, H5P.DragNBarContextMenu, H5P.EventDispatcher);
