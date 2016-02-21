"use strict";
// This is scratch code to figure out the optimal number of columns in the grid
// to be scanned. It incorporates English language word frequencies to determine
// the expected number of transitions required to type a letter.

// Letter frequencies, from Wikipedia: https://en.wikipedia.org/wiki/Letter_frequency
var frequencies = { a: {weight: 0.08167, ix: 0},
                    b: {weight: 0.01492, ix: 1},
                    c: {weight: 0.02782, ix: 2},
                    d: {weight: 0.04253, ix: 3},
                    e: {weight: 0.12702, ix: 4},
                    f: {weight: 0.02228, ix: 5},
                    g: {weight: 0.02015, ix: 6},
                    h: {weight: 0.06094, ix: 7},
                    i: {weight: 0.06966, ix: 8},
                    j: {weight: 0.00153, ix: 9},
                    k: {weight: 0.00772, ix: 10},
                    l: {weight: 0.04025, ix: 11},
                    m: {weight: 0.02406, ix: 12},
                    n: {weight: 0.06749, ix: 13},
                    o: {weight: 0.07507, ix: 14},
                    p: {weight: 0.01929, ix: 15},
                    q: {weight: 0.00095, ix: 16},
                    r: {weight: 0.05987, ix: 17},
                    s: {weight: 0.06327, ix: 18},
                    t: {weight: 0.09056, ix: 19},
                    u: {weight: 0.02758, ix: 20},
                    v: {weight: 0.00978, ix: 21},
                    w: {weight: 0.02361, ix: 22},
                    x: {weight: 0.00150, ix: 23},
                    y: {weight: 0.01974, ix: 24},
                    z: {weight: 0.00074,  ix: 25} };

// Check that frequencies sum to 1, or close
function checkNormalized(frequencies) {
    var total = (Object.keys(frequencies).
                 map(function(key) { return frequencies[key]["weight"]; }).
                 reduce(function(x, y) { return x + y; }));
    console.log(total);
}

// Return an object with the row and column of the entry
function getPosition(entry, nCols) {
    return { row: Math.floor(entry.ix / nCols),
             col: entry.ix % nCols };
}

// Draw what the grid would look like with the given number of columns
function drawGrid(freqs, nCols) {
    function applied(key) {
        var entry = freqs[key];
        var pos = getPosition(entry, nCols);
        if (pos.col === 0) {
            process.stdout.write((pos.row + 1).toString() + " ");
        }
        process.stdout.write(key + " ");
        if (pos.col === nCols - 1) {
            process.stdout.write("\n");
        }
    }
    return Object.keys(freqs).forEach(applied);
}

// The expected of number of steps required per letter spelled.
// A single step coresponds to the lighting up of a single box.
function expectedSteps(freqs, nCols) {
    if (nCols === 1) {
        return expectedStepsOne(freqs);
    } else {
        return expectedStepsMore(freqs, nCols);
    }
}

// If only 1 column, no need to number the rows. Just step thru letters
// directly.
function expectedStepsOne(freqs) {
    function mapped(key) {
        var entry = freqs[key];
        return entry.weight * (entry.ix + 1);
    }
    return Object.keys(freqs).map(mapped).reduce(add);
}

// If more than 1 column, we to figure out the row and column
function expectedStepsMore(freqs, nCols) {
    function mapped(key) {
        var entry = freqs[key];
        var pos = getPosition(entry, nCols);
        var nSteps = pos.row + pos.col + 2;
        return entry.weight * nSteps;
    }
    return Object.keys(freqs).map(mapped).reduce(add);
}

function add(x, y) { return x + y; }

////////////////////////////////////////////////////////////////////////////////

// Function that runs if called from console

// Display number of expected steps for a variety of values of nCols
function displayExpectedSteps() {
    function applied(nCols) {
        var nSteps = expectedSteps(frequencies, nCols);
        var writeMe = nCols.toString() + ": " + nSteps.toString() + "\n";
        process.stdout.write(writeMe);
    }
    [1,2,3,4,5,6,7,8,9,10].forEach(applied);
}

displayExpectedSteps();
