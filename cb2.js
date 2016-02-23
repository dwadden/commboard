"use strict";

// TODO: Replace the callback mechanism with promises using .then. This seems to
// be a feature that came out more recently than the book I have was published.

// start the driver loop when the document is loaded
// $(document).ready(function() { driverLoop(); });

// The driver loop
function driverLoop() {
    var buffer = makeBuffer();
    var grid = makeGrid(buffer);
    registerKeyPress(grid);
    registerColorDetector();
    grid.scan();
}

// when a key is pressed, dispatch it to the grid
function registerKeyPress(grid) {
    $(document)[0].onkeypress = function(event) { grid.action(event); };
}

// grid constructor
// TODO: Accept an initializer object instead of an argument.
function makeGrid(inputBuffer) {
    var gridElem = $("#grid");
    var rowElems = gridElem.find(".rowOff");
    var buffer = inputBuffer;             // a passed-in buffer object
    function initRows(rowElems) {
        var curried = curry(makeRow, inputBuffer);
        return rowElems.toArray().map(curried); // jquery's map is wrong; us the ES5 version
    }
    var rows = initRows(rowElems);
    var rowIx = 0;         // index of current highlighted row
    var timeout = null;
    function nRows() { return rows.length; }
    function getRows() { return rows; }
    function nextRow() { rowIx = (rowIx + 1) % nRows(); }
    function resetRow() { rowIx = 0; }
    function resetTimeout() {
        clearTimeout(timeout);
        timeout = null;
    }
    function scan() {     // scan the rows
        var currentRow = rows[rowIx];
        currentRow.toggle();
        var currentButton = currentRow.getIdButton();
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
        var currentRow = rows[rowIx];
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
            var idButton = currentRow.getIdButton();
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
    var rowElem = rowInput;
    var buttonElems = $(rowElem).find(".btnOff");
    var buffer = inputBuffer;
    // TODO: abstract this pattern?
    function makeButtons(buttonElems) {
        var curried = curry(makeCommButton, buffer);
        return buttonElems.toArray().map(curried); // as above, jquery map() is wrong
    }
    var buttons = makeButtons(buttonElems);
    var buttonIx = 0;      // index of current highlighted button
    var timeout = null;
    function getIdButton() { return buttons[0]; }
    function getCommandButtons() { return buttons.slice(1); }
    function nCommandButtons() { return getCommandButtons().length; }
    function nextButton() { buttonIx = (buttonIx + 1) % nCommandButtons(); }
    function resetButton() { buttonIx = 0; }
    function toggle() {
        var toAdd, toRemove;
        var rowq = $(rowElem);
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
        var currentButton = getCommandButtons()[buttonIx];
        currentButton.toggle();
        currentButton.say();
        function callback() {
            var tailCall = ((buttonIx < nCommandButtons() - 1) ?
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
        var currentButton = getCommandButtons()[buttonIx];
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
    var buttonElem = buttonInput;
    var buttonText = buttonElem.value;
    var buffer = inputBuffer;
    function say() {
        var utterance = new window.SpeechSynthesisUtterance(buttonText);
        utterance.lang = "en-US";
        window.speechSynthesis.speak(utterance);
    }
    // TODO: refactor this. it's redundant
    function toggle() {
        var toAdd, toRemove;
        var buttonq = $(buttonElem);
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
    var sliderElem = $("#slider");
    var sliderValue = $("#slider-value");
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
    var bufferElem = $("#textBuffer");
    var textElem = bufferElem.find("p");
    var bufferText = "";
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
function registerColorDetector() {
    // TODO: Make the frame rate slower. We don't need it to update super
    // quickly
    var colors = new tracking.ColorTracker(['yellow']);

     colors.on('track', function(event) {
         if (event.data.length === 0) {
             // No colors were detected in this frame.
             console.log("Nothing happened.");
         } else {
             event.data.forEach(function(rect) {
                 console.log(rect.x, rect.y, rect.height, rect.width, rect.color);
             });
         }
     });
    tracking.track('#webcamFeed', colors, {camera: true});
}

// Helper functions
function curry(func, ...first) {
    return function(...second) {
        return func(...first, ...second);
    };
}
