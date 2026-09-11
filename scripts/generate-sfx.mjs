import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const sampleRate = 44100;
const scriptDir = dirname(fileURLToPath(import.meta.url));
const outputDir = resolve(scriptDir, "../public/audio");

function clamp(value) {
  return Math.max(-1, Math.min(1, value));
}

function envelope(time, start, attack, release) {
  if (time < start || time >= start + attack + release) return 0;
  const local = time - start;
  if (local < attack) return local / Math.max(attack, 0.0001);
  return Math.pow(1 - (local - attack) / release, 2.2);
}

function seededNoise(seed = 123456789) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return (state / 0xffffffff) * 2 - 1;
  };
}

function wavBuffer(samples) {
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  for (let index = 0; index < samples.length; index += 1) buffer.writeInt16LE(Math.round(clamp(samples[index]) * 32767), 44 + index * 2);
  return buffer;
}

function createPlacementSound() {
  const duration = 0.58;
  const samples = new Float32Array(Math.ceil(duration * sampleRate));
  const random = seededNoise(170);
  let filteredNoise = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const time = index / sampleRate;
    filteredNoise += 0.16 * (random() - filteredNoise);

    const impactEnv = Math.exp(-time * 18);
    const impactFrequency = 112 - Math.min(time / 0.18, 1) * 47;
    const impact = Math.sin(Math.PI * 2 * impactFrequency * time) * impactEnv * 0.58;
    const body = filteredNoise * Math.exp(-time * 30) * 0.32;

    const servoEnv = envelope(time, 0.075, 0.012, 0.18);
    const servoTime = Math.max(0, time - 0.075);
    const servoFrequency = 245 + servoTime * 720;
    const servo = (Math.sin(Math.PI * 2 * servoFrequency * servoTime) + 0.3 * Math.sin(Math.PI * 4 * servoFrequency * servoTime)) * servoEnv * 0.18;

    const clickTime = Math.abs(time - 0.205);
    const click = clickTime < 0.012 ? filteredNoise * (1 - clickTime / 0.012) * 0.58 : 0;

    const pingEnv = envelope(time, 0.245, 0.008, 0.29);
    const pingTime = Math.max(0, time - 0.245);
    const ping = (Math.sin(Math.PI * 2 * 690 * pingTime) + 0.25 * Math.sin(Math.PI * 2 * 1035 * pingTime)) * pingEnv * 0.22;

    samples[index] = Math.tanh((impact + body + servo + click + ping) * 1.25) * 0.82;
  }
  return samples;
}

function createRemovalSound() {
  const duration = 0.78;
  const samples = new Float32Array(Math.ceil(duration * sampleRate));
  const random = seededNoise(420);
  let filteredNoise = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const time = index / sampleRate;
    filteredNoise += 0.12 * (random() - filteredNoise);

    const powerEnv = envelope(time, 0, 0.012, 0.47);
    const powerFrequency = 520 * Math.pow(0.28, Math.min(time / 0.47, 1));
    const powerDown = Math.sin(Math.PI * 2 * powerFrequency * time) * powerEnv * 0.25;

    const releaseEnv = envelope(time, 0.1, 0.025, 0.34);
    const releaseTime = Math.max(0, time - 0.1);
    const releaseFrequency = 430 - Math.min(releaseTime / 0.35, 1) * 275;
    const release = (Math.sin(Math.PI * 2 * releaseFrequency * releaseTime) + filteredNoise * 0.5) * releaseEnv * 0.2;

    const latchA = Math.abs(time - 0.34) < 0.01 ? filteredNoise * (1 - Math.abs(time - 0.34) / 0.01) * 0.5 : 0;
    const latchB = Math.abs(time - 0.44) < 0.012 ? filteredNoise * (1 - Math.abs(time - 0.44) / 0.012) * 0.42 : 0;

    const clankEnv = envelope(time, 0.47, 0.005, 0.24);
    const clankTime = Math.max(0, time - 0.47);
    const clank = (Math.sin(Math.PI * 2 * 92 * clankTime) + 0.42 * Math.sin(Math.PI * 2 * 306 * clankTime) + 0.22 * Math.sin(Math.PI * 2 * 471 * clankTime)) * clankEnv * 0.4;

    const fadeEnv = envelope(time, 0.48, 0.025, 0.27);
    const fadeTime = Math.max(0, time - 0.48);
    const cyanFade = Math.sin(Math.PI * 2 * (680 - fadeTime * 720) * fadeTime) * fadeEnv * 0.11;

    samples[index] = Math.tanh((powerDown + release + latchA + latchB + clank + cyanFade) * 1.2) * 0.8;
  }
  return samples;
}

await mkdir(outputDir, { recursive: true });
await Promise.all([
  writeFile(resolve(outputDir, "sfx-place-device.wav"), wavBuffer(createPlacementSound())),
  writeFile(resolve(outputDir, "sfx-remove-device.wav"), wavBuffer(createRemovalSound())),
]);

console.log("Generated placement and removal sound effects in public/audio.");
