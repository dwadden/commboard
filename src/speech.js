"use strict";

// Code pertaining to voice synthesis and speech for the program.

// A shared audio context
const audioContext = new window.AudioContext();

// Module variables.
let voices = null;          // The initial voice list and current voice are null.
let voice = null;           // Initially, the current

function getVoiceElem() {
    return document.querySelector("select[name=voice]");
}

function getDemoElem() {
    return document.querySelector("input[type=button][value=Demo]");
}

function speak(text) {
    const LANG = "en-US";            // Dialect for speech synthesis
    let utterance = new window.SpeechSynthesisUtterance(text.toLowerCase());
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

function initVoices() {
    // Update the voice dropdown menu.
    let voiceElem = getVoiceElem();
    let demoElem = getDemoElem();
    function each(entry, ix) {
        // Performed for each entry in the array of voices.
        let name = entry.name;
        let opt = document.createElement("option");
        opt.value = ix;
        opt.text = name;
        voiceElem.add(opt);
    }
    function inEnglish(voice) {
        return voice.lang.includes("en");
    }
    voices = window.speechSynthesis.getVoices().filter(inEnglish);
    voices.forEach(each);
    updateVoice();
    voiceElem.onchange = updateVoice;                    // Update voice when selection made.
    demoElem.onclick = demo;                             // Speak current voice as demo.
}

function updateVoice() {
    // Call this whenever the user changes the voice button.
    let voiceElem = getVoiceElem();
    let ix = parseInt(voiceElem.value);
    voice = voices[ix];
}

function demo() {
    // Speak a demo with the current voice.
    let msg = `Hello, my name is ${voice.name}`;
    speak(msg, voice);
}


// Initialize once voices are loaded.
window.speechSynthesis.onvoiceschanged = initVoices;

// Exports.
module.exports = { audioContext, speak, read };
