import { app, BrowserWindow, ipcMain, Notification } from 'electron';
import * as path from 'path';
import axios from 'axios';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({
  path: path.join(process.cwd(), '.env')
});

/** Handle creating/removing shortcuts on Windows when installing/uninstalling. */
if (require('electron-squirrel-startup')) {
  app.quit();
}

/**
 * Main window instance.
 */
let mainWindow: BrowserWindow | null;
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

/**
 * This method will be called when Electron has finished
 * initialization and is ready to create browser windows.
 * Some APIs can only be used after this event occurs.
 */
app.on('ready', createMainWindow);

/**
 * Emitted when the application is activated. Various actions can
 * trigger this event, such as launching the application for the first time,
 * attempting to re-launch the application when it's already running,
 * or clicking on the application's dock or taskbar icon.
 */
app.on('activate', () => {
  /**
   * On OS X it's common to re-create a window in the app when the
   * dock icon is clicked and there are no other windows open.
   */
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});
app.on('ready', () => {
  // Set the AppUserModelId
  app.setAppUserModelId('SoD-Phone');

  createMainWindow();
});
/**
 * Emitted when all windows have been closed.
 */
app.on('window-all-closed', () => {
  /**
   * On OS X it is common for applications and their menu bar
   * to stay active until the user quits explicitly with Cmd + Q
   */
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

/**
 * Create main window
 * @returns {BrowserWindow} Main window instance
 */

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1060,
    height: 700,
    backgroundColor: '#202020',
    show: false,
    autoHideMenuBar: true,
    icon: path.resolve('assets/favicon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,
      preload: path.join(__dirname, 'preload.js'),
      sandbox: false,
    },
  });

  // Load the index.html of the app window.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  // Show window when its ready to
  mainWindow.on('ready-to-show', () => {
    if (mainWindow) mainWindow.show();
  });

  // Close all windows when main window is closed
  mainWindow.on('close', () => {
    mainWindow = null;
    app.quit();
  });

  return mainWindow;
}

/**
 * In this file you can include the rest of your app's specific main process code.
 * You can also put them in separate files and import them here.
 */

ipcMain.on('focus-window', () => {
  const win = BrowserWindow.getAllWindows()[0];
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

let activeNotification: Notification | null = null;

ipcMain.on('show-notification', (event, { title, body }) => {
  if (activeNotification) {
    activeNotification.close();
  }

  activeNotification = new Notification({
    icon: path.resolve('assets/favicon.ico'),
    title,
    body,
    timeoutType: 'never',
  });

  activeNotification.show();

  activeNotification.on('click', () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
});

ipcMain.on('close-notification', () => {
  if (activeNotification) {
    activeNotification.close();
    activeNotification = null;
  }
});

// Make sure notifications are allowed
app.whenReady().then(() => {
  // Request permission for notifications
  if (Notification.permission === 'default') {
    Notification.requestPermission();
  }

  // ... rest of your app initialization
});

// Add this IPC handler
