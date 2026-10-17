import { test } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { RecordingCapture } from "../src/recordings/recorder";

const memory = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => memory.set(key, value),
  removeItem: (key: string) => memory.delete(key),
} });
const windowMock = Object.assign(new EventTarget(), { setInterval: () => 1, clearInterval: () => undefined });
Object.defineProperty(globalThis, "window", { configurable: true, value: windowMock });
let now = 0;
Object.defineProperty(globalThis, "performance", { configurable: true, value: { now: () => now } });
function stream() {
  const track = { onended: null, stopped: false, stop() { this.stopped = true; } };
  return { track, getTracks: () => [track], getAudioTracks: () => [track] };
}
let getMedia = async () => stream();
Object.defineProperty(globalThis, "navigator", { configurable: true, value: { mediaDevices: { getUserMedia: () => getMedia() } } });
class FakeRecorder {
  static current: FakeRecorder;
  static isTypeSupported(type: string) { return type === "audio/webm;codecs=opus"; }
  mimeType = "audio/webm;codecs=opus";
  state = "inactive";
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public source: ReturnType<typeof stream>) { FakeRecorder.current = this; }
  start() { this.state = "recording"; }
  pause() { this.state = "paused"; }
  resume() { this.state = "recording"; }
  stop() {
    this.state = "inactive";
    queueMicrotask(() => { this.ondataavailable?.({ data: new Blob(["final audio chunk"], { type: this.mimeType }) }); this.onstop?.(); });
  }
}
Object.defineProperty(globalThis, "MediaRecorder", { configurable: true, value: FakeRecorder });

// Tests intentionally run sequentially: the browser APIs above are controlled globals.
test("capture, atomic persistence and reset", async (t) => {
  await t.test("pause excludes time; final chunk is present and microphone is released", async () => {
    now = 0;
    const mic = stream(); getMedia = async () => mic;
    const capture = new RecordingCapture(); await capture.start();
    assert.equal(capture.snapshot.status, "recording");
    now = 1200; capture.pause();
    now = 8200; capture.resume();
    now = 10000; capture.stop(); await Promise.resolve();
    assert.equal(capture.snapshot.status, "review");
    assert.equal(capture.snapshot.seconds, 3);
    assert.equal(await capture.snapshot.blob?.text(), "final audio chunk");
    assert.equal(mic.track.stopped, true);
    capture.cancel();
  });
  await t.test("cancel while permission is pending releases a late microphone and cannot start recording", async () => {
    let resolve!: (value: ReturnType<typeof stream>) => void;
    getMedia = () => new Promise((done) => { resolve = done; });
    const capture = new RecordingCapture();
    const request = capture.start(); capture.cancel();
    const mic = stream(); resolve(mic); await request;
    assert.equal(mic.track.stopped, true);
    assert.equal(capture.snapshot.status, "idle");
  });
  await t.test("permission denial is retryable and never leaves the recorder busy", async () => {
    getMedia = async () => { throw new DOMException("Denied", "NotAllowedError"); };
    const capture = new RecordingCapture(); await capture.start();
    assert.equal(capture.snapshot.status, "idle"); assert.match(capture.snapshot.error, /non consentito/);
    getMedia = async () => stream(); await capture.start();
    assert.equal(capture.snapshot.status, "recording"); capture.cancel();
  });
  await t.test("redo discards every chunk and the previous take clock", async () => {
    now = 0; getMedia = async () => stream();
    const capture = new RecordingCapture(); await capture.start();
    FakeRecorder.current.ondataavailable?.({ data: new Blob(["old take"]) });
    now = 5000; capture.cancel(); await capture.start();
    now = 7000; capture.stop(); await Promise.resolve();
    assert.equal(capture.snapshot.seconds, 2);
    assert.equal(await capture.snapshot.blob?.text(), "final audio chunk");
    capture.cancel();
  });
  const { store } = await import("../src/data/store");
  const { idbGet, idbSet } = await import("../src/lib/idb");
  await store.init();
  await t.test("existing library survives; audio and metadata persist together; notes are free text", async () => {
    const song = store.addSong("Por una cabeza");
    const saved = await store.addRecording({ songId: song.id, title: song.title, blob: new Blob(["performance"], { type: "audio/webm" }), duration: 120 });
    assert.equal(store.state.songs.length, 1);
    assert.equal((await idbGet<any[]>("recordings"))?.[0].id, saved.id);
    assert.equal(await (await store.getBlob(saved.id))?.text(), "performance");
    await Promise.all([store.updateRecordingNotes(saved.id, "Battuta 10"), store.updateRecordingNotes(saved.id, "Battuta 10: legato più uniforme\nRiascoltare 0:30–0:42.")]);
    assert.match((await idbGet<any[]>("recordings"))![0].notes, /legato più uniforme\n/);
    store.renameSong(song.id, "Por una cabeza — nuovo titolo");
    store.deleteSong(song.id);
    // Await a queue barrier, including the detach caused by deleting the song.
    await store.updateRecordingNotes(saved.id, "La prova rimane salvata");
    assert.equal(store.state.recordings[0].songId, null);
    assert.equal(store.state.recordings[0].title, "Por una cabeza — nuovo titolo");
    assert.ok(await store.getBlob(saved.id));
  });
  await t.test("delete removes both metadata and blob, but preserves the library", async () => {
    const song = store.addSong("Romance");
    const saved = await store.addRecording({ songId: song.id, title: song.title, blob: new Blob(["take"]), duration: 10 });
    await store.deleteRecording(saved.id);
    assert.equal(store.state.recordings.some((item) => item.id === saved.id), false);
    assert.equal(await store.getBlob(saved.id), null);
    assert.equal(store.songById(song.id)?.title, "Romance");
  });
  await t.test("invalid/empty audio is not saved", async () => {
    const before = store.state.recordings.length;
    await assert.rejects(store.addRecording({ songId: null, title: "Empty", blob: new Blob([]), duration: 0 }));
    assert.equal(store.state.recordings.length, before);
  });
  await t.test("transaction failure is visible; later saves still work", async () => {
    const before = store.state.recordings.length;
    const bad = new Blob(["take"]);
    // A Blob that cannot be structured-cloned simulates a rejected storage write.
    const uncloneable = () => undefined;
    await assert.rejects(store.addRecording({ songId: null, title: "Fail", blob: Object.assign(uncloneable, { size: bad.size, type: "audio/webm" }) as unknown as Blob, duration: 2 }));
    assert.equal(store.state.recordings.length, before);
    assert.equal((await idbGet<any[]>("recordings"))!.length, before);
    const saved = await store.addRecording({ songId: null, title: "Retry", blob: bad, duration: 2 });
    assert.ok(await store.getBlob(saved.id));
  });
  await t.test("reset also removes recordings, notes and blobs; an in-flight save cannot resurrect data", async () => {
    const id = store.state.recordings[0].id;
    await idbSet("unrelated-old-data", "old");
    const pending = store.addRecording({ songId: null, title: "Race", blob: new Blob(["audio"]), duration: 1 });
    const result = pending.catch(() => null);
    await store.resetAll(); await result;
    assert.deepEqual(store.state.recordings, []);
    assert.equal(await idbGet("recordings"), undefined);
    assert.equal(await store.getBlob(id), null);
    assert.equal(await idbGet("unrelated-old-data"), undefined);
  });
});
