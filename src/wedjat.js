"use strict";

const menus = require("./menus.js");
const detector = require("./detector.js");
const buffer = require("./buffer.js");
const settings = require("./settings.js");
const scanner = require("./scanner.js");
const speaker = require("./speaker.js");

// This is the top-level script that pulls in all the relevant modules and
// initializes all objects needed for the program.

window.addEventListener("load", setup);

function setup() {
    // Top-level setup to initialize the objects of the program.
    let st = settings();
    let det = detector({ settings: st });
    let sp = speaker(st);
    let buf = buffer(sp);

    // Create menus (and implicitly buttons).
    let ms = menus({ detector: det,
                     buffer: buf,
                     settings: st,
                     speaker: sp });

    // Create the scanner.
    let sc = scanner(ms.composeMain, det, st, sp);
    window.s = st;
    window.buf = buf;
}
