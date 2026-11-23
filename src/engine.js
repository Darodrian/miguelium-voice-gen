import { AnimaleseEngine, EnglishAnalyzer, JapaneseAnalyzer, PitchManager, WebSampler } from 'animalese-tts';
import encode from '@audio/encode';
import { buildEngineConfig, buildSamplerSpec } from './voice-config.js';

const DEFAULT_SAMPLE_RATE = 44100;

const DEFAULT_ANALYZERS = { EnglishAnalyzer, JapaneseAnalyzer };

export async function createSampler(settings, files, { WebSampler: Sampler = WebSampler, fetchJson = fetch } = {}) {
  const spec = buildSamplerSpec(settings, files);
  let sprites = spec.sprites;
  if (typeof sprites === 'string') {
    const response = await fetchJson(sprites);
    sprites = await response.json();
  } else if (sprites && typeof sprites.text === 'function') {
    sprites = JSON.parse(await sprites.text());
  }
  let wavSource = spec.wavSource;
  if (wavSource && typeof wavSource !== 'string') {
    const buffer = typeof wavSource.arrayBuffer === 'function' ? await wavSource.arrayBuffer() : wavSource;
    wavSource = URL.createObjectURL(new Blob([buffer]));
  }
  const sampler = new Sampler(wavSource, sprites, spec.options);
  await sampler.load();
  return { sampler, sampleRate: sampler.sampleRate ?? DEFAULT_SAMPLE_RATE };
}

export function createEngine(settings, sampler, {
  AnimaleseEngine: Engine = AnimaleseEngine,
  analyzers,
  PitchManager: PitchManagerClass = PitchManager,
} = {}) {
  const built = buildEngineConfig(settings);
  const analyzerClass = (analyzers ?? DEFAULT_ANALYZERS)[built.analyzer] ?? EnglishAnalyzer;
  const engine = new Engine({
    analyzer: new analyzerClass(),
    sampler,
    effect: new PitchManagerClass({ ...built.effect }),
    spaceDelay: built.config.spaceDelay,
    punctuationDelay: built.config.punctuationDelay,
    punctuations: built.config.punctuations,
  });
  engine.sampleRate = sampler?.sampleRate ?? DEFAULT_SAMPLE_RATE;
  return engine;
}

export async function synthesize(engine, text) {
  const sampleRate = engine?.sampleRate ?? engine?.sampler?.sampleRate ?? DEFAULT_SAMPLE_RATE;
  const source = String(text ?? '');
  if (source.trim() === '') return { samples: new Float32Array(0), sampleRate };
  const speaker = engine.synthesize(source);
  const parts = [];
  for await (const output of speaker.speak()) {
    const buffer = output?.buffer;
    if (buffer) parts.push(buffer);
  }
  const samples = new Float32Array(parts.reduce((total, buffer) => total + buffer.length, 0));
  let offset = 0;
  for (const buffer of parts) {
    samples.set(buffer, offset);
    offset += buffer.length;
  }
  return { samples, sampleRate };
}

export async function playSamples(samples, sampleRate, context) {
  if (context.state === 'suspended') await context.resume();
  const buffer = context.createBuffer(1, samples.length, sampleRate);
  buffer.copyToChannel(samples, 0);
  const source = context.createBufferSource();
  source.connect(context.destination);
  source.buffer = buffer;
  source.start();
  let stopped = false;
  return {
    stop() {
      if (stopped) return;
      stopped = true;
      source.stop();
      source.disconnect();
    },
  };
}

export async function encodeSamples(samples, sampleRate, options, encoder) {
  const { format, bitrate, quality } = options ?? {};
  if (format === 'ogg') {
    return await encoder.ogg(samples, { sampleRate, quality });
  }
  return await encoder.mp3(samples, { sampleRate, bitrate });
}

export function createGeneration() {
  let latest = 0;
  const next = () => {
    latest += 1;
    return latest;
  };
  return { next, isCurrent: (token) => token === latest };
}
