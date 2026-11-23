import { DEFAULT_PUNCTUATIONS } from './defaults.js';

let assetBase = '/';
try {
  assetBase = import.meta.env.BASE_URL;
} catch {
  assetBase = '/';
}

export const spriteUrl = (name, base = assetBase) => `${base}sprites/${name}`;

export const BUNDLED_SPRITES = {
  english: { wav: spriteUrl('japanese-sprite.wav'), map: spriteUrl('english-letters-sprite.json'), analyzer: 'EnglishAnalyzer' },
  japanese: { wav: spriteUrl('japanese-sprite.wav'), map: spriteUrl('japanese-sprite.json'), analyzer: 'JapaneseAnalyzer' },
};

const CUSTOM_SPRITE_ERROR = 'Custom WAV requires a SpriteMap JSON file or phoneme labels';

const asObject = (value) => (value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {});

const bundledSprite = (language) => BUNDLED_SPRITES[language] ?? BUNDLED_SPRITES.english;

export function buildEngineConfig(settings, sprite) {
  const s = asObject(settings);
  const voice = asObject(s.voice);
  const timing = asObject(s.timing);
  return {
    analyzer: asObject(sprite).analyzer || bundledSprite(s.language).analyzer,
    effect: {
      pitch: voice.pitch,
      speed: voice.speed,
      randomness: voice.randomness,
      melodyRate: voice.melodyRate,
      melodyAmplitude: voice.melodyAmplitude,
    },
    config: {
      spaceDelay: timing.spaceDelay,
      punctuationDelay: timing.punctuationDelay,
      punctuations: Array.isArray(timing.punctuations) ? [...timing.punctuations] : [...DEFAULT_PUNCTUATIONS],
    },
  };
}

const samplerOptions = (settings) => {
  const sampler = asObject(asObject(settings).sampler);
  return {
    maxRetries: sampler.maxRetries,
    silenceThreshold: sampler.silenceThreshold,
    minSilenceDurationMs: sampler.minSilenceDurationMs,
  };
};

export function buildSamplerSpec(settings, files) {
  const s = asObject(settings);
  const f = asObject(files);
  if (s.spriteSource === 'custom') {
    if (!f.wav) throw new Error(CUSTOM_SPRITE_ERROR);
    if (s.spriteMapMode === 'labels') {
      const labels = (typeof s.spriteLabels === 'string' ? s.spriteLabels : '').split(/[\s,]+/).filter(Boolean);
      if (!labels.length) throw new Error(CUSTOM_SPRITE_ERROR);
      return { wavSource: f.wav, sprites: labels, options: samplerOptions(s) };
    }
    if (!f.map) throw new Error(CUSTOM_SPRITE_ERROR);
    return { wavSource: f.wav, sprites: f.map, options: samplerOptions(s) };
  }
  const sprite = bundledSprite(s.language);
  return { wavSource: sprite.wav, sprites: sprite.map, options: samplerOptions(s) };
}

export function parsePunctuations(text) {
  const seen = new Set();
  const result = [];
  for (const character of Array.from(String(text ?? ''))) {
    if (!/\s/.test(character) && !seen.has(character)) {
      seen.add(character);
      result.push(character);
    }
  }
  return result;
}

export function formatPunctuations(list) {
  return Array.isArray(list) ? list.join(' ') : '';
}

const slug = (value, fallback) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || fallback;

export function downloadName(text, preset, format) {
  const title = slug(text, 'voice').slice(0, 60).replace(/-+$/g, '');
  const name = slug(preset, 'voice');
  const extension = String(format ?? 'mp3').toLowerCase().replace(/[^a-z0-9]+/g, '') || 'mp3';
  return `${title}-${name}.${extension}`;
}
