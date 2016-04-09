"use strict";

const EventEmitter = require("wolfy87-eventemitter");

// Initialize a canvas; return the canvas and its context.
function makeCanvasContainer(name) {
    const VIDEO_HEIGHT = 120;   // Values here should match up with values in cbstyle.css
    const VIDEO_WIDTH = 160;    // Input camera should have a 4:3 aspect ratio.

    let canvas = document.querySelector(`canvas[data-canvas-id=${name}]`);
    canvas.setAttribute("height", VIDEO_HEIGHT);
    canvas.setAttribute("width", VIDEO_WIDTH);
    let context = canvas.getContext("2d");
    return { canvas, context, width: canvas.width, height: canvas.height };
}

// Template object constructor
function makeTemplate(name, videoStream) {
    // Local variables
    let cc = makeCanvasContainer(name);
    let selector = `input[type=button][data-canvas-id=${name}]`;
    let button = document.querySelector(selector);
    // Methods
    function capture() {
        cc.context.drawImage(videoStream.getVideo(), 0, 0, cc.width, cc.height);
    }
    function getPixels() {
        return cc.context.getImageData(0, 0, cc.width, cc.height);
    }
    // Initialize and return
    button.onclick = capture;
    return { getPixels };
}

// Initialize the list of sources for the video stream and return the element.
function getVideoSource() {
    let sourceElem = document.querySelector("select[name=videoSource]");
    function success(devices) {
        function appendIfVideo(device) {
            if (device.kind === "videoinput") {
                let option = document.createElement("option");
                option.value = device.deviceId;
                option.text = device.label.replace(/ \(.*/, "");
                sourceElem.appendChild(option);
            }
        }
        devices.forEach(appendIfVideo);
    }
    function failure(err) {
        debugger;
    }
    // Initialize and return
    navigator.mediaDevices.enumerateDevices().then(success).catch(failure);
    return sourceElem;
}

function makeVideoStream() {
    let video = document.querySelector("video");
    let cc = makeCanvasContainer("video");
    let sourceElem = getVideoSource();
    let stream = null;

    // Helper methods
    function stopCurrentStream() {
        // When a camera switch happens, stop getting data from the old camera.
        if (stream !== null) {
            stream.getTracks()[0].stop();
        }
    }
    function initStream() {
        let constraints = { video: {
            optional: [{
                sourceId: sourceElem.value
            }]
        }};
        stopCurrentStream();
        navigator.webkitGetUserMedia(constraints, handleVideo, videoError);
    }
    function handleVideo(videoStream) {
        stream = videoStream;   // Keep the new stream around so it can be stopped later
        video.src = window.URL.createObjectURL(videoStream);
    }
    function videoError(e) {
        debugger;
    }
    // Public methods
    function getVideo() {
        return video;
    }
    function getPixels() {
        // To do this, we write the current video frame to a canvas and grab its pixels.
        cc.context.drawImage(video, 0, 0, cc.width, cc.height);
        return cc.context.getImageData(0, 0, cc.width, cc.height);
    }
    // Bind event handlers
    sourceElem.onchange = initStream;
    // Initialize and return
    initStream();
    return { getVideo, getPixels };
}

// Compute the L1 distance between two imageData objects. Used by the gaze
// detector.
// Info on imageData object here: https://developer.mozilla.org/en-US/docs/Web/API/ImageData
function l1Distance(img1, img2) {
    let { width, height } = checkDimensions(img1, img2);
    let x1 = img1.data;
    let x2 = img2.data;
    let distance = 0;
    let ixMax = width * height * 4;
    // TODO: Is this idiom efficient in Javascript?
    // TODO: Downsample. This is probably more data than we need.
    for (let i = 0; i < ixMax; i++) {
        if (i % 4 === 3) {
            continue;           // Don't compare the alpha values.
        }
        else {
            distance += Math.abs(x1[i] - x2[i]);
        }
    }
    return distance;
}

// Make sure that the image dimensions match up. If so, return width and height.
function checkDimensions(img1, img2) {
    let matchWidth = img1.width === img2.width;
    let matchHeight = img1.height === img2.height;
    if (matchWidth & matchHeight) {
        return { width: img1.width, height: img1.height };
    }
    else {
        throw new Error("Image dimensions do not match.");
    }
}

function makeDetector() {
    // Constants
    const REFRESH_RATE = 20;        // Check the video feed 30 times a second.

    // Locals
    let vs = makeVideoStream();
    let rest = makeTemplate("rest", vs);
    let gaze = makeTemplate("gaze", vs);
    let button = document.querySelector("input[type=button][value=Begin]");

    // Methods
    function detect() {
        let streamPixels = vs.getPixels();
        debugger;
        let dRest = l1Distance(streamPixels, rest.getPixels());
        let dGaze = l1Distance(streamPixels, gaze.getPixels());
        if (dGaze < dRest) {
            console.log("Detection.");
        }
    }
    function begin() {
        let intervalTime = 1000 / REFRESH_RATE;
        window.setInterval(detect, intervalTime);
    }

    // Initialize and return object.
    button.onclick = begin;
    return { detect, begin };
}

function oldDetector() {
    let that = Object.create(EventEmitter.prototype); // Inherit from EventEmitter





    // Constants and magic numbers. Can be changed depending on client needs.
    const ON = Symbol("on");
    const OFF = Symbol("off");
    const GAZE_TIME = 100;      // duration (s) for which gaze must be held
    const EXTENDED_GAZE_TIME = 2000; // duration (s) for extended gaze; triggers reset
    const MIN_N_CHANGED = 10;          // if in "off" state, need 10 consecutive
    const TRACKER_COLOR = "yellow";    // detections to switch to "on", and vice versa

    // Local variables
    let startTime = null;              // start time for most recent upward gaze
    let state = OFF;
    let nChanged = 0;           // # consecutive detections that state has changed

    // Local procedures
    function time() {
        return new Date().getTime();
    }
    // Function to call if there is a detection in the current frame.
    function detection() {
        if (state === OFF) {
            nChanged += 1;
            if (nChanged >= MIN_N_CHANGED) {
                gazeOn();
            }
        } else {
            nChanged = 0;
        }
    }
    // Function to call for no detection.
    function noDetection() {
        if (state === ON) {
            nChanged += 1;
            if (nChanged >= MIN_N_CHANGED) {
                gazeOff();
            }
        } else {
            nChanged = 0;
        }
    }
    // Gaze has changed state from off to on
    function gazeOn() {
        state = ON;
        startTime = time();     // Start the gaze timer.
    }
    // Gaze has changed state from on to off
    function gazeOff() {
        state = OFF;
        let elapsed = time() - startTime; // How long did the user gaze last
        let dispatch = ((elapsed < GAZE_TIME) ? function() { ; } :
                        ((elapsed < EXTENDED_GAZE_TIME) ?
                         emitGaze : emitExtendedGaze));
        dispatch();
        startTime = null;
    }
    // Emit a gaze event for listeners
    function emitGaze() {
        that.emitEvent("gaze");
    }
    // Emit an extended gaze event for listeners
    function emitExtendedGaze() {
        that.emitEvent("extendedGaze");
    }
    // Key presses can be used in place of gazes
    function onKeyDown(event) {
        let dispatch = new Map([[38, emitGaze], // 38 is up arrow key
                                [40, emitExtendedGaze]]); // 40 is down arrow key
        let f = dispatch.get(event.keyCode) || function() { ; };
        f();
    }

    // Public procedures
    /**
     * Add listener for gaze event.
     * @param {Function} listener - The listener.
     * @memberof Detector
     */
    that.addGazeListener = function(listener) {
        that.addListener("gaze", listener); // Can't do with currying b/c scope of "this"
    };
    /**
     * Add listener for extended gaze event.
     * @param {Function} listener - The listener.
     * @memberof Detector
     */
    that.addExtendedGazeListener = function(listener) {
        that.addListener("extendedGaze", listener);
    };
    /**
     * Remove listener for gaze event.
     * @param {Function} listener - The listener.
     * @memberof Detector
     */
    that.removeGazeListener = function(listener) {
        that.removeListener("gaze", listener);
    };
    /**
     * Remove listener extended for gaze event.
     * @param {Function} listener - The listener.
     * @memberof Detector
     */
    that.removeExtendedGazeListener = function(listener) {
        that.removeListener("extendedGaze", listener);
    };
    /**
     * Initialize tracking.
     * @memberof Detector
     */
    that.setupTracking = function() {
        util.notImplemented();
    };
    /**
     * Initialize key press event handling.
     * @memberof Detector
     */
    that.setupKeyDown = function() {
        document.addEventListener("keydown", onKeyDown);
    };

    return that;
}
