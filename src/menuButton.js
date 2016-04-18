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
                   makeRequestButton,
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
    my.soundToggle = spec.soundToggle;
    my.timeout = null;

    // Private methods
    my.finished = function() {
        // Event to be emitted when button is finished with whatever actions it
        // takes.
        that.emit("buttonFinished");
    };

    // Public methods
    that.getButtonElem = function() {
        return my.buttonElem;
    };
    that.getButtonValue = function() {
        return my.buttonValue;
    };
    that.announce = function() {
        if (my.soundToggle.isSoundOn()) {
            util.speak(my.announcementText);
        }
    };
    that.toggle = function() {
        my.buttonElem.classList.toggle("buttonOn");
        my.buttonElem.classList.toggle("buttonOff");
    };
    that.pressed = function() {
        let afterRead = function() {
            that.action();
        };
        util.read(my.announcementText, afterRead, my.buttonElem, 0);
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
            clearTimeout(my.timeout);
            setTimeout(afterPress, PRESS_WAIT);
        };
        let onTimeout = function() {
            // To be executed if button is not pressed
            that.toggle();
            my.detector.removeGazeListener(onPress);
            cbpassed();
        };
        that.addFinishedListener = function(listener) {
            that.once("buttonFinished", listener);
        };
        // Initialization
        that.toggle();
        that.announce();
        my.detector.addGazeListener(onPress);
        my.timeout = setTimeout(onTimeout, my.slider.getms());
    };

    my.buttonElem.onclick = that.pressed;
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
    that.action = function() {
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
    const BEEP_DURATION = 1000;      // Length in ms of request beep
    const AFTER_BEEP_WAIT = 500;     // Wait this long after beep before making request
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
    that.action = function() {
        let afterBeep = function() {
            let afterSpeech = function() {
                setTimeout(my.finished, my.slider.getms());
            };
            let utterance = util.speak(my.message);
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

    that.action = function() {
        my.buffer.write(my.text, my.textCategory);
        my.finished();
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

function makeTerminalPunctuationButton(spec, my) {
    my = my || {};
    let that = makePunctuationButton(spec, my);

    my.textCategory = "terminalPunctuation";

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
    that.action = function(cbpressed) {
        my.buffer.write(my.buttonValue, my.textCategory);
        my.finished();
    };

    return that;
}

function makeEmailButton(spec, my) {
    my = my || {};
    let that = makeButton(spec, my);

    // Private data
    my.buffer = spec.buffer;
    my.recipients = my.buttonElem.dataset.recipients;
    my.name = window.sessionStorage.getItem("name");
    my.address = window.sessionStorage.getItem("address");
    my.password = window.sessionStorage.getItem("password");

    // Public methods
    that.action = function() {
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
                user: my.address,
                pass: my.password
            }
        });
        const mailOptions = {
            from: `"${my.name}" <${my.address}>`,
            to: `${my.recipients}`, // list of receivers
            subject: `A message from ${my.name}`, // Subject line
            text: my.buffer.getText() + "\n\n\n" + warningText // plaintext body
        };

        // Send it off
        transporter.sendMail(mailOptions, afterSend);
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
        let utterance = util.speak("Not implemented");
        utterance.onend = afterRead;
        my.buttonElem.utternce = utterance;
    };
    return that;
}
