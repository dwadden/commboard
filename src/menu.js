"use strict";

// npm imports
const jQuery = require("jquery");

// File imports
const menuButton = require("./menuButton.js");
const util = require("./util.js");

// Exports
module.exports = { makeMenu, makeBranchMenu, makeLeafMenu, makeGuessMenu };

function initMenus(spec) {
    // Create all the menus and return
    let menus = new Map();
    let cbNames = [ "composeMain",
                    "compose1",
                    "compose2",
                    "compose3",
                    "compose4",
                    "compose5" ];
    let sNames = [ "guess",
                   "punctuation",
                   "buffer",
                   "email",
                   "callBell" ];
    let commboardMenus = cbNames.forEach(function(name) {
        menus.set(name, makeCommboardMenu(spec));
    });
    let slidingMenus = sNames.map(function(name) {
        menus.set(name, makeSlidingMenu(spec));
    });
    menus.forEach(function(menu) { // Give each menu a pointer to all other menus
        menu.menus = menus;
    });

    return menus;
}

// Menus

function makeMenu(spec, my) {
    // Constructor for generic menu objects

    // Private and public objects
    my = my || {};
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
                     buffer: my.buffer,
                     soundToggle: my.soundToggle
                   };
        };
        let specs = Array.prototype.map.call(my.buttonElems, mapped);
        return specs.map(my.initButton);
    };
    // my.nextButton = function(ix) {
    //     return (ix + 1) % my.nButtons;
    // };
    // my.isLastButton = function(buttonIx) {
    //     return buttonIx === my.nButtons - 1;
    // };

    // Private data
    my.buffer = spec.buffer;
    my.soundToggle = spec.soundToggle;
    my.divElem = document.querySelector(`div#${spec.menuName}`);
    my.buttonElems = document.querySelectorAll(
        `input[type=button][data-menu="${spec.menuName}"]`);
    my.buttons = my.initButtons();
    my.nButtons = my.buttons.length;
    my.children = null;

    // Public methods
    that.getChildren = function() {
        return my.children;
    };
    that.setChildren = function(children) {
        my.children = children;
        let setParent = function(child) {
            child.parent = that;
        };
        children.forEach(setParent);
    };
    that.slideUp = function() {
        if (my.divElem !== null) {
            jQuery(my.divElem).slideUp();
        }
    };
    that.slideDown = function() {
        if (my.divElem !== null) {
            jQuery(my.divElem).slideDown();
        }
    };
    that.getButtons = function() {
        return my.buttons;
    };
    that.getNButtons = function() {
        return my.nButtons;
    };
    // Initialize and return
    // that.slideUp();
    return that;
}

function makeCommboardMenu(spec, my) {
    // Commboard menus are always present; no sliding up and down
    my = my || {};
    let that = makeMenu(spec, my);

    my.menuType = "commboard";
}

function makeSlidingMenu(spec, my) {
    // Sliding menus are hidden; they slide down when they're being scanned or
    // when a button targeting them has been pressed.
    my = my || {};
    let that = makeMenu(spec, my);

    my.menuType = "sliding";
}



function makeBranchMenu(spec, my) {
    my = my || {};
    let that = makeMenu(spec, my);

    my.scanAt = function(buttonIx) {
        let cbpassed = function() { my.scanAt(my.nextButton(buttonIx)); };
        let cbpressed = that.scan;
        let button = my.buttons[buttonIx];
        button.scan(cbpassed, cbpressed);
    };

    return that;
}

function makeLeafMenu(spec, my) {
    my = my || {};
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

function makeGuessMenu(spec, my) {
    my = my || {};
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
