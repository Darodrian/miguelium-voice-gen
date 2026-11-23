import {
  BANDS,
  CHARACTER_IDS,
  DEFAULT_CUSTOM_SPRITE,
  DEFAULT_EXPORT,
  DEFAULT_PUNCTUATIONS,
  DEFAULT_SAMPLER,
  DEFAULT_TIMING,
  DEFAULT_VOICE,
  EXPORT_FORMATS,
  LANGUAGES,
  LIMITS,
  PRESET_PITCHES,
  SPRITE_MAP_MODES,
  SPRITE_SOURCES,
  STORAGE_KEYS,
} from './defaults.js';

export { BANDS, DEFAULT_PUNCTUATIONS, LIMITS } from './defaults.js';

const asObject = (value) => (value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {});

const round3 = (n) => Math.round(n * 1000) / 1000;

const clampNumber = (value, fallback, [lo, hi]) => {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? Math.min(Math.max(n, lo), hi) : fallback;
};

const pickString = (value, fallback) => (typeof value === 'string' ? value : fallback);

const pickEnum = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback);

const copyPunctuations = (value) =>
  Array.isArray(value) && value.every((p) => typeof p === 'string') ? [...value] : [...DEFAULT_PUNCTUATIONS];

export function presetVoice(character) {
  const [lo, hi] = BANDS.default.pitch;
  return {
    pitch: PRESET_PITCHES[character] ?? (lo + hi) / 2,
    speed: DEFAULT_VOICE.speed,
    randomness: DEFAULT_VOICE.randomness,
    melodyRate: DEFAULT_VOICE.melodyRate,
    melodyAmplitude: DEFAULT_VOICE.melodyAmplitude,
    spaceDelay: DEFAULT_TIMING.spaceDelay,
    punctuationDelay: DEFAULT_TIMING.punctuationDelay,
  };
}

export function rollVoice(character, random = Math.random) {
  const band = BANDS[character] ?? BANDS.default;
  const draw = (key) => {
    const [lo, hi] = band[key];
    return round3(lo + random() * (hi - lo));
  };
  return {
    pitch: draw('pitch'),
    speed: draw('speed'),
    randomness: draw('randomness'),
    melodyRate: draw('melodyRate'),
    melodyAmplitude: draw('melodyAmplitude'),
    spaceDelay: draw('spaceDelay'),
    punctuationDelay: draw('punctuationDelay'),
  };
}

export function normalizeSettings(raw) {
  const r = asObject(raw);
  const sampler = asObject(r.sampler);
  const voice = asObject(r.voice);
  const timing = asObject(r.timing);
  const exportSettings = asObject(r.export);
  const customSprite = asObject(r.customSprite);

  return {
    preset: pickString(r.preset, 'miguelium') || 'miguelium',
    reRollSource: pickString(r.reRollSource, 'miguelium') || 'miguelium',
    language: pickEnum(r.language, LANGUAGES, 'english'),
    spriteSource: pickEnum(r.spriteSource, SPRITE_SOURCES, 'bundled'),
    spriteMapMode: pickEnum(r.spriteMapMode, SPRITE_MAP_MODES, 'json'),
    spriteLabels: pickString(r.spriteLabels, ''),
    sampler: {
      maxRetries: clampNumber(sampler.maxRetries, DEFAULT_SAMPLER.maxRetries, LIMITS.maxRetries),
      silenceThreshold: clampNumber(sampler.silenceThreshold, DEFAULT_SAMPLER.silenceThreshold, LIMITS.silenceThreshold),
      minSilenceDurationMs: clampNumber(sampler.minSilenceDurationMs, DEFAULT_SAMPLER.minSilenceDurationMs, LIMITS.minSilenceDurationMs),
    },
    voice: {
      pitch: clampNumber(voice.pitch, DEFAULT_VOICE.pitch, LIMITS.pitch),
      speed: clampNumber(voice.speed, DEFAULT_VOICE.speed, LIMITS.speed),
      randomness: clampNumber(voice.randomness, DEFAULT_VOICE.randomness, LIMITS.randomness),
      melodyRate: clampNumber(voice.melodyRate, DEFAULT_VOICE.melodyRate, LIMITS.melodyRate),
      melodyAmplitude: clampNumber(voice.melodyAmplitude, DEFAULT_VOICE.melodyAmplitude, LIMITS.melodyAmplitude),
    },
    timing: {
      spaceDelay: clampNumber(timing.spaceDelay, DEFAULT_TIMING.spaceDelay, LIMITS.spaceDelay),
      punctuationDelay: clampNumber(timing.punctuationDelay, DEFAULT_TIMING.punctuationDelay, LIMITS.punctuationDelay),
      punctuations: copyPunctuations(timing.punctuations),
    },
    export: {
      format: pickEnum(exportSettings.format, EXPORT_FORMATS, DEFAULT_EXPORT.format),
      bitrate: clampNumber(exportSettings.bitrate, DEFAULT_EXPORT.bitrate, LIMITS.bitrate),
      quality: clampNumber(exportSettings.quality, DEFAULT_EXPORT.quality, LIMITS.quality),
    },
    customSprite: {
      wavName: pickString(customSprite.wavName, DEFAULT_CUSTOM_SPRITE.wavName),
      mapName: pickString(customSprite.mapName, DEFAULT_CUSTOM_SPRITE.mapName),
    },
  };
}

export function createDefaultSettings() {
  return normalizeSettings({});
}

function cloneSettings(settings) {
  const s = asObject(settings);
  return {
    ...s,
    sampler: { ...asObject(s.sampler) },
    voice: { ...asObject(s.voice) },
    timing: { ...asObject(s.timing), punctuations: copyPunctuations(s.timing?.punctuations) },
    export: { ...asObject(s.export) },
    customSprite: { ...asObject(s.customSprite) },
  };
}

export function applyPreset(settings, id) {
  const next = cloneSettings(settings);
  next.preset = id;
  if (CHARACTER_IDS.includes(id)) {
    next.reRollSource = id;
    const voice = presetVoice(id);
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
      punctuations: copyPunctuations(undefined),
    };
  }
  return next;
}

export function markCustom(settings) {
  const next = cloneSettings(settings);
  next.preset = 'custom';
  return next;
}

export function loadSettings(storage) {
  try {
    const raw = storage.getItem(STORAGE_KEYS.settings);
    return raw == null ? createDefaultSettings() : normalizeSettings(JSON.parse(raw));
  } catch {
    return createDefaultSettings();
  }
}

export function saveSettings(storage, settings) {
  storage.setItem(STORAGE_KEYS.settings, JSON.stringify(normalizeSettings(settings)));
}

function readPresetRecords(storage) {
  try {
    const raw = storage.getItem(STORAGE_KEYS.presets);
    const parsed = raw == null ? [] : JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((p) =>
      p && typeof p.id === 'string' && typeof p.name === 'string' &&
      asObject(p.voice) === p.voice && asObject(p.timing) === p.timing);
  } catch {
    return [];
  }
}

export function listUserPresets(storage) {
  return readPresetRecords(storage).map((p) => ({
    id: p.id,
    name: p.name,
    voice: { ...p.voice },
    timing: { ...p.timing, punctuations: copyPunctuations(p.timing.punctuations) },
  }));
}

export function saveUserPreset(storage, name, settings) {
  const s = asObject(settings);
  const record = {
    id: globalThis.crypto.randomUUID(),
    name: (typeof name === 'string' ? name : String(name ?? '')).trim() || 'Untitled',
    voice: { ...asObject(s.voice) },
    timing: { ...asObject(s.timing), punctuations: copyPunctuations(s.timing?.punctuations) },
  };
  storage.setItem(STORAGE_KEYS.presets, JSON.stringify([...readPresetRecords(storage), record]));
  return record;
}

export function deleteUserPreset(storage, id) {
  storage.setItem(
    STORAGE_KEYS.presets,
    JSON.stringify(readPresetRecords(storage).filter((p) => p.id !== id)),
  );
}
