"use strict";

// start the driver loop when the document is loaded
// $(document).ready(function() { driverLoop(); });

// The driver loop
var driverLoop = function() {
    setupSlider();
    var buffer = makeBuffer();
    var grid = makeGrid(buffer);
    registerKeyPress(grid);
    grid.scan();
};

// when a key is pressed, dispatch it to the grid
var registerKeyPress = function(grid) {
    $(document)[0].onkeypress = function(event) { grid.action(event); };
};

var setupSlider = function() {
    var s = $("#slider");
    var stop = function(event) {
        $("#slider-value")[0].innerText = $(this).slider("value");
    };
    s.slider({ min: 0,
               max: 50,
               value: 20,
               stop: stop});
};

// grid constructor
var makeGrid = function(inputBuffer) {
    var gridElem = $("#grid");
    var rowElems = gridElem.find(".rowOff");
    var buffer = inputBuffer;             // a passed-in buffer object
    var initRows = function(rowElems) {
        var curried = curry(makeRow, inputBuffer);
        return rowElems.toArray().map(curried); // jquery's map is wrong; us the ES5 version
    };
    var rows = initRows(rowElems);
    var rowIx = 0;         // index of current highlighted row
    var timeout = null;
    var nRows = function() {
        return rows.length;
    };
    var getRows = function() {
        return rows;
    };
    var nextRow = function() {
        rowIx = (rowIx + 1) % nRows();
    };
    var resetRow = function() {
        rowIx = 0;
    };
    var resetTimeout = function() {
        clearTimeout(timeout);
        timeout = null;
    };
    var scan = function() {     // scan the rows
        var currentRow = rows[rowIx];
        currentRow.toggle();
        var currentButton = currentRow.getIdButton();
        currentButton.toggle();
        currentButton.say();
        var callback = function() {
            currentRow.toggle();
            currentButton.toggle();
            nextRow();
            scan();
        };
        timeout = setTimeout(callback, 1000);
    };
    var action = function(event) {
        resetTimeout();
        var currentRow = rows[rowIx];
        var onReturnNoSelection = function() {
            currentRow.toggle();
            nextRow();
            $(document)[0].onkeypress = function(event) { action(event); };
            scan();
        };
        var onReturnSelection = function() {
            currentRow.toggle();
            resetRow();
            $(document)[0].onkeypress = function(event) { action(event); };
            scan();
        };
        var callback1 = function() {
            var idButton = currentRow.getIdButton();
            idButton.say();
            var callback2 = function() {
                idButton.toggle();
                $(document)[0].onkeypress = function(event) { currentRow.action(event, onReturnSelection); };
                currentRow.scan(onReturnNoSelection);
            };
            setTimeout(callback2, 1000);
        };
        setTimeout(callback1, 250);
    };
    return Object.freeze({nRows, getRows, nextRow, scan, action});
};

// row constructor
var makeRow = function(inputBuffer, rowInput) {
    var rowElem = rowInput;
    var buttonElems = $(rowElem).find(".btnOff");
    var buffer = inputBuffer;
    var makeButtons = function(buttonElems) {
        var curried = curry(makeCommButton, buffer);
        return buttonElems.toArray().map(curried); // as above, jquery map() is wrong
    };
    var buttons = makeButtons(buttonElems);
    var buttonIx = 0;      // index of current highlighted button
    var timeout = null;
    var getIdButton = function() {
        return buttons[0];
    };
    var getCommandButtons = function() {
        return buttons.slice(1);
    };
    var nCommandButtons = function() {
        return getCommandButtons().length;
    };
    var nextButton = function() {
        buttonIx = (buttonIx + 1) % nCommandButtons();
    };
    var resetButton = function() {
        buttonIx = 0;
    };
    var toggle = function() {
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
    };
    var scan = function(fromCaller) {
        var currentButton = getCommandButtons()[buttonIx];
        currentButton.toggle();
        currentButton.say();
        var callback;
        var tailCall = ((buttonIx < nCommandButtons() - 1) ?
                        function () { scan(fromCaller); } :
                        fromCaller);
        callback = function() {
            currentButton.toggle();
            nextButton();
            tailCall();
        };
        timeout = setTimeout(callback, 1000); // Advance to next button
    };
    var resetTimeout = function() {
        clearTimeout(timeout);
        timeout = null;
    };
    var action = function(event, fromCaller) {
        resetTimeout();
        var currentButton = getCommandButtons()[buttonIx];
        var callback1 = function() {
            currentButton.action();
            var callback2 = function() {
                currentButton.toggle();
                resetButton();
                fromCaller();
            };
            setTimeout(callback2, 1000);
        };
        setTimeout(callback1, 250);
    };
    return Object.freeze({getIdButton, getCommandButtons, nextButton,
                          toggle, scan, action});
};

// console button constructor
var makeCommButton = function(inputBuffer, buttonInput) {
    var buttonElem = buttonInput;
    var buttonText = buttonElem.value;
    var buffer = inputBuffer;
    var say = function() {
        var utterance = new window.SpeechSynthesisUtterance(buttonText);
        utterance.lang = "en-US";
        window.speechSynthesis.speak(utterance);
    };
    var toggle = function() {
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
    };
    var getText = function() {
        return buttonText;
    };
    var action = function() {
        say();
        buffer.push(buttonText);
    };
    return Object.freeze({say, toggle, getText, action});
};

// menu constructor
var makeMenu = function() {
    ;
};

// buffer constructor
var makeBuffer = function() {
    var bufferElem = $("#textBuffer");
    var textElem = bufferElem.find("p");
    var bufferText = "";
    var getContents = function() {
        return bufferText;
    };
    var update = function() {
        textElem.text(bufferText);
    };
    var push = function(character) {
        bufferText += character;
        update();
    };
    var backspace = function() {
        bufferText = bufferText.slice(0, -1);
        update();
    };
    var clear = function() {
        bufferText = "";
        update();
    };
    return Object.freeze({getContents, push, backspace, clear});
};

var setupGrid = function() {
    var grid = {};
    grid.buttons = $("input");           // get the buttons
    grid.nButtons = grid.buttons.length; // number of buttons in grid
    grid.ix = 0;
    grid.increment = function() {
        this.ix = (this.ix + 1) % this.nButtons;
    };
    grid.reset = function() {
        this.ix = 0;
    };
    grid.scan = function() {
        var that = this;         // a hack since "this" is dumb
        var button = this.buttons[this.ix];
        button.className = "btnOn";
        readOut(button.value);
        var callback = function() {
            button.className = "btnOff";
            that.increment();
            that.scan();
        };
        this.timeout = setTimeout(callback, 1000);
    };
    grid.delegate = function(event) {
        clearTimeout(this.timeout);
        var that = this;
        var button = this.buttons[this.ix];
        readOut(button.value);
        var callback = function() {
            button.className = "btnOff";
            that.reset();
            that.scan();
        };
        this.timeout = setTimeout(callback, 1000);
    };
    var pause = function() {
        console.log("paused");
    };
    grid.actions = {112: pause};
    // Register handler to clear grid timeout
    $(document)[0].onkeypress = function(event) { grid.delegate(event); };
    return grid;
};

// Helper functions
function curry(func, ...first) {
    return function(...second) {
        return func(...first, ...second);
    };
};
