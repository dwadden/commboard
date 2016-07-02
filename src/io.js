"use strict";

// Constructors for input and output objects - blink detector, text buffer, etc.
// Because these objects are not members of hierarchies, they do not need shared
// secrets. Instead of "my", we just have local variables.

// npm imports
const jQuery = require("jquery");
require("jquery-ui");
const EventEmitter = require("events");
const _ = require("underscore");

// File imports
const util = require("./util.js");
const speech = require("./speech.js");

// Exports
module.exports = { makeBuffer, makeSettings };

function makeBuffer() {
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

function makeSettings() {
    // General settings object. Handles the following:
    //   Toggle sound.
    //   Toggle display menu.
    //   Language. Currently only English is implemented.
    //   Slider controlling scan speed.
    // TODO: Is this the right way to do this? Maybe I should access the
    // settings as a simple object without the method calls? Maybe it should be
    // a map?
    let that = {};

    // Internal variables
    let soundElem = document.querySelector("input[type=checkbox][value=sound]");
    let showElem = document.querySelector("input[type=checkbox][value=showMenu]");
    let layoutElem = document.querySelector("select[name=layout]");
    let languageElem = document.querySelector("select[name=language]");
    let slider = makeSlider();
    let emailSettings = makeEmailSettings();

    // Public methods
    that.useSoundP = function() {
        return soundElem.checked;
    };
    that.showMenuP = function() {
        return showElem.checked;
    };
    that.getLayout = function() {
        return layoutElem.value;
    };
    that.getLanguage = function() {
        return languageElem.value;
    };
    that.getScanSpeed = function() {
        return slider.getms();
    };
    that.addShowMenuListener = function(listener) {
        showElem.addEventListener("change", listener);
    };
    that.getEmailSignature = emailSettings.getSignature;
    that.getEmailAddress = emailSettings.getAddress;
    that.getEmailPassword = emailSettings.getPassword;

    // Return the object
    return that;
}



function makeSlider() {
    // Constructor for slider object.
    // Encapsulated by the generalSettings object.
    let that = {};

    // Constants
    const VMIN = 0;
    const VMAX = 3;
    const V0 = 1.5;               // Initial slider setting
    const SCALE = 10;

    // Internal variables
    let sliderValue = V0;
    let containerElem = document.getElementById("sliderContainer");
    let sliderElem = document.getElementById("slider");
    let valueElem = document.getElementById("sliderValue");
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

    that.getms = function() {
        return sliderValue * 1000;
    };

    // Initialize and return.
    updateValue();
    return that;
}

function makeEmailSettings() {
    //  Email settings object. Handles the following:
    //   Signature (the user's name)
    //   Email address
    //   Password
    // I'm not sure if it's secure to store variables this way. For now, use a
    // dedicated email account that won't be used for sensitive communications.
    let that = {};

    // Internal variables
    let signature, address, password = null;
    let signatureButton = document.querySelector("input[type=text][name=signature]");
    let addressButton = document.querySelector("input[type=text][name=address]");
    let passwordButton = document.querySelector("input[type=password][name=password]");
    let storeButton = document.querySelector("input[type=button][value=Store]");

    // Private methods
    function store() {
        signature = signatureButton.value;
        address = addressButton.value;
        password = passwordButton.value;
        passwordButton.value = ""; // Remove the password text once it's been assigned.
    }

    // Public methods
    that.getSignature = function() {
        return signature;
    };
    that.getAddress = function() {
        return address;
    };
    that.getPassword = function() {
        return password;
    };

    // Initialize and return
    storeButton.onclick = store;
    return that;
}
