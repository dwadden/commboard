"use strict";

// *****************************************************************************

// File imports
const menus = require("./menus.js");
const detector = require("./detector.js");
const buffer = require("./buffer.js");
const settings = require("./settings.js");
const scan = require("./scan.js");

// Setup
window.onload = setup;

function setup() {
    // Top-level setup to initialize the objects of the program.

    let det = detector();
    let buf = buffer();
    let s = settings();

    // Create menus (and implicitly buttons)
    let ms = menus({ detector: det,
                     buffer: buf,
                     settings: s });

    // Create the scanner
    let scanner = scan.makeScanner(ms["composeMain"], det, s);

    // TODO: For debugging purposes only, so I have access to the relevant
}
