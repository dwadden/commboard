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
module.exports = { makeBuffer, makeSlider };
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
    let bufferElem = document.getElementById("bufferContainer");
    let textElem = bufferElem.querySelector("p");
    let bufferText = CURSOR;

    // Elementary buffer operations
    // Update element text to match text stored in JS variable
    function update() {
        // TODO: fix this
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
        that.emit("bufferChange");
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
