/*global H5P*/

/**
 * Create context menu
 * @class
 */
H5P.DragNBar.ContextMenu = (function ($, EventDispatcher) {

  /**
   * Constructor for context menu
   * @param {H5P.DragNBar} dragNBar
   * @param {Boolean} [hasCoordinates] Decides if coordinates will be displayed
   * @constructor
   */
  function ContextMenu(dragNBar, hasCoordinates) {

    EventDispatcher.call(this);

    this.dnb = dragNBar;
    this.$contextMenu = $('<div>', {
      'class': 'h5p-dragnbar-context-menu'
    }).appendTo(H5P.$body);

    // Default buttons
    this.hasCoordinates = (hasCoordinates !== undefined ? hasCoordinates : true);
    this.buttons = [
      {buttonName: 'edit', eventName: 'contextMenuEdit'},
      {buttonName: 'delete', eventName: 'contextMenuDelete'}
      //{buttonName: 'bringToFront', eventName: 'contextMenuBringToFront'}
    ];

    this.updateContextMenu();
  }

  // Inheritance
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
        var x = parseInt(self.$x.val());
        var y = parseInt(self.$y.val());
        if (!isNaN(x) && !isNaN(y)) {
          var snap = self.dnb.dnd.snap;
          delete self.dnb.dnd.snap;
          self.dnb.dnd.stopMovingCallback({
            pageX: x + self.dnb.dnd.adjust.x + self.dnb.dnd.containerOffset.left + self.dnb.dnd.scrollLeft + parseInt(self.dnb.$container.css('padding-left')),
            pageY: y + self.dnb.dnd.adjust.y + self.dnb.dnd.containerOffset.top + self.dnb.dnd.scrollTop
          });
          self.dnb.dnd.snap = snap;
        }
      }
    });
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
   * Add button to context menu
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
      'title': buttonName
    }).click(function () {
      self.trigger(eventName);
    }).appendTo(this.$contextMenu);
  };

  /**
   * Remove button from context menu
   * @param {String} buttonName
   */
  ContextMenu.prototype.removeFromMenu = function (buttonName) {
    var $removeButton = this.$contextMenu.children('.h5p-context-menu-button-' + buttonName);
    $removeButton.remove();
  };

  /**
   * Update context menu with current buttons
   */
  ContextMenu.prototype.updateContextMenu = function () {
    var self = this;

    // Clear context menu
    this.$contextMenu.children().remove();

    // Add coordinates
    if (this.hasCoordinates) {
      this.addCoordinates();
    }

    // Add menu elements
    this.buttons.forEach(function (button) {
      self.addToMenu(button.buttonName, button.eventName);
    });
  };

  /**
   * Add button to context menu
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
   * Hide context menu
   */
  ContextMenu.prototype.hide = function () {
    this.$contextMenu.hide();
  };

  /**
   * Show context menu
   */
  ContextMenu.prototype.show = function () {
    this.$contextMenu.show();
  };

  return ContextMenu;

})(H5P.jQuery, H5P.EventDispatcher);
