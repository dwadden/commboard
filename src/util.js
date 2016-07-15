"use strict";

// Helper procedures

// Exports
module.exports = { repeat,
                   pad,
                   capitalize,
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
