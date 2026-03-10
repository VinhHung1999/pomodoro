const { app, BrowserWindow, Notification, ipcMain, dialog, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const WebSocket = require('ws');

let mainWindow;

// API keys config file
function getConfigPath() {
  return path.join(app.getPath('userData'), 'api-keys.json');
}

function loadApiKeys() {
  try {
    const data = fs.readFileSync(getConfigPath(), 'utf-8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

function saveApiKeys(keys) {
  fs.writeFileSync(getConfigPath(), JSON.stringify(keys, null, 2), 'utf-8');
}

function getApiKey(name) {
  const keys = loadApiKeys();
  return keys[name] || process.env[name] || '';
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 190,
    resizable: false,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#1a1a2e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
}

ipcMain.handle('show-notification', (_event, { title, body }) => {
  if (Notification.isSupported()) {
    const notification = new Notification({
      title,
      body,
      silent: false,
    });
    notification.show();

    notification.on('show', () => {
      console.log('Notification shown:', title);
    });
    notification.on('failed', (_, err) => {
      console.error('Notification failed:', err);
    });
  } else {
    console.warn('Notifications not supported');
  }

  // Bounce dock icon when app is not focused
  if (mainWindow && !mainWindow.isFocused()) {
    app.dock.bounce('informational');
  }
});

// Always On Top toggle
ipcMain.handle('toggle-always-on-top', () => {
  if (!mainWindow) return false;
  const current = mainWindow.isAlwaysOnTop();
  mainWindow.setAlwaysOnTop(!current);
  return !current;
});

ipcMain.handle('set-window-size', (_event, width, height) => {
  if (!mainWindow) return;
  mainWindow.setSize(width, height, true);
});

// Read kanban markdown file
ipcMain.handle('read-kanban-file', async (_event, filePath) => {
  try {
    const resolved = filePath.replace(/^~/, app.getPath('home'));
    const content = fs.readFileSync(resolved, 'utf-8');
    return { ok: true, content, path: resolved };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// Write kanban markdown file
ipcMain.handle('write-kanban-file', async (_event, filePath, content) => {
  try {
    const resolved = filePath.replace(/^~/, app.getPath('home'));
    fs.writeFileSync(resolved, content, 'utf-8');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// Create new kanban file dialog
ipcMain.handle('create-kanban-file', async () => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Create New Kanban File',
    defaultPath: 'kanban.md',
    filters: [{ name: 'Markdown', extensions: ['md'] }],
  });
  if (result.canceled || !result.filePath) return null;
  const template = `---\n\nkanban-plugin: board\n\n---\n\n## Todo\n\n## Doing\n\n## Review\n\n## Done\n\n\n\n\n%% kanban:settings\n\`\`\`\n{"kanban-plugin":"board","list-collapse":[false]}\n\`\`\`\n%%\n`;
  try {
    fs.writeFileSync(result.filePath, template, 'utf-8');
    return result.filePath;
  } catch (err) {
    return null;
  }
});

// Pick kanban file dialog
ipcMain.handle('pick-kanban-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Kanban Markdown File',
    filters: [{ name: 'Markdown', extensions: ['md'] }],
    properties: ['openFile'],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

// API keys management
ipcMain.handle('get-api-keys', () => {
  const keys = loadApiKeys();
  return {
    SONIOX_API_KEY: keys.SONIOX_API_KEY || process.env.SONIOX_API_KEY || '',
    XAI_API_KEY: keys.XAI_API_KEY || process.env.XAI_API_KEY || '',
    kanbanFilePath: keys.kanbanFilePath || '',
    voiceShortcut: keys.voiceShortcut || DEFAULT_SHORTCUT,
  };
});

ipcMain.handle('save-api-keys', (_event, keys) => {
  saveApiKeys(keys);
  return { ok: true };
});

// Soniox real-time transcription via WebSocket
let sonioxWs = null;

ipcMain.handle('soniox-start', async () => {
  const apiKey = getApiKey('SONIOX_API_KEY');
  if (!apiKey) return { ok: false, error: 'SONIOX_API_KEY not set. Open Settings to configure.' };

  return new Promise((resolve) => {
    sonioxWs = new WebSocket('wss://stt-rt.soniox.com/transcribe-websocket');

    sonioxWs.on('open', () => {
      sonioxWs.send(JSON.stringify({
        api_key: apiKey,
        model: 'stt-rt-preview',
        audio_format: 'auto',
        language_hints: ['vi', 'en'],
      }));
      resolve({ ok: true });
    });

    sonioxWs.on('message', (data) => {
      try {
        const result = JSON.parse(data.toString());
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('soniox-result', result);
        }
      } catch {}
    });

    sonioxWs.on('error', (err) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('soniox-error', err.message);
      }
      resolve({ ok: false, error: err.message });
    });

    sonioxWs.on('close', () => {
      sonioxWs = null;
    });

    // Timeout if connection takes too long
    setTimeout(() => {
      if (sonioxWs && sonioxWs.readyState === WebSocket.CONNECTING) {
        sonioxWs.terminate();
        resolve({ ok: false, error: 'Connection timeout' });
      }
    }, 10000);
  });
});

ipcMain.handle('soniox-send', (_event, audioChunk) => {
  if (sonioxWs && sonioxWs.readyState === WebSocket.OPEN) {
    sonioxWs.send(Buffer.from(audioChunk));
  }
});

ipcMain.handle('soniox-stop', () => {
  if (sonioxWs && sonioxWs.readyState === WebSocket.OPEN) {
    // Send empty buffer to signal end of stream
    sonioxWs.send(Buffer.alloc(0));
    setTimeout(() => {
      if (sonioxWs) {
        sonioxWs.close();
        sonioxWs = null;
      }
    }, 2000);
  }
});

// Parse voice command via xAI
ipcMain.handle('parse-voice-command', async (_event, text, kanbanState) => {
  const apiKey = getApiKey('XAI_API_KEY');
  if (!apiKey) return { ok: false, error: 'XAI_API_KEY not set' };

  try {
    const columnsInfo = Object.entries(kanbanState)
      .map(([col, tasks]) => `${col}: ${tasks.map(t => `"${t.text}"${t.tag ? ` [${t.tag}]` : ''}`).join(', ') || '(empty)'}`)
      .join('\n');

    const systemPrompt = `You are a voice command parser for a Kanban board app. Parse the user's Vietnamese or English voice command into a JSON action.

Current Kanban state:
${columnsInfo}

Available actions:
1. create_task - Create a new task. Fields: taskText, tag (default: "work", options: "work"/"life"), column (default: "Todo")
2. move_task - Move a task between columns. Fields: taskText (match closest existing task), fromColumn, toColumn
3. delete_task - Delete a task. Fields: taskText (match closest existing task), fromColumn
4. edit_task - Edit/rename a task's text. Fields: taskText (match closest existing task), newText, fromColumn

Available columns: ${Object.keys(kanbanState).join(', ')}

Respond with ONLY valid JSON, no markdown:
{"action": "create_task|move_task|delete_task|edit_task", "taskText": "...", "newText": "...", "tag": "work|life|null", "column": "...", "fromColumn": "...", "toColumn": "..."}

If you can't parse the command, respond: {"action": "unknown", "error": "reason"}`;

    const res = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'grok-3-fast',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text },
        ],
        temperature: 0,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: `xAI API error: ${errText}` };
    }

    const data = await res.json();
    const content = data.choices[0].message.content.trim();

    // Parse JSON from response (handle possible markdown wrapping)
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1].trim();

    const parsed = JSON.parse(jsonStr);
    return { ok: true, command: parsed };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

const DEFAULT_SHORTCUT = 'Control+Option+V';

function registerVoiceShortcut() {
  globalShortcut.unregisterAll();
  const keys = loadApiKeys();
  const shortcut = keys.voiceShortcut || DEFAULT_SHORTCUT;
  try {
    globalShortcut.register(shortcut, () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('toggle-voice');
        if (!mainWindow.isVisible()) mainWindow.show();
        mainWindow.focus();
      }
    });
  } catch (err) {
    console.error('Failed to register shortcut:', shortcut, err.message);
  }
}

app.whenReady().then(() => {
  createWindow();
  registerVoiceShortcut();
});

// Re-register shortcut when settings change
ipcMain.handle('update-shortcut', () => {
  registerVoiceShortcut();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
