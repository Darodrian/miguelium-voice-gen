import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  BUNDLED_SPRITES,
  buildEngineConfig,
  buildSamplerSpec,
  parsePunctuations,
  formatPunctuations,
  downloadName,
  spriteUrl,
} from '../src/voice-config.js';
import { LANGUAGES } from '../src/defaults.js';
import { createDefaultSettings, normalizeSettings } from '../src/presets.js';

test('engine config maps effect and timing fields only', () => {
  const c = buildEngineConfig(createDefaultSettings(), { analyzer: 'OverrideAnalyzer' });
  assert.equal(c.analyzer, 'OverrideAnalyzer');
  assert.deepEqual(c.effect, { pitch: 0.85, speed: 3.9, randomness: 0.1, melodyRate: 0.055, melodyAmplitude: 0.1 });
  assert.equal(c.config.punctuationDelay, 0.3);
  assert.deepEqual(c.config.punctuations, ['.', ',', '!', '?', "'", '"', '(', ')', '~', '。', '、', '！', '？', 'っ', 'ッ', 'ー']);
});

test('bundled sprite selection follows the analyzer', () => {
  const s = { ...createDefaultSettings(), language: 'japanese' };
  const spec = buildSamplerSpec(s, {});
  assert.equal(spec.wavSource, '/sprites/japanese-sprite.wav');
  assert.equal(spec.sprites, '/sprites/japanese-sprite.json');
});

test('buildSamplerSpec rejects incomplete custom sprites', () => {
  const s = { ...createDefaultSettings(), spriteSource: 'custom', spriteMapMode: 'json' };
  assert.throws(() => buildSamplerSpec(s, {}), /Custom WAV requires a SpriteMap JSON/);
});

test('punctuation parsing and download names', () => {
  assert.deepEqual(parsePunctuations('. , ! ? !'), ['.', ',', '!', '?']);
  assert.equal(downloadName('¡Hola, mundo!', 'miguelium', 'mp3'), 'hola-mundo-miguelium.mp3');
});

test('BUNDLED_SPRITES pairs each language with its wav, map and analyzer', () => {
  assert.deepEqual(BUNDLED_SPRITES, {
    english: { wav: '/sprites/japanese-sprite.wav', map: '/sprites/english-letters-sprite.json', analyzer: 'EnglishAnalyzer' },
    japanese: { wav: '/sprites/japanese-sprite.wav', map: '/sprites/japanese-sprite.json', analyzer: 'JapaneseAnalyzer' },
  });
});

test('engine config derives the analyzer from language when no sprite is given', () => {
  const s = { ...createDefaultSettings(), language: 'korean' };
  assert.equal(buildEngineConfig(s).analyzer, 'EnglishAnalyzer');
  assert.equal(buildEngineConfig(s, BUNDLED_SPRITES.english).analyzer, 'EnglishAnalyzer');
});

test('korean is not a supported language', () => {
  assert.deepEqual(LANGUAGES, ['english', 'japanese']);
  assert.equal(normalizeSettings({ language: 'korean' }).language, 'english');
  const html = readFileSync('index.html', 'utf8');
  assert.ok(!html.includes('value="korean"'));
});

test('sampler spec carries sampler options and maps custom files by mode', () => {
  const base = { ...createDefaultSettings(), spriteSource: 'custom' };
  const wav = { arrayBuffer: async () => new ArrayBuffer(8) };
  const map = { a: { startMs: 0, durationMs: 100 } };
  const withMap = buildSamplerSpec({ ...base, spriteMapMode: 'json' }, { wav, map });
  assert.equal(withMap.wavSource, wav);
  assert.equal(withMap.sprites, map);
  assert.deepEqual(withMap.options, { maxRetries: 3, silenceThreshold: 0.01, minSilenceDurationMs: 20 });

  const withLabels = buildSamplerSpec(
    { ...base, spriteMapMode: 'labels', spriteLabels: 'a,b  c' },
    { wav },
  );
  assert.deepEqual(withLabels.sprites, ['a', 'b', 'c']);
});

test('custom sprites require both a wav and a usable map or labels', () => {
  const wav = { arrayBuffer: async () => new ArrayBuffer(8) };
  assert.throws(
    () => buildSamplerSpec({ ...createDefaultSettings(), spriteSource: 'custom', spriteMapMode: 'json' }, { wav }),
    /Custom WAV requires a SpriteMap JSON/,
  );
  assert.throws(
    () => buildSamplerSpec({ ...createDefaultSettings(), spriteSource: 'custom', spriteMapMode: 'labels' }, { wav }),
    /Custom WAV requires a SpriteMap JSON/,
  );
});

test('punctuation formatting round-trips unique single characters', () => {
  const list = parsePunctuations('.!?。 .!?');
  assert.deepEqual(list, ['.', '!', '?', '。']);
  assert.equal(formatPunctuations(list), '. ! ? 。');
  assert.equal(formatPunctuations([]), '');
});

test('download names strip accents, collapse separators and cap the slug at 60 chars', () => {
  assert.equal(downloadName('  ¡Hola,   mundo!  ', 'miguelium', 'mp3'), 'hola-mundo-miguelium.mp3');
  assert.equal(downloadName('Crème brûlée', 'ms-rowlet', 'ogg'), 'creme-brulee-ms-rowlet.ogg');
  const long = downloadName('a'.repeat(80), 'miguelium', 'mp3');
  assert.equal(long, `${'a'.repeat(60)}-miguelium.mp3`);
  assert.equal(downloadName('', 'miguelium', 'mp3'), 'voice-miguelium.mp3');
});

test('english bundled sprite uses japanese sounds with a letter alias map', () => {
  assert.deepEqual(BUNDLED_SPRITES.english, {
    wav: '/sprites/japanese-sprite.wav',
    map: '/sprites/english-letters-sprite.json',
    analyzer: 'EnglishAnalyzer',
  });
  const spec = buildSamplerSpec(createDefaultSettings(), {});
  assert.equal(spec.wavSource, '/sprites/japanese-sprite.wav');
  assert.equal(spec.sprites, '/sprites/english-letters-sprite.json');
});

test('english alias map covers every letter and accented vowel', () => {
  const base = JSON.parse(readFileSync('public/sprites/japanese-sprite.json', 'utf8'));
  const alias = JSON.parse(readFileSync('public/sprites/english-letters-sprite.json', 'utf8'));
  const expected = {
    a: 'a', b: 'b', c: 'c', d: 'd', e: 'e', f: 'h', g: 'g', h: 'h', i: 'i', j: 'j',
    k: 'k', l: 'r', m: 'm', n: 'n', o: 'o', p: 'p', q: 'k', r: 'r', s: 's', t: 't',
    u: 'u', v: 'b', w: 'w', x: 's', y: 'y', z: 's',
    'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ü': 'u', 'ñ': 'n',
  };
  assert.deepEqual(Object.keys(alias).sort(), Object.keys(expected).sort());
  for (const [from, to] of Object.entries(expected)) assert.deepEqual(alias[from], base[to], from);
});

test('spriteUrl prefixes sprite assets with the supplied base', () => {
  assert.equal(spriteUrl('japanese-sprite.wav', './'), './sprites/japanese-sprite.wav');
  assert.equal(spriteUrl('english-letters-sprite.json', '/repo/'), '/repo/sprites/english-letters-sprite.json');
  assert.equal(spriteUrl('japanese-sprite.wav'), '/sprites/japanese-sprite.wav');
});

test('custom english sprites still use the uploaded wav and map', () => {
  const base = { ...createDefaultSettings(), language: 'english', spriteSource: 'custom', spriteMapMode: 'json' };
  const wav = { arrayBuffer: async () => new ArrayBuffer(8) };
  const map = { z: { startMs: 0, durationMs: 10 } };
  const spec = buildSamplerSpec(base, { wav, map });
  assert.equal(spec.wavSource, wav);
  assert.equal(spec.sprites, map);
});
