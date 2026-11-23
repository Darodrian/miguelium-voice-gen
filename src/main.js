import encode from '@audio/encode';
import { createSampler, createEngine, synthesize, playSamples, encodeSamples, createGeneration } from './engine.js';
import { createDefaultSettings, normalizeSettings, loadSettings, saveSettings, applyPreset, markCustom, rollVoice, listUserPresets, saveUserPreset, deleteUserPreset } from './presets.js';
import { CHARACTER_IDS } from './defaults.js';
import { parsePunctuations, formatPunctuations, downloadName } from './voice-config.js';
import './styles.css';

const state = {
  settings: createDefaultSettings(),
  files: {},
  engine: null,
  sampler: null,
  engineStale: true,
  playHandle: null,
  audioContext: null,
  generation: createGeneration(),
};

const elements = {
  preset: document.getElementById('preset'),
  language: document.getElementById('language'),
  reroll: document.getElementById('reroll'),
  text: document.getElementById('text'),
  play: document.getElementById('play'),
  stop: document.getElementById('stop'),
  format: document.getElementById('format'),
  bitrate: document.getElementById('bitrate'),
  quality: document.getElementById('quality'),
  save: document.getElementById('save'),
  status: document.getElementById('status'),
  customWav: document.getElementById('custom-wav'),
  customMap: document.getElementById('custom-map'),
  spriteMode: document.getElementById('sprite-mode'),
  presetAdd: document.getElementById('preset-add'),
  presetRename: document.getElementById('preset-rename'),
  presetDelete: document.getElementById('preset-delete'),
};

export function setStatus(message) {
  if (elements.status) elements.status.textContent = message == null ? '' : String(message);
}

const errorMessage = (error) => (error instanceof Error ? error.message : String(error));

function getAudioContext() {
  if (!state.audioContext) state.audioContext = new AudioContext();
  return state.audioContext;
}

async function buildRuntime() {
  const { sampler } = await createSampler(state.settings, state.files);
  const engine = createEngine(state.settings, sampler);
  state.sampler = sampler;
  state.engine = engine;
  state.engineStale = false;
  return engine;
}

function stopPlayback() {
  if (state.playHandle) {
    state.playHandle.stop();
    state.playHandle = null;
  }
  state.generation.next();
  elements.stop.disabled = true;
}

async function handlePlay() {
  const text = elements.text.value ?? '';
  if (String(text).trim() === '') {
    setStatus('Enter some text before playing.');
    return;
  }
  try {
    stopPlayback();
    const context = getAudioContext();
    if (context.state === 'suspended') context.resume();
    const engine = state.engineStale ? await buildRuntime() : state.engine;
    const token = state.generation.next();
    const { samples, sampleRate } = await synthesize(engine, text);
    if (!state.generation.isCurrent(token)) {
      setStatus('Playback cancelled.');
      return;
    }
    const handle = await playSamples(samples, sampleRate, context);
    state.playHandle = handle;
    elements.stop.disabled = false;
    setStatus('Playing.');
  } catch (error) {
    setStatus(`Could not play: ${errorMessage(error)}`);
  }
}

function handleStop() {
  stopPlayback();
  setStatus('Stopped.');
}

async function handleSave() {
  const text = elements.text.value ?? '';
  if (String(text).trim() === '') {
    setStatus('Enter some text before saving.');
    return;
  }
  try {
    const engine = state.engineStale ? await buildRuntime() : state.engine;
    const { samples, sampleRate } = await synthesize(engine, text);
    const { format, bitrate, quality } = state.settings.export;
    const bytes = await encodeSamples(samples, sampleRate, { format, bitrate, quality }, encode);
    const mime = format === 'ogg' ? 'audio/ogg' : 'audio/mpeg';
    const blob = new Blob([bytes], { type: mime });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = downloadName(text, state.settings.preset, format);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setStatus('Clip saved.');
  } catch (error) {
    setStatus(`Could not save: ${errorMessage(error)}`);
  }
}

function handleReroll() {
  const source = state.settings.reRollSource;
  const voice = rollVoice(source, Math.random);
  const next = markCustom(state.settings);
  next.voice = {
    pitch: voice.pitch,
    speed: voice.speed,
    randomness: voice.randomness,
    melodyRate: voice.melodyRate,
    melodyAmplitude: voice.melodyAmplitude,
  };
  next.timing = {
    spaceDelay: voice.spaceDelay,
    punctuationDelay: voice.punctuationDelay,
    punctuations: next.timing.punctuations,
  };
  state.settings = next;
  saveSettings(localStorage, state.settings);
  state.engineStale = true;
  setStatus(`Re-rolled ${source} voice.`);
}

function handlePresetChange(id) {
  let next;
  if (CHARACTER_IDS.includes(id)) {
    next = applyPreset(state.settings, id);
  } else if (id === 'custom') {
    next = markCustom(state.settings);
  } else {
    next = markCustom(state.settings);
    const found = listUserPresets(localStorage).find((preset) => preset.id === id);
    if (found) {
      next.voice = { ...found.voice };
      next.timing = { ...found.timing };
      next.preset = found.id;
    }
  }
  state.settings = next;
  saveSettings(localStorage, next);
  state.engineStale = true;
  renderControls();
  refreshPresetOptions();
  setStatus(`Preset: ${next.preset}`);
}

function handleAddPreset() {
  const name = window.prompt('Name for the new preset');
  if (name == null) return;
  const trimmed = String(name).trim();
  if (!trimmed) return;
  const record = saveUserPreset(localStorage, trimmed, state.settings);
  state.settings = markCustom(state.settings);
  state.settings.preset = record.id;
  saveSettings(localStorage, state.settings);
  state.engineStale = true;
  refreshPresetOptions();
  if (elements.preset) elements.preset.value = record.id;
  setStatus(`Preset "${record.name}" saved.`);
}

function handleRenamePreset() {
  const selected = elements.preset?.value;
  const presets = listUserPresets(localStorage);
  const target = presets.find((preset) => preset.id === selected);
  if (!target) {
    setStatus('Select a saved preset to rename.');
    return;
  }
  const name = window.prompt('Rename preset', target.name);
  if (name == null) return;
  const nextName = String(name).trim();
  if (!nextName) return;
  const renamed = saveUserPreset(localStorage, nextName, { voice: target.voice, timing: target.timing });
  deleteUserPreset(localStorage, target.id);
  refreshPresetOptions();
  if (selected && selected !== renamed.id && state.settings.preset === selected) {
    elements.preset.value = renamed.id;
    const next = normalizeSettings({ ...state.settings, preset: renamed.id });
    state.settings = next;
    saveSettings(localStorage, next);
    state.engineStale = true;
    renderControls();
  }
  setStatus(`Preset "${nextName}" renamed.`);
}

function handleDeletePreset() {
  const selected = elements.preset?.value;
  if (selected === 'miguelium' || selected === 'ms-rowlet' || selected === 'custom') {
    setStatus('Select a saved preset to delete.');
    return;
  }
  deleteUserPreset(localStorage, selected);
  refreshPresetOptions();
  if (state.settings.preset === selected) {
    const next = normalizeSettings({ ...state.settings, preset: 'miguelium' });
    state.settings = next;
    saveSettings(localStorage, next);
    state.engineStale = true;
    renderControls();
  }
  setStatus('Preset deleted.');
}

function handleCustomFileChange() {
  const wav = elements.customWav?.files?.[0] ?? null;
  const map = elements.customMap?.files?.[0] ?? null;
  state.files = { wav, map };
  state.engineStale = true;
}

function applySetting(def, rawValue) {
  const base = def.custom ? markCustom(state.settings) : normalizeSettings(state.settings);
  const keys = def.path.split('.');
  let target = base;
  for (let i = 0; i < keys.length - 1; i += 1) {
    const key = keys[i];
    if (target[key] === null || typeof target[key] !== 'object') target[key] = {};
    target = target[key];
  }
  let value = rawValue;
  if (def.kind === 'number') value = rawValue == null || String(rawValue).trim() === '' ? NaN : Number(rawValue);
  if (def.kind === 'punctuations') value = parsePunctuations(rawValue);
  target[keys[keys.length - 1]] = value;
  state.settings = normalizeSettings(base);
  saveSettings(localStorage, state.settings);
  if (def.invalidate !== false) state.engineStale = true;
  refreshControlDisplay(def);
  syncPresetSelector();
  renderControls();
}

function refreshControlDisplay(def) {
  let value = state.settings;
  for (const key of def.path.split('.')) value = value?.[key];
  if (def.kind === 'punctuations') value = formatPunctuations(value);
  setControlValue(def.id, value);
}

function syncPresetSelector() {
  if (!elements.preset) return;
  const value = state.settings.preset;
  const optionValues = [...elements.preset.options].map((option) => option.value);
  if (optionValues.includes(value)) elements.preset.value = value;
  else if (optionValues.includes('custom')) elements.preset.value = 'custom';
  else if (optionValues[0]) elements.preset.value = optionValues[0];
}

const CONTROL_DEFS = [
  { id: 'language', path: 'language', kind: 'enum', invalidate: true },
  { id: 'sprite-source', path: 'spriteSource', kind: 'enum', invalidate: true },
  { id: 'sprite-map-mode', path: 'spriteMapMode', kind: 'enum', invalidate: true },
  { id: 'sprite-labels', path: 'spriteLabels', kind: 'string', invalidate: true },
  { id: 'sampler-max-retries', path: 'sampler.maxRetries', kind: 'number', invalidate: true },
  { id: 'sampler-silence-threshold', path: 'sampler.silenceThreshold', kind: 'number', invalidate: true },
  { id: 'sampler-min-silence', path: 'sampler.minSilenceDurationMs', kind: 'number', invalidate: true },
  { id: 'voice-pitch', path: 'voice.pitch', kind: 'number', custom: true, invalidate: true },
  { id: 'voice-speed', path: 'voice.speed', kind: 'number', custom: true, invalidate: true },
  { id: 'voice-randomness', path: 'voice.randomness', kind: 'number', custom: true, invalidate: true },
  { id: 'voice-melody-rate', path: 'voice.melodyRate', kind: 'number', custom: true, invalidate: true },
  { id: 'voice-melody-amplitude', path: 'voice.melodyAmplitude', kind: 'number', custom: true, invalidate: true },
  { id: 'timing-space-delay', path: 'timing.spaceDelay', kind: 'number', custom: true, invalidate: true },
  { id: 'timing-punctuation-delay', path: 'timing.punctuationDelay', kind: 'number', custom: true, invalidate: true },
  { id: 'timing-punctuations', path: 'timing.punctuations', kind: 'punctuations', custom: true, invalidate: true },
  { id: 'format', path: 'export.format', kind: 'enum', invalidate: false },
  { id: 'bitrate', path: 'export.bitrate', kind: 'number', invalidate: false },
  { id: 'quality', path: 'export.quality', kind: 'number', invalidate: false },
];

function bindControls() {
  for (const def of CONTROL_DEFS) {
    const el = document.getElementById(def.id);
    if (!el) continue;
    const apply = () => applySetting(def, el.value);
    el.addEventListener('input', apply);
    el.addEventListener('change', apply);
  }
}

function setControlValue(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  const next = String(value ?? '');
  if (el.value !== next) el.value = next;
  const span = document.getElementById(`${id}-value`);
  if (span) span.textContent = next;
}

function renderControls() {
  setControlValue('preset', state.settings.preset);
  setControlValue('language', state.settings.language);
  setControlValue('format', state.settings.export.format);
  setControlValue('bitrate', state.settings.export.bitrate);
  setControlValue('quality', state.settings.export.quality);
  setControlValue('sprite-source', state.settings.spriteSource);
  setControlValue('sprite-map-mode', state.settings.spriteMapMode);
  setControlValue('sprite-labels', state.settings.spriteLabels);
  setControlValue('sampler-max-retries', state.settings.sampler.maxRetries);
  setControlValue('sampler-silence-threshold', state.settings.sampler.silenceThreshold);
  setControlValue('sampler-min-silence', state.settings.sampler.minSilenceDurationMs);
  setControlValue('voice-pitch', state.settings.voice.pitch);
  setControlValue('voice-speed', state.settings.voice.speed);
  setControlValue('voice-randomness', state.settings.voice.randomness);
  setControlValue('voice-melody-rate', state.settings.voice.melodyRate);
  setControlValue('voice-melody-amplitude', state.settings.voice.melodyAmplitude);
  setControlValue('timing-space-delay', state.settings.timing.spaceDelay);
  setControlValue('timing-punctuation-delay', state.settings.timing.punctuationDelay);
  setControlValue('timing-punctuations', formatPunctuations(state.settings.timing.punctuations));
  for (const id of ['sprite-mode', 'sprite-labels', 'custom-wav', 'custom-map']) {
    const el = document.getElementById(id);
    if (el) el.hidden = state.settings.spriteSource !== 'custom';
  }
}

function refreshPresetOptions() {
  const select = elements.preset;
  if (!select) return;
  const previous = select.value;
  select.innerHTML = '';
  const addOption = (value, label) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    select.appendChild(option);
  };
  addOption('miguelium', 'Miguelium');
  addOption('ms-rowlet', 'Ms. Rowlet');
  addOption('custom', 'Custom');
  for (const preset of listUserPresets(localStorage)) addOption(preset.id, preset.name);
  const exists = [...select.options].some((option) => option.value === previous);
  select.value = exists ? previous : 'miguelium';
}

function bindEvents() {
  elements.play.addEventListener('click', () => { void handlePlay(); });
  elements.stop.addEventListener('click', handleStop);
  elements.save.addEventListener('click', () => { void handleSave(); });
  elements.reroll.addEventListener('click', handleReroll);
  elements.preset.addEventListener('change', (event) => handlePresetChange(event.target.value));
  elements.presetAdd.addEventListener('click', handleAddPreset);
  elements.presetRename.addEventListener('click', handleRenamePreset);
  elements.presetDelete.addEventListener('click', handleDeletePreset);
  elements.customWav?.addEventListener('change', handleCustomFileChange);
  elements.customMap?.addEventListener('change', handleCustomFileChange);
}

function init() {
  state.settings = loadSettings(localStorage);
  renderControls();
  refreshPresetOptions();
  bindControls();
  bindEvents();
  elements.stop.disabled = true;
  setStatus('Ready.');
}

init();
