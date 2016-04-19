"use strict";

// npm imports
const jQuery = require("jquery");

// File imports
const menuButton = require("./menuButton.js");
const util = require("./util.js");

// Exports
module.exports = { makeMenu, makeBranchMenu, makeLeafMenu, makeGuessMenu, initMenus };

function initMenus(spec) {
    // Create all the menus and return

    // The spec here indicates two behaviors for each menu.
    // hide: "commboard" menus always remain showing.
    //       "dropdown" menus are hidden unless they have been selected.
    // scan: "repeat" menus should be repeated when scanned to the end
    //       "finish" menus return to their calling menu when scanning is finished
    let names = new Map([["composeMain", { hide: "commboard",
                                           scan: "repeat" }],
                         ["compose1",    { hide: "commboard",
                                           scan: "finish" }],
                         ["compose2",    { hide: "commboard",
                                           scan: "finish" }],
                         ["compose3",    { hide: "commboard",
                                           scan: "finish" }],
                         ["compose4",    { hide: "commboard",
                                           scan: "finish" }],
                         ["compose5",    { hide: "commboard",
                                           scan: "finish" }],
                         ["guess",       { hide: "dropdown",
                                           scan: "finish" }],
                         ["punctuation", { hide: "dropdown",
                                           scan: "finish" }],
                         ["buffer",      { hide: "dropdown",
                                           scan: "finish" }],
                         ["email",       { hide: "dropdown",
                                           scan: "finish" }],
                         ["callBell",    { hide: "dropdown",
                                           scan: "finish" }]]
                       );

    // Populate the menu dictionary
    let menus = new Map();
    function each(key) {
        let newSpec = jQuery.extend(names.get(key), spec);
        newSpec.menuName = key;
        menus.set(key, makeMenu(newSpec));
    }
    Array.from(names.keys()).forEach(each);

    menus.forEach(function(menu) { // Give each menu a pointer to all other menus
        menu.setMenus(menus);
    });

    debugger;
    return menus;
}

// Menus

function makeMenu(spec, my) {
    // Constructor for generic menu objects

    // Private and public objects
    my = my || {};
    let that = {};

    // Private methods
    const mb = menuButton;
    my.initButton = function(spec) {
        let dispatch = new Map(
            [["menuSelector", mb.makeMenuSelectorButton],
             ["start", mb.makeStartButton],
             ["request", mb.makeRequestButton],
             ["letter", mb.makeLetterButton],
             ["space", mb.makeSpaceButton],
             ["terminalPunctuation", mb.makeTerminalPunctuationButton],
             ["nonTerminalPunctuation", mb.makeNonTerminalPunctuationButton],
             ["bufferAction", mb.makeBufferActionButton],
             ["guess", mb.makeGuessButton],
             ["email", mb.makeEmailButton],
             ["notImplemented", mb.makeNotImplementedButton]]
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
    my.menuName = spec.menuName;
    my.hide = spec.hide;
    my.scan = spec.scan;
    my.buffer = spec.buffer;
    my.soundToggle = spec.soundToggle;
    // Some, but not all menus have elements corresponding to them. These menus
    // can slide up and down.
    my.menuElem = document.getElementById(my.menuName);
    my.buttonElems = document.querySelectorAll(
        `input[type=button][data-menu="${my.menuName}"]`);
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
        if (my.menuElem !== null) {
            jQuery(my.menuElem).slideUp();
        }
    };
    that.slideDown = function() {
        if (my.menuElem !== null) {
            jQuery(my.menuElem).slideDown();
        }
    };
    that.getButtons = function() {
        return my.buttons;
    };
    that.getNButtons = function() {
        return my.nButtons;
    };
    that.setMenus = function(menus) {
        my.menus = menus;
    };
    that.getMenus = function() {
        return my.menus;
    };
    that.getInfo = function() {
        return { menuName: my.menuName,
                 hide: my.hide,
                 scan: my.scan };
    };

    // Initialize and return
    // If it's a sliding menu, hide it
    if (my.hide === "dropdown") {
        that.slideUp();
    }
    return that;
}


////////////////////////////////////////////////////////////////////////////////

// Old. Work into new scanner.



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
