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

    let isFullscreen = false;

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

      const head = document.createElement('div');
      head.classList.add('form-manager-head');

      // Create breadcrumb wrapper
      self.formBreadcrumb = document.createElement('div');
      self.formBreadcrumb.classList.add('form-manager-breadcrumb');
      head.appendChild(self.formBreadcrumb);

      // Create the first part of the breadcrumb
      const title = createTitle(parent);
      title.classList.add('form-manager-comein');
      self.formBreadcrumb.appendChild(title);

      // Check if we can has fullscreen
      if (H5PEditor.semiFullscreen !== undefined) {
        // Create and insert fullscreen button into header
        const fullscreenButton = createButton('fullscreen', '', function () {
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

              fullscreenButton.setAttribute('aria-label', l10n.exitFullscreenButtonLabel);
              fullscreenButton.classList.add('form-manager-exit');
              self.trigger('formentersemifullscreen');
            }, function () {
              isFullscreen = false;
              toggleProceedButton();

              fullscreenButton.setAttribute('aria-label', l10n.enterFullscreenButtonLabel);
              fullscreenButton.classList.remove('form-manager-exit');
              self.trigger('formexitsemifullscreen');
            });
          }
        });
        fullscreenButton.setAttribute('aria-label', l10n.enterFullscreenButtonLabel);
        head.appendChild(fullscreenButton);
      }

      // Create a container for the action buttons
      self.formButtons = document.createElement('div');
      self.formButtons.classList.add('form-manager-buttons');
      hideElement(self.formButtons); // Buttons are hidden by default
      head.appendChild(self.formButtons);

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
      head.appendChild(proceedButton);

      // Insert everything in the top of the form DOM
      self.formContainer.insertBefore(head, self.formContainer.firstChild);
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

      // Set correct starting title
      if (customTitle) {
        title.innerText = customTitle
      }
      else if (libraryField.params && libraryField.params.metadata && libraryField.params.metadata.title &&
          libraryField.params.metadata.title.substr(0, 8) !== 'Untitled') {
        title.innerText = getText(libraryField.params.metadata.title);
      }
      else {
        if (libraryField.$select !== undefined) {
          title.innerText = libraryField.$select.children(':selected').text();
        }
        else {
          // There is no way to get the title from the Hub, use the default one
          title.innerText = l10n.defaultTitle;
        }
      }

      if (libraryField.metadataForm) {
        // Listen for title updates
        libraryField.metadataForm.on('titlechange', function (e) {
          title.innerText = getText(libraryField.params.metadata.title);
        });
      }

      const iconId = customIconId ? customIconId : (libraryField.params.library ? libraryField.params.library : libraryField.currentLibrary).split(' ')[0].split('.')[1].toLowerCase();
      title.classList.add('form-manager-icon-' + iconId);
      if (customIconClass) {
        title.classList.add('form-manager-' + customIconClass);
      }

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
      element.removeAttribute('aria-hidden');
    };

    /**
     * Toggle visibility of the procees button
     */
    const toggleProceedButton = function () {
      // Show button only for main content (in fullscreen only)
      const func = (isFullscreen && !isSubformOpen ? showElement : hideElement);
      func(proceedButton);
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
      const subForm = manager.formContainer.lastChild;
      if (!subForm.classList.contains('form-manager-form')) {
        return; // Not a form
      }

      if (handleTransitionend) {
        // Cancel callback for form if not fully opened.
        subForm.removeEventListener('transitionend', handleTransitionend);
        handleTransitionend = null;
      }

      const title = manager.formBreadcrumb.lastChild;
      const headHeight = manager.formContainer.firstChild.getBoundingClientRect().height;

      // Freeze container height to avoid jumping while showing elements
      manager.formContainer.style.height = (subForm.getBoundingClientRect().height + headHeight) + 'px';

      // Make underlay visible again
      if (subForm.previousSibling.classList.contains('form-manager-form')) {
        // This is not our last sub-form
        showElement(subForm.previousSibling);
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
      });

      // Start the animation
      subForm.classList.remove('form-manager-slidein');
      title.classList.remove('form-manager-comein');

      toggleProceedButton();
    };

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
      subForm.classList.add('form-manager-form');
      subForm.classList.add('form-manager-movable');
      if (customClass) {
        subForm.classList.add(customClass);
      }
      subForm.appendChild(formElement);

      // Ensure same height as container
      const headHeight = manager.formContainer.firstChild.getBoundingClientRect().height;
      subForm.style.height = (manager.formContainer.getBoundingClientRect().height - headHeight) + 'px';

      // Insert into DOM
      manager.formContainer.appendChild(subForm);

      // Add breadcrumb section
      const title = createTitle(libraryField, customTitle, customIconId);
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
        subForm.classList.add('form-manager-slidein');
        title.classList.add('form-manager-comein');
        manager.formButtons.classList.add('form-manager-comein');
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
