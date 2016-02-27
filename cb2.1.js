"use strict";

// TODO: If she keeps her eyes up long enough, stop the program and return to
// the main menu. Equivalent to triggering the reset button.



function makeMenu(spec) {
    let buttons = makeButtons();

    function scan() {
        for (let button of buttons) {
            // do stuff
        }
    }

}

function makeButton() {

    function say() {
        ;
    }

    function toggle() {
        ;
    }

    function action() {
        ;
    }

}

// Temporary function so I'll see what the color tracker looks like on screen

// Constructor for detector object. Inherits from EventEmitter.
function detector() {
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

    // Start camera and return event emitter
    setupTracking();
    return that;
}

function buffer() {
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

// Procedure to speak text out loud
function speak(text) {
    let utterance = new window.SpeechSynthesisUtterance(text);
    utterance.lang = LANG;
    window.speechSynthesis.speak(utterance);
}

function notImplemented () {
    throw new Error("Not implemented.");
}

// Temporary function so I'll see what the slider looks like
function makeSlider() {
    let sliderElem = $("#slider");
    let sliderValue = $("#sliderValue");
    // function stop(event) {
    //     $("#slider-value")[0].innerText = $(this).slider("value");
    // }
    function stop(event) {
        ;
    }
    sliderElem.slider({ min: 0,
                        max: 50,
                        value: 20,
                        stop: stop});
}
