import { contextBridge, ipcRenderer } from 'electron';

// Say something
console.log('[EVite] : preload executed');

// Expose the electron API to the renderer process

contextBridge.exposeInMainWorld('electron', {
  Notification: {
    create: (title: string, body: string) => {
      ipcRenderer.send('show-notification', { title, body });
    },
    close: () => {
      ipcRenderer.send('close-notification');
    }
  },
  env: {
    USERNAME: process.env.REACT_APP_USERNAME || '',
    PASSWORD: process.env.REACT_APP_PASSWORD || '',
    API_URL: process.env.REACT_APP_API_URL || '',
    SERVER_URL: process.env.REACT_APP_SERVER_URL || '',
    WS_PROTOCOL: process.env.REACT_APP_WS_PROTOCOL || '',
    ELKS_NUMBER: process.env.REACT_APP_ELKS_NUMBER || '',
    API_TRANSFER_PROTOCOL: process.env.REACT_APP_API_TRANSFER_PROTOCOL || '',
  },
});
