"use strict";

// npm imports
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
                   makeReturnButton,
                   makeGuessButton,
                   makeEmailButton,
                   makeNotImplementedButton };

// Buttons

/**
 * Constructor for generic Button objects.
 * @param {Object} spec - Specification object.
 * @param {Object} spec.elem - Button's document element.
 * @param {Object} spec.detector - Gaze detector object
 * @param {Object} spec.slider - Slider object.
 * @param {Object} spec.menu - The menu of which this button is a part.
 * @param {Object} my - Holds class heirarchy shared secrets.
 * @returns {Object} A Button object.
 */
function makeButton(spec, my) {
    my = my || {};
    /**
     * @namespace Button
     */
    let that = {};

    // Internal constants
    const PRESS_WAIT = 350;          // After button is pressed, wait this many ms before its action

    // Private data
    my.buttonElem = spec.elem;
    my.buttonValue = my.buttonElem.value;
    my.announcementText = my.buttonValue; // By default, announce the button text
    my.detector = spec.detector;
    my.slider = spec.slider;
    my.menu = spec.menu;
    my.soundToggle = spec.soundToggle;
    my.timeout = null;

    // Public methods
    /**
     Get the document element for the button.
     * @returns {Object} A document object.
     * @memberof Button
     */
    that.getButtonElem = function() {
        return my.buttonElem;
    };
    /**
     Get the value of the button (its text).
     * @returns {String} Button text.
     * @memberof Button
     */
    that.getButtonValue = function() {
        return my.buttonValue;
    };
    /**
     Audio announcement for the button.
     * @memberof Button
     */
    that.announce = function() {
        if (my.soundToggle.isSoundOn()) {
            util.speak(my.announcementText);
        }
    };
    /**
     Toggle button highlighting.
     * @memberof Button
     */
    that.toggle = function() {
        my.buttonElem.classList.toggle("buttonOn");
        my.buttonElem.classList.toggle("buttonOff");
    };
    /**
     Scan the button. Await user input, and trigger action if input occurs.
     * @memberof Button
     */
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

        // Initialization
        that.toggle();
        that.announce();
        my.detector.addGazeListener(onPress);
        my.timeout = setTimeout(onTimeout, my.slider.getms());
    };
    return that;
}

/**
 * Constructor for menu selector buttons. When pressed, these buttons trigger
 * another menu.
 * @param {Object} spec - Specification object, as in makeButton.
 * @param {Object} my - Shared secrets, as in makeButton.
 * @returns{Object} A menuSelectorButton object.
 */
function makeMenuSelectorButton(spec, my) {
    my = my || {};
    /**
     * @namespace menuSelectorButton
     * @augments Button
     */
    let that = makeButton(spec, my);

    // Private data
    my.slide = JSON.parse(my.buttonElem.dataset.slide); // converts to boolean

    // Public methods
    /**
     Invoke the menu pointed to by this button.
     * @param {Function} cbpressed - Callback invoked by called menu when
     * finished scanning.
     * @memberof menuSelectorButton
     */
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

/**
 * Constructor for start / stop button.
 * @param {Object} spec - Specification object, as in makeButton.
 * @param {Object} my - Shared secrets, as in makeButton.
 * @returns {Object} - A startButton object.
 */
function makeStartButton(spec, my) {
    my = my || {};
    /**
     * @namespace startButton
     * @augments Button
     */
    let that = makeButton(spec, my);

    // Public
    /**
     Kick off the program (called upon gesture detection).
     * @memberof startButton
     */
    that.start = function() {
        my.detector.removeExtendedGazeListener(that.start);
        my.buttonValue = my.announcementText = my.buttonElem.value = "Stop";
        my.menu.scan();
        that.toggle();
    };
    /**
     Stop the program.
     * @memberof startButton
     */
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

/**
 * Constructor for request buttons. When pressed, they issue requests for nurses
 * or assistants.
 * @param {Object} spec - Specification object, as in makeButton.
 * @param {Object} my - Shared secrets, as in makeButton.
 * @returns{Object} A requestButton object.
 */
function makeRequestButton(spec, my) {
    my = my || {};
    /**
     * @namespace requestButton
     * @augments Button
     */
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
    /**
     Beep to get attention of assistant.
     * @memberof requestButton
     */
    that.beep = function() {
        let context = new window.AudioContext();
        let oscillator = context.createOscillator();
        oscillator.frequency.value = 400;
        oscillator.connect(context.destination);
        oscillator.start();
        setTimeout(function () { oscillator.stop(); }, BEEP_DURATION);
    };
    /**
     Play request audio.
     * @param {Function} cbpressed - Callback invoked after audio finishes.
     * @memberof requestButton
     */
    that.action = function(cbpressed) {
        let afterBeep = function() {
            let afterSpeech = function() {
                setTimeout(cbpressed, my.slider.getms());
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

/**
 * Constructor for text buttons. When pressed, they write text to the buffer.
 * @param {Object} spec - Specification object, as in makeButton with one
 * addition, below.
 * @param {Object} spec.buffer - A textBuffer object.
 * @param {Object} my - Shared secrets, as in makeButton.
 * @returns{Object} A textButton object.
 */
function makeTextButton(spec, my) {
    my = my || {};
    /**
     * @namespace textButton
     * @augments Button
     */
    let that = makeButton(spec, my);

    // Private data
    my.textCategory = null;     // Set by subclasses
    my.buffer = spec.buffer;
    my.text = my.buttonValue.toLowerCase();

    // Public methods
    /**
     Write text to buffer.
     * @param {Function} cbpressed - Callback to be invoked after buffer write.
     * @memberof textButton
     */
    that.action = function(cbpressed) {
        my.buffer.write(my.text, my.textCategory);
        cbpressed();
    };

    return that;
}

/**
 * Constructor for letter buttons. When pressed, write a single letter to
 * buffer.
 * @param {Object} spec - Specification object, as in makeTextButton.
 * @param {Object} my - Shared secrets, as in makeButton.
 * @returns{Object} A letterButton object.
 */
function makeLetterButton(spec, my) {
    my = my || {};
    /**
     * @namespace letterButton
     * @augments textButton
     */
    let that = makeTextButton(spec, my);

    my.textCategory = "letter";

    return that;
}

/**
 * Constructor for space button. When pressed, write a space to the buffer.
 * @param {Object} spec - Specification object, as in makeTextButton.
 * @param {Object} my - Shared secrets, as in makeButton.
 * @returns{Object} A spaceButton object.
 */
function makeSpaceButton(spec, my) {
    my = my || {};
    /**
     * @namespace spaceButton
     * @augments textButton
     */
    let that = makeTextButton(spec, my);

    my.textCategory = "space";
    my.text = " ";   // Button text is just " "

    return that;
};

/**
 * Constructor for punctuation button. When pressed, write punctuation to
 * buffer.
 * @param {Object} spec - Specification object, as in makeTextButton.
 * @param {Object} my - Shared secrets, as in makeButton.
 * @returns{Object} A spaceButton object.
 */
function makePunctuationButton(spec, my) {
    my = my || {};
    /**
     * @namespace punctuationButton
     * @augments textButton
     */
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

/**
 * Constructor for non-terminal punctuation button. When pressed, write a
 * punctuation character that doesn't end a sentence.
 * @param {Object} spec - Specification object, as in makeTextButton.
 * @param {Object} my - Shared secrets, as in makeButton.
 * @returns{Object} A spaceButton object.
 */
function makeNonTerminalPunctuationButton(spec, my) {
    my = my || {};
    /**
     * @namespace nonTerminalPunctuationButton
     * @augments punctuationButton
     */
    let that = makePunctuationButton(spec, my);

    my.textCategory = "nonTerminalPunctuation";

    return that;
}

/**
 * Constructor for terminal punctuation button. When pressed, write a
 * punctuation character that ends a sentence.
 * @param {Object} spec - Specification object, as in makeTextButton.
 * @param {Object} my - Shared secrets, as in makeButton.
 * @returns{Object} A spaceButton object.
 */
function makeTerminalPunctuationButton(spec, my) {
    my = my || {};
    /**
     * @namespace terminalPunctuationButton
     * @augments punctuationButton
     */
    let that = makePunctuationButton(spec, my);

    my.textCategory = "terminalPunctuation";

    return that;
}

/**
 * Constructor for buffer action button. When pressed, performs a specific
 * action on the buffer (e.g. reading the buffer text).
 * @param {Object} spec - Specification object, as in makeButton, with one
 * addition.
 * @param {Object} spec.buffer - A textBuffer object.
 * @param {Object} my - Shared secrets, as in makeButton.
 * @returns{Object} A spaceButton object.
 */
function makeBufferActionButton(spec, my) {
    my = my || {};
    /**
     * @namespace bufferActionButton
     * @augments Button
     */
    let that = makeButton(spec, my);

    my.buffer = spec.buffer;
    my.actionName = my.buttonValue.toLowerCase();

    /**
     Perform action specified by button.
     * @param {Function} cbpressed - Callback invoked after action is performed.
     * @memberof bufferActionButton
     */
    that.action = function(cbpressed) {
        my.buffer.executeAction(my.actionName, cbpressed); // Pass the callback along to the buffer method
    };

    return that;
}

// Return to calling menu
// TODO: Replace this with a gesture to do the return
function makeReturnButton(spec, my) {
    my = my || {};
    let that = makeButton(spec, my);

    // Private methods
    my.getReturnMenu = function(menu, depth) {
        if (depth === 0) {
            return menu;
        } else {
            return my.getReturnMenu(menu.parent, depth - 1);
        }
    };

    // Private data
    my.depth = parseInt(my.buttonElem.dataset.returnDepth); // number of levels to return


    // Public methods
    that.action = function(cbpressed) {
        let returnMenu = my.getReturnMenu(my.menu, my.depth);
        let majorMenu = my.getReturnMenu(my.menu, my.depth - 1);
        majorMenu.slideUp();
        returnMenu.scan();
    };
    return that;
}

/**
 * Constructor for word guess buttons. These buttons guess words based on
 * current buffer text. When pressed, they enter the guessed word.
 * @param {Object} spec - Specification object, as in makeButton, with one
 * addition.
 * @param {Object} spec.buffer - A textBuffer object.
 * @param {Object} my - Shared secrets, as in makeButton.
 * @returns{Object} A guessButton object.
 */
function makeGuessButton(spec, my) {
    my = my || {};
    /**
     * @namespace guessButton
     * @augments textButton
     */
    let that = makeTextButton(spec, my);

    // Private data
    my.textCategory = "word";

    // Public methods
    /**
     Get the current value of the button's guess.
     * @returns {String} The guess text.
     * @memberof guessButton
     */
    that.getValue = function() {
        return my.buttonValue;
    };
    /**
     Set the current value of the button's guess.
     * @param {String} value - The guess value.
     * @memberof guessButton
     */
    that.setValue = function(value) {
        // TODO: Too many variables.
        my.buttonValue = my.announcementText = my.buttonElem.value = value;
    };
    /**
     Write the current guess to the buffer
     * @param {Function} cbpressed - Callback to be invoked after buffer write.
     * @memberof guessButton
     */
    that.action = function(cbpressed) {
        my.buffer.write(my.buttonValue, my.textCategory);
        cbpressed();
    };

    return that;
}

/**
 * Constructor for email button. When pressed, attempts to send an email to the
 * named recipient.
 * @param {Object} spec - Sepcification object, as in makeButton, with one
 * addition.
 * @param {Object} spec.buffer - A textBuffer object.
 * @param {Object} my - Shared secrets as in makeButton
 * @returns {Object} An emailButton object.
 */
function makeEmailButton(spec, my) {
    my = my || {};
    /**
     * @namespace emailButton
     * @augments Button
     */
    let that = makeButton(spec, my);

    // Private data
    my.buffer = spec.buffer;
    my.recipients = my.buttonElem.dataset.recipients;
    my.name = window.sessionStorage.getItem("name");
    my.address = window.sessionStorage.getItem("address");
    my.password = window.sessionStorage.getItem("password");

    // Public methods
    /**
     Send email.
     * @param {Function} cbpressed - Callback to be invoked after buffer write.
     * @memberof emailButton
     */
    that.action = function(cbpressed) {
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
                util.read("An error ocurred.", cbpressed, my.buttonElem);
                console.log(error);
            } else {
                // Otherwise, inform user of success and continue program
                util.read(`Message sent to ${my.buttonValue}`,
                     cbpressed, my.buttonElem);
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

/**
 * Constructor for buttons that are not yet implemented.
 * @param {Object} spec - Specification object, as in makeButton.
 * @param {Object} my - Shared secrets, as in makeButton.
 * @returns{Object} A notImplementedButton object.
 */
function makeNotImplementedButton(spec, my) {
    // Internal constants
    const PAUSE = 500;

    my = my || {};
    /**
     * @namespace notImplementedButton
     * @augments Button
     */
    let that = makeButton(spec, my);

    /**
     * Inform the user that functionality is not implemented.
     * @param {Function} cbpressed - Callback to be invoked after audio plays.
     * @memberof notImplementedButton
     */
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
