"use strict";

// The constructor exported by this module creates a detector object. The
// detector recognizes gazes, currently via template matching. After the "start"
// button on the UI is pressed, it fires events when it recognizes the beginning
// or end of an upward gaze.

const EventEmitter = require("events");
const util = require("./util.js");

module.exports = detector;

function detector() {
    // Constructor for a detector object that fires events when the gaze state
    // changes.
    // To determine whether the user is gazing upward or not, this
    // implementation computes the L1 distances between the current video frame
    // and each of the templates, and takes the closer. Many other ideas are
    // possible, but this one is quite simple and seems to work pleasingly well.

    // Constants
    const REST = Symbol("rest");
    const GAZE = Symbol("gaze");
    const REFRESH_RATE_LISTEN = 5; // When listening, check the camera 5 times a second.
    const REFRESH_RATE_SCAN = 20; // When scanning, check 20 times a second.

    // Locals
    let emitter = new EventEmitter();
    let vs = makeVideoStream();
    let rest = makeTemplate("rest", vs);
    let gaze = makeTemplate("gaze", vs);
    let state = REST;
    let statusElem = document.getElementById("detectorStatus");
    let interval, refreshRate, status;

    // Private methods
    function detect() {
        // Compares current video frame to templates. Emits events if change occurred.
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
    const emitGazeStart = () => emitter.emit("gazeBegin");
    const emitGazeEnd = () => emitter.emit("gazeEnd");
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
    function setStatus(newStatus) {
        // Update the DOM element indicating detector status.
        let p = statusElem.querySelector("p");
        let oldStatus = status;
        status = newStatus;
        p.innerHTML = util.capitalize(status);
        if (oldStatus !== undefined) {
            statusElem.classList.toggle(oldStatus);
        }
        statusElem.classList.toggle(status);
    }

    // The returned object
    let that = {
        idleMode: function() {
            // Detector is idle.
            setStatus("idle");
            window.clearInterval(interval);
        },
        listenMode: function() {
            // When user isn't scanning, listen for input 5 times a second.
            setStatus("listening");
            window.clearInterval(interval);
            interval = window.setInterval(detect, 1000 / REFRESH_RATE_LISTEN);
        },
        scanMode: function() {
            // When user is scanning, listen for input 20 times a second.
            setStatus("scanning");
            window.clearInterval(interval);
            interval = window.setInterval(detect, 1000 / REFRESH_RATE_SCAN);
        },
        addBeginListener: (listener) => emitter.addListener("gazeBegin", listener),
        addEndListener: (listener) => emitter.addListener("gazeEnd", listener),
        removeBeginListener: (listener) => emitter.removeListener("gazeBegin", listener),
        removeEndListener: (listener) => emitter.removeListener("gazeEnd", listener)
    };

    // Initialize and return.
    that.idleMode();
    return that;
}

function makeVideoStream() {
    // Create an object that wraps the incoming video stream.
    // Enables the user to select the video source using the dropdown menu in
    // the DOM.
    // Returns an object that exposes the video DON element, and the pixels for
    // the current video frame.

    // Private variables and methods.
    let video = document.querySelector("video");
    let cc = makeCanvasContainer("video");
    let sourceElem = getVideoSource();
    let stream = null;

    function stopCurrentStream() {
        // When a camera switch happens, stop getting data from the old camera.
        if (stream !== null) {
            stream.getTracks()[0].stop();
        }
    }

    function initStream() {
        // Initialize a new camera stream (and stop the old one if it exists).
        function handleVideo(videoStream) {
            // Keep a pointer the video stream around so it can be stopped later.
            stream = videoStream;
            video.src = window.URL.createObjectURL(videoStream);
        }
        function videoError(e) {
            throw new Error("Something went wrong with the video feed.");
        }
        let constraints = { video: {
            optional: [{
                sourceId: sourceElem.value
            }]
        }};
        stopCurrentStream();
        navigator.webkitGetUserMedia(constraints, handleVideo, videoError);
    }

    // The exposed object.
    let that = {
        getVideo: () => video,
        getPixels: function() {
            // Write the current video frame to an invisible canvas and grab its pixels.
            cc.context.drawImage(video, 0, 0, cc.getWidth(), cc.getHeight());
            return cc.context.getImageData(0, 0, cc.getWidth(), cc.getHeight());
        }
    };

    // Bind event handlers, initialize, return
    sourceElem.onchange = initStream;
    initStream();
    return that;
}

function makeTemplate(name, videoStream) {
    // Constructor for a template object.
    // Binds an event handler to the relevant "capture" button in the DOM, so
    // that when pressed it will create a template from the current video frame.
    // Exposes a method to retrieve the captured template's pixels.

    // Local variables and methods
    let cc = makeCanvasContainer(name);
    let selector = `input[type=button][data-canvas-id=${name}]`;
    let button = document.querySelector(selector);

    function capture() {
        // Procedure to capture the current video image as a template.
        cc.context.drawImage(videoStream.getVideo(), 0, 0, cc.getWidth(), cc.getHeight());
    }

    // The returned object.
    let that = {
        getPixels: () => cc.context.getImageData(0, 0, cc.getWidth(), cc.getHeight())
    };

    // Bind event handler and return.
    button.onclick = capture;
    return that;
}

function getVideoSource() {
    // Detects all available video input sources (e.g. MacBook pro camera, USB
    // cameras if attached, etc). Adds them as options in the relevant drop-down
    // menu in the app. Returns the DOM object for this menu.

    let sourceElem = document.querySelector("select[name=videoSource]");
    function success(devices) {
        // Invoked if the browser successfully enumerates all available media devices.
        function appendIfVideo(device) {
            // Add video devices to the dropdown list of available input sources.
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
        throw new Error("Video sources not correctly detected.");
    }

    // Initialize the list of available devices, and return the DOM object.
    navigator.mediaDevices.enumerateDevices().then(success).catch(failure);
    return sourceElem;
}

function makeCanvasContainer(name) {
    // Initialize a canvas. Return the canvas, its context, and getters for its dimenions.

    // Constants
    const VIDEO_HEIGHT = 120;   // Values here should match up with values in cbstyle.css
    const VIDEO_WIDTH = 160;    // Input camera should have a 4:3 aspect ratio.

    let canvas = document.querySelector(`canvas[data-canvas-id=${name}]`);
    canvas.setAttribute("height", VIDEO_HEIGHT);
    canvas.setAttribute("width", VIDEO_WIDTH);
    let context = canvas.getContext("2d");

    let that = { canvas,
                 context,
                 getWidth: () => canvas.width,
                 getHeight: () => canvas.height };
    return that;
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
    for (let i = 0; i < ixMax; i += 1) {
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
