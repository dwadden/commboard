"use strict";

// npm imports
const EventEmitter = require("events");
const jQuery = require("jquery");
require("jquery-ui");
const nodemailer = require("nodemailer");

// File imports
const util = require("./util.js");

// Exports
module.exports = { makeButton,
                   makeMenuSelectorButton,
                   makeStartButton,
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
    my = my || {};
    let that = Object.create(EventEmitter.prototype);

    // Internal constants
    const PRESS_WAIT = 350;          // After button is pressed, wait this many ms before its action

    // Private data
    my.buttonElem = spec.elem;
    my.buttonValue = my.buttonElem.value;
    my.announcementText = my.buttonValue; // By default, announce the button text
    my.menu = spec.menu;
    my.settings = spec.settings;
    my.timeout = null;

    // Private methods
    my.finished = function() {
        // Event to be emitted when button is finished with whatever actions it
        // takes.
        that.emit("buttonFinished");
    };

    // Public methods
    that.getMenu = function() {
        return my.menu;
    };
    that.getButtonElem = function() {
        return my.buttonElem;
    };
    that.getButtonValue = function() {
        return my.buttonValue;
    };
    that.announce = function() {
        if (my.settings.useSoundP()) {
            util.speak(my.announcementText);
        }
    };
    that.toggle = function() {
        my.buttonElem.classList.toggle("buttonOn");
        my.buttonElem.classList.toggle("buttonOff");
    };
    that.pressed = function() {
        // If sound, read the button name. Else just perform the action.
        if (my.settings.useSoundP()) {
            util.read(my.announcementText, that.action, my.buttonElem, 0);
        } else {
            that.action();
        }
    };
    that.addFinishedListener = function(listener) {
        // The listener will fire once when the button says it's finished.
        that.once("buttonFinished", listener);
    };
    that.buttonType = "button";

    // Initialize and return
    my.buttonElem.onclick = that.pressed;
    return that;
}

function makeMenuSelectorButton(spec, my) {
    my = my || {};
    let that = makeButton(spec, my);

    // Public methods
    that.action = function() {
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
    };
    that.getTargetMenu = function() {
        // Return a pointer to the target menu
        let targetName = my.buttonElem.dataset.target;
        let menus = my.menu.getMenus();
        return menus.get(targetName);
    };
    that.buttonType = "menuSelector";
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
    that.action = function() {
        my.detector.addExtendedGazeListener(that.start);
        my.buttonValue = my.announcementText = my.buttonElem.value = "Start";
        my.buttonElem.value = my.buttonValue;
        that.toggle();
    };
    that.buttonType = "start";

    // Initialize
    that.toggle();
    my.detector.addExtendedGazeListener(that.start);
    return that;
}

function makeCallBellButton(spec, my) {
    my = my || {};
    let that = makeButton(spec, my);

    // internal constants
    const BEEP_DURATION = 2000;      // Length in ms of request beep
    const AFTER_BEEP_WAIT = 1000;     // Time after beep before continuing program

    // Public methods
    // TODO: Refactor this, since it's used elsewhere.
    that.beep = function() {
        let oscillator = util.audioContext.createOscillator();
        oscillator.frequency.value = 400;
        oscillator.connect(util.audioContext.destination);
        oscillator.start();
        setTimeout(function () { oscillator.stop(); }, BEEP_DURATION);
    };
    that.action = function() {
        that.beep();
        setTimeout(my.finished, BEEP_DURATION + AFTER_BEEP_WAIT);
    };
    that.buttonType = "callBell";
    return that;
}

function makeTextButton(spec, my) {
    my = my || {};
    let that = makeButton(spec, my);

    // Private data
    my.textCategory = null;     // Set by subclasses
    my.buffer = spec.buffer;
    my.text = my.buttonValue.toLowerCase();

    that.action = function() {
        my.buffer.write(my.text, my.textCategory);
        my.finished();
    };
    that.buttonType = "text";
    return that;
}

function makeLetterButton(spec, my) {
    my = my || {};
    let that = makeTextButton(spec, my);

    that.buttonType = my.textCategory = "letter";
    return that;
}

function makeSpaceButton(spec, my) {
    my = my || {};
    let that = makeTextButton(spec, my);
    that.buttonType = my.textCategory = "space";
    my.text = " ";   // Button text is just " "
    return that;
}

function makePunctuationButton(spec, my) {
    my = my || {};
    let that = makeTextButton(spec, my);
    my.announcementText = my.buttonElem.dataset.announcement;
    that.buttonType = "punctuation";

    return that;
}

function makeNonTerminalPunctuationButton(spec, my) {
    my = my || {};
    let that = makePunctuationButton(spec, my);

    that.buttonType = my.textCategory = "nonTerminalPunctuation";

    return that;
}

function makeTerminalPunctuationButton(spec, my) {
    my = my || {};
    let that = makePunctuationButton(spec, my);

    that.buttonType = my.textCategory = "terminalPunctuation";

    return that;
}

function makeBufferActionButton(spec, my) {
    my = my || {};
    let that = makeButton(spec, my);

    my.buffer = spec.buffer;
    my.actionName = my.buttonValue.toLowerCase();

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
    that.getValue = function() {
        return my.buttonValue;
    };
    that.setValue = function(value) {
        // TODO: Too many variables.
        my.buttonValue = my.announcementText = my.buttonElem.value = value;
    };
    that.action = function() {
        my.buffer.write(my.buttonValue, my.textCategory);
        my.finished();
    };
    that.isEmpty = function() {
        // TODO: My is my.text empy here, while my.buttonValue has the actual button text?
        return my.buttonValue === "";
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

    // Public methods
    that.action = function() {
        // Email variables
        const signature = my.settings.getEmailSignature();
        const address = my.settings.getEmailAddress();
        const password = my.settings.getEmailPassword();
        const recipients = my.buttonElem.dataset.recipients;

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
                util.read("An error ocurred.", my.finished, my.buttonElem);
                console.log(error);
            } else {
                // Otherwise, inform user of success and continue program
                util.read(`Message sent to ${my.buttonValue}`,
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
            to: `${recipients}`, // list of receivers
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
        let utterance = util.speak("Not implemented");
        utterance.onend = my.finished;
        my.buttonElem.utternce = utterance;
    };
    that.buttonType = "notImplemented";
    return that;
}
