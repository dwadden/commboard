"use strict";

const electron = require("electron");
const app = electron.app;  // Module to control application life.
const BrowserWindow = electron.BrowserWindow;  // Module to create native browser window.

// Keep a global reference of the window object, if you don"t, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow = null;

// Quit when all windows are closed.
app.on("window-all-closed", function() {
    app.quit();
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.on("ready", function() {
    // Create the browser window.
    // mainWindow = new BrowserWindow({x: 800, y: 300, width: 1600, height: 1200});
    mainWindow = new BrowserWindow();

    // and load the index.html of the app.
    mainWindow.loadURL("file://" + __dirname + "/index.html");

    // Open the DevTools.
    // mainWindow.webContents.openDevTools();

    // Emitted when the window is closed.
    mainWindow.on("closed", function() {
        mainWindow = null;
    });
});
