import { app, session } from 'electron';
import log from 'electron-log';
import { isOSX, isWindows } from '../shared/utils/platform';
import { handleProtocolCall } from './actions';
import { loadFile } from './lib/files';
import { getQueue } from './lib/queue';
import { getWindowManager } from './lib/window-manager';
import { getFilePathFromArgv } from './utils/argv';
import { reopenMainWindow, sendEventToMainWindow } from './utils/window';
import { setupWindows } from './windows';

log.info('Buttercup starting up...');

// // Unhandled rejections
// const unhandled = require('electron-unhandled');
// unhandled();

const windowManager = getWindowManager();

let appIsReady = false;
let appTriedToQuit = false;
let initialFile = null;

// Crash reporter for alpha and beta releases
// After we come out of beta, we should be rolling our own
// Crash reporter server using Mozilla Socorro
// https://github.com/mozilla/socorro
// This process is fail-safe. Even if the URL stops working
// The app has already crashed. lol.
if (process.env.NODE_ENV !== 'development') {
  const { crashReporter } = require('electron');
  crashReporter.start({
    productName: app.name,
    companyName: 'Buttercup LLC',
    submitURL:
      'https://electron-crash-reporter.appspot.com/5642489998344192/create/',
    uploadToServer: true
  });
}

const installExtensions = async () => {
  require('electron-debug')({
    showDevTools: true
  });

  const installer = require('electron-devtools-installer');
  const forceDownload = Boolean(process.env.UPGRADE_EXTENSIONS);
  const extensions = ['REACT_DEVELOPER_TOOLS', 'REDUX_DEVTOOLS'];

  for (const name of extensions) {
    try {
      await installer.default(installer[name], forceDownload); // eslint-disable-line babel/no-await-in-loop
    } catch (err) {}
  }
};

// app.disableHardwareAcceleration();

// In case user tries to open a file using Buttercup (on Mac)
app.on('open-file', (e, filePath) => {
  e.preventDefault();
  if (appIsReady === true) {
    loadFile(filePath);
  } else {
    initialFile = filePath;
  }
});

// Open file using Buttercup (on Windows)
if (isWindows()) {
  initialFile = getFilePathFromArgv(process.argv);
}

// Someone tried to run a second instance, we should focus our window.
const lock = app.requestSingleInstanceLock();
if (!lock) {
  app.quit();
}

app.on('second-instance', (event, args) => {
  reopenMainWindow(() => {
    // Handle Protocol URL for win32 & linux
    const protocolUrl = args.find(arg => arg.startsWith('buttercup://'));
    if (protocolUrl) {
      handleProtocolCall(protocolUrl);
    }
  });
});

// Handle Protocol URL for macOS
app.on('open-url', (e, url) => {
  if (url.startsWith('buttercup://')) {
    handleProtocolCall(url);
  }
});

app.on('ready', async () => {
  if (process.env.NODE_ENV === 'development') {
    // Install Dev Extensions
    // await installExtensions();
  }

  // Set origin for network requests
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders['Origin'] = 'https://desktop.buttercup.pw';
    callback({ cancel: false, requestHeaders: details.requestHeaders });
  });

  // Setup Windows & IPC Actions
  setupWindows();

  appIsReady = true;

  // Show main window
  windowManager.buildWindowOfType('main', win => {
    // If the app has been started in order to open a file
    // launch that file after the main window has been created.
    if (initialFile) {
      loadFile(initialFile, win);
      initialFile = null;
    }
  });

  // When user closes all windows
  // On Windows, the command practice is to quit the app.
  // app.on('window-all-closed', () => {
  //   if (
  //     appTriedToQuit ||
  //     (!isOSX() && !getSetting(store.getState(), 'isTrayIconEnabled'))
  //   ) {
  //     unregisterGlobalShortcuts();

  //     app.quit();
  //   }
  // });
});

// Create a new window if all windows are closed.
app.on('activate', () => {
  if (windowManager.getCountOfType('main') === 0) {
    if (isOSX()) {
      app.dock.show();
    }
    windowManager.buildWindowOfType('main');
  }
});

app.once('before-quit', e => {
  log.info('Running before-quit operation.');
  const channel = getQueue().channel('saves');
  appTriedToQuit = true;

  if (!channel.isEmpty) {
    log.info('Operation queue is not empty, waiting before quitting.');
    e.preventDefault();
    sendEventToMainWindow('save-started');
    channel.once('stopped', () => {
      sendEventToMainWindow('save-completed');
      app.quit();
    });
  } else {
    app.quit();
  }
});
