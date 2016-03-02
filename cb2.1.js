"use strict";

// TODO: If she keeps her eyes up long enough, stop the program and return to
// the main menu. Equivalent to triggering the reset button.


// Global variables
const LANG = "en-US";            // Dialect for speech synthesis
const LEAF_LOOPS = 2;            // # loops through leaf menu before jumping to parent
const PRESS_WAIT = 350;     // After button is pressed, wait this many ms before its action

// const menus = { main: makeMainMenu() };

function makeMenu(spec, my) {
    my = my || {};
    let that = {};
    my.parent = spec.parent;    // The parent menu of this menu
    my.detector = spec.detector;
    my.slider = spec.slider;
    my.menuElem = document.getElementById(spec.menuId);
    my.menuRow = my.menuElem.querySelector("tr");
    my.buttonElems = my.menuRow.querySelectorAll("input[type=button]");
    my.buttons = initButtons();
    my.nButtons = my.buttons.length;

    function initButtons() {
        function mapped(buttonElem) {
            return { elem: buttonElem,
                     menu: that,
                     detector: my.detector,
                     slider: my.slider
                   };
        }
        let specs = Array.prototype.map.call(my.buttonElems, mapped);
        return specs.map(initButton);
    }

    function initButton(spec) {
        // let dispatch = { bufferAction: makeBufferActionButton,
        //                  guess: makeGuessButton,
        //                  menuAction: makeMenuActionButton,
        //                  reqest: makeRequestButton,
        //                  return: makeReturnButton,
        //                  menuSelector: makeMenuSelectorButton,
        //                  text: makeTextButton,
        //                  textAlias: makeTextAliasButton
        //                };
        let dispatch = { menuSelector: makeMenuSelectorButton,
                         start: makeStartButton };
        let maker = dispatch[spec.elem.dataset.buttonType];
        return maker(spec);
    }

    function toggle() {
        ;
    }

    function nextButton(ix) {
        return (ix + 1) % my.nButtons;
    }
    my.nextButton = nextButton;

    function isLastButton(buttonIx) {
        return buttonIx === my.nButtons - 1;
    }

    return that;
}

function makeBranchMenu(spec, my) {
    my = my || {};
    let that = makeMenu(spec, my);

    function scanAt(buttonIx) {
        let cbpassed = function() { scanAt(my.nextButton(buttonIx)); };
        let cbpressed = that.scan;
        let button = my.buttons[buttonIx];
        button.scan(cbpassed, cbpressed);
    }

    that.scan = function() {
        scanAt(0);
    };

    return that;
}

function makeLeafMenu(spec, my) {
    my = my || {};
    my.loopIx = 0;
    let that = makeMenu(spec, my);

    my.isLastLoop = function(loopIx) {
        return loopIx === LEAF_LOOPS - 1;
    };

    my.nextLoop = function(buttonIx, loopIx) {
        return my.isLastButton(buttonIx) ? loopIx + 1 : loopIx;
    };

    function scanAt(buttonIx, loopIx) {
        let cbpressed = my.parent.scan;
        let cbpassed = (my.isLastButton(buttonIx) && my.isLastLoop(loopIx) ?
                        cbpressed :
                        function() { scanAt(my.nextButton(buttonIx),
                                            my.nextLoop(buttonIx, loopIx)); });
        let button = my.buttons[buttonIx];
        button.scan(cbpassed, cbpressed);
    };

    that.scan = function() {
        scanAt(0, 0);
    };
    return that;

}

// The spec for this guy is just the detector and the slider
function makeMainMenu(spec) {
    let my = {};
    spec.menuId = "main";
    let that = makeBranchMenu(spec, my);
    return that;
}

function makeButton(spec, my) {
    my = my || {};
    my.buttonElem = spec.elem;
    my.buttonValue = my.buttonElem.value;
    my.detector = spec.detector;
    my.slider = spec.slider;
    my.menu = spec.menu;
    my.timeout = null;

    function announce() {
        speak(my.buttonValue);
    }

    function toggle() {
        my.buttonElem.classList.toggle("buttonOn");
        my.buttonElem.classList.toggle("buttonOff");
    }

    // abstract
    my.action = function(cbpressed) {
        ;
    };

    // Here's the difference. If it's not a menu button, nextPressed is invoked
    // immediately. If it is a menu button, then nextPressed is passed into the
    // next menu.

    function scan(cbpassed, cbpressed) {
        toggle();
        announce();
        my.detector.addGazeListener(onPress);
        let timeout = setTimeout(onTimeout, my.slider.getms());

        function onPress() {
            // To be executed if the button is pressed
            function afterPress() {
                announce();
                function afterAnnouncement() {
                    toggle();
                    my.action(cbpressed);
                }
                setTimeout(afterAnnouncement, my.slider.getms());
            }
            my.detector.removeGazeListener(onPress);
            clearTimeout(timeout);
            setTimeout(afterPress, PRESS_WAIT);
        }
        function onTimeout() {
            // To be executed if button is not pressed
            toggle();
            my.detector.removeGazeListener(onPress);
            cbpassed();
        }
    }
    return { scan };
}

function makeMenuSelectorButton(spec, my) {
    my = my || {};
    let that = makeButton(spec, my);

    my.action = function(cbpressed) {
        console.log("Menu selector button pressed");
        cbpressed();
    };
    return that;
}

function makeStartButton(spec, my) {
    my = my || {};
    let that = makeButton(spec, my);

    my.action = function(cbpressed) {
        console.log("Start button pressed");
        cbpressed();
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
    function setupTracking() {
        let tracker = new tracking.ColorTracker([TRACKER_COLOR]);
        tracker.on("track", function(event) {
            if (event.data.length === 0) { // No colors
                noDetection();
            } else {                      // Colors found
                detection();
            }
        });
        tracking.track("#cam", tracker, {camera: true});
    }

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

    // Start camera and return event emitter
    setupTracking();
    return that;
}

// Constructor for buffer object.
function makeBuffer() {
    let bufferElem = document.getElementById("buffer");
    let textElem = bufferElem.querySelector("p");
    let bufferText = "";
    // Update element text to match text stored in JS variable
    function update() {
        textElem.textContent = bufferText;
    };
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
    // Read buffer contents out loud
    function read() {
        speak(bufferText);
    }
    // Clear the buffer.
    function clear() {
        bufferText = "";
        update();
    }
    return { push, pop, read, clear };
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
    const SCALE = 10;
    // Initial slider value
    let sliderValue = VMIN + VMAX / 2;
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
