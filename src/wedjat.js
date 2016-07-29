"use strict";

const menus = require("./menus.js");
const detector = require("./detector.js");
const buffer = require("./buffer.js");
const settings = require("./settings.js");
const scanner = require("./scanner.js");

// This is the top-level script that pulls in all the relevant modules and
// initializes all objects needed for the program.

window.onload = setup;

function setup() {
    // Top-level setup to initialize the objects of the program.
    let det = detector();
    let buf = buffer();
    let s = settings();

    // Create menus (and implicitly buttons).
    let ms = menus({ detector: det,
                     buffer: buf,
                     settings: s });

    // Create the scanner.
    let sc = scanner(ms["composeMain"], det, s);
}
