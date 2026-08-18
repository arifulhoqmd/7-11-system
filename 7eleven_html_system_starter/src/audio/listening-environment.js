export const LISTENING_ENVIRONMENTS = Object.freeze([
  Object.freeze({ id: "clean", label: "Clean", gain: 0, kind: "clean" }),
  Object.freeze({ id: "light", label: "Light noise", gain: 0.025, kind: "noise" }),
  Object.freeze({ id: "medium", label: "Medium noise", gain: 0.055, kind: "noise" }),
  Object.freeze({
    id: "conversation",
    label: "Background conversation",
    gain: 0.09,
    kind: "conversation",
  }),
]);

const ENVIRONMENT_BY_ID = new Map(
  LISTENING_ENVIRONMENTS.map((environment) => [environment.id, environment]),
);

export function normalizeListeningEnvironment(value) {
  return ENVIRONMENT_BY_ID.has(value) ? value : "clean";
}

function fillNeutralNoise(samples, random) {
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = random() * 2 - 1;
  }
}

function fillConversationBabble(samples, sampleRate, random) {
  for (let index = 0; index < samples.length; index += 1) {
    const time = index / sampleRate;
    const phraseEnvelope =
      0.08 +
      0.52 * Math.max(0, Math.sin(2 * Math.PI * 2.2 * time)) +
      0.28 * Math.max(0, Math.sin(2 * Math.PI * 3.7 * time + 1.4));
    const firstVoice =
      Math.sin(2 * Math.PI * 122 * time + 0.18 * Math.sin(2 * Math.PI * 3 * time)) +
      0.42 * Math.sin(2 * Math.PI * 244 * time) +
      0.2 * Math.sin(2 * Math.PI * 488 * time) +
      0.12 * Math.sin(2 * Math.PI * 732 * time);
    const secondVoice =
      0.65 * Math.sin(2 * Math.PI * 174 * time + 1.1) +
      0.28 * Math.sin(2 * Math.PI * 348 * time + 0.5) +
      0.15 * Math.sin(2 * Math.PI * 522 * time + 0.9) +
      0.09 * Math.sin(2 * Math.PI * 696 * time + 0.2);
    const breath = (random() * 2 - 1) * 0.32;
    samples[index] = Math.max(
      -1,
      Math.min(1, (firstVoice + secondVoice + breath) * phraseEnvelope * 0.55),
    );
  }
}

export function createListeningEnvironment({
  AudioContext = globalThis.AudioContext ?? globalThis.webkitAudioContext,
  random = Math.random,
} = {}) {
  let context = null;
  let source = null;
  let gainNode = null;
  let filterNode = null;

  function stop() {
    if (source !== null) {
      try {
        source.stop();
      } catch {
        // A source that already ended needs no further cleanup.
      }
      source.disconnect?.();
    }
    gainNode?.disconnect?.();
    filterNode?.disconnect?.();
    source = null;
    gainNode = null;
    filterNode = null;
  }

  function start(level) {
    stop();
    const environment = ENVIRONMENT_BY_ID.get(
      normalizeListeningEnvironment(level),
    );
    if (environment.gain === 0 || typeof AudioContext !== "function") {
      return Object.freeze({ active: false, level: environment.id });
    }

    try {
      context ??= new AudioContext();
      context.resume?.();
      const sampleRate = context.sampleRate || 44100;
      const bufferDurationSeconds =
        environment.kind === "conversation" ? 4 : 2;
      const buffer = context.createBuffer(
        1,
        sampleRate * bufferDurationSeconds,
        sampleRate,
      );
      const samples = buffer.getChannelData(0);
      if (environment.kind === "conversation") {
        fillConversationBabble(samples, sampleRate, random);
      } else {
        fillNeutralNoise(samples, random);
      }

      source = context.createBufferSource();
      gainNode = context.createGain();
      filterNode = context.createBiquadFilter();
      source.buffer = buffer;
      source.loop = true;
      gainNode.gain.value = environment.gain;
      filterNode.type = "lowpass";
      filterNode.frequency.value =
        environment.kind === "conversation" ? 1600 : 1200;
      source.connect(filterNode);
      filterNode.connect(gainNode);
      gainNode.connect(context.destination);
      source.start();
      return Object.freeze({ active: true, level: environment.id });
    } catch {
      stop();
      context?.close?.();
      context = null;
      return Object.freeze({ active: false, level: environment.id });
    }
  }

  function dispose() {
    stop();
    context?.close?.();
    context = null;
  }

  return Object.freeze({ start, stop, dispose });
}
