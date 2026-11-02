let config = null;
let editingId = null;

const form = document.getElementById('task-form');
const titleInput = document.getElementById('task-title');
const descInput = document.getElementById('task-description');
const submitBtn = document.getElementById('task-submit');
const cancelBtn = document.getElementById('task-cancel');
const listEl = document.getElementById('task-list');
const statusEl = document.getElementById('status-message');

function showStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.className = isError ? 'error' : 'ok';
}

async function loadConfig() {
  const res = await fetch('config.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('Cannot load config.json');
  config = await res.json();
}

function baseUrl() {
  return `${config.supabaseUrl}/rest/v1/${config.tableName}`;
}

async function api(path, options = {}) {
  const res = await fetch(baseUrl() + path, {
    ...options,
    headers: {
      apikey: config.supabasePublishableKey,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(options.headers || {})
    }
  });
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json()).message || ''; } catch (e) {}
    throw new Error(`HTTP ${res.status}${detail ? ': ' + detail : ''}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function loadTasks() {
  try {
    const tasks = await api('?select=*&order=id.asc');
    renderTasks(tasks);
    showStatus('');
  } catch (err) {
    showStatus('Failed to load tasks: ' + err.message, true);
  }
}

function renderTasks(tasks) {
  listEl.innerHTML = '';
  if (tasks.length === 0) {
    const p = document.createElement('p');
    p.textContent = 'No tasks yet.';
    listEl.appendChild(p);
    return;
  }
  tasks.forEach(task => listEl.appendChild(buildItem(task)));
}

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

function buildItem(task) {
  const item = el('div', 'task-item' + (task.completed ? ' done' : ''));
  item.dataset.id = task.id;

  item.appendChild(el('span', 'task-title', task.title));
  item.appendChild(el('span', 'task-description', task.description || ''));
  item.appendChild(el('span', 'task-status', task.completed ? 'Completed' : 'Not completed'));

  const toggle = el('button', 'toggle-task', task.completed ? 'Mark incomplete' : 'Mark completed');
  toggle.type = 'button';
  toggle.addEventListener('click', () => toggleTask(task));

  const edit = el('button', 'edit-task', 'Edit');
  edit.type = 'button';
  edit.addEventListener('click', () => startEdit(task));

  const del = el('button', 'delete-task', 'Delete');
  del.type = 'button';
  del.addEventListener('click', () => deleteTask(task.id));

  item.append(toggle, ' ', edit, ' ', del);
  return item;
}

function startEdit(task) {
  editingId = task.id;
  titleInput.value = task.title;
  descInput.value = task.description || '';
  submitBtn.textContent = 'Save changes';
  cancelBtn.hidden = false;
  titleInput.focus();
}

function resetForm() {
  editingId = null;
  form.reset();
  submitBtn.textContent = 'Add task';
  cancelBtn.hidden = true;
}

async function toggleTask(task) {
  try {
    await api(`?id=eq.${task.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ completed: !task.completed })
    });
    showStatus('Task updated.');
    await loadTasks();
  } catch (err) {
    showStatus('Failed to update task: ' + err.message, true);
  }
}

async function deleteTask(id) {
  try {
    await api(`?id=eq.${id}`, { method: 'DELETE' });
    if (editingId === id) resetForm();
    showStatus('Task deleted.');
    await loadTasks();
  } catch (err) {
    showStatus('Failed to delete task: ' + err.message, true);
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = titleInput.value.trim();
  const description = descInput.value.trim();
  if (!title) {
    showStatus('Title is required.', true);
    return;
  }
  try {
    if (editingId === null) {
      await api('', { method: 'POST', body: JSON.stringify({ title, description }) });
      showStatus('Task added.');
    } else {
      await api(`?id=eq.${editingId}`, { method: 'PATCH', body: JSON.stringify({ title, description }) });
      showStatus('Task saved.');
    }
    resetForm();
    await loadTasks();
  } catch (err) {
    showStatus('Failed to save task: ' + err.message, true);
  }
});

cancelBtn.addEventListener('click', resetForm);

(async function init() {
  try {
    await loadConfig();
    await loadTasks();
  } catch (err) {
    showStatus('Initialization error: ' + err.message, true);
  }
})();
