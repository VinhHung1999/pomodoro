const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  showNotification: (title, body) =>
    ipcRenderer.invoke('show-notification', { title, body }),
  toggleAlwaysOnTop: () =>
    ipcRenderer.invoke('toggle-always-on-top'),
  readKanban: (filePath) =>
    ipcRenderer.invoke('read-kanban-file', filePath),
  writeKanban: (filePath, content) =>
    ipcRenderer.invoke('write-kanban-file', filePath, content),
  pickKanbanFile: () =>
    ipcRenderer.invoke('pick-kanban-file'),
  createKanbanFile: () =>
    ipcRenderer.invoke('create-kanban-file'),
  // Soniox real-time streaming
  sonioxStart: () =>
    ipcRenderer.invoke('soniox-start'),
  sonioxSend: (audioChunk) =>
    ipcRenderer.invoke('soniox-send', audioChunk),
  sonioxStop: () =>
    ipcRenderer.invoke('soniox-stop'),
  onSonioxResult: (callback) =>
    ipcRenderer.on('soniox-result', (_event, data) => callback(data)),
  onSonioxError: (callback) =>
    ipcRenderer.on('soniox-error', (_event, error) => callback(error)),
  onToggleVoice: (callback) =>
    ipcRenderer.on('toggle-voice', () => callback()),
  // xAI
  parseVoiceCommand: (text, kanbanState) =>
    ipcRenderer.invoke('parse-voice-command', text, kanbanState),
  // Settings
  getApiKeys: () =>
    ipcRenderer.invoke('get-api-keys'),
  saveApiKeys: (keys) =>
    ipcRenderer.invoke('save-api-keys', keys),
  updateShortcut: () =>
    ipcRenderer.invoke('update-shortcut'),
  setWindowSize: (width, height) =>
    ipcRenderer.invoke('set-window-size', width, height),
});
