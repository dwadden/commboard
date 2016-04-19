"use strict";

// Code to handle aural commboard scanning

module.exports = { makeScanner };

function makeScanner(mainMenu, detector, settings) {

    // Scanning object
    let that = {};

    // Constants
    const N_LOOPS = 2;          // Loop through a menu twice before exiting.
    const SHORT_GAZE_TIME = 100;     // A short gaze must last for 100 ms
    const LONG_GAZE_TIME = 2000;     // A long gaze must last for 2 s.
    const BEEP_DURATION = 250;       // Length of beep informing user that the gaze has lasted 2s

    function signalLongGaze() {
        // TODO: Refactor this into a single beep function.
        let context = new window.AudioContext();
        let oscillator = context.createOscillator();
        oscillator.frequency.value = 300;
        oscillator.connect(context.destination);
        oscillator.start();
        setTimeout(function () { oscillator.stop(); }, BEEP_DURATION);
    }


    function scanMenu(menu, cb) {
        // Scan a menu. The second argument specifies the callback to be invoked
        // when scanning is complete.

        // State variables
        let currentButton = null;
        let gazeButton = null;
        let startTime = null;
        let timeout = null;
        let longGazeTimeout = null;

        // Procedures

        function nextButton(ix) {
            return (ix + 1) % menu.getNButtons();
        }
        function isLastButton(buttonIx) {
            return buttonIx === menu.getNButtons() - 1;
        }
        function nextLoop(buttonIx, loopIx) {
            return isLastButton(menu, buttonIx) ? loopIx + 1 : loopIx;
        }
        function isLoopOver(loopIx) {
            return loopIx === N_LOOPS;
        }
        function loop(buttonIx, loopIx) {
            if (isLoopOver(loopIx)) {
                cb();
            } else {
                let button = menu.getButtons()[buttonIx];
                currentButton = button;
                button.toggle();
                button.announce();
                let next = function() {
                    button.toggle();
                    loop(nextButton(buttonIx), nextLoop(loopIx));
                };
                timeout = setTimeout(next, settings.getScanSpeed());
            }
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
                if (elapsed < LONG_GAZE_TIME) {
                    pressButton(gazeButton); // If it was a short gaze, press the relevant button
                } else {
                    cb();       // If it was a long gaze, cancel the scan of the current menu and return to caller.
                }
            }
        }

        function pressButton(button) {
            // Press button. After it's been pressed, either resume control of
            // program or pass control to selected menu.
            function afterCompletion() {
                const dispatch = new Map([["repeat", function() { scanMenu(menu, cb); }],
                                          ["finish", cb]]);
                let scanType = menu.getInfo().scan;
                let cb2 = dispatch.get(scanType);
                if (button.buttonType === "menuSelector") {
                    scanMenu(button.getTargetMenu(), cb2);
                } else {
                    cb2();
                }
            }
            detector.removeBeginListener(gazeBegin);
            detector.removeEndListener(gazeEnd);
            button.toggle();
            button.addFinishedListener(afterCompletion);
            button.pressed();
        }

        // Kick off the function
        detector.addBeginListener(gazeBegin);
        detector.addEndListener(gazeEnd);
        loop(0, 0);
    }

    that.scan = function() {
        // Kick off by scanning the main menu. If scanning completes, no
        // callback need be invoked.
        scanMenu(mainMenu, function() { ; });
    };

    return that;
}

function scanMenu(menu, detector, settings) {
    ;
}

function scanButton(button, detector, settings) {
    ;
}

////////////////////////////////////////////////////////////////////////////////

// that.scan = function(cbpassed, cbpressed) {
//     let onPress = function() {
//         // To be executed if the button is pressed
//         let afterPress = function() {
//             that.announce();
//             let afterAnnouncement = function() {
//                 that.toggle();
//                 that.action(cbpressed);
//             };
//             setTimeout(afterAnnouncement, my.slider.getms());
//         };
//         my.detector.removeGazeListener(onPress);
//         clearTimeout(my.timeout);
//         setTimeout(afterPress, PRESS_WAIT);
//     };
//     let onTimeout = function() {
//         // To be executed if button is not pressed
//         that.toggle();
//         my.detector.removeGazeListener(onPress);
//         cbpassed();
//     };
//     that.addFinishedListener = function(listener) {
//         that.once("buttonFinished", listener);
//     };
//     // Initialization
//     that.toggle();
//     that.announce();
//     my.detector.addGazeListener(onPress);
//     my.timeout = setTimeout(onTimeout, my.slider.getms());
// };
