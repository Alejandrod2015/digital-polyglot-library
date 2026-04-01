function encodeBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }

  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index] ?? 0);
  }
  return btoa(binary);
}

function writeAscii(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

function createToneWavDataUri(
  tones: Array<{ frequency: number; durationMs: number; gain: number }>,
  sampleRate = 22050
): string {
  const gapSamples = Math.floor(sampleRate * 0.018);
  const totalSamples =
    tones.reduce((sum, tone) => sum + Math.floor((sampleRate * tone.durationMs) / 1000), 0) +
    gapSamples * Math.max(0, tones.length - 1);
  const pcmBytes = new Uint8Array(totalSamples * 2);
  const pcmView = new DataView(pcmBytes.buffer);

  let sampleIndex = 0;
  for (let toneIndex = 0; toneIndex < tones.length; toneIndex += 1) {
    const tone = tones[toneIndex];
    const toneSamples = Math.floor((sampleRate * tone.durationMs) / 1000);
    for (let index = 0; index < toneSamples; index += 1) {
      const t = index / sampleRate;
      const attack = Math.min(1, index / Math.max(1, toneSamples * 0.14));
      const release = Math.min(1, (toneSamples - index) / Math.max(1, toneSamples * 0.24));
      const envelope = Math.max(0, Math.min(attack, release));
      const sample =
        Math.sin(2 * Math.PI * tone.frequency * t) * tone.gain * envelope;
      pcmView.setInt16(sampleIndex * 2, Math.round(sample * 32767), true);
      sampleIndex += 1;
    }

    if (toneIndex < tones.length - 1) {
      sampleIndex += gapSamples;
    }
  }

  const wavBytes = new Uint8Array(44 + pcmBytes.length);
  const wavView = new DataView(wavBytes.buffer);
  writeAscii(wavView, 0, "RIFF");
  wavView.setUint32(4, 36 + pcmBytes.length, true);
  writeAscii(wavView, 8, "WAVE");
  writeAscii(wavView, 12, "fmt ");
  wavView.setUint32(16, 16, true);
  wavView.setUint16(20, 1, true);
  wavView.setUint16(22, 1, true);
  wavView.setUint32(24, sampleRate, true);
  wavView.setUint32(28, sampleRate * 2, true);
  wavView.setUint16(32, 2, true);
  wavView.setUint16(34, 16, true);
  writeAscii(wavView, 36, "data");
  wavView.setUint32(40, pcmBytes.length, true);
  wavBytes.set(pcmBytes, 44);

  return `data:audio/wav;base64,${encodeBase64(wavBytes)}`;
}

export const JOURNEY_MILESTONE_CHIME_URI = createToneWavDataUri([
  { frequency: 784, durationMs: 95, gain: 0.14 },
  { frequency: 1046.5, durationMs: 125, gain: 0.16 },
]);

// Short ascending ding for a correct practice answer
export const PRACTICE_CORRECT_SOUND_URI = createToneWavDataUri([
  { frequency: 659, durationMs: 60, gain: 0.15 },
  { frequency: 1047, durationMs: 110, gain: 0.17 },
]);

// Short descending low tone for a wrong practice answer
export const PRACTICE_WRONG_SOUND_URI = createToneWavDataUri([
  { frequency: 330, durationMs: 70, gain: 0.18 },
  { frequency: 247, durationMs: 110, gain: 0.14 },
]);
