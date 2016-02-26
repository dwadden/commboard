"use strict";

// TODO: If she keeps her eyes up long enough, stop the program and return to
// the main menu. Equivalent to triggering the reset button.



function makeMenu(spec) {
    let buttons = makeButtons();

    function scan() {
        for (let button of buttons) {
            // do stuff
        }
    }

}

function makeButton() {

    function say() {
        ;
    }

    function toggle() {
        ;
    }

    function action() {
        ;
    }

}

// Temporary function so I'll see what the color tracker looks like on screen
function setupCam() {
    let colors = new tracking.ColorTracker(['yellow']);
    colors.on('track', function(event) {
        if (event.data.length === 0) {
            // No colors were detected in this frame.
            noDetection();
        } else {
            detection();
        }
    });
    tracking.track('#cam', colors, {camera: true});
}

function noDetection() {
    ;
}

function detection() {
    ;
}

// Temporary function so I'll see what the slider looks like
function makeSlider() {
    let sliderElem = $("#slider");
    let sliderValue = $("#sliderValue");
    // function stop(event) {
    //     $("#slider-value")[0].innerText = $(this).slider("value");
    // }
    function stop(event) {
        ;
    }
    sliderElem.slider({ min: 0,
                        max: 50,
                        value: 20,
                        stop: stop});
}
