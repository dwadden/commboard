"use strict";

// TODO: If she keeps her eyes up long enough, stop the program and return to
// the main menu. Equivalent to triggering the reset button.


// Global variables
const LANG = "en-US";            // Dialect for speech synthesis
const LEAF_LOOPS = 2;            // # loops through leaf menu before jumping to parent
const PRESS_WAIT = 350;     // After button is pressed, wait this many ms before its action
const BEEP_DURATION = 1000;  // Length in ms of request beep
const AFTER_BEEP_WAIT = 500; // Wait this long after beep before making request
const AFTER_BUFFER_READ = 1000; // After reading the buffer, wait a second before restart

window.onload = setup;

// Top-level function to set up the menus and return main menu
function setup() {
    // Generate utility objects
    const detector = makeDetector();
    detector.setupTracking();
    const buffer = makeBuffer();
    const clock = makeClock();
    const slider = makeSlider();

    function makeSpec(menuName) {
        return { detector, buffer, slider, menuName };
    }
    function makeLeaf(menuName) {
        return makeLeafMenu(makeSpec(menuName));
    }
    function makeBranch(menuName) {
        return makeBranchMenu(makeSpec(menuName));
    }

    // submenus representing the rows of the compose menu
    function makeComposeSubmenus() {
        return new Map([["guess",   makeLeaf("composeGuess")],
                        ["1",       makeLeaf("compose1")],
                        ["2",       makeLeaf("compose2")],
                        ["3",       makeLeaf("compose3")],
                        ["4",       makeLeaf("compose4")],
                        ["5",       makeLeaf("compose5")],
                        ["actions", makeLeaf("composeActions")]]);
    }

    // Create menus
    const main = makeBranch("main");
    main.slideDown();
    const request = makeLeaf("request");
    const email = makeBranch("email");
    const compose = makeBranch("compose");
    const composeSubmenus = makeComposeSubmenus();

    // Add children
    main.addChildren(new Map([["request", request],
                              ["compose", compose],
                              ["email",   email]]));
    compose.addChildren(composeSubmenus);
}

// The spec is an object with four fields:
// detector: the detector object
// slider: the slider object
// buffer: the buffer object. Left unused by many buttons.
// menuId: the id of the DOM element corresponding to the menu
function makeMenu(spec, my) {
    my = my || {};
    let that = {};
    my.detector = spec.detector;
    my.slider = spec.slider;
    my.buffer = spec.buffer;
    let query = `input[type=button][data-menu="${spec.menuName}"]`;
    my.divElem = document.querySelector(`div#${spec.menuName}`);
    my.buttonElems = document.querySelectorAll(query);
    that.buttons = initButtons();
    that.nButtons = that.buttons.length;

    // The input is an object containing the menus that are children of this
    // menu
    that.addChildren = function(children) {
        that.children = children;
        function addParent(child) {
            child.parent = that;
        }
        children.forEach(addParent);
    };

    function initButtons() {
        function mapped(buttonElem) {
            return { elem: buttonElem,
                     menu: that,
                     detector: my.detector,
                     slider: my.slider,
                     buffer: my.buffer
                   };
        }
        let specs = Array.prototype.map.call(my.buttonElems, mapped);
        return specs.map(initButton);
    }

    function initButton(spec) {
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
    }

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

    that.slideUp();

    function nextButton(ix) {
        return (ix + 1) % that.nButtons;
    }
    my.nextButton = nextButton;

    function isLastButton(buttonIx) {
        return buttonIx === that.nButtons - 1;
    }
    my.isLastButton = isLastButton;

    that.scan = function() {
        that.slideDown();
        my.scanAt(0, 0);
    };

    return that;
}

// The spec is an object
function makeBranchMenu(spec, my) {
    my = my || {};
    let that = makeMenu(spec, my);

    my.scanAt = function(buttonIx) {
        let cbpassed = function() { my.scanAt(my.nextButton(buttonIx)); };
        let cbpressed = that.scan;
        let button = that.buttons[buttonIx];
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
        function cbpressed() {
            that.slideUp();
            that.parent.scan();
        }
        let cbpassed = (my.isLastButton(buttonIx) && my.isLastLoop(loopIx) ?
                        cbpressed :
                        function() { my.scanAt(my.nextButton(buttonIx),
                                               my.nextLoop(buttonIx, loopIx)); });
        let button = that.buttons[buttonIx];
        button.scan(cbpassed, cbpressed);
    };

    return that;
}

function makeButton(spec, my) {
    my = my || {};
    my.buttonElem = spec.elem;
    my.buttonValue = my.buttonElem.value;
    my.announcementText = my.buttonValue; // By default, announce the button text
    my.detector = spec.detector;
    my.slider = spec.slider;
    my.menu = spec.menu;
    my.timeout = null;

    let that = {};

    function announce() {
        speak(my.announcementText);
    }

    that.toggle = function() {
        my.buttonElem.classList.toggle("buttonOn");
        my.buttonElem.classList.toggle("buttonOff");
    };

    // abstract
    that.action = function(cbpressed) {
        ;
    };

    // Here's the difference. If it's not a menu button, nextPressed is invoked
    // immediately. If it is a menu button, then nextPressed is passed into the
    // next menu.

    that.scan = function(cbpassed, cbpressed) {
        that.toggle();
        announce();
        my.detector.addGazeListener(onPress);
        let timeout = setTimeout(onTimeout, my.slider.getms());

        function onPress() {
            // To be executed if the button is pressed
            function afterPress() {
                announce();
                function afterAnnouncement() {
                    that.toggle();
                    that.action(cbpressed);
                }
                setTimeout(afterAnnouncement, my.slider.getms());
            }
            my.detector.removeGazeListener(onPress);
            clearTimeout(timeout);
            setTimeout(afterPress, PRESS_WAIT);
        }
        function onTimeout() {
            // To be executed if button is not pressed
            that.toggle();
            my.detector.removeGazeListener(onPress);
            cbpassed();
        }
    };
    return that;
}

function makeMenuSelectorButton(spec, my) {
    my = my || {};
    let that = makeButton(spec, my);
    my.slide = JSON.parse(my.buttonElem.dataset.slide); // converts to boolean

    that.action = function(cbpressed) {
        let nextMenuName = my.buttonValue.toLowerCase();
        let nextMenu = my.menu.children.get(nextMenuName);
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

    that.toggle();
    my.detector.addExtendedGazeListener(start);

    // Kick off the process
    function start() {
        my.detector.removeExtendedGazeListener(start);
        my.buttonValue = my.announcementText = my.buttonElem.value = "Stop";
        my.menu.scan();
        that.toggle();
    }

    that.action = function(cbpressed) {
        my.detector.addExtendedGazeListener(start);
        my.buttonValue = my.announcementText = my.buttonElem.value = "Start";
        my.buttonElem.value = my.buttonValue;
        that.toggle();
    };
    return that;
}

function makeRequestButton(spec, my) {
    my = my || {};
    my.utterance = null;
    let that = makeButton(spec, my);

    let messages = { Cold: "I am cold.",
                     Hot: "I am hot.",
                     Company: "I'd like some company." };
    let message = messages[my.buttonValue];

    function beep() {
        var context = new window.AudioContext();
        var oscillator = context.createOscillator();
        oscillator.frequency.value = 400;
        oscillator.connect(context.destination);
        oscillator.start();
        setTimeout(function () { oscillator.stop(); }, BEEP_DURATION);
    }

    that.action = function(cbpressed) {
        function afterBeep() {
            function afterSpeech() {
                setTimeout(cbpressed, my.slider.getms());
            }
            let utterance = speak(message);
            utterance.onend = afterSpeech;
            my.buttonElem.utterance = utterance; // Not extraneous, but subtle. See issue 1.
        }
        beep();
        setTimeout(afterBeep, BEEP_DURATION + AFTER_BEEP_WAIT);
    };
    return that;
}

function makeTextButton(spec, my) {
    my = my || {};
    let that = makeButton(spec, my);
    my.textCategory = null;     // Set by subclasses
    my.buffer = spec.buffer;
    my.text = my.buttonValue.toLowerCase();
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

// This is just a text button, but with the value of the button changed
// appropriately.
function makeSpaceButton(spec, my) {
    my = my || {};
    let that = makeTextButton(spec, my);
    my.textCategory = "space";
    my.text = " ";   // Button text is just " "
    return that;
}

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

    let dispatch = new Map([["Delete", "pop"],
                            ["Read", "read"],
                            ["Clear", "clear"]]);
    that.action = function(cbpressed) {
        let methodName = dispatch.get(my.buttonValue);
        my.buffer[methodName](cbpressed); // Pass the callback along to the buffer method
    };
    return that;
}

// Return to calling menu
function makeReturnButton(spec, my) {
    my = my || {};
    let that = makeButton(spec, my);
    my.depth = parseInt(my.buttonElem.dataset.returnDepth); // number of levels to return

    // Ignore the callback and return to calling menu
    function getReturnMenu(menu, depth) {
        if (depth === 0) {
            return menu;
        } else {
            return getReturnMenu(menu.parent, depth - 1);
        }
    }

    that.action = function(cbpressed) {
        let returnMenu = getReturnMenu(my.menu, my.depth);
        let majorMenu = getReturnMenu(my.menu, my.depth - 1);
        majorMenu.slideUp();
        returnMenu.scan();
    };
    return that;
}

// Word guesses
function makeGuessButton(spec, my) {
    my = my || {};
    let that = makeButton(spec, my);
    return that;
}

function makeNotImplementedButton(spec, my) {
    const PAUSE = 500;
    my = my || {};
    let that = makeButton(spec, my);

    // Inform the user that the button isn't yet implemented
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

// Constructor for detector object. Inherits from EventEmitter.
function makeDetector() {
    let that = Object.create(EventEmitter.prototype); // Inherit from EventEmitter

    // Constants and magic numbers. Can be changed depending on client needs.
    const ON = Symbol("on");
    const OFF = Symbol("off");
    const GAZE_TIME = 100;      // duration (s) for which gaze must be held
    const EXTENDED_GAZE_TIME = 2000; // duration (s) for extended gaze; triggers reset
    const MIN_N_CHANGED = 10;          // if in "off" state, need 10 consecutive
    const TRACKER_COLOR = "yellow";    // detections to switch to "on", and vice versa
    // Function-level variables
    let startTime = null;              // start time for most recent upward gaze
    let state = OFF;
    let nChanged = 0;           // # consecutive detections that state has changed

    function time() { return new Date().getTime(); }

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
    } // Emit extended gaze event

    // Setup up tracking.
    // TODO: Ideally, this is the only function that will need to change when we
    // switch from color tracking to eye tracking.
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

    // Methods to add and remove listeners for relevant events.
    // These should not be removed.
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

    // TODO: These methods are only make visible for development. Remove them
    // when I've got things working.
    that.emitGaze = emitGaze;
    that.emitExtendedGaze = emitExtendedGaze;

    // TODO: This stuff is just for debugging. Remove it.
    document.addEventListener("keypress", dispatchKeypress);
    function dispatchKeypress(event) {
        let dispatch = new Map([[103, emitGaze], // 103 is "g" for gaze
                                [101, emitExtendedGaze]]); // 101 is "e" for extended
        let f = dispatch.get(event.keyCode) || function() { ; };
        f();
    }

    return that;
}

// Constructor for buffer object.
function makeBuffer() {
    const CURSOR = "_";          // Cursor character. Could be |, for instance
    let bufferElem = document.getElementById("buffer");
    let textElem = bufferElem.querySelector("p");
    let bufferText = "";
    // Booleans to indicate whether we are at the start of a new word and new sentence
    let wordStart = true;       // If true, guess full words
    let sentenceStart = true;   // If true, capitalize the next letter.
    // Update element text to match text stored in JS variable
    function update() {
        textElem.textContent = bufferText;
    };
    // Write text to buffer. Dispatch based on text category.
    function write(text, textCategory) {
        let dispatch = new Map([["letter", writeLetter],
                                ["space", writeSpace],
                                ["nonTerminalPunctuation", writeNonTerminalPunctuation],
                                ["terminalPunctuation", writeTerminalPunctuation]]);
        let writer = dispatch.get(textCategory);
        writer(text);
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

    // Just writes the text.
    function writeNonTerminalPunctuation(text) {
        writeText(text);
    }

    function writeTerminalPunctuation(text) {
        writeText(text);
        sentenceStart = true;
        writeSpace();           // Add space to start new word
    }

    // Push to buffer
    function push(char) {
        bufferText += char;
        update();
    }
    // Pop off end of buffer
    // TODO: Right now, pop may be invoked with a callback or without. This
    // isn't really correct. Probably pop should be private, and things that
    // call it (like delete) should do so through an exposed method that handles
    // the callback. For later.
    function pop(cb) {
        bufferText = bufferText.slice(0, -1);
        update();
        if (cb !== undefined) {
            cb();
        }
    }
    // Read buffer contents out loud
    function read(cb) {
        function afterRead() {  // Allow a short pause after reading finishes
            setTimeout(cb, AFTER_BUFFER_READ);
        }
        let utterance = speak(bufferText);
        utterance.onend = afterRead;       // Read the utterance, then continue the program
        bufferElem.utterance = utterance; // So the utterance won't go out of scope
    }
    // Clear the buffer.
    function clear(cb) {
        bufferText = "";
        update();
        cb();
    }
    // retrieve guesses for next word
    function guess() {

    }
    return { push, pop, write, read, clear };
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
