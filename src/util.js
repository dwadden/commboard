"use strict";

const _ = require("underscore");

// Helper procedures

// Exports
module.exports = { repeat,
                   pad,
                   capitalize,
                   all,
                   renameKeys };

function repeat(x, n) {
    // Return an array consisting of element x repeated n times.
    let xs = new Array(n);
    xs.fill(x);
    return xs;
}

function pad(xs, fillVal, len) {
    // Pad (on right) array xs with value fill, such that the returned array has
    // length "len"
    if (xs.length >= len) {
        return xs.slice(0, len);
    }
    let nMissing = len - xs.length;
    let padding = repeat(fillVal, nMissing);
    return xs.concat(padding);
}

function capitalize(text) {
    // Convert first letter of word to uppercase
    return text[0].toUpperCase() + text.slice(1);
}

function all(xs) {
    // Return true if all elements of xs are true.
    return _.every(xs, (x) => x);
}

function renameKeys(obj, keys) {
    // keys is a list of [old, replacement] pairs.
    function each(pair) {
        let oldKey = pair[0];
        let newKey = pair[1];
        obj[newKey] = obj[oldKey];
        delete obj[oldKey];
    }
    keys.forEach(each);
    return obj;
}
