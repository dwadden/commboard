"use strict";

// npm imports
const bootbox = require("bootbox");
require("bootstrap");

// Exports
module.exports = { registerEmailConfigButton, makeSoundToggleButton };

/**
 * Register button to prompt user for email information on click.
*/
function registerEmailConfigButton() {
    let selector = "input[type=button][data-button-type=emailConfig";
    let buttonElem = document.querySelector(selector);
    buttonElem.onclick = clicked;

    // TODO: Figure out how to do this correctly. For now I just want to get the
    // program running; a clear warning is ok.
    function clicked() {
        let alert = `WARNING: This is an experimental feature. The email
password will not be stored securely, and it is possible a malicious person
could retrieve it. Only enter a password for an account created expressely for
use with this program, which will NEVER be used to exchange sensitive
information (bank / credit card statements, travel documents, etc).`;
        bootbox.alert(alert, getName);
    }
    function getName() {
        bootbox.prompt("Please enter your name.",
                       function(name) { getEmailAddress(name); });

    }
    function getEmailAddress(name) {
        bootbox.prompt("Please enter your email address.",
                       function(address) { getPassword(name, address); });
    }
    function getPassword(name, address) {
        bootbox.prompt("Please enter your password.",
                       function(password) {
                           storeEmailConfig(name, address, password);
                       });
    }
    function storeEmailConfig(name, address, password) {
        window.sessionStorage.setItem("name", name);
        window.sessionStorage.setItem("address", address);
        window.sessionStorage.setItem("password", password);
    }
}

function makeSoundToggleButton() {
    // TODO: Documentation
    let selector = "input[type=button][data-button-type=soundToggle";
    let buttonElem = document.querySelector(selector);
    let soundOn = true;
    buttonElem.onclick = clicked;

    function clicked() {
        soundOn = !soundOn;
        buttonElem.value = soundOn ? "Sound Off" : "Sound On";
    }
    function isSoundOn() {
        return soundOn;
    }

    return { isSoundOn };
}
