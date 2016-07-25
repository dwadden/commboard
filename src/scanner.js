"use strict";

// Code to handle aural commboard scanning

// File imports
const util = require("./util.js");
const speech = require("./speech.js");

module.exports = scanner;

function scanner(mainMenu, detector, settings) {

    // Scanning object
    let that = {};

    // Constants
    const N_LOOPS = 2;               // Loop through a menu twice before exiting.
    const SHORT_GAZE_TIME = 200;     // A short gaze must last for 200 ms
    const LONG_GAZE_TIME = 2000;     // A long gaze must last for 2 s.
    const BEEP_DURATION = 250;       // Length of beep informing of long gaze detection.
    const BEEP_FREQ = 300;           // The pitch of said beep.

    // Local variables
    let startButton = document.querySelector("input[type=button][value=Start]");
    let stopButton = document.querySelector("input[type=button][value=Stop]");

    // Procedures
    const signalLongGaze = () => speech.beep(BEEP_FREQ, BEEP_DURATION);

    function registerListeners(cbBegin, cbEnd, cbClick) {
        detector.addBeginListener(cbBegin);
        detector.addEndListener(cbEnd);
        stopButton.addEventListener("click", cbClick);
    }

    function unregisterListeners(cbBegin, cbEnd, cbClick) {
        stopButton.removeEventListener("click", cbClick);
        detector.removeBeginListener(cbBegin);
        detector.removeEndListener(cbEnd);
    }

    function scanMenu(menu, cb) {
        // Scan a menu. The second argument specifies the callback to be invoked
        // when scanning is complete.

        // State variables
        let currentButton, gazeButton, startTime, timeout, longGazeTimeout;

        // Procedures
        const nextButton = (ix) => (ix + 1) % menu.getNButtons();
        const isLastButton = (buttonIx) => buttonIx === menu.getNButtons() - 1;
        const nextLoop = (buttonIx, loopIx) =>
                  isLastButton(buttonIx) ? loopIx + 1 : loopIx;
        const isLoopOver = (loopIx) => loopIx === N_LOOPS;
        const getWaitTime = (button) =>
                  settings.getScanSpeed() * button.getWaitMultiplier();
        const register = () => registerListeners(gazeBegin, gazeEnd, pressStop);
        const unregister = () => unregisterListeners(gazeBegin, gazeEnd, pressStop);

        function loop(buttonIx, loopIx) {
            let button = menu.getButtons()[buttonIx];
            if (isLoopOver(loopIx)) {
                unregister();
                cb();
            } else if (button.isEmpty()) {
                loop(0, loopIx + 1);
            } else {
                step(button, buttonIx, loopIx);
            }
        }

        function step(button, buttonIx, loopIx) {
            currentButton = button;
            button.toggle();
            button.announce();
            let waitTime = getWaitTime(button);
            let next = function() {
                button.toggle();
                loop(nextButton(buttonIx), nextLoop(buttonIx, loopIx));
            };
            timeout = setTimeout(next, waitTime);
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
                clearTimeout(timeout);
                if (currentButton !== gazeButton) {
                    currentButton.toggle(); // Turn off the current button if it won't be turned off otherwise.
                }
                if (elapsed < LONG_GAZE_TIME) {
                    pressButton(gazeButton); // If it was a short gaze, press the relevant button
                } else {
                    unregister();
                    cb();       // If it was a long gaze, cancel the scan of the current menu and return to caller.
                }
            }
        }

        function pressButton(button) {
            unregister();
            if (currentButton === gazeButton) {
                button.toggle();
            }
            let bcb = makeButtonCallback(button);
            button.addFinishedListener(bcb);
            button.pressed();
        }

        function makeButtonCallback(button) {
            // This function takes a button and returns the callback that should
            // be invoked after the button is finished executing its actions,
            // and has emitted a signal telling the scanner to continue.
            let buttonType = button.buttonType;
            let scanType = menu.getInfo().scanType;
            let bcb = (scanType === "repeat" ?
                       () => scanMenu(menu, cb) :
                       cb);
            if (buttonType === "menuSelector") {
                let afterTarget = function() {
                    if (button.selectsDropdownMenu()) {
                        button.getTargetMenu().slideUp();
                    }
                    bcb();
                };
                return () => scanMenu(button.getTargetMenu(), afterTarget);
            } else {
                return bcb;
            }
        }

        function pressStop() {
            unregister();
            currentButton.toggle();
            clearTimeout(timeout);
            detector.idleMode();
            speech.speakSync("Stopping");
        }

        // Kick off the function
        register();
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
                unregister();
                that.scan();
            }
        }
        function pressStop() {
            speech.speakSync("Stopping.");
            unregister();
            detector.idleMode();
        }
        const register = () => registerListeners(gazeBegin, gazeEnd, pressStop);
        const unregister = () => unregisterListeners(gazeBegin, gazeEnd, pressStop);
        speech.speakSync("listening.");
        detector.listenMode();
        register();
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
