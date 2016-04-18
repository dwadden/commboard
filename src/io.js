"use strict";

// Constructors for input and output objects - blink detector, text buffer, etc.
// Because these objects are not members of hierarchies, they do not need shared
// secrets. Instead of "my", we just have local variables.

// npm imports
const jQuery = require("jquery");
require("jquery-ui");
const EventEmitter = require("events");
const moment = require("moment");

// File imports
const util = require("./util.js");

// Exports
module.exports = { makeDetector, makeBuffer, makeClock, makeSlider };

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
    function onKeyDown(event) {
        let dispatch = new Map([[38, emitGaze], // 38 is up arrow key
                                [40, emitExtendedGaze]]); // 40 is down arrow key
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
     * Initialize tracking.
     * @memberof Detector
     */
    that.setupTracking = function() {
        util.notImplemented();
    };
    /**
     * Initialize key press event handling.
     * @memberof Detector
     */
    that.setupKeyDown = function() {
        document.addEventListener("keydown", onKeyDown);
    };

    return that;
}

/**
 * Constructor for text buffer.
 * @returns {Object} A buffer object.
 */
function makeBuffer() {
    /**
     * @namespace Buffer
     */
    let that = Object.create(EventEmitter.prototype);

    // Constants
    const CURSOR = "_";          // Cursor character. Could be |, for instance

    // Local variables
    let bufferElem = document.getElementById("buffer");
    let textElem = bufferElem.querySelector("p");
    let bufferText = CURSOR;

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
    // Is the character a terminal punctuation character?
    function isTerminalPunctuation(char) {
        return char.match(/[.!?]/) !== null;
    }
    // Are we at the start of a word?
    function isBufferWordStart() {
        return that.getText() === "" || that.getText().slice(-1) == " ";
    }
    // Are we at the start of a sentence?
    function isBufferSentenceStart() {
        // This will break if user backspaces after a sentence finishes.
        let text = that.getText();
        return (text == "" ||
                (text.slice(-1) === " " &&
                 isTerminalPunctuation(text.slice(-2))));
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
        let toWrite = isBufferSentenceStart() ? util.capitalize(text) : text;
        writeText(toWrite);
    }
    // For spaces, write a space and switch wordStart to true
    function writeSpace() {
        writeText(" ");
    }
    // Write a whole word to the buffer; for use in word guessing
    function writeWord(text) {
        while (!isBufferWordStart()) // Clear out partial word.
            pop();
        let toWrite = isBufferSentenceStart() ? util.capitalize(text) : text;
        writeText(toWrite);
        writeSpace();
    }
    // Just writes the text.
    function writeNonTerminalPunctuation(text) {
        writeText(text);
    }
    function writeTerminalPunctuation(text) {
        writeText(text);
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
    function readBuffer(cb) {
        util.read(that.getText(), cb, bufferElem);
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
    /**
     * Write to the buffer.
     * @param {string} text - The text to write.
     * @param {string} textCategory - The type of text (e.g. punctuation,
     * letter).
     * @memberof Buffer
     */
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
    /**
     * Perform buffer action
     * @param {string} actionName - The name of the action to be performed.
     * @param {Function} cbpressed - The callback to invoke after completion.
     * @memberof Buffer
     */
    that.executeAction = function(actionName, cbpressed) {
        let dispatch = new Map([["delete", deleteText],
                                ["read", readBuffer],
                                ["clear", clear]]);
        let action = dispatch.get(actionName);
        action(cbpressed);
    };
    /**
     * Get buffer text.
     * @returns {string} The buffer text
     * @memberof Buffer
     */
    that.getText = function() {
        return bufferText.slice(0, -1);
    };
    /**
     * Add listener for buffer change event.
     * @param {Function} listener - The listener.
     * @memberof Buffer
     */
    that.addChangeListener = function(listener) {
        that.addListener("bufferChange", listener);
    };
    /**
     * Remove listener for buffer change event.
     * @param {Function} listener - The listener.
     * @memberof Buffer
     */
    that.removeChangeListener = function(listener) {
        that.removeListener("bufferChange", listener);
    };

    // Initialize and return
    update();
    return that;
}

/**
 * Constructor for clock objects.
 */
function makeClock() {
    /**
     * @namespace Clock
     */
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
    /**
     * Start the clock.
     * @memberof Clock
     */
    that.start = function() {
        iv = setInterval(tick, INTERVAL);
    };
    /**
     * Stop the clock.
     * @memberof Clock
     */
    that.stop = function() {
        clearInterval(iv);
    };

    // Start the clock and return the method.
    that.start();
    return that;
}

/**
 * Constructor for slider objects.
 */
function makeSlider() {
    /**
     * @namespace Slider
     */
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
    /**
     * Get the wait time specified by the slider.
     * @returns {number} Wait time in milliseconds.
     * @memberof Slider
     */
    that.getms = function() {
        return sliderValue * 1000;
    };

    // Initialize and return.
    updateValue();
    return that;
}
