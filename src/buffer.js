"use strict";

// npm imports
const jQuery = require("jquery");
require("jquery-ui");
const EventEmitter = require("events");
const _ = require("underscore");

// File imports
const util = require("./util.js");
const speech = require("./speech.js");

// Exports
module.exports = buffer;

function buffer() {
    // Constructor for text buffer.
    let that = Object.create(EventEmitter.prototype);

    // Constants
    const CURSOR = "_";          // Cursor character. Could be |, for instance

    // Local variables
    let bufferElem = document.getElementById("bufferContainer");
    let textElem = bufferElem.querySelector("p");
    let bufferText = CURSOR;
    let fontSizeElem = document.querySelector("input[type=number][name=fontSize]");

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
        return (text === "" ||
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
        if (isBufferWordStart() && !isBufferSentenceStart()) {
            // This covers the case where the last word was autocompleted and a space inserted.
            pop();
        }
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
        speech.read(that.getText(), cb, bufferElem);
    }
    // Clear the buffer.
    function clear(cb) {
        bufferText = CURSOR;
        update();
        emitChange();
        cb();
    }
    // Fired when buffer changes
    function emitChange() {
        that.emit("bufferChange");
    }

    // Procedures to change the font size on input from user.
    function updateFontSize() {
        let size = fontSizeElem.value + "px";
        bufferElem.style.fontSize = size;
    }
    fontSizeElem.onchange = updateFontSize; // Listen for font size changes and update as needed.

    // Public methods
    that.write = function(text, textCategory) {
        // Write to the buffer.
        let dispatch = new Map([["letter", writeLetter],
                                ["space", writeSpace],
                                ["word", writeWord],
                                ["nonTerminalPunctuation", writeNonTerminalPunctuation],
                                ["terminalPunctuation", writeTerminalPunctuation]]);
        let writer = dispatch.get(textCategory);
        writer(text);
        emitChange();
    };
    that.executeAction = function(actionName, cbpressed) {
        // Perform buffer action.
        let dispatch = new Map([["delete", deleteText],
                                ["read", readBuffer],
                                ["clear", clear]]);
        let action = dispatch.get(actionName);
        action(cbpressed);
    };
    that.getText = function() {
        // Retrieve buffer text.
        return bufferText.slice(0, -1);
    };
    that.addChangeListener = function(listener) {
        // Add listener for buffer change event.
        that.addListener("bufferChange", listener);
    };
    that.removeChangeListener = function(listener) {
        // Remove listener for buffer change event.
        that.removeListener("bufferChange", listener);
    };

    // Initialize and return
    updateFontSize();
    update();
    return that;
}
