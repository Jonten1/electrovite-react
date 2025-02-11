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
    PASSWORD: process.env.REACT_APP_PASSWORD || ''
  }
});
