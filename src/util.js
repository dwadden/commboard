"use strict";

// Helper procedures

// A shared audio context
const audioContext = new window.AudioContext();

// Exports
module.exports = { audioContext,
                   speak,
                   read,
                   notImplemented,
                   curry,
                   repeat,
                   pad,
                   capitalize,
                   zip,
                   pass };

// Speak text out loud, using the supplied voice..
function speak(text, voice) {
    const LANG = "en-US";            // Dialect for speech synthesis
    let utterance = new window.SpeechSynthesisUtterance(text);
    utterance.lang = LANG;
    utterance.voice = voice;
    window.speechSynthesis.speak(utterance);
    return utterance;
}
// Speak the text. Instead of returning, invoke a callback when speech is
// finished. Bind the utterance to an element in the dom so that it doesn't get
// garbage-collected.
function read(text, cb, element, delay = 1000) {
    function afterRead() {
        setTimeout(cb, delay);
    }
    let utterance = speak(text);
    utterance.onend = afterRead;
    element.utterance = utterance;
}
function notImplemented () {
    throw new Error("Not implemented.");
}
function curry(func, ...first) {
    return function(...second) {
        return func(...first, ...second);
    };
}
// Return an array consisting of element x repeated n times.
function repeat(x, n) {
    let xs = new Array(n);
    xs.fill(x);
    return xs;
}
// Pad (on right) array xs with value fill, such that the returned array has
// length "len"
function pad(xs, fillVal, len) {
    if (xs.length >= len) {
        return xs.slice(0, len);
    }
    let nMissing = len - xs.length;
    let padding = repeat(fillVal, nMissing);
    return xs.concat(padding);
}
// Convert first letter of word to uppercase
function capitalize(text) {
    return text[0].toUpperCase() + text.slice(1);
}
// Zip two arrays. If unequal lengths, truncate the longer.
function zip(xs, ys) {
    if (xs.length === 0 || ys.length === 0) {
        return [];
    } else {
        return Array.prototype.concat([[xs[0], ys[0]]],
                                      zip(xs.slice(1), ys.slice(1)));
    }
}
// A function that does nothing
function pass() {}
