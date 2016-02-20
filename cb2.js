"use strict";

$(document).ready(function() {
    setupSlider();
    setupButtons();
    var grid = setupGrid();
    grid.scan();
});

var setupSlider = function() {
    var s = $("#slider");
    var stop = function(event) {
        $("#slider-value")[0].innerText = $(this).slider("value");
    };
    s.slider({ min: 5,
               max: 50,
               value: 2,
               stop: stop});
};

// read word aloud
var readOut = function(word) {
    var utterance = new window.SpeechSynthesisUtterance(word);
    utterance.lang = "en-US";
    window.speechSynthesis.speak(utterance);
};

var setupButtons = function() {
    var buttons = $("input");
    var onClick = function(event) {
        readOut(this.value);
    };
    buttons.click(onClick);
};

var scan = function(grid, ix) {
    // scan the grid
    var button = grid.buttons[ix]; // retrieve the active button
    button.className = "btnOn";
    readOut(button.value);
    var nextIx = (ix + 1) % grid.nButtons;
    setTimeout(
        function() {
            button.className = "btnOff";
            scan(grid, nextIx);
        },
        1000);
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
        debugger;
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
