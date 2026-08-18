import assert from "node:assert/strict";
import test from "node:test";

import { createListeningEnvironment } from "../src/audio/listening-environment.js";

function createFakeAudioContext() {
  const instances = [];
  class FakeNode {
    constructor() {
      this.disconnected = false;
    }
    connect(target) {
      this.target = target;
    }
    disconnect() {
      this.disconnected = true;
    }
  }
  class FakeContext {
    constructor() {
      this.sampleRate = 8000;
      this.destination = {};
      this.sources = [];
      this.resumed = false;
      this.closed = false;
      instances.push(this);
    }
    resume() {
      this.resumed = true;
    }
    createBuffer(_channels, length) {
      const samples = new Float32Array(length);
      const buffer = { getChannelData: () => samples, samples };
      this.buffers ??= [];
      this.buffers.push(buffer);
      return buffer;
    }
    createBufferSource() {
      const node = new FakeNode();
      node.started = false;
      node.stopped = false;
      node.start = () => {
        node.started = true;
      };
      node.stop = () => {
        node.stopped = true;
      };
      this.sources.push(node);
      return node;
    }
    createGain() {
      const node = new FakeNode();
      node.gain = { value: 0 };
      this.gain = node;
      return node;
    }
    createBiquadFilter() {
      const node = new FakeNode();
      node.frequency = { value: 0 };
      this.filter = node;
      return node;
    }
    close() {
      this.closed = true;
    }
  }
  return { FakeContext, instances };
}

test("Clean listening creates no background audio", () => {
  const fake = createFakeAudioContext();
  const environment = createListeningEnvironment({
    AudioContext: fake.FakeContext,
  });
  assert.deepEqual(environment.start("clean"), {
    active: false,
    level: "clean",
  });
  assert.equal(fake.instances.length, 0);
});

test("Light and Medium activate quiet synthetic ambient audio", () => {
  const fake = createFakeAudioContext();
  const environment = createListeningEnvironment({
    AudioContext: fake.FakeContext,
    random: () => 0.5,
  });
  assert.equal(environment.start("light").active, true);
  const context = fake.instances[0];
  assert.equal(context.gain.gain.value, 0.025);
  assert.equal(context.sources[0].started, true);

  assert.equal(environment.start("medium").active, true);
  assert.equal(context.sources[0].stopped, true);
  assert.equal(context.gain.gain.value, 0.055);
});

test("Background conversation creates quiet, indistinct speech-like babble", () => {
  const fake = createFakeAudioContext();
  const environment = createListeningEnvironment({
    AudioContext: fake.FakeContext,
    random: () => 0.5,
  });

  assert.deepEqual(environment.start("conversation"), {
    active: true,
    level: "conversation",
  });
  const context = fake.instances[0];
  assert.equal(context.gain.gain.value, 0.09);
  assert.equal(context.filter.type, "lowpass");
  assert.equal(context.filter.frequency.value, 1600);
  const samples = context.buffers[0].samples;
  const rootMeanSquare = Math.sqrt(
    samples.reduce((sum, sample) => sum + sample ** 2, 0) / samples.length,
  );
  assert.ok(rootMeanSquare > 0.1);
  assert.equal(context.sources[0].started, true);
});

test("ambient audio stops at audio end or navigation cleanup", () => {
  const fake = createFakeAudioContext();
  const environment = createListeningEnvironment({
    AudioContext: fake.FakeContext,
  });
  environment.start("medium");
  const source = fake.instances[0].sources[0];
  environment.stop();
  assert.equal(source.stopped, true);
  assert.equal(source.disconnected, true);
});
