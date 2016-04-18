"use strict";

// *****************************************************************************

// npm imports
const jQuery = require("jquery"); // Shouldn't need this, but bootstrap gets cranky without it.
require("jquery-ui");

// File imports
const menu = require("./menu.js");
const detector = require("./detector.js");
const io = require("./io.js");
const util = require("./util.js");

// Setup
window.onload = setup;

function setup() {
    // Top-level setup to initialize the objects of the program.

    // Create utility objects
    let det = detector.makeDetector();
    let buffer = io.makeBuffer();
    let slider = io.makeSlider();

    // Create menus (and implicitly buttons)
    let menus = menu.initMenus({ det, buffer, slider });
}
