"use strict";

// npm imports
const jQuery = require("jquery");

// File imports
const menuButton = require("./menuButton.js");
const util = require("./util.js");

// Exports
module.exports = { makeMenu, makeBranchMenu, makeLeafMenu, makeGuessMenu };

// Menus

/**
 * Constructor for generic Menu objects.
 * @param {Object} spec - Specification object.
 * @param {Object} spec.detector - Gaze detector object.
 * @param {Object} spec.buffer - Text buffer object.
 * @param {Object} spec.slider - Slider object.
 * @param {string} spec.menuName - CSS id of menu's document element.
 * @param {Object} my - Holds class hierarchy shared secrets.
 * @returns {Object} A Menu object.
 */
function makeMenu(spec, my) {
    // Private and public objects
    my = my || {};
    /**
     * @namespace Menu
     */
    let that = {};

    // Private methods
    my.initButton = function(spec) {
        let dispatch = new Map(
            [["menuSelector", menuButton.makeMenuSelectorButton],
             ["start", menuButton.makeStartButton],
             ["request", menuButton.makeRequestButton],
             ["letter", menuButton.makeLetterButton],
             ["space", menuButton.makeSpaceButton],
             ["terminalPunctuation", menuButton.makeTerminalPunctuationButton],
             ["nonTerminalPunctuation", menuButton.makeNonTerminalPunctuationButton],
             ["bufferAction", menuButton.makeBufferActionButton],
             ["return", menuButton.makeReturnButton],
             ["guess", menuButton.makeGuessButton],
             ["email", menuButton.makeEmailButton],
             ["notImplemented", menuButton.makeNotImplementedButton]]
        );
        let maker = dispatch.get(spec.elem.dataset.buttonType);
        return maker(spec);
    };
    my.initButtons = function() {
        let mapped = function(buttonElem) {
            return { elem: buttonElem,
                     menu: that,
                     detector: my.detector,
                     slider: my.slider,
                     buffer: my.buffer
                   };
        };
        let specs = Array.prototype.map.call(my.buttonElems, mapped);
        return specs.map(my.initButton);
    };
    my.nextButton = function(ix) {
        return (ix + 1) % my.nButtons;
    };
    my.isLastButton = function(buttonIx) {
        return buttonIx === my.nButtons - 1;
    };

    // Private data
    my.detector = spec.detector;
    my.slider = spec.slider;
    my.buffer = spec.buffer;
    my.divElem = document.querySelector(`div#${spec.menuName}`);
    my.buttonElems = document.querySelectorAll(
        `input[type=button][data-menu="${spec.menuName}"]`);
    my.buttons = my.initButtons();
    my.nButtons = my.buttons.length;
    my.children = null;

    // Public methods
    /**
     * Get the child menus for this menu.
     * @returns {Array} An array of child menus.
     * @memberof Menu
     */
    that.getChildren = function() {
        return my.children;
    };
    /**
     * Set the child menus for this menu.
     * @param {Array} children An array of child menus.
     * @memberof Menu
     */
    that.setChildren = function(children) {
        my.children = children;
        let setParent = function(child) {
            child.parent = that;
        };
        children.forEach(setParent);
    };
    /**
     * Slide this menu's document element up, hiding it.
     * @memberof Menu
     */
    that.slideUp = function() {
        // TODO: Is there a cleaner way to do this?
        if (my.divElem !== null) {
            jQuery(my.divElem).slideUp();
        }
    };
    /**
     * Slide this menu's document element down, revealing it.
     * @memberof Menu
     */
    that.slideDown = function() {
        if (my.divElem !== null) {
            jQuery(my.divElem).slideDown();
        }
    };
    /**
     * Scan through the buttons in the menu, awaiting user input.
     * @memberof Menu
     */
    that.scan = function() {
        that.slideDown();
        my.scanAt(0, 0);
    };
    /**
     * Get the buttons contained by this menu.
     * @returns {Array} An array of buttons.
     * @memberof Menu
     */
    that.getButtons = function() {
        return my.buttons;
    };
    /**
     * Get the number of buttons contained in the menu.
     * @returns {Number} The number of buttons.
     * @memberof Menu
     */
    that.getNButtons = function() {
        return my.nButtons;
    };
    // Initialize and return
    that.slideUp();
    return that;
}

/**
 * Constructor for branch menus. When finished scanning their contents, branch
 * menus begin again scanning again.
 * @param {Object} spec - Specification object. See makeMenu for details.
 * @param {Object} my - Shared secrets as in makeMenu.
 * @returns {Object} A branchMenu object.
 */
function makeBranchMenu(spec, my) {
    my = my || {};
    /**
     * @namespace branchMenu
     * @augments Menu
     */
    let that = makeMenu(spec, my);

    my.scanAt = function(buttonIx) {
        let cbpassed = function() { my.scanAt(my.nextButton(buttonIx)); };
        let cbpressed = that.scan;
        let button = my.buttons[buttonIx];
        button.scan(cbpassed, cbpressed);
    };

    return that;
}

/**
 * Constructor for leaf menus. When finished scanning their contents, leaf
 * menus return control of the program to their parent.
 * @param {Object} spec - Specification object. See makeMenu for details.
 * @param {Object} my - Shared secrets as in makeMenu.
 * @returns {Object} A leafMenu object.
 */
function makeLeafMenu(spec, my) {
    my = my || {};
    /**
     * @namespace leafMenu
     * @augments Menu
     */
    let that = makeMenu(spec, my);
    const LEAF_LOOPS = 2;            // # loops through leaf menu before jumping to parent

    my.isLastLoop = function(loopIx) {
        return loopIx === LEAF_LOOPS - 1;
    };
    my.nextLoop = function(buttonIx, loopIx) {
        return my.isLastButton(buttonIx) ? loopIx + 1 : loopIx;
    };
    my.scanAt = function(buttonIx, loopIx) {
        let cbpressed = function() {
            that.slideUp();
            that.parent.scan();
        };
        let cbnext = function() {
            my.scanAt(my.nextButton(buttonIx),
                      my.nextLoop(buttonIx, loopIx));
        };
        let cbpassed = (my.isLastButton(buttonIx) && my.isLastLoop(loopIx) ?
                        cbpressed : cbnext);
        let button = my.buttons[buttonIx];
        button.scan(cbpassed, cbpressed);
    };

    return that;
}

/**
 * Constructor for guess menus, which submit web queries for content guesses.
 * @param {Object} spec - Specification object. See makeMenu for details.
 * @param {Object} my - Shared secrets as in makeMenu.
 * @returns {Object} A guessMenu object.
 */
function makeGuessMenu(spec, my) {
    my = my || {};
    /**
     * @namespace guessMenu
     * @augments Menu
     */
    let that = makeLeafMenu(spec, my);

    // internal constants
    const N_GUESSES = 7;        // Number of guesses to be offered to user
    const MIN_COUNT = 1000;     // Min number of ocurrences in wordnik corpus

    // private methods
    my.wordnik = function(text, success, failure) {
        // TODO: It's probably wrong to hard-code the api key. User will have to
        // get his own. Deal with this later.
        // TODO: Should treat all words as lower case, even if they're upper
        // case in the text buffer.
        let queryURL = "http:api.wordnik.com:80/v4/words.json/search/" + text;
        jQuery.ajax({
            url: queryURL,
            data: { minCorpusCount: MIN_COUNT,
                    api_key: "a8a677e1378da5d7a03532c7b57083a570bdd1254c16f6af3",
                    caseSensitive: true,
                    limit: N_GUESSES },
            type: "GET",
            dataType: "json",
            success: success,
            error: failure
        });
    };
    my.guessWord = function(inputText, cb) {
        let success = function(data, status) {
            let guesses = (data.searchResults.slice(1).
                           map(function(o) { return o.word; }));
            let padded = util.pad(guesses, "", N_GUESSES); // Pad with proper number of guesses
            cb(padded);
        };
        // TODO: Figure out how to handle this properly
        let failure = function(data, status) {
            debugger;
        };

        let text = inputText.split(" ").slice(-1)[0];
        if (text === "") {          // If no text, no guesses.
            cb(util.repeat("", N_GUESSES));
        } else {
            my.wordnik(text, success, failure);
        }
    };
    // Update word guesses based on changes to buffer
    my.update = function() {
        let callback = function(guesses) {
            util.zip(my.buttons, guesses).forEach(function([button, guess])
                                                  { button.setValue(guess); });
        };
        let inputText = my.buffer.getText();
        my.guessWord(inputText, callback);
    };

    // Initialization
    my.buffer.addChangeListener(my.update);
    return that;
}
