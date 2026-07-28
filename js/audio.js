/**
 * AudioManager
 * ------------
 * Handles two independent audio channels:
 *   - a short "typing" click sound, replayed on every keystroke
 *   - background "music", one track playing continuously
 *
 * Expects files at:
 *   audio/typing1.mp3, audio/typing2.mp3, audio/typing3.mp3
 *   audio/music1.mp3 ... audio/music5.mp3
 * Missing files fail silently (try/catch + swallowed play() rejections) —
 * the app works fine with no audio files present at all.
 *
 * All choices (volumes, selected track/sound) persist in localStorage so
 * they survive a page reload / return visit.
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "typeow:audioSettings";
  const MUSIC_TRACKS = ["music1", "music2", "music3", "music4", "music5"];
  const TYPING_POOL_SIZE = 6;

  const defaults = {
    musicVolume: 60,
    typingVolume: 70,
    musicTrack: "random", // "random" | "music1".."music5"
    typingSound: "typing1", // "typing1" | "typing2" | "typing3"
  };

  function loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return Object.assign({}, defaults);
      return Object.assign({}, defaults, JSON.parse(raw));
    } catch (e) {
      return Object.assign({}, defaults);
    }
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      /* storage unavailable (private browsing, quota, etc.) — non-fatal */
    }
  }

  const settings = loadSettings();

  // ---------------- typing sound pool ----------------
  // A small round-robin pool so rapid keystrokes can overlap instead of
  // cutting each other off.
  const typingPool = [];
  let typingPoolIndex = 0;
  for (let i = 0; i < TYPING_POOL_SIZE; i++) {
    const a = new Audio();
    a.preload = "auto";
    typingPool.push(a);
  }

  function refreshTypingPoolSrc() {
    const src = "audio/" + settings.typingSound + ".mp3";
    typingPool.forEach((a) => {
      a.src = src;
    });
  }
  refreshTypingPoolSrc();

  // Caps how often the typing sound can retrigger. Without this, very fast
  // typing (or a burst of keystrokes) fires more overlapping play() calls
  // than the audio pipeline can comfortably handle, which is what causes
  // background music to stutter — each play() call has real decode/mix
  // overhead, and it adds up faster than human ears can even distinguish
  // individual clicks anyway. 40ms still sounds continuous and responsive
  // (that's a 25/sec ceiling) while keeping a hard cap on the worst case.
  const TYPING_SOUND_MIN_INTERVAL_MS = 40;
  let lastTypingSoundAt = 0;

  function playTyping() {
    if (settings.typingVolume <= 0) return;
    const now = performance.now();
    if (now - lastTypingSoundAt < TYPING_SOUND_MIN_INTERVAL_MS) return;
    lastTypingSoundAt = now;
    try {
      const a = typingPool[typingPoolIndex];
      typingPoolIndex = (typingPoolIndex + 1) % typingPool.length;
      a.currentTime = 0;
      a.volume = settings.typingVolume / 100;
      const p = a.play();
      if (p && p.catch) p.catch(() => {});
    } catch (e) {
      /* missing file / not decodable — ignore */
    }
  }

  // ---------------- background music ----------------
  const musicEl = new Audio();
  musicEl.preload = "auto";
  let musicStarted = false;
  let lastTrack = null;

  function pickRandomTrack() {
    const candidates = lastTrack ? MUSIC_TRACKS.filter((t) => t !== lastTrack) : MUSIC_TRACKS;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  function playTrack(trackId) {
    lastTrack = trackId;
    musicEl.src = "audio/" + trackId + ".mp3";
    musicEl.loop = settings.musicTrack !== "random";
    musicEl.volume = settings.musicVolume / 100;
    try {
      const p = musicEl.play();
      if (p && p.catch) p.catch(() => {});
    } catch (e) {
      /* missing file — ignore */
    }
  }

  musicEl.addEventListener("ended", () => {
    if (settings.musicTrack === "random") {
      playTrack(pickRandomTrack());
    }
  });

  function startMusic() {
    if (musicStarted) return;
    musicStarted = true;
    const trackId = settings.musicTrack === "random" ? pickRandomTrack() : settings.musicTrack;
    playTrack(trackId);
  }

  function setMusicVolume(v) {
    settings.musicVolume = v;
    musicEl.volume = v / 100;
    persist();
  }

  function setTypingVolume(v) {
    settings.typingVolume = v;
    persist();
  }

  function setMusicTrack(trackId) {
    settings.musicTrack = trackId;
    persist();
    if (musicStarted) {
      playTrack(trackId === "random" ? pickRandomTrack() : trackId);
    }
  }

  function setTypingSound(soundId) {
    settings.typingSound = soundId;
    persist();
    refreshTypingPoolSrc();
  }

  function getSettings() {
    return Object.assign({}, settings);
  }

  global.AudioManager = {
    startMusic,
    playTyping,
    setMusicVolume,
    setTypingVolume,
    setMusicTrack,
    setTypingSound,
    getSettings,
  };
})(window);
