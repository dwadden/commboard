# Wedjat

Wedjat is a simple app designed to help individuals with disabilities to interact with a computer.

## Installation

### Prerequisites

Wedjat requires that the following software be installed:

- [Git](https://git-scm.com/)
- [Node.js](http://nodejs.org/)
- [npm](http://npmjs.org/)

### Package dependencies

Clone the repository. Change to the installation directory and execute the following to install the requisite packages from npm:

```
npm install
```

Wedjat runs on Github's [Electron](http://electron.atom.io/). You may install it globally using:

```
npm install -g electron-prebuilt
```

### Running the program

If Electron is installed globally, navigate to the Wedjat home directory and enter:

```
electron .
```

The program will launch. If Electron is installed locally, locate the executable and invoke in the same fashion.

## Usage

### Interaction Concepts

Wedjat consists of a series of menus. Each menu contains buttons. When a button is selected, it triggers an action. Common actions include writing letters to the text buffer and opening other menus.

Wedjat recognizes two gestures from the user. For the original user, these two gestures are two types of gazes: an upward gaze and an extended upward gaze (lasting 2 seconds or more).

The user issues input by listening as the program scans through available menu options, and performing a gesture when the desired option is spoken. When launched, the program does not scan; it awaits an extended upward gaze from the user to start. Once started, a short gaze indicates a selection, while an extended gaze indicates a cancellation.

### Interaction menus

At present, the following menus are implemented:

#### Request

Enables the user to make an audible request from a predefined list. When a request is selected, a buzzer sounds and the request text is read out. This functionality is intended to able the user to quickly signal a caretaker that he / she needs attention.

#### Compose

Enables the user to compose messages. The alphabet is laid out in a grid. The program scans through the grid, awaiting a selection from the user. In addition to letters, the grid also provides simple word guessing functionality and simple operations on the buffer: e.g. deleting the last character and clearing the buffer. In the future, saving and loading old buffer text may be implemented. Finally, the user may select for the buffer text to be read aloud.

#### Email

Enables the user to send an email to a recipient in a predefined list. To enable email use, a caretaker should press the "Setup" button and enter the user's name, email address, and password.

Once setup is complete, the user can send an email as follows:

- Enter the desired text into the buffer using the `Compose` menu.
- Select `Return` from the `Compose` menu to return to the main menu.
- Select `Email` to enter the email menu.
- Select a recipient from the resulting list. The program will attempt to send the buffer text to    the recipient, and will inform the user aurally whether the attempt was successful.

As noted in the program, the user's email password will be stored in the app's window.sessionStorage, which I don't believe is secure. Until this has been sorted out, it is strongly advised to create a new email account for use only with this program, which will not be linked to any sensitive personal data. The email text also includes a notification to recipients that they should not send any sensitive data in response messages.

### Simulating interactions using the keyboard

Developers and assistants may wish to simulate interactions with the program without actually gazing. The keyboard may be used for this purpose. Pressing the down arrow key fires an extended gaze event, while pressing up arrow key fires a short gaze event.

### Program settings

- **Adjust scan speed** - Use the slider at the bottom right.
- **Toggle sound** - Click the button labeled "Sound Off" at the bottom right.

## Documentation

Comments in the code follow [JSDoc](http://usejsdoc.org/) syntax. You may generate documentation by entering the following at the command line, from the installation directory:

```
jsdoc wedjat.js
```

For information, see the JSDoc documentation.
