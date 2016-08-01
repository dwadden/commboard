"use strict";

// File imports
const speech = require("./speech.js");

// ************************************************************************** //

// This module exports a single function called "scanner". The function creates
// a scanner object, which is the object that does the work of presenting
// options to the user, detecting when an option has selected, and responding
// accordingly.
//
// The scanner object exposes only a single method, scan(). Within the scope of
// the scanner's definition, a number of additional functions are defined which
// help implement this method.

// ************************************************************************** //

module.exports = scanner;

function scanner(mainMenu, detector, settings) {
    // Constructor for scanner objects. The returned object exposes a single
    // method called scan(), which in turn relies upon the scanMenu function to
    // do its work. The scanMenu function is a bit tricky, and itself includes a
    // number of internal variables and function definitions.

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
        // During scanning, the scanner must listen for three different inputs
        // from the user. The first is the beginning of a gesture (e.g. an
        // upward gaze). The second is the end of such a gesture. The third is
        // an assistant pressing the stop button. For each of these user events,
        // assign an event handler.
        detector.addBeginListener(cbBegin);
        detector.addEndListener(cbEnd);
        stopButton.addEventListener("click", cbClick);
    }

    function unregisterListeners(cbBegin, cbEnd, cbClick) {
        // Unregister the event handlers for the three events described above.
        stopButton.removeEventListener("click", cbClick);
        detector.removeBeginListener(cbBegin);
        detector.removeEndListener(cbEnd);
    }

    function scanMenu(menu, cb) {
        // Scan a menu. When scanning is finished, invoke the callback cb.
        // This is a complicated function, so an in-depth explanation is
        // provided.
        //
        // When the scanner scans a menu, it announces the menu's buttons one at
        // a time and awaits input from the user. As described above, there are
        // 3 possible inputs.
        // 1. Beginning of a gaze (implemented by gazeBegin). The scanner notes
        // the button "under point" when the user begins the gesture, and notes
        // the current time.
        // 2. Ending a gaze (implemented by gazeEnd). The scanner checks how
        // long the gaze lasted. If it didn't last long enough, ignore it. If it
        // lasted long enough to qualify as a short gaze, then determine which
        // button was under point when the gaze began and invoke that button's
        // action. Finally, if it was long enough to qualify as a long gaze,
        // terminate the scan of the current menu and invoke the callback passed
        // in when this menu began scanning.
        // 3. Pressing the stop button (implemented by pressStop). When the
        // scanner terminates the scan and sets the program back to "idle".
        //
        // If the user enters a short gaze, then the scanner "presses" a button
        // by invoking pressButton. However, the scanner doesn't know how long
        // it will take the button to carry out its action (if the button reads
        // the entire buffer text, it could be a little while. Or, the button
        // could kick off scanning another menu entirely). Here's how this is
        // handled:
        // The scanner creates a callback that the button should invoke when
        // it's finished doing whatever it needs to do. This is implemented in
        // makeButtonCallback. Then, it tells the button to do its thing. When
        // the button is finished, it emits an event, which triggers the
        // callback created by the scanner. In this way the button returns
        // control of the program back to the scanner.
        //
        // These pieces are tied together by the loop function, which in turn
        // invokes the step function to step over each button, announce its
        // contents, and await input. The step function sets the button "under
        // point" so that, if input is recieved, the scanner will know which
        // button to press. If no input is received after a given time interval,
        // the step function continues on to the next button.

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
        function gazeBegin() {
            // Callback to execute if the beginning of a gaze was
            // detected. Store the button that was under point as well as the
            // time. Register a timeout to inform the user when they've stared
            // long enough for a "long gaze".
            gazeButton = currentButton;
            startTime = new Date();
            longGazeTimeout = setTimeout(signalLongGaze, LONG_GAZE_TIME);
        }
        function gazeEnd() {
            // Callback to execute if the end of a gaze was detected. Depending
            // on the length of the gaze, either do nothing, press the button,
            // or invoke the callback passed in to scanMenu.
            clearTimeout(longGazeTimeout);
            let elapsed = new Date() - startTime;
            if (elapsed >= SHORT_GAZE_TIME) {
                clearTimeout(timeout);
                if (currentButton !== gazeButton) {
                    currentButton.toggle();
                }
                if (elapsed < LONG_GAZE_TIME) {
                    pressButton(gazeButton);
                } else {
                    unregister();
                    cb();
                }
            }
        }
        function pressStop() {
            // Callback to execute if the stop button was pressed. Cancel the
            // scan and return to idle.
            unregister();
            currentButton.toggle();
            clearTimeout(timeout);
            detector.idleMode();
            speech.speakSync("Stopping");
        }
        function pressButton(button) {
            // Invoke the action of a given button. Create a callback to execute
            // when the button is finished doing its thing, and register this
            // callback.
            unregister();
            if (currentButton === gazeButton) {
                button.toggle();
            }
            let bcb = makeButtonCallback(button);
            button.addFinishedListener(bcb);
            button.pressed();
        }
        function makeButtonCallback(button) {
            // Create the callback to be invoked when the given button is
            // finished.
            // First, make a callback "bcb" that either scans the current menu
            // again (if this menu's scanning behavior is to repeat) or invokes
            // the callback passed into scanMenu.
            // If the button doesn't select a new menu, then bcb does what we
            // want and we return it.
            // If the button does select a new menu, then we create a callback
            // that scans the new menu, and also passes another callback to the
            // new menu. This is easier to understand in code than in English.
            let buttonType = button.buttonType;
            let scanType = menu.getInfo().scanType;
            let bcb = (scanType === "repeat" ? // The callback to use if the button doesn't kick off a new menu.
                       () => scanMenu(menu, cb) :
                       cb);
            if (buttonType === "menuSelector") {
                let afterTarget = function() { // The callback to be invoked after the target menu has finished.
                    if (button.selectsDropdownMenu()) {
                        button.getTargetMenu().slideUp();
                    }
                    bcb();
                };
                return () => scanMenu(button.getTargetMenu(), afterTarget); // The callback that scans the target menu.
            } else {
                return bcb;
            }
        }
        function loop(buttonIx, loopIx) {
            // Loop over the buttons awaiting input. If we've gone too long
            // without any input, invoke the passed-in callback.
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
            // A single step in the scan.
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

        // Kick off the function
        register();
        loop(0, 0);
    }

    function listen() {
        // This function is invoked when the program starts. It awaits an
        // initial cue from the user, and when this cue is given it kicks off a
        // scan. When a scan is finished, the scanner reverts to listening.
        let startTime, longGazeTimeout;
        const register = () => registerListeners(gazeBegin, gazeEnd, pressStop);
        const unregister = () => unregisterListeners(gazeBegin, gazeEnd, pressStop);
        function gazeBegin() {
            // Beginning of gaze detected.
            startTime = new Date();
            longGazeTimeout = setTimeout(signalLongGaze, LONG_GAZE_TIME); // Tell the user when they've gazed long enough
        }
        function gazeEnd() {
            // End of gaze detected. If the gaze was long enough, start scanning.
            clearTimeout(longGazeTimeout);
            let elapsed = new Date() - startTime;
            if (elapsed >= LONG_GAZE_TIME) {
                unregister();
                scan();
            }
        }
        function pressStop() {
            // If an assistant pressed the stop button, tell the detector to stop listening for input.
            speech.speakSync("Stopping.");
            unregister();
            detector.idleMode();
        }
        speech.speakSync("listening.");
        detector.listenMode();
        register();
    }

    function scan() {
        // Scan the main menu.
        detector.scanMode();
        scanMenu(mainMenu, listen);
    };

    // Register buttons and return the object, which exposes a method to scan.
    startButton.addEventListener("click", listen);

    let that = { scan };
    return that;
}
