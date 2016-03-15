"use strict";

// *****************************************************************************

// Setup

// Execute on app launch and window load
chrome.app.runtime.onLaunched.addListener(launch);
window.onload = setup;

/**
 * Executed on chrome app launch. Creates app window.
 */
function launch() {
    const WINDOW_WIDTH = 1000;       // Default window width
    const WINDOW_HEIGHT = 800;       // Default window height
    chrome.app.window.create('window.html', {
        'outerBounds': {
            'width': WINDOW_WIDTH,
            'height': WINDOW_HEIGHT
        }
    });
}

/**
 * Top-level setup function. Creates and initializes program objects.
 */
function setup() {
    // Initialization procedures
    function makeSpec(menuName) {
        return { detector, buffer, slider, menuName };
    }
    function makeLeaf (menuName) {
        return makeLeafMenu(makeSpec(menuName));
    }
    function makeBranch(menuName) {
        return makeBranchMenu(makeSpec(menuName));
    }
    function makeComposeSubmenus() {
        return new Map([["guess",   makeGuessMenu(makeSpec("composeGuess"))],
                        ["1",       makeLeaf("compose1")],
                        ["2",       makeLeaf("compose2")],
                        ["3",       makeLeaf("compose3")],
                        ["4",       makeLeaf("compose4")],
                        ["5",       makeLeaf("compose5")],
                        ["actions", makeLeaf("composeActions")]]);
    }

    // Create utility objects
    let detector = makeDetector();
    let buffer = makeBuffer();
    let clock = makeClock();
    let slider = makeSlider();

    // Create menus
    let main = makeBranch("main");
    let request = makeLeaf("request");
    let email = makeBranch("email");
    let compose = makeBranch("compose");
    let composeSubmenus = makeComposeSubmenus();

    // Add children to menus
    main.setChildren(new Map([["request", request],
                              ["compose", compose],
                              ["email",   email]]));
    compose.setChildren(composeSubmenus);

    // Final actions
    detector.setupTracking();
    detector.setupKeyPress();
    main.slideDown();
}

// *****************************************************************************

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
        let dispatch = new Map([["menuSelector", makeMenuSelectorButton],
                                ["start", makeStartButton],
                                ["request", makeRequestButton],
                                ["letter", makeLetterButton],
                                ["space", makeSpaceButton],
                                ["terminalPunctuation", makeTerminalPunctuationButton],
                                ["nonTerminalPunctuation", makeNonTerminalPunctuationButton],
                                ["bufferAction", makeBufferActionButton],
                                ["return", makeReturnButton],
                                ["guess", makeGuessButton],
                                ["notImplemented", makeNotImplementedButton]]);
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
        if (my.divElem !== undefined) {
            jQuery(my.divElem).slideUp();
        }
    };
    /**
     * Slide this menu's document element down, revealing it.
     * @memberof Menu
     */
    that.slideDown = function() {
        if (my.divElem !== undefined) {
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
        let button = that.getButtons()[buttonIx];
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
        let button = that.getButtons()[buttonIx];
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
        // TODO: It's probably wrong to hard-code the api key. User will have to get
        // his own. Deal with this later.
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
        // TODO: Need to deal with the fact that the wordnik api is accessed via http
        // not https.
        let success = function(data, status) {
            let guesses = (data.searchResults.slice(1).
                           map(function(o) { return o.word; }));
            let padded = pad(guesses, "", N_GUESSES); // Pad with proper number of guesses
            cb(padded);
        };
        // TODO: Figure out how to handle this properly
        let failure = function(data, status) {
            debugger;
        };

        let text = inputText.split(" ").slice(-1)[0].toLowerCase();
        if (text === "") {          // If no text, no guesses.
            cb(repeat("", N_GUESSES));
        }
        my.wordnik(text, success, failure);
    };
    // Update word guesses based on changes to buffer
    my.update = function() {
        let callback = function(guesses) {
            zip(that.getButtons(), guesses).forEach(function([button, guess])
                                                    { button.setValue(guess); });
        };
        let inputText = my.buffer.getText();
        my.guessWord(inputText, callback);
    };

    // Initialization
    my.buffer.addChangeListener(my.update);
    return that;
}

// *****************************************************************************

// Buttons

/**
 * Constructor for generic Button objects.
 * @param {Object} spec - Specification object.
 * @param {Object} spec.elem - Button's document element.
 * @param {Object} spec.detector - Gaze detector object
 * @param {Object} spec.slider - Slider object.
 * @param {Object} spec.menu - The menu of which this button is a part.
 * @param {Object} my - Holds class heirarchy shared secrets.
 * @returns {Object} A Button object.
 */
function makeButton(spec, my) {
    my = my || {};
    /**
     * @namespace Button
     */
    let that = {};

    // Internal constants
    const PRESS_WAIT = 350;          // After button is pressed, wait this many ms before its action

    // Private data
    my.buttonElem = spec.elem;
    my.buttonValue = my.buttonElem.value;
    my.announcementText = my.buttonValue; // By default, announce the button text
    my.detector = spec.detector;
    my.slider = spec.slider;
    my.menu = spec.menu;

    // Public methods
    /**
     Get the document element for the button.
     * @returns {Object} A document object.
     * @memberof Button
     */
    that.getButtonElem = function() {
        return my.buttonElem;
    };
    /**
     Get the value of the button (its text).
     * @returns {String} Button text.
     * @memberof Button
     */
    that.getButtonValue = function() {
        return my.buttonValue;
    };
    /**
     Audio announcement for the button.
     * @memberof Button
     */
    that.announce = function() {
        speak(my.announcementText);
    };
    /**
     Toggle button highlighting.
     * @memberof Button
     */
    that.toggle = function() {
        my.buttonElem.classList.toggle("buttonOn");
        my.buttonElem.classList.toggle("buttonOff");
    };
    /**
     Scan the button. Await user input, and trigger action if input occurs.
     * @memberof Button
     */
    that.scan = function(cbpassed, cbpressed) {
        let onPress = function() {
            // To be executed if the button is pressed
            let afterPress = function() {
                that.announce();
                let afterAnnouncement = function() {
                    that.toggle();
                    that.action(cbpressed);
                };
                setTimeout(afterAnnouncement, my.slider.getms());
            };
            my.detector.removeGazeListener(onPress);
            clearTimeout(timeout);
            setTimeout(afterPress, PRESS_WAIT);
        };
        let onTimeout = function() {
            // To be executed if button is not pressed
            that.toggle();
            my.detector.removeGazeListener(onPress);
            cbpassed();
        };

        // Initialization
        that.toggle();
        that.announce();
        my.detector.addGazeListener(onPress);
        let timeout = setTimeout(onTimeout, my.slider.getms());
    };
    return that;
}

/**
 * Constructor for menu selector buttons. When pressed, these buttons trigger
 * another menu.
 * @param {Object} spec - Specification object, as in makeButton.
 * @param {Object} my - Shared secrets, as in makeButton.
 * @returns{Object} A menuSelectorButton object.
 */
function makeMenuSelectorButton(spec, my) {
    my = my || {};
    /**
     * @namespace menuSelectorButton
     * @augments Button
     */
    let that = makeButton(spec, my);

    // Private data
    my.slide = JSON.parse(my.buttonElem.dataset.slide); // converts to boolean

    // Public methods
    /**
     Invoke the menu pointed to by this button.
     * @param {Function} cbpressed - Callback invoked by called menu when
     * finished scanning.
     * @memberof menuSelectorButton
     */
    that.action = function(cbpressed) {
        let nextMenuName = my.buttonValue.toLowerCase();
        let nextMenu = my.menu.getChildren().get(nextMenuName);
        if (my.slide) {
            my.menu.slideUp();
        }
        nextMenu.scan();
    };

    return that;
}

/**
 * Constructor for start / stop button.
 * @param {Object} spec - Specification object, as in makeButton.
 * @param {Object} my - Shared secrets, as in makeButton.
 * @returns {Object} - A startButton object.
 */
function makeStartButton(spec, my) {
    my = my || {};
    /**
     * @namespace startButton
     * @augments Button
     */
    let that = makeButton(spec, my);

    // Public
    /**
     Kick off the program (called upon gesture detection).
     * @memberof startButton
     */
    that.start = function() {
        my.detector.removeExtendedGazeListener(that.start);
        my.buttonValue = my.announcementText = my.buttonElem.value = "Stop";
        my.menu.scan();
        that.toggle();
    };
    /**
     Stop the program.
     * @memberof startButton
     */
    that.action = function() {
        my.detector.addExtendedGazeListener(that.start);
        my.buttonValue = my.announcementText = my.buttonElem.value = "Start";
        my.buttonElem.value = my.buttonValue;
        that.toggle();
    };

    // Initialize
    that.toggle();
    my.detector.addExtendedGazeListener(that.start);
    return that;
}

/**
 * Constructor for request buttons. When pressed, they issue requests for nurses
 * or assistants.
 * @param {Object} spec - Specification object, as in makeButton.
 * @param {Object} my - Shared secrets, as in makeButton.
 * @returns{Object} A requestButton object.
 */
function makeRequestButton(spec, my) {
    my = my || {};
    /**
     * @namespace requestButton
     * @augments Button
     */
    let that = makeButton(spec, my);

    // internal constants
    const BEEP_DURATION = 1000;      // Length in ms of request beep
    const AFTER_BEEP_WAIT = 500;     // Wait this long after beep before making request
    const MESSAGES = { Cold: "I am cold.",
                       Hot: "I am hot.",
                       Company: "I'd like some company." };

    // Private variables
    my.utterance = null;
    my.message = MESSAGES[my.buttonValue];

    // Public methods
    /**
     Beep to get attention of assistant.
     * @memberof requestButton
     */
    that.beep = function() {
        let context = new window.AudioContext();
        let oscillator = context.createOscillator();
        oscillator.frequency.value = 400;
        oscillator.connect(context.destination);
        oscillator.start();
        setTimeout(function () { oscillator.stop(); }, BEEP_DURATION);
    };
    /**
     Play request audio.
     * @param {Function} cbpressed - Callback invoked after audio finishes.
     * @memberof requestButton
     */
    that.action = function(cbpressed) {
        let afterBeep = function() {
            let afterSpeech = function() {
                setTimeout(cbpressed, my.slider.getms());
            };
            let utterance = speak(my.message);
            utterance.onend = afterSpeech;
            my.buttonElem.utterance = utterance; // Not extraneous, but subtle. See issue 1.
        };
        that.beep();
        setTimeout(afterBeep, BEEP_DURATION + AFTER_BEEP_WAIT);
    };
    return that;
}

/**
 * Constructor for text buttons. When pressed, they write text to the buffer.
 * @param {Object} spec - Specification object, as in makeButton with one
 * addition, below.
 * @param {Object} spec.buffer - A textBuffer object.
 * @param {Object} my - Shared secrets, as in makeButton.
 * @returns{Object} A textButton object.
 */
function makeTextButton(spec, my) {
    my = my || {};
    /**
     * @namespace textButton
     * @augments Button
     */
    let that = makeButton(spec, my);

    // Private data
    my.textCategory = null;     // Set by subclasses
    my.buffer = spec.buffer;
    my.text = my.buttonValue.toLowerCase();

    // Public methods
    /**
     Write text to buffer.
     * @param {Function} cbpressed - Callback to be invoked after buffer write.
     * @memberof textButton
     */
    that.action = function(cbpressed) {
        my.buffer.write(my.text, my.textCategory);
        cbpressed();
    };

    return that;
}

/**
 * Constructor for letter buttons. When pressed, write a single letter to
 * buffer.
 * @param {Object} spec - Specification object, as in makeTextButton.
 * @param {Object} my - Shared secrets, as in makeButton.
 * @returns{Object} A letterButton object.
 */
function makeLetterButton(spec, my) {
    my = my || {};
    /**
     * @namespace letterButton
     * @augments textButton
     */
    let that = makeTextButton(spec, my);

    my.textCategory = "letter";

    return that;
}

/**
 * Constructor for space button. When pressed, write a space to the buffer.
 * @param {Object} spec - Specification object, as in makeTextButton.
 * @param {Object} my - Shared secrets, as in makeButton.
 * @returns{Object} A spaceButton object.
 */
function makeSpaceButton(spec, my) {
    my = my || {};
    /**
     * @namespace spaceButton
     * @augments textButton
     */
    let that = makeTextButton(spec, my);

    my.textCategory = "space";
    my.text = " ";   // Button text is just " "

    return that;
};

/**
 * Constructor for punctuation button. When pressed, write punctuation to
 * buffer.
 * @param {Object} spec - Specification object, as in makeTextButton.
 * @param {Object} my - Shared secrets, as in makeButton.
 * @returns{Object} A spaceButton object.
 */
function makePunctuationButton(spec, my) {
    my = my || {};
    /**
     * @namespace punctuationButton
     * @augments textButton
     */
    let that = makeTextButton(spec, my);

    let m = new Map([[".", "period"],
                     ["?", "question"],
                     ["!", "exclamation"],
                     ["'", "apostrophe"],
                     ['"', "quote"],
                     ["@", "at"]]);
    my.announcementText = m.get(my.buttonValue);

    return that;
}

/**
 * Constructor for non-terminal punctuation button. When pressed, write a
 * punctuation character that doesn't end a sentence.
 * @param {Object} spec - Specification object, as in makeTextButton.
 * @param {Object} my - Shared secrets, as in makeButton.
 * @returns{Object} A spaceButton object.
 */
function makeNonTerminalPunctuationButton(spec, my) {
    my = my || {};
    /**
     * @namespace nonTerminalPunctuationButton
     * @augments punctuationButton
     */
    let that = makePunctuationButton(spec, my);

    my.textCategory = "nonTerminalPunctuation";

    return that;
}

/**
 * Constructor for terminal punctuation button. When pressed, write a
 * punctuation character that ends a sentence.
 * @param {Object} spec - Specification object, as in makeTextButton.
 * @param {Object} my - Shared secrets, as in makeButton.
 * @returns{Object} A spaceButton object.
 */
function makeTerminalPunctuationButton(spec, my) {
    my = my || {};
    /**
     * @namespace terminalPunctuationButton
     * @augments punctuationButton
     */
    let that = makePunctuationButton(spec, my);

    my.textCategory = "terminalPunctuation";

    return that;
}

/**
 * Constructor for buffer action button. When pressed, performs a specific
 * action on the buffer (e.g. reading the buffer text).
 * @param {Object} spec - Specification object, as in makeButton, with one
 * addition.
 * @param {Object} spec.buffer - A textBuffer object.
 * @param {Object} my - Shared secrets, as in makeButton.
 * @returns{Object} A spaceButton object.
 */
function makeBufferActionButton(spec, my) {
    my = my || {};
    /**
     * @namespace bufferActionButton
     * @augments Button
     */
    let that = makeButton(spec, my);

    my.buffer = spec.buffer;
    my.actionName = my.buttonValue.toLowerCase();

    /**
     Perform action specified by button.
     * @param {Function} cbpressed - Callback invoked after action is performed.
     * @memberof bufferActionButton
     */
    that.action = function(cbpressed) {
        my.buffer.executeAction(my.actionName, cbpressed); // Pass the callback along to the buffer method
    };

    return that;
}

// Return to calling menu
// TODO: Replace this with a gesture to do the return
function makeReturnButton(spec, my) {
    my = my || {};
    let that = makeButton(spec, my);

    // Private methods
    my.getReturnMenu = function(menu, depth) {
        if (depth === 0) {
            return menu;
        } else {
            return my.getReturnMenu(menu.parent, depth - 1);
        }
    };

    // Private data
    my.depth = parseInt(my.buttonElem.dataset.returnDepth); // number of levels to return


    // Public methods
    that.action = function(cbpressed) {
        let returnMenu = my.getReturnMenu(my.menu, my.depth);
        let majorMenu = my.getReturnMenu(my.menu, my.depth - 1);
        majorMenu.slideUp();
        returnMenu.scan();
    };
    return that;
}

/**
 * Constructor for word guess buttons. These buttons guess words based on
 * current buffer text. When pressed, they enter the guessed word.
 * @param {Object} spec - Specification object, as in makeButton, with one
 * addition.
 * @param {Object} spec.buffer - A textBuffer object.
 * @param {Object} my - Shared secrets, as in makeButton.
 * @returns{Object} A guessButton object.
 */
function makeGuessButton(spec, my) {
    my = my || {};
    /**
     * @namespace guessButton
     * @augments Button
     */
    let that = makeButton(spec, my);

    // Private data
    my.textCategory = "word";

    // Public methods
    /**
     Get the current value of the button's guess.
     * @returns {String} The guess text.
     * @memberof guessButton
     */
    that.getValue = function() {
        return my.buttonValue;
    };
    /**
     Set the current value of the button's guess.
     * @param {String} value - The guess value.
     * @memberof guessButton
     */
    that.setValue = function(value) {
        // TODO: Too many variables.
        my.buttonValue = my.announcementText = my.buttonElem.value = value;
    };
    /**
     Write the current guess to the buffer
     * @param {Function} cbpressed - Callback to be invoked after buffer write.
     * @memberof guessButton
     */
    that.action = function(cbpressed) {
        my.buffer.write(my.buttonValue, my.textCategory);
    };

    return that;
}

/**
 * Constructor for buttons that are not yet implemented.
 * @param {Object} spec - Specification object, as in makeButton.
 * @param {Object} my - Shared secrets, as in makeButton.
 * @returns{Object} A notImplementedButton object.
 */
function makeNotImplementedButton(spec, my) {
    // Internal constants
    const PAUSE = 500;

    my = my || {};
    /**
     * @namespace notImplementedButton
     * @augments Button
     */
    let that = makeButton(spec, my);

    /**
     * Inform the user that functionality is not implemented.
     * @param {Function} cbpressed - Callback to be invoked after audio plays.
     * @memberof notImplementedButton
     */
    that.action = function(cbpressed) {
        function afterRead() {
            setTimeout(cbpressed, PAUSE);
        }
        let utterance = speak("Not implemented");
        utterance.onend = afterRead;
        my.buttonElem.utternce = utterance;
    };
    return that;
}

// *****************************************************************************

// Constructors for utility objects - blink detector, text buffer, etc.
// Because these objects are not members of hierarchies, they do not need shared
// secrets. Instead of "my", we just have local variables.

/**
 * Constructor for detector objects.
 * @returns {Object} A detector object.
 */
function makeDetector() {
    /**
     * @namespace Detector
     */
    let that = Object.create(EventEmitter.prototype); // Inherit from EventEmitter

    // Constants and magic numbers. Can be changed depending on client needs.
    const ON = Symbol("on");
    const OFF = Symbol("off");
    const GAZE_TIME = 100;      // duration (s) for which gaze must be held
    const EXTENDED_GAZE_TIME = 2000; // duration (s) for extended gaze; triggers reset
    const MIN_N_CHANGED = 10;          // if in "off" state, need 10 consecutive
    const TRACKER_COLOR = "yellow";    // detections to switch to "on", and vice versa

    // Local variables
    let startTime = null;              // start time for most recent upward gaze
    let state = OFF;
    let nChanged = 0;           // # consecutive detections that state has changed

    // Local procedures
    function time() {
        return new Date().getTime();
    }
    // Function to call if there is a detection in the current frame.
    function detection() {
        if (state === OFF) {
            nChanged += 1;
            if (nChanged >= MIN_N_CHANGED) {
                gazeOn();
            }
        } else {
            nChanged = 0;
        }
    }
    // Function to call for no detection.
    function noDetection() {
        if (state === ON) {
            nChanged += 1;
            if (nChanged >= MIN_N_CHANGED) {
                gazeOff();
            }
        } else {
            nChanged = 0;
        }
    }
    // Gaze has changed state from off to on
    function gazeOn() {
        state = ON;
        startTime = time();     // Start the gaze timer.
    }
    // Gaze has changed state from on to off
    function gazeOff() {
        state = OFF;
        let elapsed = time() - startTime; // How long did the user gaze last
        let dispatch = ((elapsed < GAZE_TIME) ? function() { ; } :
                        ((elapsed < EXTENDED_GAZE_TIME) ?
                         emitGaze : emitExtendedGaze));
        dispatch();
        startTime = null;
    }
    // Emit a gaze event for listeners
    function emitGaze() {
        that.emitEvent("gaze");
    }
    // Emit an extended gaze event for listeners
    function emitExtendedGaze() {
        that.emitEvent("extendedGaze");
    }
    // Key presses can be used in place of gazes
    function onKeyPress(event) {
        let dispatch = new Map([[103, emitGaze], // 103 is "g" for gaze
                                [101, emitExtendedGaze]]); // 101 is "e" for extended
        let f = dispatch.get(event.keyCode) || function() { ; };
        f();
    }

    // Public procedures
    /**
     * Add listener for gaze event.
     * @param {Function} listener - The listener.
     * @memberof Detector
     */
    that.addGazeListener = function(listener) {
        that.addListener("gaze", listener); // Can't do with currying b/c scope of "this"
    };
    /**
     * Add listener for extended gaze event.
     * @param {Function} listener - The listener.
     * @memberof Detector
     */
    that.addExtendedGazeListener = function(listener) {
        that.addListener("extendedGaze", listener);
    };
    /**
     * Remove listener for gaze event.
     * @param {Function} listener - The listener.
     * @memberof Detector
     */
    that.removeGazeListener = function(listener) {
        that.removeListener("gaze", listener);
    };
    /**
     * Remove listener extended for gaze event.
     * @param {Function} listener - The listener.
     * @memberof Detector
     */
    that.removeExtendedGazeListener = function(listener) {
        that.removeListener("extendedGaze", listener);
    };
    /**
     * Initialize color tracking.
     * @memberof Detector
     */
    that.setupTracking = function() {
        // TODO: Change from color detection to eye tracking
        let tracker = new tracking.ColorTracker([TRACKER_COLOR]);
        tracker.on("track", function(event) {
            if (event.data.length === 0) { // No colors
                noDetection();
            } else {                      // Colors found
                detection();
            }
        });
        tracking.track("#cam", tracker, {camera: true});
    };
    /**
     * Initialize key press event handling.
     * @memberof Detector
     */
    that.setupKeyPress = function() {
        document.addEventListener("keypress", onKeyPress);
    };

    return that;
}

// Text buffer
function makeBuffer() {
    let that = Object.create(EventEmitter.prototype);

    // Constants
    const CURSOR = "_";          // Cursor character. Could be |, for instance
    const AFTER_BUFFER_READ = 1000;  // After reading the buffer, wait a second before restart

    // Local variables
    let bufferElem = document.getElementById("buffer");
    let textElem = bufferElem.querySelector("p");
    let bufferText = CURSOR;
    let wordStart = true;       // Are we at start of new word?
    let sentenceStart = true;   // Are we at start of new sentence?

    // Elementary buffer operations
    // Update element text to match text stored in JS variable
    function update() {
        textElem.textContent = bufferText;
    }
    // Push to buffer
    function push(char) {
        bufferText += char;
        update();
    }
    // Pop off end of buffer
    function pop() {
        bufferText = bufferText.slice(0, -1);
        update();
    }

    // Higher-level procedures implementing button actions
    // Generic function to write to buffer
    function writeText(text) {
        pop();                  // Get cursor out of the way
        push(text);
        push(CURSOR);           // Add the cursor back
    }
    // For letters, capitalize if at beginning of sentence
    function writeLetter(text) {
        let toWrite = sentenceStart ? text.toUpperCase() : text;
        writeText(toWrite);
        wordStart = false;
        sentenceStart = false;
    }
    // For spaces, write a space and switch wordStart to true
    function writeSpace() {
        writeText(" ");
        wordStart = true;
    }
    function writeWord(text) {
        let toWrite = sentenceStart ? capitalize(text) : text;
        pop();
        writeText(toWrite);
        writeSpace();
    }
    // Just writes the text.
    function writeNonTerminalPunctuation(text) {
        writeText(text);
    }
    function writeTerminalPunctuation(text) {
        writeText(text);
        sentenceStart = true;
        writeSpace();           // Add space to start new word
    }
    function deleteText(cb) {
        pop();                  // Need to pop the cursor and the last letter
        pop();
        push(CURSOR);           // Then add the cursor back
        emitChange();
        cb();
    }
    // Read buffer contents out loud
    function read(cb) {
        function afterRead() {  // Allow a short pause after reading finishes
            setTimeout(cb, AFTER_BUFFER_READ);
        }
        let utterance = speak(that.getText());
        utterance.onend = afterRead;       // Read the utterance, then continue the program
        bufferElem.utterance = utterance; // So the utterance won't go out of scope
    }
    // Clear the buffer.
    function clear(cb) {
        bufferText = CURSOR;;
        update();
        emitChange();
        cb();
    }
    // Fired when buffer changes
    function emitChange() {
        that.emitEvent("bufferChange");
    }

    // Public methods
    // Write to the buffer. Called by buttons. Buffer dispatches on text type.
    that.write = function(text, textCategory) {
        let dispatch = new Map([["letter", writeLetter],
                                ["space", writeSpace],
                                ["word", writeWord],
                                ["nonTerminalPunctuation", writeNonTerminalPunctuation],
                                ["terminalPunctuation", writeTerminalPunctuation]]);
        let writer = dispatch.get(textCategory);
        writer(text);
        emitChange();
    };
    // Perform buffer actions. Dispatched based on action.
    that.executeAction = function(actionName, cbpressed) {
        let dispatch = new Map([["delete", deleteText],
                                ["read", read],
                                ["clear", clear]]);
        let action = dispatch.get(actionName);
        action(cbpressed);
    };
    that.getText = function() {
        return bufferText.slice(0, -1);
    };
    // Add a listener (the guess menu)
    that.addChangeListener = function(listener) {
        that.addListener("bufferChange", listener);
    };
    // Remove listener
    that.removeChangeListener = function(listener) {
        that.removeListener("bufferChange", listener);
    };

    // Initialize and return
    update();
    return that;
}

// Constructor for clock object.
function makeClock() {
    let that = {};

    // Constants
    const INTERVAL = 1000;      // Update each second

    // Local variables
    let clockElem = document.getElementById("clockContainer");
    let textElem = clockElem.querySelector("p");
    let iv;                     // Handle for the interval

    // Internal procedures
    function tick() {           // Clock ticks every second once started.
        let m = moment(new Date());
        textElem.textContent = m.format("dddd, h:mm:ss a");
    }

    // Public methods
    that.start = function() {
        iv = setInterval(tick, INTERVAL);
    };
    that.stop = function() {
        clearInterval(iv);
    };
    // Start the clock and return the method.
    that.start();
    return that;
}

// constructor for slider object
function makeSlider() {
    let that = {};

    // Constants
    const VMIN = 0;
    const VMAX = 3;
    const V0 = 1;               // Initial slider setting
    const SCALE = 10;

    // Internal variables
    let sliderValue = V0;
    let containerElem = document.getElementById("sliderContainer");
    let sliderElem = containerElem.querySelector("#slider");
    let valueElem = containerElem.querySelector("#sliderValue");
    let s = jQuery(sliderElem).slider({ min: VMIN * SCALE,
                                        max: VMAX * SCALE,
                                        value: sliderValue * SCALE,
                                        slide: updateValue,
                                        change: updateValue });

    // Internal procedures
    function updateValue() {
        let v = s.slider("value");
        sliderValue = parseFloat(v) / SCALE;
        let stringValue = sliderValue.toString();
        valueElem.textContent = `${stringValue} s`;
    }

    // Public methods.
    that.getms = function() {
        return sliderValue * 1000;
    };

    // Initialize and return.
    updateValue();
    return that;
}

// *****************************************************************************

// Helper procedures

// Speak text out loud
function speak(text) {
    const LANG = "en-US";            // Dialect for speech synthesis
    let utterance = new window.SpeechSynthesisUtterance(text);
    utterance.lang = LANG;
    window.speechSynthesis.speak(utterance);
    return utterance;
}
function notImplemented () {
    throw new Error("Not implemented.");
}
function curry(func, ...first) {
    return function(...second) {
        return func(...first, ...second);
    };
}
// Return an array consisting of element x repeated n times.
function repeat(x, n) {
    let xs = new Array(n);
    xs.fill(x);
    return xs;
}
// Pad (on right) array xs with value fill, such that the returned array has
// length "len"
function pad(xs, fillVal, len) {
    if (xs.length >= len) {
        return xs.slice(0, len);
    }
    let nMissing = len - xs.length;
    let padding = repeat(fillVal, nMissing);
    return xs.concat(padding);
}
// Convert first letter of word to uppercase
function capitalize(text) {
    return text[0].toUpperCase() + text.slice(1);
}
// Zip two arrays. If unequal lengths, truncate the longer.
function zip(xs, ys) {
    if (xs.length === 0 || ys.length === 0) {
        return [];
    } else {
        return Array.prototype.concat([[xs[0], ys[0]]],
                                      zip(xs.slice(1), ys.slice(1)));
    }
}
