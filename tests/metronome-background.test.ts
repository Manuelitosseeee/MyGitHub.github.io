import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderLoop, wavBuffer, LOOP_SAMPLE_RATE } from '../src/engine/metroLoop';
import type { MetronomeConfig } from '../src/engine/metronome';
const cfg: MetronomeConfig = { bpm: 120, volume: 1, sound: 'mechanical', subdivision: 'none', weights: [2,1,1,1] };
const energy = (data: Float32Array, start: number, end: number) => data.slice(Math.round(start * LOOP_SAMPLE_RATE), Math.round(end * LOOP_SAMPLE_RATE)).reduce((n, s) => n + s*s, 0);

test('PCM contains exactly one bar at the requested tempo, at extreme and fractional pulse positions', () => {
  for (const bpm of [20,73,120,167,400]) for (const subdivision of ['none','eighth','triplet','sixteenth'] as const) {
    const {samples,duration} = renderLoop({...cfg,bpm,subdivision});
    assert.equal(samples.length, Math.round(60 / bpm * 4 * LOOP_SAMPLE_RATE));
    assert.ok(Math.abs(duration - 240 / bpm) <= 1 / LOOP_SAMPLE_RATE);
    assert.ok(samples.every(Number.isFinite));
  }
});
test('silent beats and subdivisions are respected; no accidental second metronome', () => {
  const {samples} = renderLoop({...cfg,weights:[2,0,1,0]});
  assert.ok(energy(samples,0,.1)>0);
  assert.equal(energy(samples,.5,.6),0);
  assert.ok(energy(samples,1,1.1)>0);
  assert.equal(energy(samples,1.5,1.6),0);
  const eighths=renderLoop({...cfg,weights:[2,0,1,0],subdivision:'eighth'}).samples;
  assert.ok(energy(eighths,.75,.85)>0);
});
test('all four sounds produce PCM and volume is baked into the audio for iOS', () => {
  for (const sound of ['classic','digital','metallic','mechanical'] as const) {
    const data=renderLoop({...cfg,sound}).samples;
    assert.ok(energy(data,0,.1)>0, sound);
    assert.ok(data.every(s=>Math.abs(s)<2), sound);
    assert.ok(renderLoop({...cfg,sound,volume:0}).samples.every(s=>s===0));
  }
  const full=renderLoop(cfg).samples, half=renderLoop({...cfg,volume:.5}).samples;
  assert.ok(Math.abs(energy(half,0,2)/energy(full,0,2)-.25)<1e-6);
});
test('WAV is valid mono PCM16 with no extra silence at the loop seam', () => {
  const {samples}=renderLoop(cfg), buffer=wavBuffer(samples), v=new DataView(buffer);
  assert.equal(new TextDecoder().decode(buffer.slice(0,4)),'RIFF');
  assert.equal(new TextDecoder().decode(buffer.slice(8,12)),'WAVE');
  assert.equal(v.getUint16(22,true),1);assert.equal(v.getUint32(24,true),44100);
  assert.equal(v.getUint16(34,true),16);assert.equal(v.getUint32(40,true),samples.length*2);
  assert.equal(buffer.byteLength,44+samples.length*2);
});
