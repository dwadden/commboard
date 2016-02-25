"use strict";

// TODO: Replace the callback mechanism with promises using .then. This seems to
// be a feature that came out more recently than the book I have was published.

// start the driver loop when the document is loaded
// $(document).ready(function() { driverLoop(); });

// The driver loop
function driverLoop() {
    let buffer = makeBuffer();
    let grid = makeGrid(buffer);
    let colorDetector = makeColorDetector();
    colorDetector.setup();
    registerKeyPress(grid);
    grid.scan();
}

// when a key is pressed, dispatch it to the grid
function registerKeyPress(grid) {
    $(document)[0].onkeypress = function(event) { grid.action(event); };
}

// grid constructor
// TODO: Accept an initializer object instead of an argument.
function makeGrid(inputBuffer) {
    let gridElem = $("#grid");
    let rowElems = gridElem.find(".rowOff");
    let buffer = inputBuffer;             // a passed-in buffer object
    function initRows(rowElems) {
        let curried = curry(makeRow, inputBuffer);
        return rowElems.toArray().map(curried); // jquery's map is wrong; us the ES5 version
    }
    let rows = initRows(rowElems);
    let rowIx = 0;         // index of current highlighted row
    let timeout = null;
    function nRows() { return rows.length; }
    function getRows() { return rows; }
    function nextRow() { rowIx = (rowIx + 1) % nRows(); }
    function resetRow() { rowIx = 0; }
    function resetTimeout() {
        clearTimeout(timeout);
        timeout = null;
    }
    function scan() {     // scan the rows
        let currentRow = rows[rowIx];
        currentRow.toggle();
        let currentButton = currentRow.getIdButton();
        currentButton.toggle();
        currentButton.say();
        function callback() {
            currentRow.toggle();
            currentButton.toggle();
            nextRow();
            scan();
        }
        timeout = setTimeout(callback, 1000);
    }
    function action(event) {
        resetTimeout();
        let currentRow = rows[rowIx];
        function onReturnNoSelection() {
            currentRow.toggle();
            nextRow();
            // TODO: write a function for this.
            $(document)[0].onkeypress = function(event) { action(event); };
            scan();
        }
        function onReturnSelection() {
            currentRow.toggle();
            resetRow();
            $(document)[0].onkeypress = function(event) { action(event); };
            scan();
        }
        function callback1() {
            let idButton = currentRow.getIdButton();
            idButton.say();
            function callback2() {
                idButton.toggle();
                $(document)[0].onkeypress = function(event) { currentRow.action(event, onReturnSelection); };
                currentRow.scan(onReturnNoSelection);
            }
            setTimeout(callback2, 1000);
        }
        setTimeout(callback1, 250);
    }
    return Object.freeze({nRows, getRows, nextRow, scan, action});
}

// row constructor
// TODO: Accept an initializer object the place of inputBuffer
function makeRow(inputBuffer, rowInput) {
    let rowElem = rowInput;
    let buttonElems = $(rowElem).find(".btnOff");
    let buffer = inputBuffer;
    // TODO: abstract this pattern?
    function makeButtons(buttonElems) {
        let curried = curry(makeCommButton, buffer);
        return buttonElems.toArray().map(curried); // as above, jquery map() is wrong
    }
    let buttons = makeButtons(buttonElems);
    let buttonIx = 0;      // index of current highlighted button
    let timeout = null;
    function getIdButton() { return buttons[0]; }
    function getCommandButtons() { return buttons.slice(1); }
    function nCommandButtons() { return getCommandButtons().length; }
    function nextButton() { buttonIx = (buttonIx + 1) % nCommandButtons(); }
    function resetButton() { buttonIx = 0; }
    function toggle() {
        let toAdd, toRemove;
        let rowq = $(rowElem);
        if (rowq.attr("class") === "rowOff") {
            toAdd = "rowOn";
            toRemove = "rowOff";
        } else {
            toAdd = "rowOff";
            toRemove = "rowOn";
        }
        rowq.addClass(toAdd);
        rowq.removeClass(toRemove);
    }
    function scan(fromCaller) {
        let currentButton = getCommandButtons()[buttonIx];
        currentButton.toggle();
        currentButton.say();
        function callback() {
            let tailCall = ((buttonIx < nCommandButtons() - 1) ?
                            function () { scan(fromCaller); } :
                            fromCaller);
            currentButton.toggle();
            nextButton();
            tailCall();
        }
        timeout = setTimeout(callback, 1000); // Advance to next button
    }
    function resetTimeout() {
        clearTimeout(timeout);
        timeout = null;
    }
    function action(event, fromCaller) {
        resetTimeout();
        let currentButton = getCommandButtons()[buttonIx];
        function callback1() {
            currentButton.action();
            function callback2() {
                currentButton.toggle();
                resetButton();
                fromCaller();
            }
            setTimeout(callback2, 1000);
        }
        setTimeout(callback1, 250);
    }
    return Object.freeze({getIdButton, getCommandButtons, nextButton,
                          toggle, scan, action});
}

// console button constructor
// TODO: Accept an initializer object in the place of the input buffer
function makeCommButton(inputBuffer, buttonInput) {
    let buttonElem = buttonInput;
    let buttonText = buttonElem.value;
    let buffer = inputBuffer;
    function say() {
        let utterance = new window.SpeechSynthesisUtterance(buttonText);
        utterance.lang = "en-US";
        window.speechSynthesis.speak(utterance);
    }
    // TODO: refactor this. it's redundant
    function toggle() {
        let toAdd, toRemove;
        let buttonq = $(buttonElem);
        if (buttonq.attr("class") === "btnOff") {
            toAdd = "btnOn";
            toRemove = "btnOff";
        } else {
            toAdd = "btnOff";
            toRemove = "btnOn";
        }
        buttonq.addClass(toAdd);
        buttonq.removeClass(toRemove);
    }
    function getText() { return buttonText; }
    function action() {
        say();
        buffer.push(buttonText);
    }
    return Object.freeze({say, toggle, getText, action});
}

// menu constructor
function makeMenu() {
    ;
}

function makeMenuButton() {
    ;
}

function makeSlider() {
    let sliderElem = $("#slider");
    let sliderValue = $("#slider-value");
    function stop(event) {
        $("#slider-value")[0].innerText = $(this).slider("value");
    }
    s.slider({ min: 0,
               max: 50,
               value: 20,
               stop: stop});
}

// buffer constructor
function makeBuffer() {
    let bufferElem = $("#textBuffer");
    let textElem = bufferElem.find("p");
    let bufferText = "";
    function getContents() { return bufferText; }
    function update() { textElem.text(bufferText); }
    function push(character) {
        bufferText += character;
        update();
    }
    function pop() {
        bufferText = bufferText.slice(0, -1);
        update();
    }
    function clear() {
        bufferText = "";
        update();
    }
    return Object.freeze({getContents, push, pop, clear});
}

// Using web camera to trigger events
// This is a very simple detector. It just looks for yellow objects in the
// frame. Bigger is better. I've just been holding up a big yellow book.
// TODO: This is hackish. Fix it once I know it works.
function makeColorDetector() {
    // TODO: Make frame rate slower. We don't need super-fast updates
    let stateEnum = { off: 0, on: 1 };
    let state = stateEnum.off;
    let nchanged = 0;           // The number of consecutive events that have indicated a state change

    // This not the correct way to do pass comments to the grid. But first I
    // just want to get it working.
    function fireKeyboardEvent() {
        let keyboardEvent = document.createEvent("KeyboardEvent");
        let initMethod = typeof keyboardEvent.initKeyboardEvent !== 'undefined' ? "initKeyboardEvent" : "initKeyEvent";
        keyboardEvent[initMethod](
            "keypress", // event type : keydown, keyup, keypress
            true, // bubbles
            true, // cancelable
            window, // viewArg: should be window
            false, // ctrlKeyArg
            false, // altKeyArg
            false, // shiftKeyArg
            false, // metaKeyArg
            40, // keyCodeArg : unsigned long the virtual key code, else 0
            0 // charCodeArgs : unsigned long the Unicode character associated with the depressed key, else 0
        );
        document.dispatchEvent(keyboardEvent);
    }

    function detection(event) {
        if (state == stateEnum.off) {
            nchanged++;
            if (nchanged >= 10) {// TODO: This number should not be hard-coded
                state = stateEnum.on;
                fireKeyboardEvent(); // TODO: This is wrong. Do this the right way.
            }
        } else {
            nchanged = 0;
        }
    }

    function noDetection(event) {
        if (state== stateEnum.on) {
            nchanged++;
            if (nchanged >= 10) { // TODO: don't hard code
                state = stateEnum.off;
            }
        } else {
            nchanged = 0;
        }
    }

    function setup() {
        let colors = new tracking.ColorTracker(['yellow']);
        colors.on('track', function(event) {
            if (event.data.length === 0) {
                // No colors were detected in this frame.
                noDetection();
            } else {
                detection();
            }
        });
        tracking.track('#webcamFeed', colors, {camera: true});
    }
    return Object.freeze({setup});
}

// Helper functions
function curry(func, ...first) {
    return function(...second) {
        return func(...first, ...second);
    };
}
