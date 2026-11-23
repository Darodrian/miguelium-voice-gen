import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EnglishAnalyzer, JapaneseAnalyzer, MemorySampler } from 'animalese-tts';
import { synthesize, playSamples, encodeSamples, createGeneration, createEngine } from '../src/engine.js';
import { createDefaultSettings } from '../src/presets.js';

test('synthesize concatenates generator buffers and ignores empty text', async () => {
  let calls = 0;
  const engine = { synthesize() { calls++; return { speak: async function* () {
    yield { buffer: new Float32Array([1, 2]) };
    yield { buffer: new Float32Array([3]) };
  } }; } };
  const result = await synthesize(engine, 'hola');
  assert.deepEqual([...result.samples], [1, 2, 3]);
  assert.equal(result.sampleRate, 44100);
  assert.equal((await synthesize(engine, '   ')).samples.length, 0);
  assert.equal(calls, 1);
});

test('playSamples stop is immediate and idempotent', async () => {
  const calls = [];
  const context = {
    createBuffer: (ch, len, rate) => ({ copyToChannel: (data) => calls.push(['copy', len, rate]) }),
    createBufferSource: () => ({ connect: () => calls.push(['connect']), start: () => calls.push(['start']),
      stop: () => calls.push(['stop']), disconnect: () => calls.push(['disconnect']) }),
    destination: {},
  };
  const handle = await playSamples(new Float32Array([1, 2]), 44100, context);
  handle.stop();
  handle.stop();
  assert.equal(calls.filter((c) => c[0] === 'stop').length, 1);
  assert.ok(calls.some((c) => c[0] === 'start'));
});

test('playSamples resumes a suspended context before starting the source', async () => {
  const calls = [];
  const context = {
    state: 'suspended',
    resume: async () => { calls.push('resume'); context.state = 'running'; },
    createBuffer: () => ({ copyToChannel: () => {} }),
    createBufferSource: () => ({
      connect: () => {},
      start: () => calls.push('start'),
      stop: () => calls.push('stop'),
      disconnect: () => calls.push('disconnect'),
    }),
    destination: {},
  };
  const handle = await playSamples(new Float32Array([1, 2]), 44100, context);
  assert.equal(calls[0], 'resume');
  assert.ok(calls.indexOf('resume') < calls.indexOf('start'));
  handle.stop();
});

test('playSamples attaches the filled buffer to the source before start', async () => {
  const calls = [];
  let createdBuffer = null;
  let source = null;
  const context = {
    createBuffer: () => {
      createdBuffer = { length: 2, copyToChannel: (data) => calls.push(['copy', data]) };
      return createdBuffer;
    },
    createBufferSource: () => {
      source = {
        buffer: null,
        connect: () => calls.push(['connect']),
        start: () => calls.push(['start', source.buffer === createdBuffer]),
        stop: () => calls.push(['stop']),
        disconnect: () => calls.push(['disconnect']),
      };
      return source;
    },
    destination: {},
  };
  const handle = await playSamples(new Float32Array([1, 2]), 44100, context);
  assert.ok(source, 'a source node was created');
  assert.equal(source.buffer, createdBuffer, 'the source is attached to the filled buffer');
  assert.ok(calls.some((c) => c[0] === 'start'));
  handle.stop();
});

test('encodeSamples passes exact options and propagates encoder errors', async () => {
  const calls = [];
  const encoder = { mp3: async (...a) => { calls.push(a); return new Uint8Array([1]); },
    ogg: async () => { throw new Error('encoder down'); } };
  const out = await encodeSamples(new Float32Array([1]), 48000, { format: 'mp3', bitrate: 128, quality: 5 }, encoder);
  assert.deepEqual([...out], [1]);
  assert.deepEqual(calls[0][1], { sampleRate: 48000, bitrate: 128 });
  await assert.rejects(() => encodeSamples(new Float32Array([1]), 48000, { format: 'ogg', bitrate: 128, quality: 5 }, encoder), /encoder down/);
});

test('generation tokens discard late work', () => {
  const g = createGeneration();
  const old = g.next();
  const current = g.next();
  assert.equal(g.isCurrent(old), false);
  assert.equal(g.isCurrent(current), true);
});

test('synthesize prefers the engine sample rate over the default', async () => {
  const makeEngine = (sampleRate) => ({
    sampleRate,
    synthesize() { return { speak: async function* () { yield { buffer: new Float32Array([1]) }; } }; },
  });
  assert.equal((await synthesize(makeEngine(48000), 'hola')).sampleRate, 48000);
  assert.equal((await synthesize(makeEngine(24000), 'hola')).sampleRate, 24000);
});

test('createEngine uses the injected engine through the contracted AnimaleseEngine key', () => {
  class FakeEngine {
    constructor(config) { this.config = config; }
  }
  class FakeAnalyzer { analyze() { return []; } }
  class FakePitchManager { constructor() { } }
  const engine = createEngine(createDefaultSettings(), { sampleRate: 48000 }, {
    AnimaleseEngine: FakeEngine,
    analyzers: { EnglishAnalyzer: FakeAnalyzer },
    PitchManager: FakePitchManager,
  });
  assert.ok(engine instanceof FakeEngine);
  assert.equal(engine.sampleRate, 48000);
  assert.ok(engine.config.analyzer instanceof FakeAnalyzer);
});

test('createEngine uses the language analyzer from the default registry', () => {
  const en = createEngine(createDefaultSettings(), undefined);
  assert.ok(en.config.analyzer instanceof EnglishAnalyzer);
  const ja = createEngine({ ...createDefaultSettings(), language: 'japanese' }, undefined);
  assert.ok(ja.config.analyzer instanceof JapaneseAnalyzer);
  const ko = createEngine({ ...createDefaultSettings(), language: 'korean' }, undefined);
  assert.ok(ko.config.analyzer instanceof EnglishAnalyzer);
});

test('createEngine injected analyzer overrides win over the default registry', () => {
  class CustomAnalyzer { analyze() { return []; } }
  const overridden = createEngine({ ...createDefaultSettings(), language: 'japanese' }, undefined, {
    analyzers: { JapaneseAnalyzer: CustomAnalyzer },
  });
  assert.ok(overridden.config.analyzer instanceof CustomAnalyzer);
  const fallback = createEngine({ ...createDefaultSettings(), language: 'japanese' }, undefined, {
    analyzers: {},
  });
  assert.ok(fallback.config.analyzer instanceof EnglishAnalyzer);
});

test('english bundled sounds synthesize real audio for plain, uppercase and accented text', async () => {
  const wav = readFileSync('public/sprites/japanese-sprite.wav');
  const bytes = wav.buffer.slice(wav.byteOffset, wav.byteOffset + wav.byteLength);
  const map = JSON.parse(readFileSync('public/sprites/english-letters-sprite.json', 'utf8'));
  const sampler = new MemorySampler(bytes, map);
  await sampler.load();
  assert.ok((await sampler.getSample('á')).length > 0);
  const engine = createEngine(createDefaultSettings(), sampler);
  for (const text of ['hello', 'HELLO', '¡Hola, qué tal?', 'lvx zqf']) {
    const { samples, sampleRate } = await synthesize(engine, text);
    assert.ok(samples.length > 0, text);
    assert.equal(sampleRate, 48000);
  }
});
