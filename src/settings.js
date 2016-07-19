"use strict";

// npm imports.
const jQuery = require("jquery");
require("jquery-ui");
const EventEmitter = require("events");

// This module exposes the procedure "settings", the constructor for the
// settings object. The settings object exposes the settings passed in from the
// user (e.g. the scan speed, whether or not sound is on, etc.) to the other
// objects in the program (the menus, buttons, buffer, etc.) through an
// assortment of "getter" functions. The top-level settings object encapsulates
// an object to handle the scan speed (which is controlled by a jquery UI
// slider), and an object that handles email settings.

// Exports
module.exports = settings;

function settings() {
    // Constructor for the settings object that is made available to other
    // objects in the program. The getters on the object it returns provide
    // access to user settings.

    // Private variables
    let soundElem = document.querySelector("input[type=checkbox][value=sound]");
    let showElem = document.querySelector("input[type=checkbox][value=showMenu]");
    let layoutElem = document.querySelector("select[name=layout]");
    let languageElem = document.querySelector("select[name=language]");
    let slider = makeSlider();
    let emailSettings = makeEmailSettings();

    // The public object.
    let that = {
        useSound: () => soundElem.checked,
        getLayout: () => layoutElem.value,
        getLanguage: () => languageElem.value,
        getScanSpeed: () => slider.getms(),
        addShowMenuListener: (listener) =>
            showElem.addEventListener("change", listener),
        getEmailSettings: () => emailSettings
    };

    return that;
}

function makeSlider() {
    // Constructor for slider object. Relies on the jQuery UI toolkit to create
    // the slider element. Exports a single getter, which returns the value
    // of the sider.

    // Constants
    const VMIN = 0;             // Min, max, and initial slider settings
    const VMAX = 3;
    const V0 = 1.5;
    const SCALE = 10;

    // Internal variables and methods.
    let sliderValue = V0;
    let containerElem = document.getElementById("sliderContainer");
    let sliderElem = document.getElementById("slider");
    let valueElem = document.getElementById("sliderValue");
    let s = jQuery(sliderElem).slider({ min: VMIN * SCALE,
                                        max: VMAX * SCALE,
                                        value: sliderValue * SCALE,
                                        slide: updateValue,
                                        change: updateValue });

    function updateValue() {
        // Callback to be invoked when the user changes the slider value.
        let v = s.slider("value");
        sliderValue = parseFloat(v) / SCALE;
        let stringValue = sliderValue.toString();
        valueElem.textContent = `${stringValue} s`;
    }

    // The returned object.
    let that = {
        getms: () => sliderValue * 1000
    };

    // Initialize and return.
    updateValue();
    return that;
}

function makeEmailSettings() {
    // Email settings object. Stores user email information, and acts as the
    // interface through which new email contacts can be added. Returns an
    // object that exposes getters for the relevant information.
    // I'm not a security expert. The user's password, for instance, is
    // accessible to anyone who can see the closure or can invoke the
    // getPassword() method. As far as I know, that's just anyone with local
    // access to the user's computer. For pretty much all the use cases I can
    // imagine, I think this should be fine.

    // Internal data and methods.
    let signature, address, password = null;
    let signatureField = document.querySelector("input[type=text][name=signature]");
    let addressField = document.querySelector("input[type=text][name=address]");
    let passwordField = document.querySelector("input[type=password][name=password]");
    let storeButton = document.querySelector("input[type=button][value=Store]");
    let recipientNameField = document.querySelector("input[type=text][name=recipientName]");
    let recipientAddressField = document.querySelector("input[type=text][name=recipientAddress]");
    let addButton = document.querySelector("input[type=button][value=Add]");
    let emitter = new EventEmitter();

    const emitAddRecipient = () => emitter.emit("addRecipient");
    function store() {
        // Store user email information.
        signature = signatureField.value;
        address = addressField.value;
        password = passwordField.value;
        passwordField.value = ""; // Remove the password text once it's been assigned.
    }

    // The public object.
    let that = {
        getSignature: () => signature,
        getAddress: () => address,
        getPassword: () => password,
        getRecipientName: () => recipientNameField.value,
        getRecipientAddress: () => recipientAddressField.value.split(" "),
        clearRecipientInfo: function() {
            recipientNameField.value = "";
            recipientAddressField.value = "";
        },
        addRecipientListener: (listener) =>
            emitter.addListener("addRecipient", listener),
        removeRecipientListener: (listener) =>
            emitter.removeListener("addRecipient", listener)
    };

    // Initialize and return.
    addButton.onclick = emitAddRecipient;
    storeButton.onclick = store;
    return that;
}
