export const CHARACTER_IDS = ['miguelium', 'ms-rowlet'];

export const PRESET_PITCHES = { miguelium: 0.85, 'ms-rowlet': 2.9 };

export const DEFAULT_PUNCTUATIONS = ['.', ',', '!', '?', "'", '"', '(', ')', '~', '。', '、', '！', '？', 'っ', 'ッ', 'ー'];

export const DEFAULT_VOICE = {
  pitch: 0.85,
  speed: 3.9,
  randomness: 0.1,
  melodyRate: 0.055,
  melodyAmplitude: 0.1,
};

export const DEFAULT_TIMING = { spaceDelay: 0.035, punctuationDelay: 0.3 };

export const DEFAULT_SAMPLER = { maxRetries: 3, silenceThreshold: 0.01, minSilenceDurationMs: 20 };

export const DEFAULT_EXPORT = { format: 'mp3', bitrate: 128, quality: 5 };

export const DEFAULT_CUSTOM_SPRITE = { wavName: '', mapName: '' };

const sharedBands = () => ({
  speed: [3.3, 4.5],
  randomness: [0.05, 0.15],
  melodyRate: [0.03, 0.08],
  melodyAmplitude: [0.05, 0.15],
  spaceDelay: [0.02, 0.05],
  punctuationDelay: [0.2, 0.4],
});

export const BANDS = {
  miguelium: { pitch: [0.6, 1.1], ...sharedBands() },
  'ms-rowlet': { pitch: [2.4, 3.4], ...sharedBands() },
  default: { pitch: [0.5, 3.0], ...sharedBands() },
};

export const LIMITS = {
  pitch: [0.05, 4],
  speed: [0.1, 6],
  randomness: [0, 1],
  melodyRate: [0, 1],
  melodyAmplitude: [0, 1],
  spaceDelay: [0, 5],
  punctuationDelay: [0, 10],
  maxRetries: [0, 10],
  silenceThreshold: [0, 1],
  minSilenceDurationMs: [0, 1000],
  bitrate: [32, 320],
  quality: [0, 10],
};

export const LANGUAGES = ['english', 'japanese'];
export const SPRITE_SOURCES = ['bundled', 'custom'];
export const SPRITE_MAP_MODES = ['json', 'labels'];
export const EXPORT_FORMATS = ['mp3', 'ogg'];

export const STORAGE_KEYS = { settings: 'mvg:settings:v1', presets: 'mvg:presets:v1' };
