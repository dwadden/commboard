"use strict";

// npm imports
const EventEmitter = require("events");
const jQuery = require("jquery");
require("jquery-ui");
const nodemailer = require("nodemailer");

// File imports
const util = require("./util.js");
const speech = require("./speech.js");

// ************************************************************************** //

// The module exposes a single procedure called menuButton. This procedure
// creates a button object of the requested type (e.g. a button to write letters
// to the buffer) by retrieving the desired constructor from the global
// "constructors" object.
// A constructor is added to this object by invoking "registerConstructor",
// which takes two arguments: the name of the type tag for the button, and the
// button constructor procedure. The procedure first decorates the original
// constructor by making sure that every object it returns is given the
// appropriate type tag. It then adds the decorated constructor to the global
// constructor dispatch table.

let constructors = {};          // The global constructor table.

function registerConstructor(type, constructor) {
    // Register a constructor in the global table.
    function decoratedConstructor(spec) {
        // Decorate the constructor by tagging all buttons it makes with their type.
        return Object.assign(constructor(spec),
                             { buttonType: type });
    }
    constructors[type] = decoratedConstructor;
}

function menuButton(type, spec) {
    // Top-level button constructor. Dispatches on buttonType to create a button
    // of the appropriate type.
    return constructors[type](spec);
}

module.exports = menuButton;

// ************************************************************************** //

// The base constructor for all other buttons

function makeGenericButton(spec, my) {
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
    let myAssignments = {
        // Additional fields to be added as shared secrets.
        emitter: new EventEmitter(),
        timeout: null,
        waitMultiplier: 1,      // When scanning, multiply the wait time by this number.
        finished: () => my.emitter.emit("buttonFinished")
    };
    Object.assign(my, myAssignments);

    // Public.
    let that = {
        getMenu: () => my.menu,
        getButtonValue: () => my.buttonElem.value,
        setButtonValue: (value) => my.buttonElem.value = value,
        isEmpty: () => my.buttonElem.value === "",
        getWaitMultiplier: () => my.waitMultiplier,
        getTargetMenu: () => null, // MenuButtons overwrite this.
        announce: function() {
            // Have the button state its name.
            if (my.settings.useSound()) {
                speech.speakSync(that.getAnnouncement());
            }
        },
        toggle: function() {
            // Turn button on and off.
            my.buttonElem.classList.toggle("buttonOn");
            my.buttonElem.classList.toggle("buttonOff");
        },
        pressed: function() {
            // speakAsync button name (if sound is on) and perform button action. This
            // method is "abstract" in the sense that "that.action" must be
            // implemented on a descendant.
            if (my.settings.useSound()) {
                speech.speakAsync(that.getAnnouncement(), that.action, my.buttonElem, 0);
            } else {
                that.action();
            }
        },
        addFinishedListener: function(listener) {
            // Add a procedure to listen for when this button is finished its action.
            my.emitter.once("buttonFinished", listener);
        }
    };
    // Need to assign in a separate step since these methods depend on others on "that".
    let thatAssignments = {
        getAnnouncement: that.getButtonValue, // By default, the announcement text is just the button's value.
        selectsDropdownMenu: () => (that.buttonType === "menuSelector" &&
                                    that.getTargetMenu().getInfo().hide === "dropdown")
    };
    Object.assign(that, thatAssignments);

    // Initialize and return
    my.buttonElem.onclick = that.pressed;
    return that;
}

// ************************************************************************** //

// Constructors for all buttons responsible for sending input to the buffer. The
// base constructor is makeTextButton; all others call this constructor first
// and then add on additional behavior using Object.assign.

function makeTextButton(spec, my) {
    // Constructor for general text button. Invoked by more specific
    // constructors for letters, numbers, etc.

    my = my || {};
    let that = makeGenericButton(spec, my);

    // Additional private data.
    let myAssignments = {
        textCategory: null,     // This is set by subclasses.
        buffer: spec.buffer
    };
    Object.assign(my, myAssignments);

    // Additional public data.
    let thatAssignments1 = {
        setText: (text) => that.setButtonValue(text.toUpperCase()),
        getText: () => that.getButtonValue().toLowerCase(),
        getTextCategory: () => that.buttonType
    };
    Object.assign(that, thatAssignments1);
    let thatAssignments2 = {    // Need to assign separately since "action" uses that.getText.
        action: function() {
            my.buffer.write(that.getText(), that.getTextCategory());
            my.finished();
        }
    };
    Object.assign(that, thatAssignments2);

    return that;
}
// Register a letter button, which works like a text button but is named more specifically.
registerConstructor("letter", makeTextButton); //

function makeSpaceButton(spec, my) { // Writes a space to the buffer.
    return Object.assign(makeTextButton(spec, my || {}),
                         { getText: () => " " });
}
registerConstructor("space", makeSpaceButton);

function makePunctuationButton(spec, my) {
    // General constructor for punctuation characters. Invoked by more specific
    // constructors.
    my = my || {};          // Need to assign "my" first since "getAnnouncement" needs access to it.
    return Object.assign(makeTextButton(spec, my),
                         { getAnnouncement: () => my.buttonElem.dataset.announcement });
}
// Register terminal and non-terminal punctuation buttons. The buffer handles differently based on their tag.
registerConstructor("nonTerminalPunctuation", makePunctuationButton);
registerConstructor("terminalPunctuation", makePunctuationButton);

function makeGuessButton(spec, my) {
    // Constructor for buttons that handle guesses retrieved from web API or
    // elsewhere. To work correctly these buttons must be part of a GuessMenu.

    my = my || {};
    let that = makeTextButton(spec, my);

    let myAssignment = {
        waitMultiplier: 2
    };
    Object.assign(my, myAssignment);

    let thatAssignment = {
        getTextCategory: () => "word",
        isEmpty: () => that.getText() === ""
    };
    Object.assign(that, thatAssignment);

    return that;
}
registerConstructor("guess", makeGuessButton);

// ************************************************************************** //

// Buttons to perform other types of actions.

function makeBufferActionButton(spec, my) {
    // Constructor for buttons that invoke an action from the buffer other than
    // simple writing text (e.g. speakAsyncing buffer contents out load). The buffer
    // object does the actual work, the buttons just serve to dispatch to the
    // buffer.

    my = my || {};
    let that = makeGenericButton(spec, my);

    // Private additions.
    let myAssignments = {
        getActionName: () => that.getButtonValue().toLowerCase()
    };
    Object.assign(my, myAssignments);

    // Public additions.
    let thatAssignments= {
        action: function() {
            my.buffer.executeAction(my.getActionName(), my.finished); // Pass the callback along to the buffer method
        }
    };
    Object.assign(that, thatAssignments);

    return that;
}
registerConstructor("bufferAction", makeBufferActionButton);

function makeMenuSelectorButton(spec, my) {
    // Constructor for buttons whose job it is to kick off other menus. For
    // example: the first column on the main commboard.

    my = my || {};
    let that = makeGenericButton(spec, my);

    // Additional exposed methods and data to be assigned to object.
    let assignments = {
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
            // Return a pointer to the target menu.
            let targetName = my.buttonElem.dataset.target;
            let menus = my.menu.getMenus();
            return menus[targetName];
        }
    };
    Object.assign(that, assignments);

    return that;
}
registerConstructor("menuSelector", makeMenuSelectorButton);

function makeCallBellButton(spec, my) {
    // Constructor for call bell button. When pressed, emits a tone to inform a
    // caretaker that the user requires attention.

    my = my || {};
    let that = makeGenericButton(spec, my);

    // Internal constants.
    const BEEP_DURATION = 2000;      // Length in ms of request beep.
    const AFTER_BEEP_WAIT = 1000;     // Time after beep before continuing program.
    const BEEP_FREQ = 400;            // Oscillator beep frequency.

    // Additional methods.
    let assignments = {
        action: function() {
            speech.beep(BEEP_FREQ, BEEP_DURATION);
            setTimeout(my.finished, BEEP_DURATION + AFTER_BEEP_WAIT);
        }
    };
    Object.assign(that, assignments);

    return that;
}
registerConstructor("callBell", makeCallBellButton);

function makeEmailButton(spec, my) {
    // Constructor for buttons that send email. These buttons have two important
    // methods:
    // setRecipient: sets the email recipient for the button, which allows for
    //     each user to customize who he / she sends emails to.
    // action: send the email.

    my = my || {};
    let that = makeGenericButton(spec, my);

    // Private additions.
    let myAssignments = {
        address: null,
        waitMultiplier: 2
    };
    Object.assign(my, myAssignments);

    // Public additions.
    let thatAssignments = {
        setRecipient: function(name, address) {
            // Add a recipient for this (initially empty) button.
            that.setButtonValue(name);
            my.address = address;
        },

        action: function() {
            // The procedure that sends the email.
            const emailSettings = my.settings.getEmailSettings();
            const signature = emailSettings.getSignature();
            const address = emailSettings.getAddress();
            const password = emailSettings.getPassword();
            const signoffText = (`This message was sent for ${signature} using ` +
                                 "wedjat, experimental software to enable people " +
                                 "with disabilities to use a computer.");

            function afterSend(error, info) {
                // Callback to invoke after message has been sent.
                if (error) {
                    // If something goes wrong, inform user and dump the error info.
                    speech.speakAsync("An error ocurred.", my.finished, my.buttonElem);
                    console.log(error);
                } else {
                    // Otherwise, inform user of success and continue program.
                    speech.speakAsync(`Message sent to ${that.getButtonValue()}`,
                                      my.finished,
                                      my.buttonElem);
                }
            }
            const transporter = nodemailer.createTransport({  // For details, see https://nodemailer.com/
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
                text: my.buffer.getText() + "\n\n\n" + signoffText // plaintext body
            };

            // Send the email.
            transporter.sendMail(mailOptions, afterSend);
        }
    };
    Object.assign(that, thatAssignments);

    return that;
}
registerConstructor("email", makeEmailButton);

function makeNotImplementedButton(spec, my) {
    // Button for features not yet implemented. Notifies the user and continues.
    const PAUSE = 500;
    my = my || {};
    let that = makeGenericButton(spec, my);

    // Public additions.
    let assignment = {
        action: function() {
            speech.speakAsync("Not implemented.", my.finished, my.buttonElem, PAUSE);
        }
    };
    Object.assign(that, assignment);

    return that;
}
registerConstructor("notImplemented", makeNotImplementedButton);
