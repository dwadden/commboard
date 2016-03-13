"use strict";

// Global variables
const LANG = "en-US";            // Dialect for speech synthesis
const LEAF_LOOPS = 2;            // # loops through leaf menu before jumping to parent
const PRESS_WAIT = 350;          // After button is pressed, wait this many ms before its action
const BEEP_DURATION = 1000;      // Length in ms of request beep
const AFTER_BEEP_WAIT = 500;     // Wait this long after beep before making request
const AFTER_BUFFER_READ = 1000;  // After reading the buffer, wait a second before restart

// *****************************************************************************

// Setup, to be invoked on page load
window.onload = setup;

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

// The spec is an object with four fields:
// detector: the detector object
// slider: the slider object
// buffer: the buffer object. Left unused by many buttons.
// menuId: the id of the DOM element corresponding to the menu
function makeMenu(spec, my) {
    // Private and public objects
    my = my || {};
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
    // The input is an object containing the menus that are children of this
    // menu
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
    // Slide menus up and down. Only do this for menus with a div element
    // associated with them. Those are the "major" menus.
    // TODO: Is there a cleaner way to do this?
    that.slideUp = function() {
        if (my.divElem !== undefined) {
            jQuery(my.divElem).slideUp();
        }
    };
    that.slideDown = function() {
        if (my.divElem !== undefined) {
            jQuery(my.divElem).slideDown();
        }
    };
    that.scan = function() {
        that.slideDown();
        my.scanAt(0, 0);
    };
    that.getButtons = function() {
        return my.buttons;
    };
    that.getNButtons = function() {
        return my.nButtons;
    };
    // Initialize and return
    that.slideUp();
    return that;
}

function makeBranchMenu(spec, my) {
    my = my || {};
    let that = makeMenu(spec, my);

    my.scanAt = function(buttonIx) {
        let cbpassed = function() { my.scanAt(my.nextButton(buttonIx)); };
        let cbpressed = that.scan;
        let button = that.getButtons()[buttonIx];
        button.scan(cbpassed, cbpressed);
    };

    return that;
}

function makeLeafMenu(spec, my) {
    my = my || {};
    let that = makeMenu(spec, my);

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

// The guess menu is like a leaf menu, but also listens to buffer updates and
// updates its buttons accordingly
function makeGuessMenu(spec, my) {
    my = my || {};
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

function makeButton(spec, my) {
    my = my || {};
    let that = {};

    // Private data
    my.buttonElem = spec.elem;
    my.buttonValue = my.buttonElem.value;
    my.announcementText = my.buttonValue; // By default, announce the button text
    my.detector = spec.detector;
    my.slider = spec.slider;
    my.menu = spec.menu;

    // Public methods
    that.getButtonElem = function() {
        return my.buttonElem;
    };
    that.getButtonValue = function() {
        return my.buttonValue;
    };
    that.announce = function() {
        speak(my.announcementText);
    };
    that.toggle = function() {
        my.buttonElem.classList.toggle("buttonOn");
        my.buttonElem.classList.toggle("buttonOff");
    };
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

        that.toggle();
        that.announce();
        my.detector.addGazeListener(onPress);
        let timeout = setTimeout(onTimeout, my.slider.getms());
    };
    return that;
}

function makeMenuSelectorButton(spec, my) {
    my = my || {};
    let that = makeButton(spec, my);

    // Private data
    my.slide = JSON.parse(my.buttonElem.dataset.slide); // converts to boolean

    // Public methods
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

function makeStartButton(spec, my) {
    my = my || {};
    let that = makeButton(spec, my);

    // Public
    that.start = function() {
        my.detector.removeExtendedGazeListener(that.start);
        my.buttonValue = my.announcementText = my.buttonElem.value = "Stop";
        my.menu.scan();
        that.toggle();
    };
    that.action = function(cbpressed) {
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

function makeRequestButton(spec, my) {
    my = my || {};
    let that = makeButton(spec, my);

    // internal constants
    const MESSAGES = { Cold: "I am cold.",
                       Hot: "I am hot.",
                       Company: "I'd like some company." };

    // Private variables
    my.utterance = null;
    my.message = MESSAGES[my.buttonValue];

    // Public methods
    that.beep = function() {
        let context = new window.AudioContext();
        let oscillator = context.createOscillator();
        oscillator.frequency.value = 400;
        oscillator.connect(context.destination);
        oscillator.start();
        setTimeout(function () { oscillator.stop(); }, BEEP_DURATION);
    };
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

function makeTextButton(spec, my) {
    my = my || {};
    let that = makeButton(spec, my);

    // Private data
    my.textCategory = null;     // Set by subclasses
    my.buffer = spec.buffer;
    my.text = my.buttonValue.toLowerCase();

    // Public methods
    that.action = function(cbpressed) {
        my.buffer.write(my.text, my.textCategory);
        cbpressed();
    };

    return that;
}

function makeLetterButton(spec, my) {
    my = my || {};
    let that = makeTextButton(spec, my);

    my.textCategory = "letter";

    return that;
}

function makeSpaceButton(spec, my) {
    my = my || {};
    let that = makeTextButton(spec, my);

    my.textCategory = "space";
    my.text = " ";   // Button text is just " "

    return that;
};

function makePunctuationButton(spec, my) {
    my = my || {};
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

function makeNonTerminalPunctuationButton(spec, my) {
    my = my || {};
    let that = makePunctuationButton(spec, my);

    my.textCategory = "nonTerminalPunctuation";

    return that;
}

// A puncutation button that signals the end of a setnence
function makeTerminalPunctuationButton(spec, my) {
    my = my || {};
    let that = makePunctuationButton(spec, my);

    my.textCategory = "terminalPunctuation";

    return that;
}

// Actions on the buffer
function makeBufferActionButton(spec, my) {
    my = my || {};
    let that = makeButton(spec, my);

    my.buffer = spec.buffer;
    my.actionName = my.buttonValue.toLowerCase();

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

// Word guesses
function makeGuessButton(spec, my) {
    my = my || {};
    let that = makeButton(spec, my);

    // Private data
    my.textCategory = "word";

    // Public methods
    that.getValue = function() {
        return my.buttonValue;
    };
    that.setValue = function(value) {
        // TODO: Too many variables.
        my.buttonValue = my.announcementText = my.buttonElem.value = value;
    };
    that.action = function(cbpressed) {
        my.buffer.write(my.buttonValue, my.textCategory);
    };

    return that;
}

function makeNotImplementedButton(spec, my) {
    // Internal constants
    const PAUSE = 500;

    my = my || {};
    let that = makeButton(spec, my);

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

function makeDetector() {
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
    that.addGazeListener = function(listener) {
        that.addListener("gaze", listener); // Can't do with currying b/c scope of "this"
    };
    that.addExtendedGazeListener = function(listener) {
        that.addListener("extendedGaze", listener);
    };
    that.removeGazeListener = function(listener) {
        that.removeListener("gaze", listener);
    };
    that.removeExtendedGazeListener = function(listener) {
        that.removeListener("extendedGaze", listener);
    };
    // TODO: Change from color detection to eye tracking
    that.setupTracking = function() {
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
    // Functionality to listen for key presses
    that.setupKeyPress = function() {
        document.addEventListener("keypress", onKeyPress);
    };

    return that;
}

// Constructor for buffer object.
function makeBuffer() {
    let that = Object.create(EventEmitter.prototype); // Emit events detected by word guesser
    const CURSOR = "_";          // Cursor character. Could be |, for instance
    let bufferElem = document.getElementById("buffer");
    let textElem = bufferElem.querySelector("p");
    let bufferText = CURSOR;
    // Booleans to indicate whether we are at the start of a new word and new sentence
    let wordStart = true;       // If true, guess full words
    let sentenceStart = true;   // If true, capitalize the next letter.

    // To actually get the text, don't return the cursor at the end
    function getText() {
        return bufferText.slice(0, -1);
    }
    // Update element text to match text stored in JS variable
    function update() {
        textElem.textContent = bufferText;
    };
    // Write text to buffer. Dispatch based on text category.
    function write(text, textCategory) {
        let dispatch = new Map([["letter", writeLetter],
                                ["space", writeSpace],
                                ["word", writeWord],
                                ["nonTerminalPunctuation", writeNonTerminalPunctuation],
                                ["terminalPunctuation", writeTerminalPunctuation]]);
        let writer = dispatch.get(textCategory);
        writer(text);
        that.emitChange();
    }
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

    function executeAction(actionName, cbpressed) {
        let dispatch = new Map([["delete", deleteText],
                                ["read", read],
                                ["clear", clear]]);
        let action = dispatch.get(actionName);
        action(cbpressed);
    }

    function deleteText(cb) {
        pop();                  // Need to pop the cursor and the last letter
        pop();
        push(CURSOR);           // Then add the cursor back
        that.emitChange();
        cb();
    }

    // Read buffer contents out loud
    function read(cb) {
        function afterRead() {  // Allow a short pause after reading finishes
            setTimeout(cb, AFTER_BUFFER_READ);
        }
        let utterance = speak(getText());
        utterance.onend = afterRead;       // Read the utterance, then continue the program
        bufferElem.utterance = utterance; // So the utterance won't go out of scope
    }

    // Clear the buffer.
    function clear(cb) {
        bufferText = CURSOR;;
        update();
        that.emitChange();
        cb();
    }

    // Push to buffer
    function push(char) {
        bufferText += char;
        update();
    }
    // Pop off end of buffer
    function pop(cb) {
        bufferText = bufferText.slice(0, -1);
        update();
    }

    // To be fired when buffer changes
    that.emitChange = function() {
        that.emitEvent("bufferChange");
    };

    // Add a listener (the guess menu)
    that.addChangeListener = function(listener) {
        that.addListener("bufferChange", listener);
    };

    // Remove listener
    that.removeChangeListener = function(listener) {
        that.removeListener("bufferChange", listener);
    };
    that.write = write;
    that.executeAction = executeAction;
    that.getText = getText;

    update();                   // Display cursor in DOM
    return that;
}

// Constructor for clock object.
function makeClock() {
    const INTERVAL = 1000;      // Update each second
    let clockElem = document.getElementById("clockContainer");
    let textElem = clockElem.querySelector("p");
    let iv;                     // Handle for the interval
    function tick() {           // Clock ticks every second once started.
        let m = moment(new Date());
        textElem.textContent = m.format("dddd, h:mm:ss a");
    }
    function start() {
        iv = setInterval(tick, INTERVAL);
    }
    function stop() {
        clearInterval(iv);
    }
    // Start the clock and return the method.
    start();
    return { start, stop };
}

// constructor for slider object
function makeSlider() {
    // Magic numbers that may be adjusted as desired.
    const VMIN = 0;
    const VMAX = 3;
    const V0 = 1;               // Initial value
    const SCALE = 10;
    // Initial slider value
    let sliderValue = V0;
    // Document elements
    let containerElem = document.getElementById("sliderContainer");
    let sliderElem = containerElem.querySelector("#slider");
    let valueElem = containerElem.querySelector("#sliderValue");
    let s = jQuery(sliderElem).slider({ min: VMIN * SCALE,
                                        max: VMAX * SCALE,
                                        value: sliderValue * SCALE,
                                        slide: updateValue,
                                        change: updateValue });
    // Methods
    function updateValue() {
        let v = s.slider("value");
        sliderValue = parseFloat(v) / SCALE;
        let stringValue = sliderValue.toString();
        valueElem.textContent = `${stringValue} s`;
    }

    // The slider time in milliseconds
    function getms() {
        return sliderValue * 1000;
    }
    // Initialize and return. Clients can retrieve the value of the slider.
    updateValue();
    return { getms };
}

// Constructor for reset button
function makeResetButton() {
    notImplemented();
}

// Procedure to speak text out loud
function speak(text) {
    let utterance = new window.SpeechSynthesisUtterance(text);
    utterance.lang = LANG;
    window.speechSynthesis.speak(utterance);
    return utterance;
}

function notImplemented () {
    throw new Error("Not implemented.");
}

// Helper functions
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
