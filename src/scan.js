"use strict";

// Code to handle aural commboard scanning

// File imports
const util = require("./util.js");
const speech = require("./speech.js");

module.exports = { makeScanner };

function makeScanner(mainMenu, detector, settings) {

    // Scanning object
    let that = {};

    // Constants
    const N_LOOPS = 2;          // Loop through a menu twice before exiting.
    const SHORT_GAZE_TIME = 200;     // A short gaze must last for 200 ms
    const LONG_GAZE_TIME = 2000;     // A long gaze must last for 2 s.
    const BEEP_DURATION = 250;       // Length of beep informing user that the gaze has lasted 2s
    const BEEP_FREQ = 300;

    // Local variables
    let startButton = document.querySelector("input[type=button][value=Start]");
    let stopButton = document.querySelector("input[type=button][value=Stop]");

    // Procedures
    function signalLongGaze() {
        speech.beep(BEEP_FREQ, BEEP_DURATION);
    }

    function scanMenu(menu, cb) {
        // Scan a menu. The second argument specifies the callback to be invoked
        // when scanning is complete.

        // State variables
        let currentButton, gazeButton, startTime, timeout, longGazeTimeout;

        // Procedures
        function nextButton(ix) {
            return (ix + 1) % menu.getNButtons();
        }
        function isLastButton(buttonIx) {
            return buttonIx === menu.getNButtons() - 1;
        }
        function nextLoop(buttonIx, loopIx) {
            return isLastButton(buttonIx) ? loopIx + 1 : loopIx;
        }
        function isLoopOver(loopIx) {
            return loopIx === N_LOOPS;
        }
        function loop(buttonIx, loopIx) {
            let button = menu.getButtons()[buttonIx];
            if (isLoopOver(loopIx)) {
                // TODO: This code is repeated verbatim below. Need to refactor.
                stopButton.removeEventListener("click", pressStop);
                detector.removeBeginListener(gazeBegin);
                detector.removeEndListener(gazeEnd);
                cb();
            } else if (isEmptyGuess(button)) {
                // Special edge case for dealing with guess menus.
                loop(0, loopIx + 1);
            } else {
                currentButton = button;
                button.toggle();
                button.announce();
                let next = function() {
                    button.toggle();
                    loop(nextButton(buttonIx), nextLoop(buttonIx, loopIx));
                };
                let waitTime = getWaitTime(button.buttonType);
                timeout = setTimeout(next, waitTime);
            }
        }
        function isEmptyGuess(button) {
            return button.buttonType === "guess" && button.isEmpty();
        }
        function getWaitTime(buttonType) {
            // Wait twice as long when scanning guess buttons, to give user time.
            const GUESS_MULTIPLIER = 2;
            let waitTime = settings.getScanSpeed();
            return buttonType === "guess" ? waitTime * 2 : waitTime;
        }
        function gazeBegin() {
            // Beginning of gaze detected
            gazeButton = currentButton; // The button that was active at the moment the gaze started
            startTime = new Date();
            longGazeTimeout = setTimeout(signalLongGaze, LONG_GAZE_TIME); // Tell the user when they've gazed long enough
        }
        function gazeEnd() {
            clearTimeout(longGazeTimeout);
            let elapsed = new Date() - startTime;
            if (elapsed >= SHORT_GAZE_TIME) {
                if (currentButton !== gazeButton) {
                    currentButton.toggle(); // Turn off the current button if it won't be turned off otherwise.
                }
                clearTimeout(timeout);
                if (elapsed < LONG_GAZE_TIME) {
                    pressButton(gazeButton); // If it was a short gaze, press the relevant button
                } else {
                    stopButton.removeEventListener("click", pressStop);
                    detector.removeBeginListener(gazeBegin);
                    detector.removeEndListener(gazeEnd);
                    cb();       // If it was a long gaze, cancel the scan of the current menu and return to caller.
                }
            }
        }
        function pressButton(button) {
            // Press button. After it's been pressed, either resume control of
            // program or pass control to selected menu.
            function afterCompletion() {
                // This needs to be cleaned up. For now, here's what's going on.
                // When we scan a sliding menu, it needs to slide up when it
                // exists. The way to do that is interecept the callback passed
                // from the invoking menu, and slide up the dropdown before
                // invoking that callback.
                let slidecb;
                let target = button.getTargetMenu && button.getTargetMenu();
                if (target !== undefined && target.getInfo().hide === "dropdown") {
                    slidecb = function() {
                        target.slideUp();
                        cb();
                    };
                } else {
                    slidecb = cb;
                }
                const dispatch = new Map([["repeat", function() { scanMenu(menu, slidecb); }],
                                          ["finish", slidecb]]);
                let scanType = menu.getInfo().scan;
                let cb1 = dispatch.get(scanType);
                let cb2 = (button.buttonType === "menuSelector" ?
                           function() { scanMenu(button.getTargetMenu(), cb1); } :
                           cb1);
                cb2();
            }
            detector.removeBeginListener(gazeBegin);
            detector.removeEndListener(gazeEnd);
            stopButton.removeEventListener("click", pressStop);
            if (currentButton === gazeButton) {
                button.toggle();
            }
            button.addFinishedListener(afterCompletion);
            button.pressed();
        }
        function pressStop() {
            clearTimeout(timeout);
            detector.idleMode();
            detector.removeBeginListener(gazeBegin);
            detector.removeEndListener(gazeEnd);
            speech.speak("Stopping");
            stopButton.removeEventListener("click", pressStop);
            currentButton.toggle();
        }
        // Kick off the function
        detector.addBeginListener(gazeBegin);
        detector.addEndListener(gazeEnd);
        stopButton.addEventListener("click", pressStop);
        loop(0, 0);
    }

    function listen() {
        // Listen for user input.
        // TODO: Refactor some of the shared functionality between this and the scanner.
        // TODO: The refresh rate on the webcam should be lower when we're in this mode.
        let startTime, longGazeTimeout;
        function gazeBegin() {
            // Beginning of gaze detected
            startTime = new Date();
            longGazeTimeout = setTimeout(signalLongGaze, LONG_GAZE_TIME); // Tell the user when they've gazed long enough
        }
        function gazeEnd() {
            clearTimeout(longGazeTimeout);
            let elapsed = new Date() - startTime;
            if (elapsed >= LONG_GAZE_TIME) {
                stopButton.removeEventListener("click", pressStop);
                detector.removeBeginListener(gazeBegin);
                detector.removeEndListener(gazeEnd);
                that.scan();
                }
            }
        function pressStop() {
            speech.speak("Stopping.");
            stopButton.removeEventListener("click", pressStop);
            detector.idleMode();
            detector.removeBeginListener(gazeBegin);
            detector.removeEndListener(gazeEnd);
        }
        speech.speak("listening.");
        detector.listenMode();
        stopButton.addEventListener("click", pressStop);
        detector.addBeginListener(gazeBegin);
        detector.addEndListener(gazeEnd);
    }
    that.scan = function() {
        // Kick off by scanning the main menu. If scanning completes, no
        // callback need be invoked.
        detector.scanMode();
        scanMenu(mainMenu, listen);
    };
    // register buttons
    startButton.addEventListener("click", listen);
    return that;
}
