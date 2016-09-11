"use strict";

const EventEmitter = require("events");
const util = require("./util.js");

// ************************************************************************** //

// This module exposes a function called detector, which creates a detector
// object. Since different users will have different needs and abilities, this
// object can be set to detect different types of gestures.
// At present two gestures are implemented: a detector recognizing an upward
// gaze can be constructed using makeGazeDetector, while a detector for
// recognizing the pressing of the "shift" key can be constructed using
// makeKeyDetector. This detector is of most use for debugging.
// New detector constructors can be registered using registerConstructor.
// The UI presents a dropdown menu allowing for the selection of a detection
// mode. It generates that menu based on all available constructors in the
// global "constructors" table.
// The exported detector constructor creates an object that encapsulates a
// specific detector type. When the user selects a new detector type from the
// dropdown, the constructor for that specific detector is called, and the newly
// created object is set as the prototype for the wrapper object created by
// "detector".

let constructors = {};
function registerConstructor(type, constructor) {
    // Register a detector constructor.
    constructors[type] = constructor;
}

function detector(spec) {
    // Create the detector object exposed to the rest of the program. This
    // object is merely a wrapper around an object created by one of the
    // constructors below. The prototype associated with this object changes
    // when the user selects a new detector; this means that, to the rest of the
    // program, nothing changes. It can interact with the same wrapper,
    // regardless of the implementation chosen by the user.
    let DEFAULT_MODE = "gaze";
    let detElem = document.querySelector("select[name=detector]");
    let that = Object.create(constructors[DEFAULT_MODE](spec));

    function populateOptions() {
        // Initialize the dropdown list of available detectors.
        function each(key) {
            let opt = document.createElement("option");
            opt.value = key;
            opt.text = util.capitalize(key);
            detElem.add(opt);
        }
        Object.keys(constructors).forEach(each);
        detElem.value = DEFAULT_MODE;
    }

    function change(e) {
        // To be executed when the user selects a different detector.
        let key = e ? e.target.value : DEFAULT_MODE;
        let activeDetector = constructors[key](spec);
        Object.setPrototypeOf(that, activeDetector);
    }

    populateOptions();
    detElem.addEventListener("change", change);
    return that;
}

module.exports = detector;

// ************************************************************************** //

function makeGenericDetector(spec, my) {
    // Create an object with data and methods shared by all detectors. As
    // elsewhere in this program, "my" holds shared secrets while "that" exposes
    // a public interface.

    my = my || {};
    Object.assign(my, spec);
    // Private data. Two items warrent further explanation.
    //  status: A state variable containing the current status of the
    //      detector. This state variable is always in English.
    //  statusMap: A map whose keys are state variables. For each key, the value
    //      is a map from language to the text that should be displayed in the
    //      actual status area. Doing things this way separates the way the
    //      status is stored internal to the object from the way it is
    //      represented outside.
    let myData = {
        statusElem: document.getElementById("detectorStatus"),
        emitter: new EventEmitter(),
        status: null,
        statusMap: { idle: {en: "idle", fr: "repos"},
                     listening: {en: "listening", fr: "écoute"},
                     scanning: {en: "scanning", fr: "balayage"} }
    };
    Object.assign(my, myData);

    // Private methods.
    let myMethods1 = {
        emitGestureStart: () => my.emitter.emit("gestureBegin"),
        emitGestureEnd: () => my.emitter.emit("gestureEnd"),
        setStatusText: function(status, language) {
            // Update the actual text in the DOM indicating the detector status.
            let p = my.statusElem.querySelector("p");
            let statusName = my.statusMap[my.status][language];
            p.innerHTML = util.capitalize(statusName);
        }
    };
    Object.assign(my, myMethods1);
    // More private methods, which rely on those above.
    let myMethods2 = {
        setStatus: function(newStatus) {
            // Update the status of the detector object.
            let oldStatus = my.status;
            let language = my.settings.getLanguageSettings().getLanguage();
            my.status = newStatus;
            my.setStatusText(my.status, language);
            if (oldStatus !== undefined) {
                my.statusElem.classList.toggle(oldStatus);
            }
            my.statusElem.classList.toggle(my.status);
        },
        translateStatus: function() {
            // Translate the detector status without changing it. To be invoked
            // when the user changes languages/
            let newLanguage = my.settings.getLanguageSettings().getLanguage();
            my.setStatusText(my.status, newLanguage);
        }
    };
    Object.assign(my, myMethods2);

    // Public objects.
    let that = {
        idleMode: () => my.setStatus("idle"),
        listenMode: () => my.setStatus("listening"),
        scanMode: () => my.setStatus("scanning"),
        addBeginListener: (listener) => my.emitter.addListener("gestureBegin", listener),
        addEndListener: (listener) => my.emitter.addListener("gestureEnd", listener),
        removeBeginListener: (listener) => my.emitter.removeListener("gestureBegin", listener),
        removeEndListener: (listener) => my.emitter.removeListener("gestureEnd", listener)
    };

    // Add listeners, initialize, and return.
    my.settings.getLanguageSettings().addChangeListener(my.translateStatus);
    that.idleMode();
    return that;
}

// ************************************************************************** //

function makeKeyDetector(spec, my) {
    // Create a detector that awaits a press of the "shift" key from the
    // user. For debugging purposes mainly.

    my = my || {};
    let that = makeGenericDetector(spec, my);

    function emitIfShift(event, signal) {
        let conditions = [!event.altKey,
                          !event.ctrlKey,
                          !event.metaKey,
                          event.keyIdentifier === "Shift" ];
        if (util.all(conditions)) {
            signal();
        }
    }

    let myExtensions = {
        onKeyDown: (e) => emitIfShift(e, my.emitGestureStart),
        onKeyUp: (e) => emitIfShift(e, my.emitGestureEnd)
    };
    Object.assign(my, myExtensions);

    document.addEventListener("keydown", my.onKeyDown);
    document.addEventListener("keyup", my.onKeyUp);

    return that;
}
registerConstructor("key", makeKeyDetector);

// ************************************************************************** //

function makeGazeDetector(spec, my) {
    // Creates a gaze detector. This detector respects the interface of the
    // generic detector. The gesture for which it looks is an upward gaze as
    // detected by a camera.

    // Constants
    const REFRESH_RATE_LISTEN = 5; // When listening, check the camera 5 times a second.
    const REFRESH_RATE_SCAN = 20; // When scanning, check 20 times a second.

    my = my || {};
    let that = makeGenericDetector(spec, my);

    let stream = makeVideoStream();
    let myData = {
        vs: stream,
        rest: makeTemplate("rest", stream),
        gaze: makeTemplate("gaze", stream),
        state: "rest",
        interval: null
    };
    Object.assign(my, myData);

    let myMethods = {
        detect: function() {
            // Compares current video frame to templates. Emits events if change occurred.
            let streamPixels = my.vs.getPixels();
            let dRest = l1Distance(streamPixels, my.rest.getPixels());
            let dGaze = l1Distance(streamPixels, my.gaze.getPixels());
            let newState = (dGaze < dRest) ? "gaze" : "rest";
            if (my.state === "rest" & newState === "gaze") {
                my.emitGestureStart();    // If we went from resting to gazing, then the gaze started.
            }
            if (my.state === "gaze" & newState === "rest") {
                my.emitGestureEnd();      // If we went from gaze to rest, then the gaze ended.
            }
            my.state = newState;
        }
    };
    Object.assign(my, myMethods);

    // Store methods from the parent class so that they can be invoked by
    // newline defined functions of the child class sharing the same name.
    let supers = { idleMode: that.idleMode,
                   listenMode: that.listenMode,
                   scanMode: that.scanMode };
    // The returned object
    let thatAssignments = {
        idleMode: function() {
            supers.idleMode();
            window.clearInterval(my.interval);
        },
        listenMode: function() {
            supers.listenMode();
            window.clearInterval(my.interval);
            my.interval = window.setInterval(my.detect, 1000 / REFRESH_RATE_LISTEN);
        },
        scanMode: function() {
            supers.scanMode();
            window.clearInterval(my.interval);
            my.interval = window.setInterval(my.detect, 1000 / REFRESH_RATE_SCAN);
        }
    };
    Object.assign(that, thatAssignments);

    // Initialize and return.
    return that;
}
registerConstructor("gaze", makeGazeDetector);

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
    let stream;

    function stopCurrentStream() {
        // When a camera switch happens, stop getting data from the old camera.
        if (stream !== undefined) {
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
    sourceElem.addEventListener("change", initStream);
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
    button.addEventListener("click", capture);
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
