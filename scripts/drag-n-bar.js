H5P.DragNBar = (function (EventDispatcher) {
  var nextInstanceIndex = 0;

  /**
   * Constructor. Initializes the drag and drop menu bar.
   *
   * @class
   * @param {Array} buttons
   * @param {H5P.jQuery} $container
   * @param {H5P.jQuery} $dialogContainer
   * @param {object} [options] Collection of options
   * @param {boolean} [options.disableEditor=false] Determines if DragNBar should be displayed in view or editor mode
   * @param {boolean} [options.enableCopyPaste=true] Determines if copy & paste is supported
   * @param {H5P.jQuery} [options.$blurHandlers] When clicking these element(s) dnb focus will be lost
   * @param {object} [options.libraries] Libraries to check against for paste notification
   */
  function DragNBar(buttons, $container, $dialogContainer, options) {
    var self = this;

    EventDispatcher.call(this);
    this.overflowThreshold = 13; // How many buttons to display before we add the more button.
    this.buttons = buttons;
    this.$container = $container;
    this.$dialogContainer = $dialogContainer;
    this.dnd = new H5P.DragNDrop(this, $container);
    this.dnd.snap = 10;
    this.newElement = false;
    var defaultOptions = {
      disableEditor: false,
      enableCopyPaste: true,
    };
    options = H5P.jQuery.extend(defaultOptions, options);
    this.enableCopyPaste = options.enableCopyPaste;
    this.isEditor = !options.disableEditor;
    this.$blurHandlers = options.$blurHandlers
      ? options.$blurHandlers
      : undefined;
    this.libraries = options.libraries;
    this.instanceIndex = nextInstanceIndex++;

    this.initShiftKeyPressedListener(self);

    /**
     * Keeps track of created DragNBar elements
     * @type {Array}
     */
    this.elements = [];

    // Create a popup dialog
    this.dialog = new H5P.DragNBarDialog($dialogContainer, $container);

    // Fix for forcing redraw on $container, to avoid "artifcats" on safari
    this.$container.addClass("hardware-accelerated");

    if (this.isEditor) {
      this.transformButtonActive = false;
      this.initEditor();
      this.initClickListeners();

      H5P.$window.resize(function () {
        self.resize();
        self.hideControlBoxes();
      });
    }

    /**
     * Add button group.
     *
     * @private
     * @param {object[]} Buttons.
     * @param {H5P.jQuery} $button Button to add button group to.
     * @param {object} [options] Options.
     * @param {string} [options.title] Title for the group.
     */
    this.addButtonGroup = function (buttons, $button, options) {
      const $buttonGroup = H5P.jQuery(
        '<li class="h5p-dragnbar-li h5p-dragnbar-button-group" data-label="Image"></li>'
      );
      // Add optional title to the group
      if (options && options.title && options.title !== "") {
        H5P.jQuery(
          '<div class="h5p-dragnbar-button-title">' + options.title + "</div>"
        ).appendTo($buttonGroup);
      }

      // Container for buttons
      const $buttonGroupButtons = H5P.jQuery(
        '<ul class="h5p-dragnbar-button-buttons h5p-dragnbar-ul"></ul>'
      ).appendTo($buttonGroup);

      // Add buttons
      buttons.forEach(function (button) {
        self.addButton(button, $buttonGroupButtons);
      });

      $buttonGroup.insertAfter($button.parent());
      return $buttonGroup;
    };
  }

  // Inherit support for events
  DragNBar.prototype = Object.create(EventDispatcher.prototype);
  DragNBar.prototype.constructor = DragNBar;

  return DragNBar;
})(H5P.EventDispatcher);

/**
 * Creates eventlisteners which sets a boolean true or false if the shift key is pressed. 
 * Is used to turn off increments on rotation
 * 
 * @param {*} instance 
 */

H5P.DragNBar.prototype.initShiftKeyPressedListener = function (instance) {
  instance.shiftKeyIsPressed = false;

    window.addEventListener("keydown", (event) => {
      const isShiftKey = event.key === "Shift";
      if (isShiftKey) {
        instance.shiftKeyIsPressed = true;
      }
    });

    window.addEventListener("keyup", (event) => {
      const isShiftKey = event.key === "Shift";
      if (isShiftKey) {
        instance.shiftKeyIsPressed = false;
      }
    });
}

/**
 * Initializes editor functionality of DragNBar
 */
H5P.DragNBar.prototype.initEditor = function () {
  var that = this;
  this.dnr = new H5P.DragNResize(this.$container);
  this.dnr.snap = 10;

  this.dnd.on("showTransformPanel", function () {
    TransformPanel(true);
  });

  this.dnd.on("hideTransformPanel", function () {
    if (!that.transformButtonActive) {
      TransformPanel(false);
    }
  });

  /**
   * Trigger a context menu transform to either show or hide
   * the transform panel.
   *
   * @param {boolean} show
   */
  function TransformPanel(show) {
    if (that.focusedElement) {
      that.focusedElement.contextMenu.trigger("contextMenuTransform", {
        showTransformPanel: show,
      });
    }
  }

  this.dnd.startMovingCallback = function () {
    that.dnd.min = { x: 0, y: 0 };
    that.dnd.max = {
      x: that.$container.width() - that.$element.outerWidth(),
      y: that.$container.height() - that.$element.outerHeight(),
    };

    if (that.newElement) {
      that.dnd.adjust.x = 10;
      that.dnd.adjust.y = 10;
      that.dnd.min.y -= that.$list.height();
    }

    return true;
  };

  this.dnd.stopMovingCallback = function () {
    var pos = {};
    if (that.newElement) {
      that.$container.css("overflow", "");
      if (Math.round(parseFloat(that.$element.css("top"))) < 0) {
        // Try to center element, but avoid overlapping
        pos.x = that.dnd.max.x / 2;
        pos.y = that.dnd.max.y / 2;
        that.avoidOverlapping(pos, that.$element);
      }
    }

    if (pos.x === undefined || pos.y === undefined) {
      pos.x = Math.round(parseFloat(that.$element.css("left")));
      pos.y = Math.round(parseFloat(that.$element.css("top")));
    }

    that.stopMoving(pos.x, pos.y);
    that.newElement = false;

    delete that.dnd.min;
    delete that.dnd.max;
  };
};

/**
 * Tries to position the given element close to the requested coordinates.
 * Element can be skipped to check if spot is available.
 *
 * @param {object} pos
 * @param {number} pos.x
 * @param {number} pos.y
 * @param {(H5P.jQuery|Object)} element object with width&height if ran before insertion.
 */
H5P.DragNBar.prototype.avoidOverlapping = function (pos, $element) {
  // Determine size of element
  var size = $element;
  if (size instanceof H5P.jQuery) {
    size = window.getComputedStyle(size[0]);
    size = {
      width: parseFloat(size.width),
      height: parseFloat(size.height),
    };
  } else {
    $element = undefined;
  }

  // Determine how much they can be manuvered
  var containerStyle = window.getComputedStyle(this.$container[0]);
  var manX = parseFloat(containerStyle.width) - size.width;
  var manY = parseFloat(containerStyle.height) - size.height;

  var limit = 16;
  var attempts = 0;

  while (attempts < limit && this.elementOverlaps(pos.x, pos.y, $element)) {
    // Try to place randomly inside container
    if (manX > 0) {
      pos.x = Math.floor(Math.random() * manX);
    }
    if (manY > 0) {
      pos.y = Math.floor(Math.random() * manY);
    }
    attempts++;
  }
};

/**
 * Determine if moving the given element to its new position will cause it to
 * cover another element. This can make new or pasted elements difficult to see.
 * Element can be skipped to check if spot is available.
 *
 * @param {number} x
 * @param {number} y
 * @param {H5P.jQuery} [$element]
 * @returns {boolean}
 */
H5P.DragNBar.prototype.elementOverlaps = function (x, y, $element) {
  var self = this;

  // Use snap grid
  x = Math.round(x / 10);
  y = Math.round(y / 10);

  for (var i = 0; i < self.elements.length; i++) {
    var element = self.elements[i];
    if ($element !== undefined && element.$element === $element) {
      continue;
    }

    if (
      x === Math.round(parseFloat(element.$element.css("left")) / 10) &&
      y === Math.round(parseFloat(element.$element.css("top")) / 10)
    ) {
      return true; // Stop loop
    }
  }

  return false;
};

// Key coordinates
var SHIFT = 16;
var CTRL = 17;
var DELETE = 46;
var BACKSPACE = 8;
var C = 67;
var V = 86;
var LEFT = 37;
var UP = 38;
var RIGHT = 39;
var DOWN = 40;

// Keep track of key state
var ctrlDown = false;

// How many pixels to move
var snapAmount = 1;

/**
 * Handle keydown events for the entire frame
 */
H5P.DragNBar.keydownHandler = function (event) {
  var self = event.data.instance;
  var activeElement = document.activeElement;

  // Don't care about keys if parent editor is not in focus
  // This means all editors using drag-n-bar need to set a tabindex
  // (it's not done inside this library)
  if (
    self.$dialogContainer.find(activeElement).length === 0 &&
    self.$dialogContainer.get(0) !== activeElement
  ) {
    return;
  }

  if (event.which === CTRL) {
    ctrlDown = true;

    if (self.dnd.snap !== undefined) {
      // Disable snapping
      delete self.dnd.snap;
    }
  }

  if (event.which === SHIFT) {
    snapAmount = self.dnd.snap;
  }

  if (event.which === LEFT && self.focusedElement) {
    if (
      activeElement.contentEditable === "true" ||
      activeElement.value !== undefined
    ) {
      return;
    }
    event.preventDefault();
    self.moveWithKeys(-snapAmount, 0);
  } else if (event.which === UP && self.focusedElement) {
    if (
      activeElement.contentEditable === "true" ||
      activeElement.value !== undefined
    ) {
      return;
    }
    event.preventDefault();
    self.moveWithKeys(0, -snapAmount);
  } else if (event.which === RIGHT && self.focusedElement) {
    if (
      activeElement.contentEditable === "true" ||
      activeElement.value !== undefined
    ) {
      return;
    }
    event.preventDefault();
    self.moveWithKeys(snapAmount, 0);
  } else if (event.which === DOWN && self.focusedElement) {
    if (
      activeElement.contentEditable === "true" ||
      activeElement.value !== undefined
    ) {
      return;
    }
    event.preventDefault();
    self.moveWithKeys(0, snapAmount);
  } else if (
    event.which === C &&
    ctrlDown &&
    self.focusedElement &&
    self.$container.is(":visible")
  ) {
    self.copyHandler(event);
  } else if (
    event.which === V &&
    ctrlDown &&
    window.localStorage &&
    self.$container.is(":visible")
  ) {
    self.pasteHandler(event);
  } else if (
    (event.which === DELETE || event.which === BACKSPACE) &&
    self.focusedElement &&
    self.$container.is(":visible") &&
    activeElement.tagName.toLowerCase() !== "input"
  ) {
    if (self.pressed === undefined) {
      self.focusedElement.contextMenu.trigger("contextMenuRemove");
      event.preventDefault(); // Prevent browser navigating back
    }
  }
};

/**
 * Copy object.
 * @param {Event} event - Event to check for copyable content.
 */
H5P.DragNBar.prototype.copyHandler = function (event) {
  if (!this.enableCopyPaste) {
    return;
  }

  var self = event === undefined ? this : event.data.instance;
  // Copy element params to clipboard
  var elementSize = window.getComputedStyle(self.focusedElement.$element[0]);
  var width = parseFloat(elementSize.width);
  var height = parseFloat(elementSize.height) / width;
  width =
    width /
    (parseFloat(window.getComputedStyle(self.$container[0]).width) / 100);
  height *= width;

  self.focusedElement.toClipboard(width, height);
  H5P.externalDispatcher.trigger("datainclipboard", { reset: false });
};

/**
 * Paste object.
 * @param {Event} event - Event to check for pastable content.
 */
H5P.DragNBar.prototype.pasteHandler = function (event) {
  var self = event === undefined ? this : event.data.instance;
  var activeElement = document.activeElement;

  // Don't paste if parent editor is not in focus
  if (
    !this.enableCopyPaste ||
    self.preventPaste ||
    self.dialog.isOpen() ||
    activeElement.contentEditable === "true" ||
    activeElement.value !== undefined
  ) {
    return;
  }

  if (self.$pasteButton.hasClass("disabled")) {
    // Inform user why pasting is not possible
    const pasteCheck = H5PEditor.canPastePlus(
      H5P.getClipboard(),
      this.libraries
    );
    if (pasteCheck.canPaste !== true) {
      if (
        pasteCheck.reason === "pasteTooOld" ||
        pasteCheck.reason === "pasteTooNew"
      ) {
        self.confirmPasteError(pasteCheck.description, 0, function () {});
      } else {
        H5PEditor.attachToastTo(
          self.$pasteButton.get(0),
          pasteCheck.description,
          {
            position: {
              horizontal: "center",
              vertical: "above",
              noOverflowX: true,
            },
          }
        );
      }
      return;
    }
  }

  var clipboardData = localStorage.getItem("h5pClipboard");
  if (clipboardData) {
    // Parse
    try {
      clipboardData = JSON.parse(clipboardData);
    } catch (err) {
      console.error("Unable to parse JSON from clipboard.", err);
      return;
    }

    // Update file URLs
    H5P.DragNBar.updateFileUrls(clipboardData.specific, function (path) {
      var isTmpFile = path.substr(-4, 4) === "#tmp";
      if (!isTmpFile && clipboardData.contentId) {
        // Comes from existing content

        if (H5PEditor.contentId) {
          // .. to existing content
          return "../" + clipboardData.contentId + "/" + path;
        } else {
          // .. to new content
          return (
            (H5PEditor.contentRelUrl
              ? H5PEditor.contentRelUrl
              : "../content/") +
            clipboardData.contentId +
            "/" +
            path
          );
        }
      }
      return path; // Will automatically be looked for in tmp folder
    });

    if (clipboardData.generic) {
      // Use reference instead of key
      clipboardData.generic = clipboardData.specific[clipboardData.generic];

      // Avoid multiple content with same ID
      delete clipboardData.generic.subContentId;
    }

    self.trigger("paste", clipboardData);
  }
};

/**
 * Set state of paste button.
 * @param {boolean} canPaste - If true, button will be enabled
 */
H5P.DragNBar.prototype.setCanPaste = function (canPaste) {
  canPaste = canPaste || false;
  if (this.$pasteButton) {
    this.$pasteButton.toggleClass("disabled", !canPaste);
  }
};

/**
 * Confirm replace if there is content selected
 *
 * @param {number} top Offset
 * @param {function} next Next callback
 */
H5P.DragNBar.prototype.confirmPasteError = function (message, top, next) {
  // Confirm changing library
  var confirmReplace = new H5P.ConfirmationDialog({
    headerText: H5PEditor.t("core", "pasteError"),
    dialogText: message,
    cancelText: " ",
    confirmText: H5PEditor.t("core", "ok"),
  }).appendTo(document.body);
  confirmReplace.on("confirmed", next);
  confirmReplace.show(top);
};

/**
 * Handle keypress events for the entire frame
 */
H5P.DragNBar.keypressHandler = function (event) {
  var self = event.data.instance;
  if (
    event.which === BACKSPACE &&
    self.focusedElement &&
    self.$container.is(":visible") &&
    document.activeElement.tagName.toLowerCase() !== "input"
  ) {
    event.preventDefault(); // Prevent browser navigating back
  }
};

/**
 * Handle keyup events for the entire frame
 */
H5P.DragNBar.keyupHandler = function (event) {
  var self = event.data.instance;

  if (event.which === CTRL) {
    // Update key state
    ctrlDown = false;

    // Enable snapping
    self.dnd.snap = 10;
  }
  if (event.which === SHIFT) {
    snapAmount = 1;
  }

  if (
    self.focusedElement &&
    (event.which === LEFT ||
      event.which === UP ||
      event.which === RIGHT ||
      event.which === DOWN)
  ) {
    // Store position of element after moving
    var position = self.getElementSizeNPosition();
    self.stopMoving(Math.round(position.left), Math.round(position.top));
  }
};

/**
 * Handle click events for the entire frame
 */
H5P.DragNBar.clickHandler = function (event) {
  var self = event.data.instance;

  // Remove pressed on click
  delete self.pressed;
};

/**
 * Initialize click listeners
 */
H5P.DragNBar.prototype.initClickListeners = function () {
  var self = this;
  var index = self.instanceIndex;

  // Register event listeners
  var eventData = {
    instance: self,
  };
  H5P.$body
    .on("keydown.dnb" + index, eventData, H5P.DragNBar.keydownHandler)
    .on("keypress.dnb" + index, eventData, H5P.DragNBar.keypressHandler)
    .on("keyup.dnb" + index, eventData, H5P.DragNBar.keyupHandler)
    .on("click.dnb" + index, eventData, H5P.DragNBar.clickHandler);

  // Set blur handler element if option has been specified
  var $blurHandlers = this.$container;
  if (this.$blurHandlers) {
    $blurHandlers = this.$blurHandlers;
  }

  function handleBlur() {
    // Remove coordinates picker if we didn't press an element.
    if (self.pressed !== undefined) {
      delete self.pressed;
    } else {
      self.blurAll();
      if (self.focusedElement !== undefined) {
        delete self.focusedElement;
      }
    }
  }

  $blurHandlers
    .keydown(function (e) {
      if (e.which === 9) {
        // pressed tab
        handleBlur();
      }
    })
    .click(handleBlur);
};

/**
 * Update file URLs. Useful when copying between different contents.
 *
 * @param {object} params Reference
 * @param {function} handler Modifies the path to work when pasted
 */
H5P.DragNBar.updateFileUrls = function (params, handler) {
  for (var prop in params) {
    if (params.hasOwnProperty(prop) && params[prop] instanceof Object) {
      var obj = params[prop];
      if (obj.path !== undefined && obj.mime !== undefined) {
        obj.path = handler(obj.path);
      } else {
        H5P.DragNBar.updateFileUrls(obj, handler);
      }
    }
  }
};

/**
 * Attaches the menu bar to the given wrapper.
 *
 * @param {jQuery} $wrapper
 * @returns {undefined}
 */
H5P.DragNBar.prototype.attach = function ($wrapper) {
  var self = this;
  $wrapper.html("");
  $wrapper.addClass("h5peditor-dragnbar");

  var $list = H5P.jQuery('<ul class="h5p-dragnbar-ul"></ul>').appendTo(
    $wrapper
  );
  this.$list = $list;

  for (var i = 0; i < this.buttons.length; i++) {
    var button = this.buttons[i];

    if (i === this.overflowThreshold) {
      const $buttonMore = H5P.jQuery(
        '<li class="h5p-dragnbar-li"><a href="#" title="' +
          H5PEditor.t("H5P.DragNBar", "moreElements") +
          '" class="h5p-dragnbar-a h5p-dragnbar-more-button"></a><ul class="h5p-dragnbar-li-ul"></ul></li>'
      );
      $list = $buttonMore
        .appendTo($list)
        .click(function (e) {
          $list.stop().slideToggle(300);
          e.preventDefault();
        })
        .children(":first")
        .next();

      // Close "more" on click somewhere else
      H5P.jQuery(document).click(function (event) {
        if (
          !H5P.jQuery(event.target).is(
            $buttonMore.find(".h5p-dragnbar-more-button")
          ) &&
          $list.css("display") !== "none"
        ) {
          $list.stop().slideToggle(300);
        }
      });
    }

    this.addButton(button, $list);
  }

  if (this.enableCopyPaste) {
    // Paste button
    this.$pasteButton = H5P.jQuery(
      '<li class="h5p-dragnbar-li paste-button disabled">' +
        '<a href="#" class="h5p-dragnbar-a h5p-dragnbar-paste-button" />' +
        "</li>"
    );

    H5P.jQuery("<span>", {
      class: "h5p-dragnbar-tooltip",
      text: H5PEditor.t("H5P.DragNBar", "paste"),
    }).appendTo(this.$pasteButton);

    this.$pasteButton
      .find(".h5p-dragnbar-paste-button")
      .click(function (event) {
        event.preventDefault(); // Avoid anchor click making window scroll
        self.pasteHandler();
      });
    if (this.buttons.length > this.overflowThreshold) {
      this.$pasteButton.insertAfter($list.parent());
    } else {
      this.$pasteButton.appendTo($list);
    }
  }
};

/**
 * Add button.
 *
 * @param {type} button
 * @param {Function} button.createElement Function for creating element
 * @param {type} $list
 * @returns {undefined}
 */
H5P.DragNBar.prototype.addButton = function (button, $list) {
  var that = this;

  const hasTitle = button.title && button.title !== "";
  const ariaLabel = hasTitle ? ' aria-label="' + button.title + '"' : "";
  var $button = H5P.jQuery(
    `<li class="h5p-dragnbar-li" data-label="Image">
      <a
        href="#"
        class="h5p-dragnbar-a h5p-dragnbar-${button.id}-button"
        ${ariaLabel}
      ></a>
    </li>`
  
  ).appendTo($list);

  // Prevent empty tooltips (would show on Firefox)
  if (hasTitle) {
    H5P.jQuery("<span/>", {
      class: "h5p-dragnbar-tooltip",
      text: button.title,
    }).appendTo($button);
  }

  let $buttonGroup;
  if (button.type === "group") {
    // Create dropdown button group
    $buttonGroup = this.addButtonGroup(button.buttons, $button, {
      title: button.titleGroup,
    });
    $buttonGroup.addClass("h5peditor-dragnbar-gone");

    // Close group on click somewhere else
    H5P.jQuery(document).click(function (event) {
      const hitButton = H5P.jQuery(event.target).is($button); // Closing handled by button itself
      const hitButtonGroup =
        H5P.jQuery(event.target).closest(".h5p-dragnbar-button-group")
          .length === 1;
      if (!hitButton && !hitButtonGroup) {
        $buttonGroup.toggleClass("h5peditor-dragnbar-gone", true);
        $button
          .find(".h5p-dragnbar-tooltip")
          .toggleClass("h5peditor-dragnbar-gone", false);
      }
    });
  }

  $button
    .children()
    .click(function () {
      return false;
    })
    .mousedown(function (event) {
      if (event.which !== 1) {
        return;
      }

      // Switch between normal button and dropdown button group
      if (button.type === "group") {
        if ($buttonGroup !== undefined) {
          // Set position here, because content types might add buttons out of order
          const $dragNBar = $button.closest(".h5p-dragnbar");
          const verticalOffset = $dragNBar.height();

          const buttonPos = $button.position();
          const buttonGroupPos = $buttonGroup.position();

          const xPosition =
            buttonPos.left - buttonGroupPos.left;
          const yPosition = verticalOffset;

          if (xPosition > 0) {
            $buttonGroup.css("left", xPosition);
          }

          if (yPosition > 0) {
            $buttonGroup.css("top", yPosition);
          }

          // Show dropdown and hide buttons tooltip
          $buttonGroup.toggleClass("h5peditor-dragnbar-gone");
          $button
            .find(".h5p-dragnbar-tooltip")
            .toggleClass("h5peditor-dragnbar-gone");
        }
      } else {
        that.newElement = true;
        that.pressed = true;
        var createdElement = button.createElement();
        that.$element = createdElement;
        that.$container.css("overflow", "visible");
        // y = 0 will make sure this press is regarded as outside of canvas to place element correctly
        that.dnd.press(that.$element, event.pageX, 0);
        that.focus(that.$element);
      }
    });
};

/**
 * Change container.
 *
 * @param {jQuery} $container
 */
H5P.DragNBar.prototype.setContainer = function ($container) {
  this.$container = $container;
  if (this.dnd) {
    this.dnd.$container = $container;
  }
  if (this.dnr) {
    this.dnr.$container = $container;
  }
};

/**
 * Handler for when the dragging stops. Makes sure the element is inside its container.
 *
 * @param {Number} left
 * @param {Number} top
 */
H5P.DragNBar.prototype.stopMoving = function (left, top) {
  // Calculate percentage
  top = top / (this.$container.height() / 100);
  left = left / (this.$container.width() / 100);
  this.$element.css({ top: `${top}%`, left: `${left}%` });

  // Give others the result
  if (this.stopMovingCallback !== undefined) {
    this.stopMovingCallback(left, top);
  }
};

/**
 * @typedef SizeNPosition
 * @type Object
 * @property {number} width Outer width of the element
 * @property {number} height Outer height of the element
 * @property {number} left The X Coordinate
 * @property {number} top The Y Coordinate
 * @property {number} containerWidth Inner width of the container
 * @property {number} containerHeight Inner height of the container
 */

/**
 *
 * Only works when element is inside this.$container. This is assumed and no
 * are done.
 *
 * @param {H5P.jQuery} [$element] Defaults to focused element.
 * @throws 'No element given' if $element is missing
 * @return {SizeNPosition}
 */
H5P.DragNBar.prototype.getElementSizeNPosition = function ($element) {
  $element = $element || this.focusedElement.$element;
  if (!$element || !$element.length) {
    throw "No element given";
  }

  // Always use outer size for element
  var size = $element[0].getBoundingClientRect();

  // Always use position relative to container for element
  var position = window.getComputedStyle($element[0]);

  // We include container inner size as well
  var containerSize = window.getComputedStyle(this.$container[0]);

  // Start preparing return value
  var sizeNPosition = {
    width: parseFloat(size.width),
    height: parseFloat(size.height),
    left: parseFloat(position.left),
    top: parseFloat(position.top),
    containerWidth: parseFloat(containerSize.width),
    containerHeight: parseFloat(containerSize.height),
  };

  if (
    position.left.substr(-1, 1) === "%" ||
    position.top.substr(-1, 1) === "%"
  ) {
    // Some browsers(Safari) gets percentage value instead of pixel value.
    // Container inner size must be used to calculate such values.
    sizeNPosition.left *= sizeNPosition.containerWidth / 100;
    sizeNPosition.top *= sizeNPosition.containerHeight / 100;
  }

  return sizeNPosition;
};

/**
 * Makes it possible to move dnb elements by adding to it's x and y
 *
 * @param {number} x Amount to move on x-axis.
 * @param {number} y Amount to move on y-axis.
 */
H5P.DragNBar.prototype.moveWithKeys = function (x, y) {
  /**
   * Ensure that the given value is within the given boundaries.
   *
   * @private
   * @param {number} value
   * @param {number} min
   * @param {number} max
   * @return {number}
   */
  var withinBoundaries = function (value, min, max) {
    if (value < min) {
      value = min;
    }
    if (value > max) {
      value = max;
    }

    return value;
  };

  // Get size and position of current elemet in focus
  var sizeNPosition = this.getElementSizeNPosition();

  // Change position
  sizeNPosition.left += x;
  sizeNPosition.top += y;

  // Check that values are within boundaries
  sizeNPosition.left = withinBoundaries(
    sizeNPosition.left,
    0,
    sizeNPosition.containerWidth - sizeNPosition.width
  );
  sizeNPosition.top = withinBoundaries(
    sizeNPosition.top,
    0,
    sizeNPosition.containerHeight - sizeNPosition.height
  );

  // Determine new position style
  this.$element.css({
    left: sizeNPosition.left + "px",
    top: sizeNPosition.top + "px",
  });

  this.dnd.trigger("showTransformPanel");

  // Update position of context menu
  this.updateCoordinates(
    sizeNPosition.left,
    sizeNPosition.top,
    sizeNPosition.left,
    sizeNPosition.top
  );
};

/**
 * Makes it possible to focus and move the element around.
 * Must be inside $container.
 *
 * @param {H5P.jQuery} $element
 * @param {Object} [options]
 * @param {H5P.DragNBarElement} [options.dnbElement] Register new element with dnbelement
 * @param {boolean} [options.disableResize] Resize disabled
 * @param {boolean} [options.lock] Lock ratio during resize
 * @param {string} [clipboardData]
 * @returns {H5P.DragNBarElement} Reference to added dnbelement
 */
H5P.DragNBar.prototype.add = function ($element, clipboardData, options) {  
  var self = this;
  options = options || {};
  if (this.isEditor && !options.disableResize) {
    //this.dnr.add($element, options);
  }
  var newElement = null;

  // Check if element already exist
  if (options.dnbElement) {
    // Set element as added element
    options.dnbElement.setElement($element);
    newElement = options.dnbElement;
  } else {
    options.element = $element;
    options.disableCopy = !this.enableCopyPaste;
    newElement = new H5P.DragNBarElement(this, clipboardData, options);
    this.elements.push(newElement);
  }

  $element.addClass("h5p-dragnbar-element");
  
  // Adding control-box on element (moveable)
  self.addControlBoxOnElement(newElement);

  // Removing extra controlboxes. When an element is created, it is added twice, resulting in duplicate control-boxes
  self.removeControlBoxesNotInUse();

  if (this.isEditor) {
    if (newElement.contextMenu) {
      newElement.contextMenu.on("contextMenuCopy", function () {
        self.copyHandler();
      });
    }

    if ($element.attr("tabindex") === undefined) {
      // Make it possible to tab between elements.
      $element.attr("tabindex", "0");
    }

    $element.mousedown(function (event) {
      const isLeftMouseButton = event.which === 1;
      if (!isLeftMouseButton) {
        return;
      }
      
      self.pressed = true;
      self.focus($element);
      
      $element.addClass("h5p-element--active");
      self.dnd.press($element, event.pageX, event.pageY);
    });
  }
  
  $element.focus(function () {
    self.focus($element);
  });

  return newElement;
};

/**
 * Adding control-box on element (moveable)
 * 
 * @param {H5P.DragNBarElement} element 
 */
H5P.DragNBar.prototype.addControlBoxOnElement = function (element) {
  if(window.getComputedStyle(element.$element[0]).getPropertyValue("transform").length !== 0) {
    if(typeof element.$element.attr('class').split(" ").find(cName => cName.startsWith("h5p-dnb-unique-")) !== 'string') {
    
    const uniqueClassFloat = Math.random();
    
    // Adding class to element
    const startStringElement = 'h5p-dnb-unique-';
    const uniqueClassString = startStringElement + uniqueClassFloat.toString(32);
    element.$element.addClass(uniqueClassString);
    
    // Adding control-box
    const startStringControlBox = 'h5p-control-box-unique-';
    const uniqueControlBoxId = startStringControlBox + uniqueClassFloat.toString(32);
    this.createMoveableControlBoxOnElement(element.$element, uniqueControlBoxId);

    // Hiding moveable-control-boxes. This is because if we edit a whole CP (from the menu), we dont want all the boxes to show.
    // If we are just adding an element, it will get 'focused' after this code is run, so it's ok.
    this.hideControlBoxes();

    // Since the context-menu-box will be added after the control-box, it will push the element down, but not the control-box-element.
    // Therefore, we are adjusting the control-box's position on the element 'after' the context-menu has pushed the element down by using requestAnimationFrame(),
    // so that the control-box is exactly overlapping the element.
    requestAnimationFrame(() => this.adjustControlBoxPositionOnElement(element, uniqueControlBoxId));
    }
  }
}

/**
 * Cleaning up all control-boxes which are not in use
 */
H5P.DragNBar.prototype.removeControlBoxesNotInUse = function () {

  //Getting unique ID's from elements on all slides in the CP, which are the same ID's to the corresponding control-boxes
  let uniqueClassStringList = [];
  const wrapper = document.getElementsByClassName('h5p-slides-wrapper');
  for (let i = 0; i < wrapper[0].childNodes.length; i++) {
    for (let y = 0; y < wrapper[0].childNodes[i].childNodes.length; y++) {
      if(typeof wrapper[0].childNodes[i].childNodes[y].classList.value
        .split(" ").find(cName => cName.startsWith("h5p-dnb-unique-")) != 'undefined') {
        uniqueClassStringList
          .push(wrapper[0].childNodes[i].childNodes[y].classList.value
          .split(" ")
          .find(cName => cName.startsWith("h5p-dnb-unique-"))
          .split("-").pop());
      }
    }
  }

  // Removing all control-boxes which do not have a corresponding element in the scene
  const controlBoxes = Array.from(document.getElementsByClassName('moveable-control-box'));
  const disconnectedControlBoxes = controlBoxes.filter(controlBox => {
    const uniqueId = controlBox.className.split(" ").find(cName => cName.startsWith("h5p-control-box-unique-")).split("-").pop();
    return !uniqueClassStringList.includes(uniqueId);    
  });
  
  for (const controlBox of disconnectedControlBoxes) {
    controlBox.remove();
  }
}

/**
 *  Hiding moveable-control-boxes.
 */
H5P.DragNBar.prototype.hideControlBoxes = function () {
  const controlBoxes = document.getElementsByClassName('moveable-control-box');
  for (const controlBox of controlBoxes) {
    controlBox.style.visibility = 'hidden';
  }
}

/**
 * Adjusting the position of the control-box to overlap the element.
 * 
 * @param {H5P.DragNBarElement} element 
 * @param {String} uniqueControlBoxId The control-box and element both share this unique id in their classList in order to have a connection since they are placed in different locations in the document.
 */
 H5P.DragNBar.prototype.adjustControlBoxPositionOnElement = function (element, uniqueControlBoxId) {
  const elementBCR = element.$element[0].getBoundingClientRect();
  const theControlBoxElement = document.getElementsByClassName(uniqueControlBoxId)[0];
  theControlBoxElement.style.transform = `translate3d(${elementBCR.left + window.scrollX}px, ${elementBCR.top + window.scrollY}px, 0px)`;
}

/**
 * Remove given element in the UI.
 *
 * @param {H5P.DragNBarElement} dnbElement
 */
H5P.DragNBar.prototype.removeElement = function (dnbElement) {
  dnbElement.removeElement();
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
    this.focusedElement.blur();
    this.focusedElement.hideContextMenu();
  }

  if (!$element.is(":visible")) {
    return; // Do not focus invisible items (fixes FF refocus issue)
  }

  // Keep track of the element we have in focus
  self.$element = $element;
  this.dnd.setElement($element);

  // Show and update coordinates picker
  this.focusedElement = this.getDragNBarElement($element);

  if (this.focusedElement) {
    this.focusedElement.showContextMenu();
    this.focusedElement.focus();
    self.updateCoordinates();
  }

  // Wait for potential recreation of element
  setTimeout(function () {
    self.updateCoordinates();
    if (
      self.focusedElement &&
      self.focusedElement.contextMenu &&
      self.focusedElement.contextMenu.canResize
    ) {
      self.focusedElement.contextMenu.updateDimensions();
    }
  }, 0);
};

/**
 * Get dnbElement from $element
 * @param {jQuery} $element
 * @returns {H5P.DragNBarElement} dnbElement with matching $element
 */
H5P.DragNBar.prototype.getDragNBarElement = function ($element) {
  var foundElement;
  // Find object with matching element
  this.elements.forEach(function (element) {
    if (element.getElement().is($element)) {
      foundElement = element;
    }
  });
  return foundElement;
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
 * Resize DnB, make sure context menu is positioned correctly.
 */
H5P.DragNBar.prototype.resize = function () {
  var self = this;
  this.updateCoordinates();

  if (self.focusedElement) {
    self.focusedElement.resizeContextMenu(
      self.$element.offset().left - self.$element.parent().offset().left
    );
  }
};

/**
 * Update the coordinates of context menu.
 *
 * @param {Number} [left]
 * @param {Number} [top]
 * @param {Number} [x]
 * @param {Number} [y]
 * @returns {undefined}
 */
H5P.DragNBar.prototype.updateCoordinates = function (left, top, x, y) {
  if (!this.focusedElement) {
    return;
  }

  var containerPosition = this.$container.position();

  if (left && top && x && y) {
    left = x + containerPosition.left;
    top = y + containerPosition.top;
    this.focusedElement.updateCoordinates(left, top, x, y);
  } else {
    var position = this.$element.position();
    this.focusedElement.updateCoordinates(
      position.left + containerPosition.left,
      position.top + containerPosition.top,
      position.left,
      position.top
    );
  }
};

/**
 * Creates element data to store in the clipboard.
 *
 * @param {string} from Source of the element
 * @param {object} params Element options
 * @param {string} [generic] Which part of the parameters can be used by other libraries
 * @returns {string} JSON
 */
H5P.DragNBar.clipboardify = function (from, params, generic) {
  var clipboardData = {
    from: from,
    specific: params,
  };

  if (H5PEditor.contentId) {
    clipboardData.contentId = H5PEditor.contentId;
  }

  // Add the generic part
  if (params[generic]) {
    clipboardData.generic = generic;
  }

  return clipboardData;
};

/**
 * Make sure the given element is inside the container.
 *
 * @param {SizeNPosition} sizeNPosition For the element
 * @returns {SizeNPosition} Only the properties which require change
 */
H5P.DragNBar.fitElementInside = function (sizeNPosition) {
  var style = {};

  if (sizeNPosition.left < 0) {
    // Element sticks out of the left side
    style.left = sizeNPosition.left = 0;
  }

  if (sizeNPosition.width + sizeNPosition.left > sizeNPosition.containerWidth) {
    // Element sticks out of the right side
    style.left = sizeNPosition.containerWidth - sizeNPosition.width;
    if (style.left < 0) {
      // Element is wider than the container
      style.left = 0;
      style.width = sizeNPosition.containerWidth;
    }
  }

  if (sizeNPosition.top < 0) {
    // Element sticks out of the top side
    style.top = sizeNPosition.top = 0;
  }

  if (
    sizeNPosition.height + sizeNPosition.top >
    sizeNPosition.containerHeight
  ) {
    // Element sticks out of the bottom side
    style.top = sizeNPosition.containerHeight - sizeNPosition.height;
    if (style.top < 0) {
      // Element is higher than the container
      style.top = 0;
      style.height = sizeNPosition.containerHeight;
    }
  }

  return style;
};

/**
 * Clean up any event listeners
 */
H5P.DragNBar.prototype.remove = function () {
  var index = this.instanceIndex;

  H5P.$body
    .off("keydown.dnb" + index, H5P.DragNBar.keydownHandler)
    .off("keypress.dnb" + index, H5P.DragNBar.keypressHandler)
    .off("keyup.dnb" + index, H5P.DragNBar.keyupHandler)
    .off("click.dnb" + index, H5P.DragNBar.clickHandler);
};

H5P.DragNBar.prototype.findNewPoint = function (originX, originY, angle, distance) {
  let result = [];

  result.push(Math.cos(angle * Math.PI / 180) * distance + originX);
  result.push(-Math.sin(angle * Math.PI / 180) * distance + originY);

  return result;
}
/**
 * Create a 'moveable' which is a control-box, on an element which controls the resizing and rotation of the element.
 * https://github.com/daybrush/moveable
 * 
 * @param {H5P.jQuery} $element 
 * @param {string} uniqueClassString 
 */
 H5P.DragNBar.prototype.createMoveableControlBoxOnElement = function ($element, uniqueClassString) {
  
  if (typeof $element !== "undefined") {
    const moveable = new Moveable(document.body, {
      target: $element[0],
      draggable: true,
      resizable: true,
      throttleDrag: 0,
      throttleDragRotate: 0,
      pinchable: true,
      scalable: true,
      throttleScale: 0,
      keepRatio: false,
      rotatable: true,
      throttleRotate: 0,
      rotationPosition: "bottom",
      className: uniqueClassString
    });

    const frame = {
      translate: [0, 0],
      rotate: 0,
    };

    // set start angle
    let angle = 0;
    const styleElement = window.getComputedStyle($element[0]);
    const matrix = styleElement.getPropertyValue("transform");
    if (matrix !== "none") {
      const values = matrix.split("(")[1].split(")")[0].split(",");
      const a = values[0];
      const b = values[1];
      angle = Math.round(Math.atan2(b, a) * (180 / Math.PI));
    }
    frame.rotate = angle;

    // set start transform
    const transformCSSTranslateXYArray = $element[0].style.transform.split("px");
    const transformCSSTranslateX = parseInt(transformCSSTranslateXYArray[0].match(/-?\d+/g)[0]);
    const transformCSSTranslateY = parseInt(transformCSSTranslateXYArray[1].match(/-?\d+/g)[0]);
    frame.translate[0] = transformCSSTranslateX;
    frame.translate[1] = transformCSSTranslateY;

    let containerWidth;
    let containerHeight;

    // Values which are in controll of the position of corners when hitting a wall.
    let storedPosLeft = false;
    let tempPosLeft;
    let storedPosRight = false;
    let tempPosRight;
    let storedPosTop = false;
    let tempPosTop;
    let storedPosBottom = false;
    let tempPosBottom;

    const containerOffset = $element.offsetParent().offset();

    // Resize/scale. Code running when resizing starts
    moveable
      .on("resizeStart", ({ target, set, setOrigin, dragStart }) => {
        // Set origin if transform-orgin use %.
        setOrigin(["%", "%"]);

        // If cssSize and offsetSize are different, set cssSize. (no box-sizing)
        const style = window.getComputedStyle(target);
        const cssWidth = parseFloat(style.width);
        const cssHeight = parseFloat(style.height);
        set([cssWidth, cssHeight]);

        // If a drag event has already occurred, there is no dragStart.
        dragStart && dragStart.set(frame.translate);

        containerWidth = this.$container[0].getBoundingClientRect().width;
        containerHeight = this.$container[0].getBoundingClientRect().height;

        storedPosLeft = false;
        storedPosRight = false;
        storedPosTop = false;
        storedPosBottom = false;
      })
      // This code runs every frame when dragging an element (resizing)
      .on("resize", ({ target, width, height, drag, inputEvent}) => {
        
        // Finding corner positions to ensure the element is never outside the container borders
        // *************************************************************************************
        const theElement = target;

        let leftPos;
        let topPos;
        let widthPixels;
        let heightPixels;

        // When scaling the element by dragging on the 'dots', the transform-value is changing, not left and top, as it is when 'moving'/'dragging' the element.
        // So we find the values 'translate x and y' and add them to left and top.
        const transformCSSTranslateXYArray = theElement.style.transform.split("px");
        const transformCSSTranslateX = (parseInt(transformCSSTranslateXYArray[0].match(/-?\d+/g)));
        const transformCSSTranslateY = (parseInt(transformCSSTranslateXYArray[1].match(/-?\d+/g)));

        if(theElement.style.left.includes("%")) {
          leftPos = containerWidth * parseInt(theElement.style.left) / 100 + transformCSSTranslateX;
        } else {
          leftPos = parseInt(theElement.style.left) + transformCSSTranslateX;
        }
        if(theElement.style.top.includes("%")) {
          topPos = containerHeight * parseInt(theElement.style.top) / 100 + transformCSSTranslateY;
        } else {
          topPos = parseInt(theElement.style.top) + transformCSSTranslateY;
        }
        if(theElement.style.width.includes("%")) {
          widthPixels = containerWidth * parseInt(theElement.style.width) / 100;
        } else {
          widthPixels = parseInt(theElement.style.width)
        }
        if(theElement.style.height.includes("%")) {
          heightPixels = containerHeight * parseInt(theElement.style.height) / 100;
        } else {
          heightPixels = parseInt(theElement.style.height)
        }

        let origin = [leftPos + 0.5 * widthPixels, topPos + 0.5 * heightPixels];

        const topRightCorner0DegreesPos = [origin[0] + 0.5 * widthPixels, origin[1] - 0.5 * heightPixels];
        const topLeftCorner0DegreesPos = [origin[0] - 0.5 * widthPixels, origin[1] - 0.5 * heightPixels];
        
        const angleTopRight0Degrees = Math.atan2(origin[1] - topRightCorner0DegreesPos[1], topRightCorner0DegreesPos[0] - origin[0]) * 180 / Math.PI;
        const angleTopLeft0Degrees = Math.atan2(origin[1] - topLeftCorner0DegreesPos[1], topLeftCorner0DegreesPos[0] - origin[0]) * 180 / Math.PI;
        const angleBottomRight0Degrees = -angleTopRight0Degrees;
        const angleBottomLeft0Degrees = -angleTopLeft0Degrees;

        const hypToCorners = Math.sqrt(Math.pow((widthPixels/2),2) + Math.pow((heightPixels/2),2));

        const newPosTopRightCorner = this.findNewPoint(origin[0], origin[1], (angleTopRight0Degrees - frame.rotate), hypToCorners);
        const newPosTopleftCorner = this.findNewPoint(origin[0], origin[1], (angleTopLeft0Degrees - frame.rotate), hypToCorners);
        const newPosBottomRightCorner = this.findNewPoint(origin[0], origin[1], (angleBottomRight0Degrees - frame.rotate), hypToCorners);
        const newPosBottomLeftCorner = this.findNewPoint(origin[0], origin[1], (angleBottomLeft0Degrees - frame.rotate), hypToCorners);

        const rightmostPoint = Math.max(newPosTopRightCorner[0], newPosTopleftCorner[0], newPosBottomLeftCorner[0], newPosBottomRightCorner[0]);
        const leftmostPoint = Math.min(newPosTopRightCorner[0], newPosTopleftCorner[0], newPosBottomLeftCorner[0], newPosBottomRightCorner[0]);
        const topmostPoint = Math.min(newPosTopRightCorner[1], newPosTopleftCorner[1], newPosBottomLeftCorner[1], newPosBottomRightCorner[1]);
        const bottommostPoint = Math.max(newPosTopRightCorner[1], newPosTopleftCorner[1], newPosBottomLeftCorner[1], newPosBottomRightCorner[1]);
        // Done finding corner positions
        // *************************************************************************

        // Stop resizing if we are outside the container
        // Left
        if(leftmostPoint < 0) {
          // store x-pos when a corner hits the left wall
          if(!storedPosLeft) {
            tempPosLeft = inputEvent.x - containerOffset.left;
            storedPosLeft = true;
          }
          // if the mouse x-pos is less than the stored x-pos we return
          if((inputEvent.x - containerOffset.left) < tempPosLeft) {
            return;
          }
        }
        // Right
        if(rightmostPoint > containerWidth) {
          // store x-pos when a corner hits the right wall
          if(!storedPosRight) {
            tempPosRight = inputEvent.x - containerOffset.left;
            storedPosRight = true;
          }
          // if the mouse x-pos is greater than the stored x-pos we return
          if((inputEvent.x - containerOffset.left) > tempPosRight) {
            return;
          }
        }
        // Top
        if(topmostPoint < 0) {
          // store y-pos when a corner hits the top wall
          if(!storedPosTop) {
            tempPosTop = inputEvent.y - containerOffset.top;
            storedPosTop = true;
          }
          // if the mouse x-pos is less than the stored y-pos we return
          if((inputEvent.y - containerOffset.top) < tempPosTop) {
            return;
          }
        }
        // Bottom
        if(bottommostPoint > containerHeight) {
          // store y-pos when a corner hits the bottom wall
          if(!storedPosBottom) {
            tempPosBottom = inputEvent.y - containerOffset.top;
            storedPosBottom = true;
          }
          // if the mouse x-pos is greater than the stored y-pos we return
          if((inputEvent.y - containerOffset.top) > tempPosBottom) {
            return;
          }
        }

        const widthPercent = (width / containerWidth) * 100;
        const heightPercent = (height / containerHeight) * 100;

        target.style.width = `${widthPercent}%`;
        target.style.height = `${heightPercent}%`;

        // get drag event
        frame.translate = drag.beforeTranslate;

        // Set the CSS-transform based on the calculated values
        target.style.transform = `translate(${drag.beforeTranslate[0]}px, ${drag.beforeTranslate[1]}px) rotate(${frame.rotate}deg)`;
      })
      .on("resizeEnd", ({ target, isDrag, clientX, clientY }) => {
        // Moving translateX and translateY into left and top in order to prevent resizing-isssues of window
        const translateXInPercent = (frame.translate[0] / containerWidth) * 100;
        const translateYInPercent = (frame.translate[1] / containerHeight) * 100;
        target.style.left = parseFloat(target.style.left) + translateXInPercent + '%';
        target.style.top = parseFloat(target.style.top) + translateYInPercent + '%';

        // Resetting values
        frame.translate = [0,0];
        target.style.transform = `translate(0px, 0px) rotate(${frame.rotate}deg)`;

        // This method can be found in cp-editor. Stores values in params.
        this.stopResizeCallback(
          target.style.width,
          target.style.height,
          target.style.transform,
          $element
        ); 
      });

    // Rotate
    moveable
      .on("rotateStart", ({ set, target }) => {
        // Set origin angle
        let angle;
        const styleElement = window.getComputedStyle(target);
        const matrix = styleElement.getPropertyValue("transform");
        if (matrix !== "none") {
          const values = matrix.split("(")[1].split(")")[0].split(",");
          const a = values[0];
          const b = values[1];
          angle = Math.round(Math.atan2(b, a) * (180 / Math.PI));
        }
        frame.rotate = angle;

        set(frame.rotate);
      })
      .on("rotate", ({ target, beforeRotate }) => {
        let angle;
        if (this.shiftKeyIsPressed) {
          angle = beforeRotate;
        } else {
          // Rotating by increments by 15 degrees
          angle = Math.ceil(beforeRotate / 15) * 15;
        }
        frame.rotate = angle;
        target.style.transform = `translate(${frame.translate[0]}px, ${frame.translate[1]}px) rotate(${frame.rotate}deg)`;
      })
      .on("rotateEnd", ({ target, isDrag, clientX, clientY }) => {
        // This method can be found in cp-editor. Stores values in params.
        this.stopRotationCallback(target.style.transform, $element); 
      });
  }
};