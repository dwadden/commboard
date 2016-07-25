"use strict";

// npm imports
const jQuery = require("jquery");
const _ = require("underscore");

// File imports
const menuButton = require("./menu-button.js");
const util = require("./util.js");

// ************************************************************************** //

// The module exposes the procedure "menus". This procedure takes a spec
// containing detector, buffer, and settings objects, and returns an object
// representing a hash of all menus in the program.
//
// The "menus" procedure invokes the "menu" procedure, which in turn creates a
// single menu based on a menu name and a spec. The name of the menu identifies
// all DOM button elements that are members of the menu; so, for instance,
// calling menu("compose1", spec) creates a menu object handling all buttons
// with data-menu=c"compose1"
//
// The "menu" procedure does its work by looking up the actual constructor to
// call in the table "constructors", which is keyed by the menu's
// name. Constructors are added this table by passing a menu and a base
// procedure, as well as two extra behaviors, into "registerConstructor".
//
// The two extra behaviors specify the hiding behavior and scanning behavior of
// the menu. Some menus (labeled "dropdown") should be hideable, while others
// (labeled "commboard") should always be visible. Likewise, some menus (labeled
// "repeat") should start over when finished scanning, while others (labeled
// "finish") should return control to their calling menu.
//
// This is simpler to understand in code. See the calls to "registerConstructor"
// below.

let constructors = {};

function registerConstructor(name, constructor, behavior) {
    // Add a menu constructor to the table.
    function decoratedConstructor(spec) {
        // The input spec consists of buffer, detector, and settings objects. It
        // must be augmented by the name of the menu, as well as the menu's
        // behavior.
        let my = {};
        let fullSpec = Object.assign({}, spec, { menuName: name });
        let that = constructor(fullSpec, my);
        Object.assign(my, behavior);
        if (my.hide === "dropdown") {
            that.slideUp();
        }
        return that;
    }
    constructors[name] = decoratedConstructor;
}

function menu(name, spec) {     // Create a single menu given a menu name and a spec.
    return constructors[name](spec);
}

function menus(spec) {
    // Create all menus for which constructors have been registered. Return an
    // object containing these menus.
    function initHideables() {
        // Some DOM elements should hide when the corresponding button in the UI is selected.
        let containers = document.querySelectorAll(".hideable");
        function onChange(event) {
            if (event.target.checked) {
                jQuery(containers).show();
            } else {
                jQuery(containers).hide();
            }
        }
        spec.settings.addShowMenuListener(onChange);
    }

    let allMenus = {};
    const eachConstructor = (name) => allMenus[name] = menu(name, spec);
    Object.keys(constructors).forEach(eachConstructor);

    const eachMenu = (name) => allMenus[name].setMenus(allMenus);
    Object.keys(allMenus).forEach(eachMenu);

    // Initialize and return.
    initHideables();
    return allMenus;
}

module.exports = menus;

// ************************************************************************** //

// These constructors do the actual work of implementing the menu functionality.

function makeGenericMenu(spec, my) {
    // The factory function for menu objects not requiring extra functionality.
    //
    // The object "my" contains shared data required by menus further down the
    // hierarchy but not exposed externally. It is created by three separate
    // Object.assign's. The first retrieves data from the DOM. The second
    // specifies methods for constructing menu buttons by passing specs
    // containing the appropriate DOM information into the menu button
    // constructor. The third creates the child menu buttons and attaches the
    // menu.
    //
    // The object "that" is returned and exposes public methods; for instance,
    // to get pointers to all the buttons contained by the menu.

    // Objects to hold shared secrets and to be returned.
    my = my || {};
    let that = {};

    // Initialize shared secrets.
    Object.assign(my, spec);
    let myData1 = {             // Menu and button objects from the DOM
        menuElem: document.getElementById(my.menuName),
        buttonElems: document.querySelectorAll(
            `input[type=button][data-menu="${my.menuName}"]`)
    };
    Object.assign(my, myData1);
    let myMethods = {
        initButtons : function() { // Pass type tag and spec to menu button constructor.
            // Note on design: in principle, could just pass the spec and have
            // the constructor get the type from the DOM element attached to the
            // spec.  In general, however, we want to be able to dispatch on
            // button type if it came from a different source.
            function initButton(spec) {
                return menuButton(spec.elem.dataset.buttonType, spec);
            }
            let makeSpec = function(buttonElem) { // Create a spec passed to a single button constructor.
                return { elem: buttonElem,
                         menu: that,
                         detector: my.detector,
                         buffer: my.buffer,
                         settings: my.settings
                       };
            };
            let specs = [].map.call(my.buttonElems, makeSpec);
            return specs.map(initButton);
        }
    };
    Object.assign(my, myMethods);
    let myData2 = {             // Initialize child buttons and attach to menu object.
        buttons: my.initButtons(),
        children: null
    };
    Object.assign(my, myData2);

    // The returned object.
    let thatAssignments = {
        slideUp: function() {
            if (my.menuElem !== null) {
                jQuery(my.menuElem).slideUp();
            }
        },
        slideDown: function() {
            if (my.menuElem !== null) {
                jQuery(my.menuElem).slideDown();
            }
        },
        setChildren: function(children) {
            my.children = children;
            const setParent = (child) => child.parent = that;
            children.forEach(setParent);
        },
        getChildren: () => my.children,
        getButtons: () => my.buttons,
        getNButtons: () => my.buttons.length,
        setMenus: (menus) => my.menus = menus,
        getMenus: () => my.menus,
        getInfo: function() {
            return { menuName: my.menuName,
                     hide: my.hide,
                     scanType: my.scanType };
        }
    };
    Object.assign(that, thatAssignments);

    // Initialize and return
    if (my.hide === "dropdown") {     // If it's a sliding menu, hide it
        that.slideUp();
    }
    return that;
}
// Register menu constructors by building on the "makeGenericMenu" constructor.
registerConstructor("composeMain", makeGenericMenu, { hide: "commboard",
                                                      scanType: "repeat" });
["compose1", "compose2", "compose3", "compose4", "compose5"].forEach(
    (name) => registerConstructor(name, makeGenericMenu, { hide: "commboard",
                                                           scanType: "finish" }));
["punctuation", "buffer", "callBell"].forEach(
    (name) => registerConstructor(name, makeGenericMenu, { hide: "dropdown",
                                                           scanType: "finish" }));

function makeGuessMenu(spec, my) {
    // Factory function for menus that offer word guesses to the user.
    // In addition to the normal menu functionality, this menu listens for a
    // change to the buffer. Each time such a change occurs, it submits a word
    // completion request to the Wordnik API. It then sets the values of its
    // buttons to the suggested words.

    my = my || {};
    let that = makeGenericMenu(spec, my);

    // internal constants
    const N_GUESSES = 8;        // Number of guesses to be offered to user
    const MIN_COUNT = 1000;     // Min number of ocurrences in wordnik corpus
    const BASE_URL = "http:api.wordnik.com:80/v4/words.json/search/";
    const API_KEY = "a8a677e1378da5d7a03532c7b57083a570bdd1254c16f6af3"; // This could be set by user instead.

    // Internal procedures.
    function wordnik(text, success, failure) {
        // Given an incomplete word "text", query the wordnik API for possible
        // completions. Invoke one of the two passed-in callbacks depending on
        // the success of the API call.
        let queryURL = BASE_URL + text;
        jQuery.ajax({
            url: queryURL,
            data: { minCorpusCount: MIN_COUNT,
                    api_key: API_KEY,
                    caseSensitive: false,
                    limit: N_GUESSES },
            type: "GET",
            dataType: "json",
            success: success,
            error: failure
        });
    };

    function guessWord(inputText, cb) {
        // Wraps the API call and extracts the results.
        let success = function(data, status) {
            let guesses = (data.searchResults.slice(1).
                           map((o) => o.word));
            let padded = util.pad(guesses, "", N_GUESSES); // Pad with proper number of guesses
            cb(padded);
        };
        let failure = function(data, status) {
            console.log("Wordnik API call failed.");
        };

        let text = inputText.split(" ").slice(-1)[0];
        if (text === "") {          // If no text, no guesses.
            cb(util.repeat("", N_GUESSES));
        } else {
            // Add a wildcard so guesses will be retrieved even if "text" is a completed word.
            wordnik(text + "*", success, failure);
        }
    };

    function update() {
        // Invoked when the buffer changes. Retrieves guesses and updates buttons appropriately.
        let callback = function(guesses) {
            _.zip(my.buttons, guesses).forEach(function([button, guess])
                                               { button.setButtonValue(guess); });
        };
        let inputText = my.buffer.getText();
        guessWord(inputText, callback);
    };

    let myAssignments = { wordnik, guessWord, update };
    my = Object.assign(my, myAssignments);

    // Initialization
    my.buffer.addChangeListener(my.update);
    return that;
}
registerConstructor("guess", makeGuessMenu, { hide: "commboard", // register the guess menu constructor.
                                              scanType: "finish" });

function makeEmailMenu(spec, my) {
    // Factory function for menus offering email functionality. In addition to
    // normal menu functionality, these menus can accept new email recipients
    // from the DOM and assign buttons to these recpients.

    my = my || {};
    let that = makeGenericMenu(spec, my);

    // Constants
    const N_RECIPIENTS = 8;     // The number of recipients that can be stored.

    // Private additions
    let myData = {              // Private data
        getEmailSettings: () => my.settings.getEmailSettings(),
        buttonIx: 0            // Index of current open button.
    };
    Object.assign(my, myData);
    let myMethods = {  // Private methods, depending on the new data.
        addRecipient: function() { // Get recipient from text entry field and set the next open button accordingly.
            let button = my.buttons[my.buttonIx];
            let settings = my.getEmailSettings();
            button.setRecipient(settings.getRecipientName(),
                                settings.getRecipientAddress());
            settings.clearRecipientInfo();
            my.buttonIx = (my.buttonIx + 1) % N_RECIPIENTS;
        }
    };
    Object.assign(my, myMethods);

    // Initialization.
    my.getEmailSettings().addRecipientListener(my.addRecipient);
    return that;
}
registerConstructor("email", makeEmailMenu, { hide: "dropdown", // register the email menu constructor.
                                              scanType: "finish" });
