"use strict";

// npm imports
const jQuery = require("jquery");
const _ = require("underscore");

// File imports
const menuButton = require("./menu-button.js");
const util = require("./util.js");

// Exports
module.exports = { initMenus };

function initMenus(spec) {
    // Create all the menus and return

    // The spec here indicates two behaviors for each menu.
    // hide: "commboard" menus always remain showing.
    //       "dropdown" menus are hidden unless they have been selected.
    // scan: "repeat" menus should be repeated when scanned to the end
    //       "finish" menus return to their calling menu when scanning is finished
    let names = new Map([["composeMain", { hide: "commboard",
                                           scan: "repeat",
                                           constructor: makeMenu }],
                         ["compose1",    { hide: "commboard",
                                           scan: "finish",
                                           constructor: makeMenu }],
                         ["compose2",    { hide: "commboard",
                                           scan: "finish",
                                           constructor: makeMenu }],
                         ["compose3",    { hide: "commboard",
                                           scan: "finish",
                                           constructor: makeMenu }],
                         ["compose4",    { hide: "commboard",
                                           scan: "finish",
                                           constructor: makeMenu }],
                         ["compose5",    { hide: "commboard",
                                           scan: "finish",
                                           constructor: makeMenu }],
                         ["guess",       { hide: "commboard",
                                           scan: "finish",
                                           constructor: makeGuessMenu }],
                         ["punctuation", { hide: "dropdown",
                                           scan: "finish",
                                           constructor: makeMenu }],
                         ["buffer",      { hide: "dropdown",
                                           scan: "finish",
                                           constructor: makeMenu }],
                         ["email",       { hide: "dropdown",
                                           scan: "finish",
                                           constructor: makeEmailMenu }],
                         ["callBell",    { hide: "dropdown",
                                           scan: "finish",
                                           constructor: makeMenu} ]]
                       );

    // Populate the menu dictionary
    let menus = new Map();
    function each(key) {
        let newSpec = jQuery.extend(names.get(key), spec);
        newSpec.menuName = key;
        // TODO: This isn't the right way to do this. Fix it later.
        let constructor = names.get(key)["constructor"];
        menus.set(key, constructor(newSpec));
    }
    Array.from(names.keys()).forEach(each);

    menus.forEach(function(menu) { // Give each menu a pointer to all other menus
        menu.setMenus(menus);
    });

    // Register event listener for "show menu checkbox"
    // TODO: Encapsulate in a procedure
    let containers = document.querySelectorAll(".hideable");
    function onChange(event) {
        if (event.target.checked) {
            jQuery(containers).show();
        } else {
            jQuery(containers).hide();
        }
    }
    spec.settings.addShowMenuListener(onChange);

    return menus;
}

// Menus

function makeMenu(spec, my) {
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
                     scan: my.scan };
        }
    };
    Object.assign(that, thatAssignments);

    // Initialize and return
    if (my.hide === "dropdown") {     // If it's a sliding menu, hide it
        that.slideUp();
    }
    return that;
}

function makeGuessMenu(spec, my) {
    my = my || {};
    let that = makeMenu(spec, my);

    // internal constants
    const N_GUESSES = 8;        // Number of guesses to be offered to user
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
                    caseSensitive: false,
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
            util.notImplemented();
        };

        let text = inputText.split(" ").slice(-1)[0];
        if (text === "") {          // If no text, no guesses.
            cb(util.repeat("", N_GUESSES));
        } else {
            // Add a wildcard so guesses will be retrieved even if "text" is a completed word.
            my.wordnik(text + "*", success, failure);
        }
    };
    // Update word guesses based on changes to buffer
    my.update = function() {
        let callback = function(guesses) {
            _.zip(my.buttons, guesses).forEach(function([button, guess])
                                                  { button.setButtonValue(guess); });
        };
        let inputText = my.buffer.getText();
        my.guessWord(inputText, callback);
    };

    // Initialization
    my.buffer.addChangeListener(my.update);
    return that;
}

function makeEmailMenu(spec, my) {
    my = my || {};
    let that = makeMenu(spec, my);

    // Constants
    const N_RECIPIENTS = 8;     // The number of recipients that can be stored.

    // Private data.
    my.emailSettings = my.settings.getEmailSettings();
    my.buttonIx = 0;            // Index of current open button.

    // Private methods.
    my.addRecipient = function() {
        // Add a new recipient.
        let button = my.buttons[my.buttonIx];
        button.setRecipient(my.emailSettings.getRecipientName(),
                            my.emailSettings.getRecipientAddress());
        my.emailSettings.clearRecipientInfo();
        my.buttonIx = (my.buttonIx + 1) % N_RECIPIENTS;
    };

    // Initialization.
    my.emailSettings.addRecipientListener(my.addRecipient);
    return that;
}
