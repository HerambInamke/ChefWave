import { addRecipe, updateRecipe, deleteRecipe, listRecipes, getRecipe, exportAll, importAll, setSetting, getSetting } from './db.js';

let deferredPrompt = null;
const btnInstall = document.getElementById('btn-install');
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  btnInstall.classList.remove('d-none');
});
btnInstall?.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  btnInstall.classList.add('d-none');
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js');
  });
}

const els = {
  tabs: {
    recipes: document.getElementById('recipes'),
    editor: document.getElementById('editor'),
  },
  search: document.getElementById('search'),
  btnNew: document.getElementById('btn-new'),
  recipesEmpty: document.getElementById('recipesEmpty'),
  list: document.getElementById('recipeList'),
  itemTpl: document.getElementById('recipeItemTpl'),
  ingredientTpl: document.getElementById('ingredientRowTpl'),
  form: document.getElementById('recipeForm'),
  formId: document.getElementById('recipeId'),
  title: document.getElementById('title'),
  steps: document.getElementById('steps'),
  ingredients: document.getElementById('ingredients'),
  btnAddIng: document.getElementById('btn-add-ingredient'),
  btnDelete: document.getElementById('btn-delete'),
  btnExport: document.getElementById('btn-export'),
  importFile: document.getElementById('importFile'),
};

let currentFilter = '';

function ingredientRow(data = {}) {
  const node = els.ingredientTpl.content.firstElementChild.cloneNode(true);
  node.querySelector('.ingredient-name').value = data.name || '';
  node.querySelector('.ingredient-qty').value = data.qty || '';
  node.querySelector('.ingredient-unit').value = data.unit || '';
  node.querySelector('.ingredient-have').checked = Boolean(data.have);
  node.querySelector('.ingredient-remove').addEventListener('click', () => node.remove());
  return node;
}

function collectIngredients() {
  return Array.from(els.ingredients.querySelectorAll('.ingredient-row')).map((row) => ({
    name: row.querySelector('.ingredient-name').value.trim(),
    qty: row.querySelector('.ingredient-qty').value.trim(),
    unit: row.querySelector('.ingredient-unit').value.trim(),
    have: row.querySelector('.ingredient-have').checked,
  })).filter((i) => i.name);
}

function renderRecipeItem(recipe) {
  const el = els.itemTpl.content.firstElementChild.cloneNode(true);
  el.dataset.id = recipe.id;
  el.querySelector('.recipe-title').textContent = recipe.title;
  const haveCount = (recipe.ingredients || []).filter((i) => i.have).length;
  const total = recipe.ingredients?.length || 0;
  el.querySelector('.recipe-count').textContent = `${haveCount}/${total}`;
  el.querySelector('.recipe-ingredients').textContent = (recipe.ingredients || []).map((i) => `${i.qty || ''}${i.unit ? ' ' + i.unit : ''} ${i.name}`).join(', ');
  const allHave = total > 0 && haveCount === total;
  el.querySelector('.recipe-all-have').checked = allHave;
  el.addEventListener('click', async (e) => {
    if (e.target.classList.contains('recipe-all-have')) {
      e.stopPropagation();
      const updated = { ...recipe };
      updated.ingredients = (updated.ingredients || []).map((ing) => ({ ...ing, have: e.target.checked }));
      await updateRecipe(updated);
      renderList();
      return;
    }
    openEditor(recipe.id);
  });
  return el;
}

async function renderList() {
  const recipes = await listRecipes();
  const filtered = recipes
    .filter((r) => r.title.toLowerCase().includes(currentFilter) || (r.ingredients || []).some((i) => i.name.toLowerCase().includes(currentFilter)))
    .sort((a, b) => a.title.localeCompare(b.title));
  els.list.innerHTML = '';
  els.recipesEmpty.classList.toggle('d-none', filtered.length > 0);
  filtered.forEach((r) => els.list.appendChild(renderRecipeItem(r)));
}

async function openEditor(id) {
  const recipe = id ? await getRecipe(id) : { title: '', steps: '', ingredients: [] };
  els.formId.value = recipe.id || '';
  els.title.value = recipe.title || '';
  els.steps.value = recipe.steps || '';
  els.ingredients.innerHTML = '';
  (recipe.ingredients || []).forEach((ing) => els.ingredients.appendChild(ingredientRow(ing)));
  els.btnDelete.classList.toggle('d-none', !recipe.id);
  const tabTrigger = document.querySelector('#editor-tab');
  new bootstrap.Tab(tabTrigger).show();
}

function clearEditor() {
  els.formId.value = '';
  els.title.value = '';
  els.steps.value = '';
  els.ingredients.innerHTML = '';
}

els.btnNew.addEventListener('click', () => openEditor(null));
els.btnAddIng.addEventListener('click', () => els.ingredients.appendChild(ingredientRow()));
els.search.addEventListener('input', (e) => { currentFilter = e.target.value.trim().toLowerCase(); renderList(); });
els.form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    id: els.formId.value ? Number(els.formId.value) : undefined,
    title: els.title.value.trim(),
    steps: els.steps.value.trim(),
    ingredients: collectIngredients(),
  };
  if (!payload.title) return;
  if (payload.id) await updateRecipe(payload); else await addRecipe(payload);
  clearEditor();
  new bootstrap.Tab(document.querySelector('#recipes-tab')).show();
  renderList();
});
els.btnDelete.addEventListener('click', async () => {
  const id = Number(els.formId.value);
  if (!id) return;
  await deleteRecipe(id);
  clearEditor();
  new bootstrap.Tab(document.querySelector('#recipes-tab')).show();
  renderList();
});

els.btnExport.addEventListener('click', async () => {
  const data = await exportAll();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'chefwave-backup.json';
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
});
els.importFile.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const text = await file.text();
  try {
    const data = JSON.parse(text);
    await importAll(data);
    renderList();
  } catch (err) {
    alert('Invalid backup file');
  } finally {
    e.target.value = '';
  }
});

let audioCtx = null;
let masterGain = null;
let running = false;

const channelDefs = [
  { key: 'rain', label: 'Rain', color: '#0d6efd' },
  { key: 'wind', label: 'Wind', color: '#20c997' },
  { key: 'fire', label: 'Fire', color: '#fd7e14' },
  { key: 'waves', label: 'Waves', color: '#6f42c1' },
  { key: 'cafe', label: 'Cafe', color: '#6c757d' },
];

const mixerState = {
  master: 0.7,
  channels: Object.fromEntries(channelDefs.map((c) => [c.key, { gain: 0.6, pan: 0, filter: 8000 }]))
};

const audioGraph = {
  channels: {},
};

function createNoiseBuffer(type = 'white') {
  const sampleRate = 44100;
  const length = sampleRate * 2;
  const ctx = audioCtx;
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  let lastOut = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    if (type === 'white') data[i] = white;
    else if (type === 'pink') {
      lastOut = 0.997 * lastOut + 0.05 * white;
      data[i] = lastOut;
    } else if (type === 'brown') {
      lastOut = (lastOut + 0.02 * white) / 1.02;
      data[i] = lastOut * 3.5;
    }
  }
  return buffer;
}

function createChannelSource(key) {
  const ctx = audioCtx;
  const src = ctx.createBufferSource();
  let buffer;
  switch (key) {
    case 'rain': buffer = createNoiseBuffer('white'); break;
    case 'wind': buffer = createNoiseBuffer('pink'); break;
    case 'fire': buffer = createNoiseBuffer('brown'); break;
    case 'waves': buffer = createNoiseBuffer('pink'); break;
    case 'cafe': buffer = createNoiseBuffer('brown'); break;
    default: buffer = createNoiseBuffer('white');
  }
  src.buffer = buffer;
  src.loop = true;
  return src;
}

function ensureAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  masterGain = audioCtx.createGain();
  masterGain.gain.value = mixerState.master;
  masterGain.connect(audioCtx.destination);

  channelDefs.forEach((def) => {
    const gainNode = audioCtx.createGain();
    const panNode = audioCtx.createStereoPanner();
    const filterNode = audioCtx.createBiquadFilter();
    filterNode.type = 'lowpass';
    filterNode.frequency.value = mixerState.channels[def.key].filter;
    gainNode.gain.value = mixerState.channels[def.key].gain;
    panNode.pan.value = mixerState.channels[def.key].pan;

    filterNode.connect(panNode);
    panNode.connect(gainNode);
    gainNode.connect(masterGain);

    audioGraph.channels[def.key] = { gainNode, panNode, filterNode, srcNodes: [] };
  });
}

function startAudio() {
  ensureAudio();
  if (running) return;
  Object.keys(audioGraph.channels).forEach((key) => {
    const ch = audioGraph.channels[key];
    const src = createChannelSource(key);
    src.connect(ch.filterNode);
    src.start();
    ch.srcNodes.push(src);
  });
  running = true;
}

function stopAudio() {
  if (!running) return;
  Object.values(audioGraph.channels).forEach((ch) => {
    ch.srcNodes.forEach((src) => { try { src.stop(); } catch(_){} });
    ch.srcNodes = [];
  });
  running = false;
}

const mixerRows = document.getElementById('mixerRows');
const btnAudioToggle = document.getElementById('btn-audio-toggle');
const masterGainInput = document.getElementById('masterGain');
const btnSaveMix = document.getElementById('btn-save-mix');
const btnLoadMix = document.getElementById('btn-load-mix');
const btnResetMix = document.getElementById('btn-reset-mix');

function renderMixer() {
  mixerRows.innerHTML = '';
  channelDefs.forEach((def) => {
    const col = document.createElement('div');
    col.className = 'col-12';
    col.innerHTML = `
      <div class="mixer-channel" style="border-color:${def.color}">
        <div class="d-flex align-items-center justify-content-between mb-1">
          <span class="mixer-label" style="color:${def.color}">${def.label}</span>
          <div class="small text-muted d-flex align-items-center gap-2">
            <span>Pan</span>
            <input type="range" class="form-range form-range-sm mixer-pan" min="-1" max="1" step="0.01" value="${mixerState.channels[def.key].pan}" style="width:120px">
          </div>
        </div>
        <div class="row g-2 align-items-center">
          <div class="col">
            <label class="form-label small mb-1">Gain</label>
            <input type="range" class="form-range mixer-gain" min="0" max="1" step="0.01" value="${mixerState.channels[def.key].gain}">
          </div>
          <div class="col">
            <label class="form-label small mb-1">Filter</label>
            <input type="range" class="form-range mixer-filter" min="200" max="12000" step="1" value="${mixerState.channels[def.key].filter}">
          </div>
        </div>
      </div>`;
    const row = col.firstElementChild;
    const gainEl = row.querySelector('.mixer-gain');
    const panEl = row.querySelector('.mixer-pan');
    const filterEl = row.querySelector('.mixer-filter');
    gainEl.addEventListener('input', (e) => {
      const v = Number(e.target.value);
      mixerState.channels[def.key].gain = v;
      audioGraph.channels[def.key]?.gainNode.gain.setTargetAtTime(v, audioCtx?.currentTime || 0, 0.01);
    });
    panEl.addEventListener('input', (e) => {
      const v = Number(e.target.value);
      mixerState.channels[def.key].pan = v;
      if (audioGraph.channels[def.key]) audioGraph.channels[def.key].panNode.pan.value = v;
    });
    filterEl.addEventListener('input', (e) => {
      const v = Number(e.target.value);
      mixerState.channels[def.key].filter = v;
      if (audioGraph.channels[def.key]) audioGraph.channels[def.key].filterNode.frequency.value = v;
    });
    mixerRows.appendChild(col);
  });
}

btnAudioToggle.addEventListener('click', async () => {
  if (!audioCtx || audioCtx.state === 'suspended') {
    ensureAudio();
    await audioCtx.resume();
  }
  if (running) { stopAudio(); btnAudioToggle.textContent = 'Play'; }
  else { startAudio(); btnAudioToggle.textContent = 'Pause'; }
});

masterGainInput.addEventListener('input', (e) => {
  const v = Number(e.target.value);
  mixerState.master = v;
  if (masterGain) masterGain.gain.setTargetAtTime(v, audioCtx?.currentTime || 0, 0.01);
});

btnSaveMix.addEventListener('click', async () => {
  await setSetting('mix', JSON.stringify(mixerState));
});
btnLoadMix.addEventListener('click', async () => {
  const saved = await getSetting('mix');
  if (saved) {
    const parsed = JSON.parse(saved);
    Object.assign(mixerState, parsed);
    masterGainInput.value = mixerState.master;
    if (masterGain) masterGain.gain.value = mixerState.master;
    renderMixer();
  }
});
btnResetMix.addEventListener('click', () => {
  mixerState.master = 0.7;
  for (const key of Object.keys(mixerState.channels)) {
    mixerState.channels[key] = { gain: 0.6, pan: 0, filter: 8000 };
  }
  masterGainInput.value = mixerState.master;
  if (masterGain) masterGain.gain.value = mixerState.master;
  renderMixer();
});

document.addEventListener('DOMContentLoaded', async () => {
  await renderList();
  renderMixer();
  masterGainInput.value = mixerState.master;
});


