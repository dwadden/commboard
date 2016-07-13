"use strict";

// npm imports
const EventEmitter = require("events");
const jQuery = require("jquery");
require("jquery-ui");
const nodemailer = require("nodemailer");

// File imports
const util = require("./util.js");
const speech = require("./speech.js");

// Exports
module.exports = { makeButton,
                   makeMenuSelectorButton,
                   makeCallBellButton,
                   makeTextButton,
                   makeLetterButton,
                   makeSpaceButton,
                   makePunctuationButton,
                   makeNonTerminalPunctuationButton,
                   makeTerminalPunctuationButton,
                   makeBufferActionButton,
                   makeGuessButton,
                   makeEmailButton,
                   makeNotImplementedButton };

// Buttons

function makeButton(spec, my) {
    // Factory function for a general commboard button. Constructors for more
    // specific button types begin by invoking this one.
    // The object "my" contains data required by buttons further down in the
    // button hierarchy, but that should not be visible outside.
    // The object "that" is returned, and exposes the public methods for the
    // button.

    // Shared secrets.
    my = my || {};
    Object.assign(my, spec);
    util.renameKeys(my, [["elem", "buttonElem"]]);
    let assignments = {
        // Additional fields to be added as shared secrets.
        emitter: new EventEmitter(),
        timeout: null,
        finished: function() {
            my.emitter.emit("buttonFinished");
        }
    };
    Object.assign(my, assignments);

    // Public.
    let that = {
        buttonType: "button",
        getMenu: () => my.menu,
        getButtonValue: () => my.buttonElem.value,
        setButtonValue: (value) => my.buttonElem.value = value,
        getAnnouncement: () => my.buttonElem.value, // By default, the announcement text is just the button's value.
        announce: function() {
            // Have the button state its name.
            if (my.settings.useSoundP()) {
                speech.speak(that.getAnnouncement());
            }
        },
        toggle: function() {
            // Turn button on and off.
            my.buttonElem.classList.toggle("buttonOn");
            my.buttonElem.classList.toggle("buttonOff");
        },
        pressed: function() {
            // Read button name (if sound is on) and perform button action. This
            // method is "abstract" in the sense that "that.action" must be
            // implemented on a descendant.
            if (my.settings.useSoundP()) {
                speech.read(that.getAnnouncement(), that.action, my.buttonElem, 0);
            } else {
                that.action();
            }
        },
        addFinishedListener: function(listener) {
            // Add a procedure to listen for when this button is finished its action.
            my.emitter.once("buttonFinished", listener);
        }
    };

    // Initialize and return
    my.buttonElem.onclick = that.pressed;
    return that;
}

function makeMenuSelectorButton(spec, my) {
    // Constructor for buttons whose job it is to kick off other menus. For
    // example: the first column on the main commboard.

    my = my || {};
    let that = makeButton(spec, my);

    // Additional exposed methods and data to be assigned to object.
    let assignments = {
        buttonType: "menuSelector",
        action: function() {
            // Unhide the next menu if it's a dropdown. Also register an event
            // handler so the menu will slide back up on a mouse click.
            let target = that.getTargetMenu();
            if (target.getInfo().hide === "dropdown") {
                target.slideDown();
                let onClick = function() {
                    target.slideUp();
                    document.removeEventListener("click", onClick);
                };
                document.addEventListener("click", onClick);
            }
            my.finished();
        },
        getTargetMenu: function() {
            // Return a pointer to the target menu
            let targetName = my.buttonElem.dataset.target;
            let menus = my.menu.getMenus();
            return menus.get(targetName);
        }
    };
    Object.assign(that, assignments);

    return that;
}

function makeCallBellButton(spec, my) {
    // Constructor for call bell button. When pressed, emits a tone to inform a
    // caretaker that the user requires attention.

    my = my || {};
    let that = makeButton(spec, my);

    // Internal constants.
    const BEEP_DURATION = 2000;      // Length in ms of request beep.
    const AFTER_BEEP_WAIT = 1000;     // Time after beep before continuing program.
    const BEEP_FREQ = 400;            // Oscillator beep frequency.

    // Additional methods.
    let assignments = {
        buttonType: "callBell",
        action: function() {
            speech.beep(BEEP_FREQ, BEEP_DURATION);
            setTimeout(my.finished, BEEP_DURATION + AFTER_BEEP_WAIT);
        }
    };
    Object.assign(that, assignments);

    return that;
}

function makeTextButton(spec, my) {
    // Constructor for general text button. Invoked by more specific
    // constructors for letters, numbers, etc.

    my = my || {};
    let that = makeButton(spec, my);

    // Additional private data.
    let myAssignments = {
        textCategory: null,     // This is set by subclasses.
        buffer: spec.buffer
    };
    Object.assign(my, myAssignments);

    // Additional public data.
    let thatAssignments1 = {
        buttonType: "text",
        getText: () => that.getButtonValue().toLowerCase()
    };
    Object.assign(that, thatAssignments1);
    let thatAssignments2 = {    // Need to assign separately since "action" uses that.getText.
        action: function() {
            my.buffer.write(that.getText(), that.buttonType);
            my.finished();
        }
    };
    Object.assign(that, thatAssignments2);

    return that;
}

function makeLetterButton(spec, my) { // Button that writes a letter to buffer.
    return Object.assign(makeTextButton(spec, my || {}),
                         { buttonType: "letter" });
}

function makeSpaceButton(spec, my) { // Writes a space to the buffer.
    return Object.assign(makeTextButton(spec, my || {}),
                         { buttonType: "space",
                           getText: () => " " });
}

function makePunctuationButton(spec, my) {
    // General constructor for punctuation characters. Invoked by more specific
    // constructors.
    return Object.assign(makeTextButton(spec, my || {}),
                         { buttonType: "punctuation",
                           getAnnouncement: () => my.buttonElem.dataset.announcement });
}

function makeNonTerminalPunctuationButton(spec, my) { // Writes non-terminal punctuation (e.g. a ' character).
    return Object.assign(makePunctuationButton(spec, my || {}),
                         { buttonType: "nonTerminalPunctuation" });
}

function makeTerminalPunctuationButton(spec, my) { // Writes terminal punctuation (e.g. a ! character).
    return Object.assign(makePunctuationButton(spec, my || {}),
                         { buttonType: "terminalPunctuation" });
}

function makeBufferActionButton(spec, my) {
    my = my || {};
    let that = makeButton(spec, my);

    my.buffer = spec.buffer;
    my.actionName = that.getButtonValue().toLowerCase();

    that.action = function() {
        my.buffer.executeAction(my.actionName, my.finished); // Pass the callback along to the buffer method
    };
    that.buttonType = "bufferAction";

    return that;
}

function makeGuessButton(spec, my) {
    my = my || {};
    let that = makeTextButton(spec, my);

    // Private data
    my.textCategory = "word";

    // Public methods
    that.action = function() {
        my.buffer.write(that.getButtonValue(), my.textCategory);
        my.finished();
    };
    that.isEmpty = function() {
        return that.getButtonValue() === "";
    };
    that.buttonType = "guess";

    return that;
}

function makeEmailButton(spec, my) {
    my = my || {};
    let that = makeButton(spec, my);

    // Private data
    my.buffer = spec.buffer;
    my.settings = spec.settings;
    my.emailSettings = my.settings.getEmailSettings();
    my.address = null;

    // Public methods
    that.setRecipient = function(name, address) {
        // Add a recipient for this (initially empty) button.
        that.setButtonValue(name);
        my.address = address;
    };

    that.action = function() {
        // Email variables
        const signature = my.emailSettings.getSignature();
        const address = my.emailSettings.getAddress();
        const password = my.emailSettings.getPassword();

        const warningText = `This message was sent using experimental software
for individuals with Completely Locked-in Syndrome. Due to the immaturity of the
software, the password for this email account may not be stored securely. What
this means for you is that you should NEVER send sensitive information
(e.g. bank accounts, social security numbers, etc) to this email address, as a
malicious person could be able to gain access to it. For normal conversations,
it is perfectly fine to send messages to this address.`;
        function afterSend(error, info) {
            if (error) {
                // If something goes wrong, inform user and dump the error info
                speech.read("An error ocurred.", my.finished, my.buttonElem);
                console.log(error);
            } else {
                // Otherwise, inform user of success and continue program
                speech.read(`Message sent to ${that.getButtonValue()}`,
                            my.finished, my.buttonElem);
            }
        }
        // For details, see https://nodemailer.com/
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: address,
                pass: password
            }
        });
        const mailOptions = {
            from: `"${signature}" <${address}>`,
            to: `${my.address}`, // list of receivers
            subject: `A message from ${signature}`, // Subject line
            text: my.buffer.getText() + "\n\n\n" + warningText // plaintext body
        };

        // Send it off
        transporter.sendMail(mailOptions, afterSend);
        my.finished();
    };
    that.buttonType = "email";

    return that;
}

function makeNotImplementedButton(spec, my) {
    // Internal constants
    const PAUSE = 500;

    my = my || {};
    let that = makeButton(spec, my);

    that.action = function() {
        let utterance = speech.speak("Not implemented");
        utterance.onend = my.finished;
        my.buttonElem.utternce = utterance;
    };
    that.buttonType = "notImplemented";
    return that;
}
