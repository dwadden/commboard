// npm imports
const jQuery = require("jquery");
require("jquery-ui");
const EventEmitter = require("events");
const _ = require("underscore");

// File imports
const util = require("./util.js");
const speech = require("./speech.js");

// Exports
module.exports = settings;

function settings() {
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
    that.getEmailSettings = function() {
        return emailSettings;
    };

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
    //  Email settings object. Stores user email information, and acts as the
    //  interface through which new email contacts can be added.
    // TODO: I'm not sure if it's secure to store variables this way. For now,
    // use a dedicated email account that won't be used for sensitive
    // communications.
    let that = Object.create(EventEmitter.prototype);

    // Internal variables for user configuration and recipients.
    let signature, address, password = null;
    let signatureField = document.querySelector("input[type=text][name=signature]");
    let addressField = document.querySelector("input[type=text][name=address]");
    let passwordField = document.querySelector("input[type=password][name=password]");
    let storeButton = document.querySelector("input[type=button][value=Store]");
    let recipientNameField = document.querySelector("input[type=text][name=recipientName]");
    let recipientAdressField = document.querySelector("input[type=text][name=recipientAddress]");
    let addButton = document.querySelector("input[type=button][value=Add]");

    // Private methods
    function store() {
        // Store user email information.
        signature = signatureField.value;
        address = addressField.value;
        password = passwordField.value;
        passwordField.value = ""; // Remove the password text once it's been assigned.
    }
    function emitAddRecipient() {
        // To be emitted when the "add" button is pushed.
        that.emit("addRecipient");
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
    that.getRecipientName = function() {
        return recipientNameField.value;
    };
    that.getRecipientAddress = function() {
        // Return a list of addresses, split on spaces.
        return recipientAdressField.value.split(" ");
    };
    that.clearRecipientInfo = function() {
        // Clear the recipient info (to be used after a recipient has been added).
        recipientNameField.value = "";
        recipientAdressField.value = "";
    };
    that.addRecipientListener = function(listener) {
        // Listen for the event that the user has added a new email recipient.
        that.addListener("addRecipient", listener);
    };
    that.removeRecipientListener = function(listener) {
        // Clear a listener.
        that.removeListener("addRecipient", listener);
    };

    // Initialize and return
    addButton.onclick = emitAddRecipient;
    storeButton.onclick = store;
    return that;
}
