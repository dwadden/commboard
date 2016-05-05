"use strict";

// The constructor exported by this module makes a detector object. The detector
// recognizes gazes, currently via template matching. When the "start" button on
// the UI is pressed, it fires events when it recognizes the beginning or end of
// an upward gaze.

const EventEmitter = require("events");
const util = require("./util.js");

module.exports = { makeDetector };

function makeDetector() {
    // Top-level constructor. Makes a detector object that fires events when the
    // gaze state changes.

    // Inherit from EventEmitter
    let that = Object.create(EventEmitter.prototype);

    // Constants
    const REST = Symbol("rest");
    const GAZE = Symbol("gaze");
    const REFRESH_RATE_LISTEN = 5; // When listening, check the camera 5 times a second.
    const REFRESH_RATE_SCAN = 20; // When scanning, check 20 times a second.

    // Locals
    let vs = makeVideoStream();
    let rest = makeTemplate("rest", vs);
    let gaze = makeTemplate("gaze", vs);
    let state = REST;
    let interval, refreshRate;

    // Private methods
    function detect() {
        // Compares current video frame to templates, emits events if change occurred.
        let streamPixels = vs.getPixels();
        let dRest = l1Distance(streamPixels, rest.getPixels());
        let dGaze = l1Distance(streamPixels, gaze.getPixels());
        let newState = (dGaze < dRest) ? GAZE : REST;
        if (state === REST & newState === GAZE) {
            emitGazeStart();    // If we went from resting to gazing, then the gaze started.
        }
        if (state === GAZE & newState === REST) {
            emitGazeEnd();      // If we went from gaze to rest, then the gaze ended.
        }
        state = newState;
    }
    function emitGazeStart() {
        that.emit("gazeBegin");
    }
    function emitGazeEnd() {
        that.emit("gazeEnd");
    }
    function start() {
        // Listen for detections.
        let intervalTime = 1000 / refreshRate;
        interval = window.setInterval(detect, intervalTime);
    }
    function stop() {
        // Stop listening.
        window.clearInterval(interval);
        interval = null;
    }

    // Public methods
    that.idleMode = function() {
        // Detector is idle.
        window.clearInterval(interval);
    };
    that.listenMode = function() {
        // When user isn't scanning, listen for input 5 times a second.
        window.clearInterval(interval);
        interval = window.setInterval(detect, 1000 / REFRESH_RATE_LISTEN);
    };
    that.scanMode = function() {
        // When user is scanning, listen for input 20 times a second.
        window.clearInterval(interval);
        interval = window.setInterval(detect, 1000 / REFRESH_RATE_SCAN);
    };
    that.addBeginListener = function(listener) {
        that.addListener("gazeBegin", listener);
    };
    that.addEndListener = function(listener) {
        that.addListener("gazeEnd", listener);
    };
    that.removeBeginListener = function(listener) {
        that.removeListener("gazeBegin", listener);
    };
    that.removeEndListener = function(listener) {
        that.removeListener("gazeEnd", listener);
    };

    // Listen key presses as alternatives to gazes
    // TODO: May want to factor this out into separate detectors.
    window.onkeyup = function(event) {
        if (event.keyIdentifier === "Up") {
            emitGazeEnd();
        }
    };
    window.onkeydown = function(event) {
        if (event.keyIdentifier === "Up") {
            emitGazeStart();
        }
    };

    // Initialize and return.
    that.idleMode();
    return that;
}

function makeVideoStream() {
    // Create video stream object.

    // Locals
    let video = document.querySelector("video");
    let cc = makeCanvasContainer("video");
    let sourceElem = getVideoSource();
    let stream = null;

    // Private methods
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

    // Bind event handlers, initialize, return
    sourceElem.onchange = initStream;
    initStream();
    return { getVideo, getPixels };
}

function makeTemplate(name, videoStream) {
    // Template object constructor

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

function getVideoSource() {
    // Initialize the list of sources for the video stream and return the element.
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
        util.notImplemented();
    }
    // Initialize and return
    navigator.mediaDevices.enumerateDevices().then(success).catch(failure);
    return sourceElem;
}

function makeCanvasContainer(name) {
    // Initialize a canvas; return the canvas, its context, and its dimensions.

    // Constants
    const VIDEO_HEIGHT = 120;   // Values here should match up with values in cbstyle.css
    const VIDEO_WIDTH = 160;    // Input camera should have a 4:3 aspect ratio.

    let canvas = document.querySelector(`canvas[data-canvas-id=${name}]`);
    canvas.setAttribute("height", VIDEO_HEIGHT);
    canvas.setAttribute("width", VIDEO_WIDTH);
    let context = canvas.getContext("2d");
    return { canvas, context, width: canvas.width, height: canvas.height };
}

function l1Distance(img1, img2) {
    // Compute the L1 distance between two imageData objects. Used by the gaze
    // detector.
    // Info on imageData object here: https://developer.mozilla.org/en-US/docs/Web/API/ImageData
    let { width, height } = checkDimensions(img1, img2);
    let x1 = img1.data;
    let x2 = img2.data;
    let distance = 0;
    let ixMax = width * height * 4;
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

function checkDimensions(img1, img2) {
    // Make sure that the image dimensions match up. If so, return width and height.
    let matchWidth = img1.width === img2.width;
    let matchHeight = img1.height === img2.height;
    if (matchWidth & matchHeight) {
        return { width: img1.width, height: img1.height };
    }
    else {
        throw new Error("Image dimensions do not match.");
    }
}
