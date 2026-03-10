const MODES = {
  pomodoro:   { duration: 25 * 60, label: 'Pomodoro' },
  shortBreak: { duration:  5 * 60, label: 'Short Break' },
  longBreak:  { duration: 15 * 60, label: 'Long Break' },
};

// DOM elements
const minutesEl   = document.getElementById('minutes');
const secondsEl   = document.getElementById('seconds');
const startBtn    = document.getElementById('btn-start');
const resetBtn    = document.getElementById('btn-reset');
const skipBtn     = document.getElementById('btn-skip');
const countEl     = document.getElementById('pomodoro-count');
const barFill     = document.getElementById('timer-bar-fill');
const modeBtns    = document.querySelectorAll('.mode-btn');

// State
let currentMode     = 'pomodoro';
let timeRemaining   = MODES.pomodoro.duration;
let totalDuration   = MODES.pomodoro.duration;
let timerInterval   = null;
let isRunning       = false;
let pomodoroCount   = 0;
let sessionsBeforeLongBreak = 0;

// In-app toast notification
function showToast(title, body) {
  // Remove existing toast if any
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<strong>${title}</strong><span>${body}</span>`;
  document.body.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => toast.classList.add('show'));

  // Auto dismiss after 4s
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Audio context for bell sound
let audioCtx = null;

function ensureAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  // Resume if suspended (browser/Electron autoplay policy)
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playBell() {
  const ctx = ensureAudioCtx();

  // Three-strike bell for clear notification
  const strikes = [
    { freq: 830, time: 0 },
    { freq: 830, time: 0.25 },
    { freq: 1050, time: 0.5 },
  ];

  strikes.forEach(({ freq, time }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.5, ctx.currentTime + time);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + time + 1.0);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime + time);
    osc.stop(ctx.currentTime + time + 1.0);
  });
}

// Pre-warm audio context on first user interaction
document.addEventListener('click', () => ensureAudioCtx(), { once: true });

function updateDisplay() {
  const mins = Math.floor(timeRemaining / 60);
  const secs = timeRemaining % 60;
  minutesEl.textContent = String(mins).padStart(2, '0');
  secondsEl.textContent = String(secs).padStart(2, '0');

  // Update progress bar
  const fraction = 1 - timeRemaining / totalDuration;
  barFill.style.width = (fraction * 100) + '%';

  // Update document title
  document.title = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')} - ${MODES[currentMode].label}`;
}

function setMode(mode, autoStart = false) {
  currentMode = mode;
  timeRemaining = MODES[mode].duration;
  totalDuration = MODES[mode].duration;

  // Stop any running timer
  clearInterval(timerInterval);
  timerInterval = null;
  isRunning = false;
  startBtn.textContent = 'Start';

  // Update UI
  document.body.setAttribute('data-mode', mode);
  modeBtns.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });

  updateDisplay();

  if (autoStart) {
    toggleTimer();
  }
}

function toggleTimer() {
  if (isRunning) {
    // Pause
    clearInterval(timerInterval);
    timerInterval = null;
    isRunning = false;
    startBtn.textContent = 'Start';
  } else {
    // Start
    isRunning = true;
    startBtn.textContent = 'Pause';
    timerInterval = setInterval(tick, 1000);
  }
}

function tick() {
  timeRemaining--;
  updateDisplay();

  if (timeRemaining <= 0) {
    clearInterval(timerInterval);
    timerInterval = null;
    isRunning = false;
    startBtn.textContent = 'Start';
    onTimerComplete();
  }
}

function onTimerComplete() {
  playBell();

  if (currentMode === 'pomodoro') {
    pomodoroCount++;
    sessionsBeforeLongBreak++;
    countEl.textContent = pomodoroCount;

    // Auto-switch to break
    const nextIsLongBreak = sessionsBeforeLongBreak >= 4;
    const nextBreak = nextIsLongBreak ? 'Long Break (15 min)' : 'Short Break (5 min)';

    const pomodoroBody = `Completed ${pomodoroCount} pomodoro${pomodoroCount > 1 ? 's' : ''}. Next: ${nextBreak}.`;
    showToast('Pomodoro Complete!', pomodoroBody);
    if (window.electronAPI) {
      window.electronAPI.showNotification('Pomodoro Complete!', pomodoroBody);
    }

    if (nextIsLongBreak) {
      sessionsBeforeLongBreak = 0;
      setMode('longBreak', true);
    } else {
      setMode('shortBreak', true);
    }
  } else {
    // Break finished
    const breakType = currentMode === 'longBreak' ? 'Long Break' : 'Short Break';
    const breakBody = 'Time to get back to work. Next: Pomodoro (25 min).';
    showToast(`${breakType} Over!`, breakBody);
    if (window.electronAPI) {
      window.electronAPI.showNotification(`${breakType} Over!`, breakBody);
    }
    setMode('pomodoro', true);
  }
}

function resetTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  isRunning = false;
  startBtn.textContent = 'Start';
  timeRemaining = MODES[currentMode].duration;
  totalDuration = MODES[currentMode].duration;
  updateDisplay();
}

function skipTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  isRunning = false;
  timeRemaining = 0;
  onTimerComplete();
}

function restartAll() {
  clearInterval(timerInterval);
  timerInterval = null;
  isRunning = false;
  pomodoroCount = 0;
  sessionsBeforeLongBreak = 0;
  countEl.textContent = '0';
  setMode('pomodoro');
}

// Event listeners
startBtn.addEventListener('click', toggleTimer);
resetBtn.addEventListener('click', resetTimer);
skipBtn.addEventListener('click', skipTimer);
document.getElementById('btn-restart').addEventListener('click', restartAll);

modeBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    setMode(btn.dataset.mode);
  });
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Don't trigger shortcuts when typing in input fields
  if (e.target.tagName === 'INPUT') return;

  if (e.code === 'Space') {
    e.preventDefault();
    toggleTimer();
  } else if (e.code === 'KeyR') {
    resetTimer();
  }
});

// Initialize
document.body.setAttribute('data-mode', 'pomodoro');
updateDisplay();

// ===== Always On Top (Pin) =====
const pinBtn = document.getElementById('btn-pin');
pinBtn.addEventListener('click', async () => {
  if (!window.electronAPI) return;
  const isOnTop = await window.electronAPI.toggleAlwaysOnTop();
  pinBtn.classList.toggle('active', isOnTop);
});

// ===== Kanban =====
const KANBAN_COLUMNS = ['Todo', 'Doing', 'Review', 'Done'];
// Display order: Doing first, then Todo, Review, Done
const DISPLAY_ORDER = ['Doing', 'Todo', 'Review', 'Done'];

const kanbanSection = document.getElementById('kanban-section');
const kanbanContent = document.getElementById('kanban-content');
const kanbanCollapseBtn = document.getElementById('btn-kanban-collapse');
const pickFileBtn = document.getElementById('btn-pick-file');
const refreshBtn = document.getElementById('btn-refresh-kanban');

let kanbanFilePath = localStorage.getItem('kanbanFilePath') || null;
let kanbanData = {}; // { columnName: [{ text, tag }] }
let kanbanExpanded = true;

const WINDOW_WIDTH = 420;
const WINDOW_HEIGHT_COLLAPSED = 190;
const WINDOW_HEIGHT_EXPANDED = 450;

// Show kanban view (show kanban, expand window)
function showKanbanView() {
  kanbanSection.classList.remove('hidden');
  kanbanExpanded = true;
  kanbanContent.style.display = '';
  updateCollapseBtn();
  document.body.classList.add('kanban-visible');
  if (window.electronAPI) window.electronAPI.setWindowSize(WINDOW_WIDTH, WINDOW_HEIGHT_EXPANDED);
  if (kanbanFilePath) loadKanban();
}

// Show timer view (hide kanban entirely, shrink window)
function showTimerView() {
  kanbanSection.classList.add('hidden');
  kanbanExpanded = false;
  if (window.electronAPI) window.electronAPI.setWindowSize(WINDOW_WIDTH, WINDOW_HEIGHT_COLLAPSED);
}

// Toggle kanban content collapsed/expanded (keeps header visible)
function toggleKanbanCollapse() {
  kanbanExpanded = !kanbanExpanded;
  if (kanbanExpanded) {
    kanbanContent.style.display = '';
    if (window.electronAPI) window.electronAPI.setWindowSize(WINDOW_WIDTH, WINDOW_HEIGHT_EXPANDED);
  } else {
    kanbanContent.style.display = 'none';
    if (window.electronAPI) window.electronAPI.setWindowSize(WINDOW_WIDTH, WINDOW_HEIGHT_COLLAPSED);
  }
  updateCollapseBtn();
}

function updateCollapseBtn() {
  if (!kanbanCollapseBtn) return;
  const svg = kanbanCollapseBtn.querySelector('svg');
  if (kanbanExpanded) {
    svg.innerHTML = '<polyline points="6 9 12 15 18 9"/>';
    kanbanCollapseBtn.title = 'Collapse kanban';
  } else {
    svg.innerHTML = '<polyline points="6 15 12 9 18 15"/>';
    kanbanCollapseBtn.title = 'Expand kanban';
  }
}

// Load kanban path from config on startup and auto-show if available
(async () => {
  if (!window.electronAPI) return;
  const settings = await window.electronAPI.getApiKeys();
  if (settings.kanbanFilePath) {
    kanbanFilePath = settings.kanbanFilePath;
    localStorage.setItem('kanbanFilePath', kanbanFilePath);
  }
  // Auto-show kanban if file path exists
  if (kanbanFilePath) {
    showKanbanView();
  }
})();

// Toggle kanban collapse/expand
kanbanCollapseBtn.addEventListener('click', toggleKanbanCollapse);

// Create new kanban file
const createKanbanBtn = document.getElementById('btn-create-kanban');
createKanbanBtn.addEventListener('click', async () => {
  if (!window.electronAPI) return;
  const path = await window.electronAPI.createKanbanFile();
  if (path) {
    kanbanFilePath = path;
    localStorage.setItem('kanbanFilePath', path);
    loadKanban();
  }
});

// Pick file
pickFileBtn.addEventListener('click', async () => {
  if (!window.electronAPI) return;
  const path = await window.electronAPI.pickKanbanFile();
  if (path) {
    kanbanFilePath = path;
    localStorage.setItem('kanbanFilePath', path);
    loadKanban();
  }
});

// Refresh
refreshBtn.addEventListener('click', () => {
  if (kanbanFilePath) loadKanban();
});

// Auto-refresh on window focus
window.addEventListener('focus', () => {
  if (kanbanFilePath && !kanbanSection.classList.contains('hidden')) {
    loadKanban();
  }
});

// Parse kanban markdown - preserves original content for rebuild
let kanbanRawContent = ''; // keep original file content

function parseKanbanMarkdown(content) {
  kanbanRawContent = content;
  const data = {};
  let currentColumn = null;

  for (const line of content.split('\n')) {
    const headerMatch = line.match(/^##\s+(.+)/);
    if (headerMatch) {
      currentColumn = headerMatch[1].trim();
      data[currentColumn] = [];
      continue;
    }

    if (currentColumn && line.match(/^[-*]\s+/)) {
      const taskText = line.replace(/^[-*]\s+/, '').trim();
      if (!taskText) continue;

      // Format: [ ] [tag] text  OR  [x] [tag] text
      const checkMatch = taskText.match(/^\[([x ]?)\]\s*/);
      const checked = checkMatch ? checkMatch[1] === 'x' : false;
      const afterCheck = checkMatch ? taskText.slice(checkMatch[0].length) : taskText;

      // Extract tag like [work] or [life]
      const tagMatch = afterCheck.match(/^\[(\w+)\]\s*/);
      const tag = tagMatch ? tagMatch[1].toLowerCase() : null;
      const text = tagMatch ? afterCheck.slice(tagMatch[0].length).trim() : afterCheck.trim();

      data[currentColumn].push({ text, tag, checked });
    }
  }

  return data;
}

// Serialize: rebuild file preserving non-task content, only replacing tasks per column
function serializeKanban(data) {
  const lines = kanbanRawContent.split('\n');
  const result = [];
  let currentColumn = null;
  let skipTasks = false;
  let tasksInserted = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headerMatch = line.match(/^##\s+(.+)/);

    if (headerMatch) {
      // If we were in a column and haven't inserted tasks yet, insert them
      if (currentColumn && !tasksInserted) {
        insertTasks(result, data[currentColumn] || []);
      }
      currentColumn = headerMatch[1].trim();
      skipTasks = false;
      tasksInserted = false;
      result.push(line);
      continue;
    }

    if (currentColumn && line.match(/^[-*]\s+/)) {
      // Skip original task lines - we'll insert updated ones
      if (!skipTasks) {
        skipTasks = true;
        insertTasks(result, data[currentColumn] || []);
        tasksInserted = true;
      }
      continue;
    }

    // Non-task, non-header line (blank lines, comments, etc) - keep as is
    if (skipTasks && line.trim() === '') {
      skipTasks = false;
    }
    result.push(line);
  }

  // If file ended while in a column without inserting tasks
  if (currentColumn && !tasksInserted) {
    insertTasks(result, data[currentColumn] || []);
  }

  // Check for new columns not in original file
  const originalColumns = new Set();
  for (const line of lines) {
    const m = line.match(/^##\s+(.+)/);
    if (m) originalColumns.add(m[1].trim());
  }
  for (const col of Object.keys(data)) {
    if (!originalColumns.has(col) && data[col].length > 0) {
      result.push('');
      result.push(`## ${col}`);
      insertTasks(result, data[col]);
    }
  }

  return result.join('\n');
}

function insertTasks(result, tasks) {
  for (const task of tasks) {
    const checkStr = task.checked ? '[x]' : '[ ]';
    const tagStr = task.tag ? ` [${task.tag}]` : '';
    result.push(`- ${checkStr}${tagStr} ${task.text}`);
  }
}

// Load kanban from file
async function loadKanban() {
  if (!window.electronAPI || !kanbanFilePath) return;

  const result = await window.electronAPI.readKanban(kanbanFilePath);
  if (!result.ok) {
    kanbanContent.innerHTML = `<div class="kanban-empty">Error: ${result.error}</div>`;
    return;
  }

  kanbanData = parseKanbanMarkdown(result.content);
  renderKanban();
}

// Save kanban to file
async function saveKanban() {
  if (!window.electronAPI || !kanbanFilePath) return;
  const content = serializeKanban(kanbanData);
  await window.electronAPI.writeKanban(kanbanFilePath, content);
}

// Render kanban UI - horizontal columns
function renderKanban() {
  kanbanContent.innerHTML = '';

  // Build ordered column list: Doing first (if has tasks or exists), then rest
  let columnsToShow = [];

  // Smart ordering: Todo always first, then Doing
  columnsToShow = ['Todo', 'Doing', 'Review', 'Done'];

  // Add any extra columns from the file
  for (const col of Object.keys(kanbanData)) {
    if (!columnsToShow.includes(col)) columnsToShow.push(col);
  }

  // Only show columns that exist in data
  columnsToShow = columnsToShow.filter(col => kanbanData[col] !== undefined);

  if (columnsToShow.length === 0) {
    kanbanContent.innerHTML = '<div class="kanban-empty">No columns found in file.</div>';
    return;
  }

  for (const colName of columnsToShow) {
    const tasks = kanbanData[colName] || [];

    const colEl = document.createElement('div');
    colEl.className = 'kanban-column';

    // Header
    const header = document.createElement('div');
    header.className = 'kanban-column-header';
    header.innerHTML = `
      <div class="col-left">
        <span class="col-name">${colName}</span>
        <span class="col-count">${tasks.length}</span>
      </div>
    `;
    colEl.appendChild(header);

    // Body with tasks
    const body = document.createElement('div');
    body.className = 'kanban-column-body';

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      const taskEl = document.createElement('div');
      taskEl.className = 'kanban-task';
      taskEl.draggable = true;

      const tagClass = task.tag === 'work' ? 'work' : task.tag === 'life' ? 'life' : 'default';
      const tagHtml = task.tag ? `<span class="task-tag ${tagClass}">${task.tag}</span>` : '';

      taskEl.innerHTML = `<div class="task-top-row">${tagHtml}<span style="flex:1"></span><button class="task-menu-btn" title="Menu">⋯</button></div><span class="task-text">${escapeHtml(task.text)}</span>`;

      // 3-dot menu button triggers context menu
      const menuBtn = taskEl.querySelector('.task-menu-btn');
      menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showTaskContextMenu(e, colName, i);
      });
      // Prevent menu button from starting drag
      menuBtn.draggable = false;
      menuBtn.addEventListener('dragstart', (e) => e.preventDefault());

      // Double-click to inline edit task text
      taskEl.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        e.preventDefault();
        window.getSelection()?.removeAllRanges();
        startEditTask(colName, i);
      });

      // Drag start
      taskEl.addEventListener('dragstart', (e) => {
        // Don't drag if user is selecting text
        const selection = window.getSelection();
        if (selection && selection.toString().length > 0) {
          e.preventDefault();
          return;
        }
        taskEl.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', JSON.stringify({ fromColumn: colName, taskIndex: i }));
      });

      taskEl.addEventListener('dragend', () => {
        taskEl.classList.remove('dragging');
        // Clean up any lingering drag-over highlights
        document.querySelectorAll('.kanban-column-body.drag-over').forEach(el => el.classList.remove('drag-over'));
      });

      body.appendChild(taskEl);
    }

    // Drop zone events on column body
    body.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });

    body.addEventListener('dragenter', (e) => {
      e.preventDefault();
      body.classList.add('drag-over');
    });

    body.addEventListener('dragleave', (e) => {
      // Only remove highlight when leaving the column body itself (not children)
      if (!body.contains(e.relatedTarget)) {
        body.classList.remove('drag-over');
      }
    });

    body.addEventListener('drop', (e) => {
      e.preventDefault();
      body.classList.remove('drag-over');
      try {
        const data = JSON.parse(e.dataTransfer.getData('text/plain'));
        const { fromColumn, taskIndex } = data;
        if (fromColumn === colName) return; // Same column, do nothing
        const [movedTask] = kanbanData[fromColumn].splice(taskIndex, 1);
        if (!kanbanData[colName]) kanbanData[colName] = [];
        kanbanData[colName].push(movedTask);
        saveKanban();
        renderKanban();
      } catch (err) {
        // Ignore invalid drop data
      }
    });

    colEl.appendChild(body);

    // Add task input with tag selector
    const addRow = document.createElement('div');
    addRow.className = 'kanban-add-row';
    addRow.innerHTML = `
      <select class="kanban-tag-select" title="Tag">
        <option value="work" selected>work</option>
        <option value="life">life</option>
        <option value="">—</option>
      </select>
      <input class="kanban-add-input" placeholder="+ Add..." />
      <button class="kanban-add-btn" title="Add">+</button>
    `;
    const input = addRow.querySelector('.kanban-add-input');
    const addBtn = addRow.querySelector('.kanban-add-btn');
    const tagSelect = addRow.querySelector('.kanban-tag-select');

    const addTask = () => {
      const text = input.value.trim();
      if (!text) return;
      if (!kanbanData[colName]) kanbanData[colName] = [];
      const tag = tagSelect.value || 'work';
      kanbanData[colName].push({ text, tag, checked: false });
      saveKanban();
      renderKanban();
    };

    addBtn.addEventListener('click', addTask);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') addTask();
    });

    colEl.appendChild(addRow);
    kanbanContent.appendChild(colEl);
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Context menu for tasks: move, edit, delete
function showTaskContextMenu(event, fromColumn, taskIndex) {
  closeContextMenu();

  const menu = document.createElement('div');
  menu.className = 'task-context-menu';

  // Move to section
  const moveLabel = document.createElement('div');
  moveLabel.className = 'menu-label';
  moveLabel.textContent = 'Move to';
  menu.appendChild(moveLabel);

  const otherColumns = KANBAN_COLUMNS.filter(c => c !== fromColumn && kanbanData[c] !== undefined);
  for (const col of Object.keys(kanbanData)) {
    if (col !== fromColumn && !otherColumns.includes(col)) {
      otherColumns.push(col);
    }
  }

  for (const targetCol of otherColumns) {
    const btn = document.createElement('button');
    btn.textContent = targetCol;
    btn.addEventListener('click', () => {
      const task = kanbanData[fromColumn].splice(taskIndex, 1)[0];
      if (!kanbanData[targetCol]) kanbanData[targetCol] = [];
      kanbanData[targetCol].push(task);
      saveKanban();
      renderKanban();
      closeContextMenu();
    });
    menu.appendChild(btn);
  }

  // Divider
  const divider = document.createElement('div');
  divider.className = 'menu-divider';
  menu.appendChild(divider);

  // Edit
  const editBtn = document.createElement('button');
  editBtn.textContent = 'Edit';
  editBtn.addEventListener('click', () => {
    closeContextMenu();
    startEditTask(fromColumn, taskIndex);
  });
  menu.appendChild(editBtn);

  // Delete
  const deleteBtn = document.createElement('button');
  deleteBtn.textContent = 'Delete';
  deleteBtn.className = 'danger';
  deleteBtn.addEventListener('click', () => {
    kanbanData[fromColumn].splice(taskIndex, 1);
    saveKanban();
    renderKanban();
    closeContextMenu();
  });
  menu.appendChild(deleteBtn);

  // Position near click
  menu.style.left = Math.min(event.clientX, window.innerWidth - 160) + 'px';
  menu.style.top = Math.min(event.clientY, window.innerHeight - 200) + 'px';

  document.body.appendChild(menu);

  setTimeout(() => {
    document.addEventListener('click', closeContextMenu, { once: true });
  }, 0);
}

// Inline edit task
function startEditTask(colName, taskIndex) {
  const task = kanbanData[colName][taskIndex];
  // Find the task element in DOM
  const columns = kanbanContent.querySelectorAll('.kanban-column');
  let targetTaskEl = null;

  columns.forEach(colEl => {
    const name = colEl.querySelector('.col-name').textContent;
    if (name === colName) {
      const tasks = colEl.querySelectorAll('.kanban-task');
      if (tasks[taskIndex]) targetTaskEl = tasks[taskIndex];
    }
  });

  if (!targetTaskEl) return;

  const textEl = targetTaskEl.querySelector('.task-text');
  const originalText = task.text;

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'task-edit-input';
  input.value = originalText;

  textEl.replaceWith(input);
  input.focus();
  input.select();

  const finishEdit = () => {
    const newText = input.value.trim();
    if (newText && newText !== originalText) {
      kanbanData[colName][taskIndex].text = newText;
      saveKanban();
    }
    renderKanban();
  };

  input.addEventListener('blur', finishEdit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') input.blur();
    if (e.key === 'Escape') {
      input.value = originalText;
      input.blur();
    }
  });
}

function closeContextMenu() {
  const existing = document.querySelector('.task-context-menu');
  if (existing) existing.remove();
}

// Auto-show kanban on startup (sync fallback, async load handled above)
if (kanbanFilePath) {
  showKanbanView();
}

// ===== Voice Command (Soniox Streaming) =====
const voiceBtn = document.getElementById('btn-voice');
const voiceStatus = document.getElementById('voice-status');

let mediaRecorder = null;
let isRecording = false;
let transcriptText = ''; // accumulated final text
let partialText = '';    // current partial

function setVoiceStatus(text, className) {
  voiceStatus.textContent = text;
  voiceStatus.className = 'voice-status ' + (className || '');
  if (text) {
    voiceStatus.classList.remove('hidden');
  } else {
    voiceStatus.classList.add('hidden');
  }
}

function clearVoiceStatus(delay = 3000) {
  setTimeout(() => {
    voiceStatus.classList.add('hidden');
  }, delay);
}

// Listen for Soniox streaming results
if (window.electronAPI) {
  window.electronAPI.onSonioxResult((result) => {
    if (result.tokens && result.tokens.length > 0) {
      // Separate final vs non-final tokens
      let finalPart = '';
      let nonFinalPart = '';
      for (const token of result.tokens) {
        if (token.is_final) {
          finalPart += token.text;
        } else {
          nonFinalPart += token.text;
        }
      }

      if (finalPart) {
        transcriptText += finalPart;
      }
      partialText = nonFinalPart;

      const display = (transcriptText + partialText).trim();
      if (display && isRecording) {
        setVoiceStatus(`"${display}"`, 'recording');
      }
    }
  });

  window.electronAPI.onSonioxError((error) => {
    setVoiceStatus('Soniox error: ' + error, 'error');
    clearVoiceStatus(4000);
  });
}

async function toggleVoiceRecording() {
  if (!window.electronAPI) return;

  if (isRecording) {
    // Stop recording
    isRecording = false;
    voiceBtn.classList.remove('recording');

    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }

    // Tell Soniox to finalize
    await window.electronAPI.sonioxStop();

    // Wait a moment for final results
    await new Promise(r => setTimeout(r, 500));

    const finalText = (transcriptText + partialText).trim();
    if (!finalText) {
      setVoiceStatus('No speech detected', 'error');
      clearVoiceStatus();
      return;
    }

    // Send to xAI for parsing
    await processVoiceCommand(finalText);
  } else {
    // Reset transcript
    transcriptText = '';
    partialText = '';

    // 1. Connect to Soniox WebSocket
    setVoiceStatus('Connecting...', 'transcribing');
    const startResult = await window.electronAPI.sonioxStart();
    if (!startResult.ok) {
      setVoiceStatus(startResult.error, 'error');
      clearVoiceStatus(4000);
      return;
    }

    // 2. Start microphone
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });

      mediaRecorder.ondataavailable = async (e) => {
        if (e.data.size > 0 && isRecording) {
          const arrayBuffer = await e.data.arrayBuffer();
          // Send as Uint8Array for reliable IPC serialization in packaged app
          const uint8 = new Uint8Array(arrayBuffer);
          window.electronAPI.sonioxSend(Array.from(uint8));
        }
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
      };

      // Send chunks every 250ms for real-time streaming
      mediaRecorder.start(250);
      isRecording = true;
      voiceBtn.classList.add('recording');
      setVoiceStatus('Listening...', 'recording');
    } catch (err) {
      console.error('Microphone access error:', err);
      setVoiceStatus('Mic access denied', 'error');
      clearVoiceStatus();
      await window.electronAPI.sonioxStop();
    }
  }
}

async function processVoiceCommand(text) {
  voiceBtn.classList.add('processing');
  setVoiceStatus(`"${text}" - Processing...`, 'processing');

  try {
    // Ensure kanban is loaded
    if (!kanbanFilePath || Object.keys(kanbanData).length === 0) {
      setVoiceStatus('No kanban file loaded', 'error');
      clearVoiceStatus();
      voiceBtn.classList.remove('processing');
      return;
    }

    const parseResult = await window.electronAPI.parseVoiceCommand(text, kanbanData);
    if (!parseResult.ok) {
      setVoiceStatus('Parse failed: ' + parseResult.error, 'error');
      clearVoiceStatus(4000);
      voiceBtn.classList.remove('processing');
      return;
    }

    executeVoiceAction(parseResult.command);
  } catch (err) {
    setVoiceStatus('Error: ' + err.message, 'error');
    clearVoiceStatus(4000);
  }

  voiceBtn.classList.remove('processing');
}

function executeVoiceAction(cmd) {
  switch (cmd.action) {
    case 'create_task': {
      const col = cmd.column || 'Todo';
      if (!kanbanData[col]) kanbanData[col] = [];
      kanbanData[col].push({
        text: cmd.taskText,
        tag: cmd.tag || 'work',
        checked: false,
      });
      saveKanban();
      renderKanban();
      setVoiceStatus(`Created: "${cmd.taskText}" in ${col}`, 'success');
      clearVoiceStatus();
      break;
    }

    case 'move_task': {
      const from = cmd.fromColumn;
      const to = cmd.toColumn;
      if (!kanbanData[from] || !kanbanData[to]) {
        setVoiceStatus(`Column not found: ${from} or ${to}`, 'error');
        clearVoiceStatus();
        return;
      }

      // Find closest matching task
      const taskIdx = findClosestTask(kanbanData[from], cmd.taskText);
      if (taskIdx === -1) {
        setVoiceStatus(`Task not found: "${cmd.taskText}"`, 'error');
        clearVoiceStatus();
        return;
      }

      const task = kanbanData[from].splice(taskIdx, 1)[0];
      kanbanData[to].push(task);
      saveKanban();
      renderKanban();
      setVoiceStatus(`Moved: "${task.text}" → ${to}`, 'success');
      clearVoiceStatus();
      break;
    }

    case 'delete_task': {
      const fromCol = cmd.fromColumn;
      if (!kanbanData[fromCol]) {
        setVoiceStatus(`Column not found: ${fromCol}`, 'error');
        clearVoiceStatus();
        return;
      }

      const idx = findClosestTask(kanbanData[fromCol], cmd.taskText);
      if (idx === -1) {
        setVoiceStatus(`Task not found: "${cmd.taskText}"`, 'error');
        clearVoiceStatus();
        return;
      }

      const deleted = kanbanData[fromCol].splice(idx, 1)[0];
      saveKanban();
      renderKanban();
      setVoiceStatus(`Deleted: "${deleted.text}"`, 'success');
      clearVoiceStatus();
      break;
    }

    case 'edit_task': {
      const editCol = cmd.fromColumn;
      if (!kanbanData[editCol]) {
        setVoiceStatus(`Column not found: ${editCol}`, 'error');
        clearVoiceStatus();
        return;
      }

      const editIdx = findClosestTask(kanbanData[editCol], cmd.taskText);
      if (editIdx === -1) {
        setVoiceStatus(`Task not found: "${cmd.taskText}"`, 'error');
        clearVoiceStatus();
        return;
      }

      const oldText = kanbanData[editCol][editIdx].text;
      kanbanData[editCol][editIdx].text = cmd.newText;
      saveKanban();
      renderKanban();
      setVoiceStatus(`Edited: "${oldText}" → "${cmd.newText}"`, 'success');
      clearVoiceStatus();
      break;
    }

    default:
      setVoiceStatus(`Unknown command: ${cmd.error || cmd.action}`, 'error');
      clearVoiceStatus(4000);
  }
}

function findClosestTask(tasks, searchText) {
  if (!tasks || tasks.length === 0) return -1;

  const search = searchText.toLowerCase();

  // Exact match first
  const exactIdx = tasks.findIndex(t => t.text.toLowerCase() === search);
  if (exactIdx !== -1) return exactIdx;

  // Contains match
  const containsIdx = tasks.findIndex(t => t.text.toLowerCase().includes(search));
  if (containsIdx !== -1) return containsIdx;

  // Reverse contains (search text contains task text)
  const reverseIdx = tasks.findIndex(t => search.includes(t.text.toLowerCase()));
  if (reverseIdx !== -1) return reverseIdx;

  // Word overlap scoring
  const searchWords = search.split(/\s+/);
  let bestIdx = -1;
  let bestScore = 0;

  tasks.forEach((task, i) => {
    const taskWords = task.text.toLowerCase().split(/\s+/);
    const score = searchWords.filter(w => taskWords.some(tw => tw.includes(w) || w.includes(tw))).length;
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  });

  return bestScore > 0 ? bestIdx : -1;
}

// Voice button click
voiceBtn.addEventListener('click', toggleVoiceRecording);

// Global shortcut from main process (works even when unfocused)
if (window.electronAPI) {
  window.electronAPI.onToggleVoice(() => {
    toggleVoiceRecording();
  });
}

// ===== Settings Modal =====
const settingsBtn = document.getElementById('btn-settings');
const settingsOverlay = document.getElementById('settings-overlay');
const settingsCloseBtn = document.getElementById('btn-settings-close');
const settingsSaveBtn = document.getElementById('btn-settings-save');
const settingsPickFileBtn = document.getElementById('btn-settings-pick-file');
const inputSonioxKey = document.getElementById('input-soniox-key');
const inputXaiKey = document.getElementById('input-xai-key');
const inputKanbanPath = document.getElementById('input-kanban-path');
const inputVoiceShortcut = document.getElementById('input-voice-shortcut');

settingsBtn.addEventListener('click', async () => {
  if (!window.electronAPI) return;
  const settings = await window.electronAPI.getApiKeys();
  inputSonioxKey.value = settings.SONIOX_API_KEY || '';
  inputXaiKey.value = settings.XAI_API_KEY || '';
  inputKanbanPath.value = kanbanFilePath || '';
  inputVoiceShortcut.value = settings.voiceShortcut || 'Control+Option+V';
  settingsOverlay.classList.remove('hidden');
});

settingsCloseBtn.addEventListener('click', () => {
  settingsOverlay.classList.add('hidden');
});

settingsOverlay.addEventListener('click', (e) => {
  if (e.target === settingsOverlay) settingsOverlay.classList.add('hidden');
});

settingsPickFileBtn.addEventListener('click', async () => {
  if (!window.electronAPI) return;
  const path = await window.electronAPI.pickKanbanFile();
  if (path) {
    inputKanbanPath.value = path;
  }
});

settingsSaveBtn.addEventListener('click', async () => {
  if (!window.electronAPI) return;
  const keys = {
    SONIOX_API_KEY: inputSonioxKey.value.trim(),
    XAI_API_KEY: inputXaiKey.value.trim(),
    kanbanFilePath: inputKanbanPath.value.trim(),
    voiceShortcut: inputVoiceShortcut.value.trim() || 'Control+Option+V',
  };
  await window.electronAPI.saveApiKeys(keys);

  // Update global shortcut
  await window.electronAPI.updateShortcut();

  // Update kanban path if changed
  if (keys.kanbanFilePath && keys.kanbanFilePath !== kanbanFilePath) {
    kanbanFilePath = keys.kanbanFilePath;
    localStorage.setItem('kanbanFilePath', kanbanFilePath);
    if (!kanbanSection.classList.contains('hidden')) {
      loadKanban();
    }
  }

  settingsOverlay.classList.add('hidden');
  showToast('Settings Saved', 'API keys and kanban path updated');
});
