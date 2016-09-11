"use strict";

// Code pertaining to speech synthesis and other sounds.

// Exports.
module.exports = speaker;

// A shared audio context
function speaker(settings) {

    const audioContext = new window.AudioContext();

    // Private variables
    let voices = null;          // The initial voice list and current voice are null.
    let voice = null;

    // Private methods
    const getVoiceElem = () => document.querySelector("select[name=voice]");
    const getDemoElem = () => document.querySelector("input[type=button][name=demo]");

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
        const inEnglish = (voice) => voice.lang.includes("en");
        voices = window.speechSynthesis.getVoices().filter(inEnglish);
        voices.forEach(each);
        updateVoice();
        voiceElem.addEventListener("change", updateVoice);   // Update voice when selection made.
        demoElem.addEventListener("click", demo);            // Speak current voice as demo.
    }

    function updateVoice() {
        // Call this whenever the user changes the voice button.
        let voiceElem = getVoiceElem();
        let ix = parseInt(voiceElem.value);
        voice = voices[ix];
    }


    // Public methods
    function speakSync(text) {
        // Speak the text, synchronously.
        const LANG = "en-US";            // Dialect for speech synthesis
        let utterance = new window.SpeechSynthesisUtterance(text.toLowerCase());
        utterance.lang = LANG;
        utterance.voice = voice;
        window.speechSynthesis.speak(utterance);
        return utterance;
    }

    function speakAsync(text, cb, element, delay = 1000) {
        // Speak the text, asynchronously. When finished, this procedure invokes a
        // callback to continue the program.
        // Note that a DOM element is passed in. The speech event is stored on the
        // DOM element. Without this, the event could be garbage-collected before
        // its callback is invoked.
        function afterRead() {
            setTimeout(cb, delay);
        }
        let utterance = speakSync(text);
        utterance.addEventListener("end", afterRead);
        element.utterance = utterance;
    }

    function demo() {
        // Speak a demo with the current voice.
        let msg = `Hello, my name is ${voice.name}`;
        speakSync(msg, voice);
    }

    function beep(freq, duration) {
        // Emit a pure tone of the requested frequency and duration.
        let oscillator = audioContext.createOscillator();
        oscillator.frequency.value = freq;
        oscillator.connect(audioContext.destination);
        oscillator.start();
        setTimeout(() => oscillator.stop(), duration);
    }

    // Initialize once voices are loaded.
    window.speechSynthesis.addEventListener("voiceschanged", initVoices);

    // Return an object with the relevant methods
    return { speakSync,
             speakAsync,
             demo,
             beep };

}
