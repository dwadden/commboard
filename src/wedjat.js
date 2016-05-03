"use strict";

// *****************************************************************************

// File imports
const menu = require("./menu.js");
const det = require("./detector.js");
const io = require("./io.js");
const util = require("./util.js");
const scan = require("./scan.js");

// Setup
window.onload = setup;

function setup() {
    // Top-level setup to initialize the objects of the program.

    // Create utility objects
    let detector = det.makeDetector();
    let buffer = io.makeBuffer();
    let settings = io.makeSettings();

    // Create menus (and implicitly buttons)
    let menus = menu.initMenus({ detector, buffer, settings });

    // Create the scanner
    let scanner = scan.makeScanner(menus.get("composeMain"), detector, settings);

    // TODO: For debugging purposes only, so I have access to the relevant
}
