(function (DragNBar, EventDispatcher) {

  /**
   * Allows different forms to be places on top of each other instead of
   * in a dialog.
   *
   * @class H5P.DragNBar.FormManager
   * @extends H5P.EventDispatcher
   * @param {*} parent
   * @param {Object} l10n
   */
  DragNBar.FormManager = function (parent, l10n, customIconClass) {
    /** @alias H5P.DragNBar.FormManager# */
    var self = this;

    // Initialize event inheritance
    EventDispatcher.call(self);

    const formTargets = [self];
    let isSubformOpen, handleTransitionend, proceedButton;

    let fullscreenButton;

    let isFullscreen = false;

    self.subforms = [];

    /**
     * Initialize the FormManager.
     * Create frame breadcrumbs, and fullscreen button.
     *
     * @private
     */
    const initialize = function () {

      // Locate target container
      self.formContainer = (parent instanceof H5PEditor.Library ? parent.$libraryWrapper : parent.$form)[0];
      self.formContainer.classList.add('form-manager');

      self.head = document.createElement('div');
      self.head.classList.add('form-manager-head');

      const mobileMenuButton = document.createElement('button');
      mobileMenuButton.classList.add('mobile-menu-button');
      mobileMenuButton.addEventListener('click', function () {
        if (self.head.classList.contains('mobile-menu-open')) {
          self.head.classList.remove('mobile-menu-open');
        }
        else {
          self.head.classList.add('mobile-menu-open');
        }
      });
      self.head.appendChild(mobileMenuButton);

      // Create breadcrumb wrapper
      self.formBreadcrumb = document.createElement('div');
      self.formBreadcrumb.classList.add('form-manager-breadcrumb');
      self.head.appendChild(self.formBreadcrumb);

      // Create the first part of the breadcrumb
      const title = createTitle(parent);
      title.classList.add('form-manager-comein');
      self.formBreadcrumb.appendChild(title);

      // Check if we can has fullscreen
      if (H5PEditor.semiFullscreen !== undefined) {
        // Create and insert fullscreen button into header
        fullscreenButton = createButton('fullscreen', '', function () {
          if (manager.exitSemiFullscreen) {
            // Trigger semi-fullscreen exit
            manager.exitSemiFullscreen();
            manager.exitSemiFullscreen = null;
          }
          else {
            // Trigger semi-fullscreen enter
            manager.exitSemiFullscreen = H5PEditor.semiFullscreen([manager.formContainer], function () {
              isFullscreen = true;
              toggleProceedButton();
              updateFullscreenButton();
              self.trigger('formentersemifullscreen');
            }, function () {
              isFullscreen = false;
              toggleProceedButton();
              updateFullscreenButton();
              self.trigger('formexitsemifullscreen');
            });
          }
        });
        updateFullscreenButton();
        self.head.appendChild(fullscreenButton);
      }

      // Create a container for the action buttons
      self.formButtons = document.createElement('div');
      self.formButtons.classList.add('form-manager-buttons');
      hideElement(self.formButtons); // Buttons are hidden by default
      self.head.appendChild(self.formButtons);

      // Create 'Delete' button
      self.formButtons.appendChild(createButton('delete', l10n.deleteButtonLabel, function () {
        const e = new H5P.Event('formremove');
        formTargets[formTargets.length - 1].trigger(e);
        if (!e.preventRemove) {
          closeForm();
        }
      }));

      // Create 'Done' button
      self.formButtons.appendChild(createButton('done', l10n.doneButtonLabel, function () {
        formTargets[formTargets.length - 1].trigger('formdone');
        closeForm();
      }));

      // Create 'Proceed to save' button
      proceedButton = createButton('proceed', l10n.proceedButtonLabel, function () {
        if (manager.exitSemiFullscreen) {
          // Trigger semi-fullscreen exit
          manager.exitSemiFullscreen();
          manager.exitSemiFullscreen = null;
        }
      });
      hideElement(proceedButton);
      self.head.appendChild(proceedButton);

      window.addEventListener('resize', function () {
        toggleMobileView();
      });

      // Insert everything in the top of the form DOM
      self.formContainer.insertBefore(self.head, self.formContainer.firstChild);
    };

    /**
     * Helper for creating buttons.
     *
     * @private
     * @param {string} id
     * @param {string} text
     * @param {function} clickHandler
     * @return {Element}
     */
    const createButton = function (id, text, clickHandler) {
      const button = document.createElement('button');
      button.setAttribute('type', 'button');
      button.classList.add('form-manager-button');
      button.classList.add('form-manager-' + id);
      button.innerText = text;
      button.addEventListener('click', clickHandler);
      return button;
    };

    /**
     * Toggle mobile view
     */
    const toggleMobileView = function () {
      /**
       * The mobile view has three modes
       * #1 - remove text from buttons (mobile-view-large)
       * #2 - minimize the breadcrumb title width (mobile-view-medium)
       * #3 - create a dropdown menu of the breadcrumb titles (mobile-view-small)
       */

      /**
       * Helper to check if we have enough space
       * @return {boolean}
       */
      const hasEnoughSpace = function () {
        return manager.formButtons.getBoundingClientRect().top - manager.head.getBoundingClientRect().top < 10;
      }

      // First, we remove all classes to get the broadest non-mobile version
      manager.head.classList.remove('mobile-view-large', 'mobile-view-medium', 'mobile-view-small', 'mobile-menu-open');

      ['mobile-view-large', 'mobile-view-medium', 'mobile-view-small'].every(function (mode) {
        if (hasEnoughSpace()) {
          // If enough space, quit this "for-loop"
          return false;
        }
        manager.head.classList.add(mode);
        return true;
      })
    }

    /**
     * Create title element for breadcrumb.
     *
     * @private
     * @param {H5PEditor.Library} libraryField
     * @return {Element}
     */
    const createTitle = function (libraryField, customTitle, customIconId) {
      // Create breadcrumb section.
      const title = document.createElement('div');
      title.classList.add('form-manager-title');
      title.setAttribute('data-index', manager.formBreadcrumb.children.length);

      let innerText;

      // Set correct starting title
      if (customTitle) {
        innerText = customTitle;
      }
      else if (libraryField.params && libraryField.params.metadata && libraryField.params.metadata.title &&
          libraryField.params.metadata.title.substr(0, 8) !== 'Untitled') {
        innerText = getText(libraryField.params.metadata.title);
      }
      else {
        if (libraryField.$select !== undefined) {
          innerText = libraryField.$select.children(':selected').text();
        }
        else {
          // There is no way to get the title from the Hub, use the default one
          innerText = l10n.defaultTitle;
        }
      }

      if (libraryField.metadataForm) {
        // Listen for title updates
        libraryField.metadataForm.on('titlechange', function (e) {
          innerText = getText(libraryField.params.metadata.title);
        });
      }

      const textNode = document.createElement('span');
      textNode.classList.add('truncatable-text');
      textNode.appendChild(document.createTextNode(innerText));
      title.appendChild(textNode);

      const arrowTipContainer = document.createElement('div');
      arrowTipContainer.classList.add('arrow-tip-container');
      title.appendChild(arrowTipContainer);

      const iconId = customIconId ? customIconId : (libraryField.params.library ? libraryField.params.library : libraryField.currentLibrary).split(' ')[0].split('.')[1].toLowerCase();
      title.classList.add('form-manager-icon-' + iconId);
      if (customIconClass) {
        title.classList.add('form-manager-' + customIconClass);
      }

      title.addEventListener('click', function () {
        if (title.classList.contains('clickable')) {
          const index = title.getAttribute('data-index');
          closeFormsSequencially(index);
        }
      })

      return title;
    };

    /**
     * Look through all parent ancestors to see if a manager already exists.
     *
     * @private
     * @param {*} parent
     * @return {DragNBar.FormManager}
     */
    const findExistingManager = function (parent) {
      if (parent instanceof DragNBar.FormManager) {
        return parent.getFormManager(); // Found our parent manager
      }
      if (parent.parent) {
        // Looks deeper
        return findExistingManager(parent.parent);
      }
      else {
        return self; // Use our self
      }
    };

    /**
     * Help hide an element.
     *
     * @param {Element} element
     * @private
     */
    const hideElement = function (element) {
      // Make sure element is hidden while still retaining its size without
      // expanding its container. This is due to some editors resizing if
      // their container changes size which leads to some funny transitions...
      element.style.visibility = 'hidden';
      element.style.width = '100%';
      element.style.position = 'absolute';
      element.style.opacity = '0';
      element.setAttribute('aria-hidden', true);
    };

    /**
     * Help show a hidden element again
     *
     * @param {Element} element
     * @private
     */
    const showElement = function (element) {
      element.style.visibility = '';
      element.style.width = '';
      element.style.position = '';
      element.style.opacity = '';
      element.removeAttribute('aria-hidden');
    };

    /**
     * Toggle visibility of the procees button
     */
    const toggleProceedButton = function () {
      if (!proceedButton) {
        return;
      }
      // Show button only for main content (in fullscreen only)
      const func = (isFullscreen && !isSubformOpen ? showElement : hideElement);
      func(proceedButton);
    }

    /**
     * Update fuillscreen button's attributes dependent on fullscreen or not
     */
    const updateFullscreenButton = function () {
      const title = isFullscreen ? l10n.exitFullscreenButtonLabel : l10n.enterFullscreenButtonLabel;

      fullscreenButton.setAttribute('aria-label', title);
      fullscreenButton.setAttribute('title', title);
      fullscreenButton.classList[isFullscreen ? 'add' : 'remove']('form-manager-exit');
    }

    /**
     * Closes the current form.
     *
     * @private
     */
    const closeForm = function () {
      const activeManager = formTargets.pop();
      // Indicate that this editor no longer has a form open
      activeManager.setFormOpenState(false);

      // Close any open CKEditors
      if (H5PEditor.Html) {
        H5PEditor.Html.removeWysiwyg();
      }

      // Let everyone know we're closing
      activeManager.trigger('formclose');

      // Locate open form
      const subForm = manager.subforms.pop();

      if (handleTransitionend) {
        // Cancel callback for form if not fully opened.
        subForm.removeEventListener('transitionend', handleTransitionend);
        handleTransitionend = null;
      }

      const title = manager.formBreadcrumb.lastChild;
      const headHeight = manager.head.getBoundingClientRect().height;

      // Freeze container height to avoid jumping while showing elements
      manager.formContainer.style.height = (subForm.getBoundingClientRect().height + headHeight) + 'px';

      // Make underlay visible again
      if (manager.subforms.length !== 0) {
        // This is not our last sub-form
        showElement(manager.subforms[manager.subforms.length-1]);
      }
      else {
        // Show bottom form
        for (let i = 1; i < manager.formContainer.children.length - 1; i++) {
          showElement(manager.formContainer.children[i]);
        }

        // No need for the buttons any more
        hideElement(manager.formButtons);
        manager.formButtons.classList.remove('form-manager-comein');
      }

      // form-manager-movable sets the subform to absolute positioning - need
      // to set the current margin
      const subFormStyle = subForm.currentStyle || window.getComputedStyle(subForm);
      subForm.style.marginLeft = subFormStyle.marginLeft;

      // Make the sub-form animatable
      subForm.classList.add('form-manager-movable');

      // Resume natural container height
      manager.formContainer.style.height = '';

      // Set sub-form height to cover container
      subForm.style.height = (manager.formContainer.getBoundingClientRect().height - headHeight) + 'px';

      // Clean up when the final transition animation is finished
      onlyOnce(subForm, 'transitionend', function () {
        // Remove from DOM
        manager.formContainer.removeChild(subForm);
      });
      onlyOnce(title, 'transitionend', function () {
        // Remove last breadcrumb section
        manager.formBreadcrumb.removeChild(title);
        manager.formBreadcrumb.lastChild.classList.remove('clickable');
      });

      // Start the animation
      subForm.classList.remove('form-manager-slidein');
      title.classList.remove('form-manager-comein');

      toggleProceedButton();
    };

    /**
     * Close forms sequentially.
     *
     * @param {integer} keepIndex Close all forms after this index
     */
    const closeFormsSequencially = function (keepIndex) {
      if (manager.subforms.length > keepIndex) {
        onlyOnce(manager.subforms[manager.subforms.length-1], 'transitionend', function () {
          closeFormsSequencially(keepIndex);
        });

        formTargets[formTargets.length - 1].trigger('formdone');
        closeForm();
      }
    }

    /**
     * Retrieve the active manager.
     *
     * @return {DragNBar.FormManager}
     */
    self.getFormManager = function () {
      return manager;
    };

    /**
     * Set the form manager to be used for the next button clicks.
     *
     * @param {DragNBar.FormManager} target
     */
    self.addFormTarget = function (target) {
      formTargets.push(target);
    };

    /**
     * Set the state of the open/close toggle for the form manager.
     *
     * @param {boolean} state
     */
    self.setFormOpenState = function (state) {
      isSubformOpen = state;
    };

    /**
     * Create a new sub-form and shows it.
     *
     * @param {H5PEditor.Library} libraryField
     * @param {Element} formElement
     */
    self.openForm = function (libraryField, formElement, customClass, customTitle, customIconId) {
      if (isSubformOpen) {
        return; // Prevent opening more than one sub-form at a time per editor.
      }
      isSubformOpen = true;

      // Tell manager that we should be receiving the next buttons events
      manager.addFormTarget(self);

      // Create the new sub-form
      const subForm = document.createElement('div');
      manager.subforms.push(subForm);
      subForm.classList.add('form-manager-form');
      subForm.classList.add('form-manager-movable');
      if (customClass) {
        subForm.classList.add(customClass);
      }
      subForm.appendChild(formElement);

      // Ensure same height as container
      const headHeight = manager.head.getBoundingClientRect().height;
      subForm.style.height = (manager.formContainer.getBoundingClientRect().height - headHeight) + 'px';

      // Insert into DOM
      manager.formContainer.appendChild(subForm);

      // Add breadcrumb section
      const title = createTitle(libraryField, customTitle, customIconId);

      manager.formBreadcrumb.lastChild.classList.add('clickable');
      manager.formBreadcrumb.appendChild(title);

      // Show our buttons
      showElement(manager.formButtons);

      // When transition animation is done and the form is fully open...
      handleTransitionend = onlyOnce(subForm, 'transitionend', function () {
        handleTransitionend = null;

        // Hide everything except first & last child
        for (let i = 1; i < manager.formContainer.children.length - 1; i++) {
          if (manager.formContainer.children[i] !== subForm) {
            hideElement(manager.formContainer.children[i]);
          }
        }

        // Resume natural height
        subForm.style.height = '';
        subForm.classList.remove('form-manager-movable');

        self.trigger('formopened');
      });

      // Start animation on the next tick
      setTimeout(function () {

        // form-manager-movable sets the subform to absolute positioning - need
        // to use the current margin of the first field so it stops animating on
        // the correct place.
        const firstField = manager.formContainer.querySelector('.tree > .field');
        const firstFieldStyle = firstField.currentStyle || window.getComputedStyle(firstField);
        subForm.style.marginLeft = firstFieldStyle.marginLeft;
        // Need to remove it when animation is finished. Then margin auto takes over
        onlyOnce(subForm, 'transitionend', function () {
          subForm.style.marginLeft = '';
        });

        subForm.classList.add('form-manager-slidein');
        title.classList.add('form-manager-comein');
        manager.formButtons.classList.add('form-manager-comein');

        toggleMobileView();
      }, 0);

      toggleProceedButton();
    }

    /**
     * Check if the sub-form is fully opened. (animation finished)
     *
     * @return {boolean}
     */
    self.isFormOpen = function () {
      return isSubformOpen && !handleTransitionend;
    }

    // Figure out which manager to use.
    const manager = findExistingManager(parent);
    if (manager === self) {
      initialize(); // We are the first of our kind
    }
  };

  DragNBar.FormManager.prototype = Object.create(EventDispatcher.prototype);
  DragNBar.FormManager.prototype.constructor = DragNBar.FormManager;

  /**
   * Help convert any HTML into text.
   *
   * @param {string} value
   * @return {string}
   */
  const getText = function (value) {
    const textNode = H5PEditor.$.parseHTML(value);
    if (textNode !== null) {
      return textNode[0].nodeValue;
    }
    return value;
  };

  /**
   * Help make sure that an event handler is only triggered once.
   *
   * @private
   * @param {Element} element
   * @param {string} eventName
   * @param {function} handler
   * @return {function} Callback in case of manual cancellation
   */
  const onlyOnce = function (element, eventName, handler) {
    const callback = function () {
      // Make sure we're only called once.
      element.removeEventListener(eventName, callback);

      // Trigger the real handler
      handler.apply(this, arguments);
    };
    element.addEventListener(eventName, callback);
    return callback;
  };

})(H5P.DragNBar, H5P.EventDispatcher);
