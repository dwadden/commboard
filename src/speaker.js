"use strict";

// This module exposes a function called speaker. This function creates a
// speaker object, which speaks text passed in from other parts of the
// program. The speaker is multilingual. If it is given a string to speak, it
// just speaks the string. If it is given an object, it assumes it is a table
// keyed by language. It speaks the correct phrase for the language that the
// user has selected.

const _ = require("underscore");

// Exports.
module.exports = speaker;

// A shared audio context
function speaker(settings) {
    // Constructor function that creates a speaker object. The constructor takes
    // a settings object so that the speaker can determine the current language
    // being spoken. The speaker will update itself, and the list of available
    // voices, when it detects that the user has changed languages.
    // The returned object exposes methods to speak text both synchronously and
    // asynchronously.

    // Private variables
    const audioContext = new window.AudioContext();
    let voice;           // The current voice being used by the speaker.
    let voices;          // All available voices for the current language.
    let voiceElem = document.querySelector("select[name=voice]");
    let demoElem = document.querySelector("input[type=button][name=demo]");

    // Private methods
    const getLanguage = settings.getLanguageSettings().getLanguage;
    function demo() {
        // Speak a demo with the current voice.
        const msg = { en: `Hello, my name is ${voice.name}`,
                      fr: `Bonjour, mon nom est ${voice.name}`};
        speakSync(msg[getLanguage()], voice);
    }
    function clearVoices() {
        // Clear all voices from the dropdown menu. To be executed when the user switches languages.
        let options = voiceElem.options;
        let nvoices = options.length;
        [].reverse.call(_.range(nvoices)).forEach((i) => options[i] = null);
    }

    function initVoices() {
        // Initialize the voices in the dropdown menu and register event handlers.
        voiceElem.addEventListener("change", setVoice);      // Set voice when selection made.
        demoElem.addEventListener("click", demo);            // Speak current voice as demo.
        updateVoices();
    }

    function updateVoices() {
        // To be invoked the list of voices is initialized, and after the user changes languages.
        function each(entry, ix) {
            // Performed for each entry in the array of voices.
            let name = entry.name;
            let opt = document.createElement("option");
            opt.value = ix;
            opt.text = name;
            voiceElem.add(opt);
        }
        const correctLanguage = (voice) => voice.lang.includes(getLanguage());
        clearVoices();
        voices = window.speechSynthesis.getVoices().filter(correctLanguage);
        voices.forEach(each);
        setVoice(voices);
    }
    function setVoice() {
        // Call this whenever the user changes the voice button.
        let ix = parseInt(voiceElem.value);
        voice = voices[ix];
    }

    // Public methods
    function speakSync(text) {
        // Speak the text, synchronously.
        // There are two input types that are handled seperately.
        //   string: The input text is read directly.
        //   object: The input is assumed to be a map from languages to
        //           text. The speaker asks the settings object for the current
        //           language and looks up the correct text for this langauge.
        let toSpeak = _.isString(text) ? text : text[getLanguage()];
        let utterance = new window.SpeechSynthesisUtterance(toSpeak.toLowerCase());
        utterance.lang = getLanguage();
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

    function beep(freq, duration) {
        // Emit a pure tone of the requested frequency and duration.
        let oscillator = audioContext.createOscillator();
        oscillator.frequency.value = freq;
        oscillator.connect(audioContext.destination);
        oscillator.start();
        setTimeout(() => oscillator.stop(), duration);
    }

    // Register event listeners.
    settings.getLanguageSettings().addChangeListener(updateVoices); // If the user changes the language, change the voices.
    window.speechSynthesis.addEventListener("voiceschanged", initVoices); // Initialize voices once the page has loaded them.

    // Return an object with the relevant methods
    return { speakSync,
             speakAsync,
             beep };
}
