/**
 * LocalScores
 * -----------
 * Personal bests, stored entirely in this browser via localStorage — no
 * network, no account, no other players' data. One entry per (difficulty,
 * duration) mode; only the four standard durations are ever tracked —
 * custom durations are never saved, by design.
 *
 * Everything here is synchronous: reads and writes are instant (no
 * network round trip), so saving a score at the end of a test never
 * blocks or slows anything down.
 */
const LocalScores = (() => {
  const STORAGE_KEY = "typeow:bestScores";
  const ALLOWED_DURATIONS = [15, 30, 60, 120];

  function key(difficulty, duration) {
    return difficulty + "_" + duration;
  }

  function isStandardDuration(duration) {
    return ALLOWED_DURATIONS.indexOf(Number(duration)) !== -1;
  }

  function loadAll() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  /** Best wpm for one (difficulty, duration) mode, or null if none yet / custom duration. */
  function getBest(difficulty, duration) {
    if (!isStandardDuration(duration)) return null;
    const entry = loadAll()[key(difficulty, duration)];
    return entry ? entry.wpm : null;
  }

  /** Every saved best, keyed "difficulty_duration" — e.g. for the settings table. */
  function getAllBests() {
    return loadAll();
  }

  /**
   * Saves a score only if it beats the existing best for that exact mode.
   * No-ops for custom durations. Returns {saved, isNewBest, best}.
   */
  function submitScore(difficulty, duration, wpm, accuracy) {
    if (!isStandardDuration(duration)) {
      return { saved: false, isNewBest: false, best: null };
    }
    const all = loadAll();
    const k = key(difficulty, duration);
    const existing = all[k];
    if (existing && existing.wpm >= wpm) {
      return { saved: false, isNewBest: false, best: existing.wpm };
    }
    all[k] = {
      wpm: Math.round(wpm),
      accuracy: Math.round(accuracy),
      date: new Date().toISOString(),
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch (e) {
      // Storage full or unavailable (e.g. private browsing) — non-fatal,
      // the score just won't persist this time.
      return { saved: false, isNewBest: false, best: existing ? existing.wpm : null };
    }
    return { saved: true, isNewBest: true, best: Math.round(wpm) };
  }

  return { getBest, getAllBests, submitScore };
})();
