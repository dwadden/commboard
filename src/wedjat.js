"use strict";

// *****************************************************************************

// npm imports
const jQuery = require("jquery"); // Shouldn't need this, but bootstrap gets cranky without it.
require("jquery-ui");

// File imports
const menu = require("./menu.js");
const settingsButton = require("./settingsButton.js");
const io = require("./io.js");
const util = require("./util.js");

// Setup

window.onload = setup;

/**
 * Top-level setup function. Creates and initializes program objects.
 */
function setup() {
    // Create utility objects
    let detector = io.makeDetector();
    let buffer = io.makeBuffer();
    // let clock = io.makeClock();
    let slider = io.makeSlider();
    let soundToggle = settingsButton.makeSoundToggleButton();

    // Initialization procedures
    function makeSpec(menuName) {
        return { detector, buffer, slider, soundToggle, menuName };
    }
    function makeLeaf (menuName) {
        return menu.makeLeafMenu(makeSpec(menuName));
    }
    function makeBranch(menuName) {
        return menu.makeBranchMenu(makeSpec(menuName));
    }
    function makeComposeSubmenus() {
        return new Map(
            [["1",       makeLeaf("compose1")],
             ["2",       makeLeaf("compose2")],
             ["3",       makeLeaf("compose3")],
             ["4",       makeLeaf("compose4")],
             ["5",       makeLeaf("compose5")],
             ["guess",   menu.makeGuessMenu(makeSpec("composeGuess"))],
             ["actions", makeLeaf("composeActions")]]);
    }

    // Create menus
    let main = makeBranch("main");
    let request = makeLeaf("request");
    let email = makeLeaf("email");
    let compose = makeBranch("compose");
    let composeSubmenus = makeComposeSubmenus();

    // Add children to menus
    main.setChildren(new Map([["request", request],
                              ["compose", compose],
                              ["email",   email]]));
    compose.setChildren(composeSubmenus);

    // Final actions
    settingsButton.registerEmailConfigButton(); // Register email config button
    // detector.setupTracking();
    detector.setupKeyDown();
    main.slideDown();
}
