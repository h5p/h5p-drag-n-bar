/*global H5P*/

/**
 * Create context menu
 * @class
 */
H5P.DragNBarContextMenu = (function ($, EventDispatcher) {

  /**
   * Constructor for context menu
   * @param {H5P.DragNBarElement} DragNBarElement
   * @param {Boolean} [hasCoordinates] Decides if coordinates will be displayed
   * @constructor
   */
  function ContextMenu(DragNBarElement, hasCoordinates) {
    EventDispatcher.call(this);

    /**
     * Keeps track of DragNBar object
     *
     * @type {H5P.DragNBar}
     */
    this.dnb = DragNBarElement.dnb;

    /**
     * Keeps track of DnBElement object
     *
     * @type {H5P.DragNBarElement}
     */
    this.dnbElement = DragNBarElement;

    /**
     * Keeps track of context menu container
     *
     * @type {H5P.jQuery}
     */
    this.$contextMenu = $('<div>', {
      'class': 'h5p-dragnbar-context-menu'
    });

    /**
     * Keeps track of buttons container
     *
     * @type {H5P.jQuery}
     */
    this.$buttons = $('<div>', {
      'class': 'h5p-context-menu-buttons'
    });

    /**
     * Keeps track of whether the context menu should display coordinates
     * @type {Boolean}
     */
    this.hasCoordinates = (hasCoordinates !== undefined ? hasCoordinates : true);

    /**
     * Button containing button name and event name that will be fired.
     * @typedef {Object} ContextMenuButton
     * @property {String} buttonName - Name of the button and title
     * @property {String} eventName - Name of the event that will be fired upon click
     */

    /**
     * Keeps track of button objects
     * @type {ContextMenuButton[]}
     */
    this.buttons = [
      {buttonName: 'edit', eventName: 'contextMenuEdit'},
      {buttonName: 'delete', eventName: 'contextMenuDelete'}
      //{buttonName: 'bringToFront', eventName: 'contextMenuBringToFront'}
    ];

    this.updateContextMenu();
  }

  // Inherit event dispatcher
  ContextMenu.prototype = Object.create(EventDispatcher.prototype);
  ContextMenu.prototype.constructor = ContextMenu;

  /**
   * Create coordinates in context menu
   */
  ContextMenu.prototype.addCoordinates = function () {
    // Coordinates disabled or exists
    if (!this.hasCoordinates || this.$coordinates) {
      return;
    }

    var self = this;

    // Add coordinates picker
    this.$coordinates = $(
      '<div class="h5p-dragnbar-coordinates">' +
        '<input class="h5p-dragnbar-x" type="text" value="0">' +
        '<span class="h5p-dragnbar-coordinates-separater">,</span>' +
        '<input class="h5p-dragnbar-y" type="text" value="0">' +
      '</div>'
    ).mousedown(function () {
      self.dnb.pressed = true;
    }).appendTo(this.$contextMenu);

    this.$x = this.$coordinates.find('.h5p-dragnbar-x');
    this.$y = this.$coordinates.find('.h5p-dragnbar-y');

    this.$x.add(this.$y).on('change keydown', function(event) {
      if (event.type === 'change' || event.which === 13) {

        // Get input
        var x = Number(self.$x.val());
        var y = Number(self.$y.val());

        if (!isNaN(x) && !isNaN(y)) {

          // Do not move outside of container
          var min = {x: 0 , y: 0};
          var max = {
            x: self.dnb.$container.width() - self.dnbElement.getElement().outerWidth(),
            y: self.dnb.$container.height() - self.dnbElement.getElement().outerHeight()
          };

          // Check min values
          if (x < 0) {
            x = min.x;
          }
          if (y < 0) {
            y = min.y;
          }

          // Check max values
          if (x > max.x) {
            x = max.x;
          }
          if (y > max.y) {
            y = max.y;
          }

          // Update and store location
          self.dnb.stopMoving(x, y);

          if (event.which === 13) {
            // Pressed enter, mark number for easy edit
            setTimeout(function () {
              event.target.focus();
              event.target.setSelectionRange(0, event.target.value.length);
            }, 0);
          }

          // Update context menu position
          self.dnb.updateCoordinates();
        }
      }
    });
  };

  /**
   * Update the coordinates picker.
   *
   * @param {Number} left Left pos of context menu
   * @param {Number} top Top pos of context menu
   * @param {Number} x X value in coordinates
   * @param {Number} y Y value in coordinates
   */
  ContextMenu.prototype.updateCoordinates = function (left, top, x, y) {
    // Move it
    this.$contextMenu.css({
      left: left,
      top: top
    });

    // Set pos
    if (this.hasCoordinates) {
      this.$x.val(Math.round(x));
      this.$y.val(Math.round(y));
    }
  };

  /**
   * Create button and add it to context menu element
   * @param {String} buttonName
   * @param {String} eventName
   */
  ContextMenu.prototype.addToMenu = function (buttonName, eventName) {
    var self = this;

    // Create new button
    $('<div>', {
      'class': 'h5p-dragnbar-context-menu-button ' + buttonName,
      'role': 'button',
      'tabindex': 0,
      'aria-label': buttonName
    }).click(function () {
      self.dnb.pressed = true;
      self.trigger(eventName);
    }).appendTo(this.$buttons);
  };

  /**
   * Remove button from context menu
   * @param {String} buttonName
   */
  ContextMenu.prototype.removeFromMenu = function (buttonName) {
    var $removeButton = this.$buttons.children('.h5p-context-menu-button-' + buttonName);
    $removeButton.remove();
  };

  /**
   * Update context menu with current buttons. Useful when having added or removed buttons.
   */
  ContextMenu.prototype.updateContextMenu = function () {
    var self = this;

    // Clear context menu
    this.$buttons.children().remove();

    // Add coordinates
    if (this.hasCoordinates) {
      this.addCoordinates();
    }

    // Add menu elements
    this.buttons.forEach(function (button) {
      self.addToMenu(button.buttonName, button.eventName);
    });

    this.$buttons.appendTo(this.$contextMenu);
  };

  /**
   * Add button and update context menu.
   * @param {String} buttonName
   * @param {String} eventName
   */
  ContextMenu.prototype.addButton = function (buttonName, eventName) {
    this.buttons.push({buttonName: buttonName, eventName: eventName});
    this.updateContextMenu();
  };

  /**
   * Remove button from context menu
   * @param {String} buttonName
   */
  ContextMenu.prototype.removeButton = function (buttonName) {
    // Check if button exists
    var buttonIndex = this.buttons.indexOf(buttonName);

    // Remove button
    if (buttonIndex >= 0) {
      this.buttons.splice(buttonIndex, 1);
    }

    this.updateContextMenu();
  };

  /**
   * Toggle if coordinates should show
   * @param {Boolean} [enableCoordinates] Enable coordinates
   */
  ContextMenu.prototype.toggleCoordinates = function (enableCoordinates) {
    if (enableCoordinates === undefined) {
      this.hasCoordinates = !this.hasCoordinates;
    } else {
      this.hasCoordinates = !!enableCoordinates;
    }

    this.updateContextMenu();
  };

  /**
   * Attach context menu to body.
   */
  ContextMenu.prototype.attach = function () {
    this.$contextMenu.appendTo(H5P.$body);
  };

  /**
   * Detach context menu from DOM.
   */
  ContextMenu.prototype.detach = function () {
    this.$contextMenu.detach();
  };

  return ContextMenu;

})(H5P.jQuery, H5P.EventDispatcher);
