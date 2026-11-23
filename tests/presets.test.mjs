import test from 'node:test';
import assert from 'node:assert/strict';
import { presetVoice, rollVoice, normalizeSettings, createDefaultSettings,
  applyPreset, markCustom, loadSettings, saveSettings,
  saveUserPreset, listUserPresets, deleteUserPreset } from '../src/presets.js';

test('character presets use the spec midpoints', () => {
  assert.equal(presetVoice('miguelium').pitch, 0.85);
  assert.equal(presetVoice('ms-rowlet').pitch, 2.9);
  for (const c of ['miguelium', 'ms-rowlet']) {
    const v = presetVoice(c);
    assert.equal(v.speed, 3.9);
    assert.equal(v.randomness, 0.1);
    assert.equal(v.melodyRate, 0.055);
    assert.equal(v.melodyAmplitude, 0.1);
    assert.equal(v.spaceDelay, 0.035);
    assert.equal(v.punctuationDelay, 0.3);
  }
});

test('rollVoice stays inside the character bands and rounds to 3 decimals', () => {
  const v = rollVoice('ms-rowlet', () => 0);
  assert.equal(v.pitch, 2.4);
  assert.equal(rollVoice('miguelium', () => 1).pitch, 1.1);
  assert.equal(rollVoice('nobody', () => 0.5).pitch, 1.75);
});

test('sanitizeSettings clamps and rejects bad numbers', () => {
  const s = normalizeSettings({ voice: { pitch: 99, speed: NaN }, language: 'klingon' });
  assert.equal(s.voice.pitch, 4);
  assert.equal(s.voice.speed, 3.9);
  assert.equal(normalizeSettings({ language: 'custom' }).language, 'english');
  assert.equal(s.language, 'english');
  assert.deepEqual(s.timing.punctuations, ['.', ',', '!', '?', "'", '"', '(', ')', '~', '。', '、', '！', '？', 'っ', 'ッ', 'ー']);
});

test('applyPreset changes only the voice recipe; markCustom remembers the band source', () => {
  const s = { ...createDefaultSettings(), language: 'japanese', export: { format: 'ogg', bitrate: 96, quality: 5 } };
  const r = applyPreset(s, 'ms-rowlet');
  assert.equal(r.voice.pitch, 2.9);
  assert.equal(r.language, 'japanese');
  assert.equal(r.export.format, 'ogg');
  assert.equal(markCustom(r).preset, 'custom');
  assert.equal(markCustom(r).reRollSource, 'ms-rowlet');
});

test('settings and named presets persist through an injected storage', () => {
  const map = new Map();
  const storage = { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, v) };
  const s = applyPreset(createDefaultSettings(), 'ms-rowlet');
  saveSettings(storage, s);
  assert.equal(loadSettings(storage).voice.pitch, 2.9);
  saveUserPreset(storage, 'Whisper Rowlet', s);
  const presets = listUserPresets(storage);
  assert.equal(presets[0].name, 'Whisper Rowlet');
  deleteUserPreset(storage, presets[0].id);
  assert.equal(listUserPresets(storage).length, 0);
});
