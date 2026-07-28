/**
 * app.js
 * ------
 * Wires WordManager, CountdownTimer, Stats, Gauge, UI, AudioManager and
 * LocalScores together. Owns the test state machine:
 *   idle -> running -> (paused) -> finished
 */
(function () {
  const INITIAL_BUFFER = 200;
  const EXTEND_THRESHOLD = 40;
  const EXTEND_BATCH = 100;
  const LAYOUT_STORAGE_KEY = "typeow:layout";
  const FOCUS_STORAGE_KEY = "typeow:focusMode";
  const MOUSE_MOVE_THRESHOLD_PX = 6;

  const dashEl = document.querySelector(".dash");
  const hiddenInput = document.getElementById("hiddenInput");
  const stageCanvas = document.getElementById("stageCanvas");
  const difficultyGroup = document.getElementById("difficultyGroup");
  const durationGroup = document.getElementById("durationGroup");
  const layoutGroup = document.getElementById("layoutGroup");
  const focusGroup = document.getElementById("focusGroup");
  const customDurationBtn = document.getElementById("customDurationBtn");
  const customDurationInput = document.getElementById("customDurationInput");
  const restartBtn = document.getElementById("restartBtn");
  const tryAgainBtn = document.getElementById("tryAgainBtn");
  const pbValueEl = document.getElementById("pbValue");
  const resultPersonalBestEl = document.getElementById("resultPersonalBest");
  const resultCompareEl = document.getElementById("resultCompare");

  let difficulty = "medium";
  let duration = 60;
  let isCustomDuration = false;
  let state = "idle"; // idle | running | paused | finished
  let testWords = [];
  let currentIndex = 0;
  let stats = { correctChars: 0, incorrectChars: 0, correctWords: 0, incorrectWords: 0 };
  let focusModeEnabled = false;
  let lastMouse = null;

  function onTick(remaining) {
    UI.updateTimer(remaining);
    refreshLiveWpm();
  }

  function onComplete() {
    const word = testWords[currentIndex];
    const typed = hiddenInput.value;
    if (word && typed.length > 0) {
      updateCharStats(word.target, typed);
    }
    state = "finished";
    hiddenInput.blur();
    hiddenInput.disabled = true;
    UI.setPauseVisible(false);
    updateFocusVisual();

    const minutes = duration / 60;
    const totalTyped = stats.correctChars + stats.incorrectChars;
    const finalStats = {
      wpm: Stats.computeWPM(stats.correctChars, minutes),
      rawWpm: Stats.computeRawWPM(totalTyped, minutes),
      accuracy: Stats.computeAccuracy(stats.correctChars, totalTyped),
      correctChars: stats.correctChars,
      incorrectChars: stats.incorrectChars,
      correctWords: stats.correctWords,
      incorrectWords: stats.incorrectWords,
    };
    UI.showResults(finalStats);
    reportScore(finalStats);
  }

  /** Saves the score locally (if it's a standard duration) — instant, no network. */
  function reportScore(finalStats) {
    if (isCustomDuration) {
      UI.showPersonalBestBadge(false);
      resultPersonalBestEl.textContent = "—";
      resultCompareEl.textContent = "custom durations aren't saved";
      return;
    }
    const result = LocalScores.submitScore(difficulty, duration, finalStats.wpm, finalStats.accuracy);
    UI.showPersonalBestBadge(result.isNewBest);
    resultCompareEl.textContent = "";
    resultPersonalBestEl.textContent = result.best !== null ? result.best : "—";
    if (result.saved) {
      pbValueEl.textContent = result.best;
    }
  }

  const timer = new CountdownTimer({ onTick, onComplete });

  /** Focus mode should only visually hide the GUI while a test is actively running. */
  function updateFocusVisual() {
    dashEl.classList.toggle("focus-active", focusModeEnabled && state === "running");
  }

  function pauseTest() {
    if (state !== "running") return;
    timer.pause();
    state = "paused";
    UI.setPauseVisible(true);
    updateFocusVisual();
    // Blurring (rather than just flipping state) means typing is blocked at
    // the DOM level too, not just logically — mouse-move-triggered pauses
    // don't otherwise remove focus, so without this the hidden input would
    // happily keep accepting keystrokes while the UI claims to be paused.
    if (document.activeElement === hiddenInput) {
      hiddenInput.blur();
    }
  }

  function resumeTest() {
    if (state !== "paused") return;
    state = "running";
    UI.setPauseVisible(false);
    updateFocusVisual();
    timer.start();
  }

  function resetTest() {
    timer.stop();
    state = "idle";
    stats = { correctChars: 0, incorrectChars: 0, correctWords: 0, incorrectWords: 0 };
    currentIndex = 0;

    WordManager.reset(difficulty);
    UI.clearRow();
    testWords = UI.appendWords(WordManager.nextBatch(INITIAL_BUFFER));
    UI.markCurrent(testWords[0]);
    UI.renderTyping(testWords[0], "");

    timer.setDuration(duration);
    UI.updateTimer(duration);
    UI.updateLiveWpm(0);
    UI.showStage();
    UI.setHintVisible(true);
    UI.setPauseVisible(false);
    updateFocusVisual();

    hiddenInput.value = "";
    hiddenInput.disabled = false;
    hiddenInput.focus();

    refreshPersonalBestReadout();
  }

  function refreshPersonalBestReadout() {
    if (isCustomDuration) {
      pbValueEl.textContent = "—";
      return;
    }
    const best = LocalScores.getBest(difficulty, duration);
    pbValueEl.textContent = best === null ? "—" : best;
  }

  function ensureStarted() {
    if (state === "idle") {
      state = "running";
      UI.setHintVisible(false);
      AudioManager.startMusic();
      updateFocusVisual();
      timer.start();
    }
  }

  function extendBufferIfNeeded() {
    if (currentIndex > testWords.length - EXTEND_THRESHOLD) {
      const created = UI.appendWords(WordManager.nextBatch(EXTEND_BATCH));
      testWords = testWords.concat(created);
    }
  }

  /**
   * Standard WPM methodology (matches MonkeyType and most typing tests):
   * a "correct character" for the numerator includes the space after each
   * *exactly* correctly-typed word — that's precisely why WPM is computed
   * as chars/5 (an average word is ~4 letters + a trailing space). Without
   * that space credit, WPM comes out systematically lower than MonkeyType
   * for identical typing, since every single word is missing one char's
   * worth of credit. Characters the user never got to (submitted a word
   * short, e.g. "appl" for "apple") count as errors, same as a mistyped
   * character — omission is still a mistake, not a neutral non-event.
   */
  function updateCharStats(target, typed) {
    const compareLen = Math.min(target.length, typed.length);
    let correct = 0;
    for (let i = 0; i < compareLen; i++) {
      if (typed[i] === target[i]) correct++;
    }
    const wrongOrExtra = typed.length - correct; // mismatched chars + any overtyped extras
    const missing = Math.max(0, target.length - typed.length); // characters never typed at all
    const isExact = typed === target;

    stats.correctChars += correct + (isExact ? 1 : 0); // +1 credits the space after a perfect word
    stats.incorrectChars += wrongOrExtra + missing;
  }

  function lockCurrentWord() {
    const typed = hiddenInput.value;
    if (typed.length === 0) return; // bare space with nothing typed does nothing
    ensureStarted();

    const word = testWords[currentIndex];
    const isCorrect = typed === word.target;
    updateCharStats(word.target, typed);
    if (isCorrect) stats.correctWords++;
    else stats.incorrectWords++;
    UI.lockWord(word, isCorrect ? "correct" : "incorrect");

    currentIndex++;
    extendBufferIfNeeded();
    hiddenInput.value = "";

    const nextWord = testWords[currentIndex];
    if (nextWord) {
      UI.markCurrent(nextWord);
      UI.scrollToWord(nextWord);
      UI.renderTyping(nextWord, "");
    }
    refreshLiveWpm();
  }

  function refreshLiveWpm() {
    const elapsed = duration - timer.remaining;
    if (elapsed < 1) {
      UI.updateLiveWpm(0);
      return;
    }
    UI.updateLiveWpm(Stats.computeWPM(stats.correctChars, elapsed / 60));
  }

  function handleInput() {
    if (state === "finished" || state === "paused") {
      hiddenInput.value = "";
      return;
    }
    // Words are all lowercase, so treat typing as case-insensitive: Caps Lock
    // or an accidental Shift shouldn't ever register as a "wrong" letter.
    if (hiddenInput.value !== hiddenInput.value.toLowerCase()) {
      const pos = hiddenInput.selectionStart;
      hiddenInput.value = hiddenInput.value.toLowerCase();
      hiddenInput.setSelectionRange(pos, pos);
    }
    AudioManager.playTyping();
    const typed = hiddenInput.value;
    if (typed.length > 0) ensureStarted();
    const word = testWords[currentIndex];
    if (!word) return;
    UI.renderTyping(word, typed);
  }

  function handleKeydown(e) {
    if (state === "finished" || state === "paused") return;
    if (e.code === "Space" || e.key === " ") {
      e.preventDefault();
      AudioManager.playTyping();
      lockCurrentWord();
    }
  }

  function bindInputEvents() {
    hiddenInput.addEventListener("input", handleInput);
    hiddenInput.addEventListener("keydown", handleKeydown);
    hiddenInput.addEventListener("blur", pauseTest);
    hiddenInput.addEventListener("focus", resumeTest);
    stageCanvas.addEventListener("click", () => hiddenInput.focus());

    // Before the test has even started, clicking away shouldn't lock you
    // out of typing — nothing is actually "paused" yet, so any keypress
    // should just silently refocus and start the test. Once a test is
    // genuinely paused (mid-run), this deliberately does NOT auto-resume
    // on typing — pausing should mean typing stops registering entirely
    // until you click back in; otherwise "paused" is meaningless since
    // the very next keystroke would silently resume and start counting.
    document.addEventListener("keydown", (e) => {
      if (state === "idle" && (document.activeElement === document.body || document.activeElement === null)) {
        hiddenInput.focus();
      }
    });

    // Focus mode: moving the mouse while actively typing counts as an
    // interruption and pauses the test (which also lifts the focus-mode
    // fade, per updateFocusVisual()/pauseTest() above). A small movement
    // threshold avoids false positives from cursor jitter or the click
    // that started the test in the first place.
    document.addEventListener("mousemove", (e) => {
      if (!focusModeEnabled || state !== "running") {
        lastMouse = null;
        return;
      }
      if (lastMouse === null) {
        lastMouse = { x: e.clientX, y: e.clientY };
        return;
      }
      const dx = e.clientX - lastMouse.x;
      const dy = e.clientY - lastMouse.y;
      if (Math.sqrt(dx * dx + dy * dy) > MOUSE_MOVE_THRESHOLD_PX) {
        pauseTest();
      }
    });
  }

  function bindSettingsEvents() {
    difficultyGroup.querySelectorAll(".pill[data-difficulty]").forEach((btn) => {
      btn.addEventListener("click", () => {
        difficulty = btn.dataset.difficulty;
        UI.setActivePill(difficultyGroup, "difficulty", difficulty);
        resetTest();
      });
    });

    durationGroup.querySelectorAll(".pill[data-duration]").forEach((btn) => {
      btn.addEventListener("click", () => {
        duration = parseInt(btn.dataset.duration, 10);
        isCustomDuration = false;
        customDurationInput.classList.add("hidden");
        customDurationBtn.classList.remove("active");
        UI.setActivePill(durationGroup, "duration", duration);
        resetTest();
      });
    });

    customDurationBtn.addEventListener("click", () => {
      customDurationInput.classList.toggle("hidden");
      if (!customDurationInput.classList.contains("hidden")) {
        customDurationInput.focus();
      }
    });

    function applyCustomDuration() {
      const raw = parseInt(customDurationInput.value, 10);
      if (!raw || raw < 5) return;
      duration = Math.min(600, Math.max(5, raw));
      isCustomDuration = true;
      durationGroup.querySelectorAll(".pill[data-duration]").forEach((b) => b.classList.remove("active"));
      customDurationBtn.classList.add("active");
      resetTest();
    }

    customDurationInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") applyCustomDuration();
    });
    customDurationInput.addEventListener("blur", applyCustomDuration);

    layoutGroup.querySelectorAll(".pill[data-layout]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const mode = btn.dataset.layout;
        UI.setActivePill(layoutGroup, "layout", mode);
        try {
          localStorage.setItem(LAYOUT_STORAGE_KEY, mode);
        } catch (e) {
          /* non-fatal */
        }
        switchLayout(mode);
      });
    });

    focusGroup.querySelectorAll(".pill[data-focus]").forEach((btn) => {
      btn.addEventListener("click", () => {
        focusModeEnabled = btn.dataset.focus === "on";
        UI.setActivePill(focusGroup, "focus", focusModeEnabled ? "on" : "off");
        try {
          localStorage.setItem(FOCUS_STORAGE_KEY, focusModeEnabled ? "on" : "off");
        } catch (e) {
          /* non-fatal */
        }
        updateFocusVisual();
      });
    });
  }

  /**
   * Switching layout mid-test used to hard-reset the whole test (losing
   * progress and restarting the timer) because the two renderers use
   * differently-sized boxes and the old code just rebuilt everything via
   * resetTest(). Now: if nothing's in progress, a full reset is simplest
   * and correct. If a test is actively running or paused, the exact same
   * words/progress/timer/stats are preserved — only which DOM renderer
   * draws them changes.
   */
  function switchLayout(mode) {
    if (state === "idle" || state === "finished") {
      UI.setLayoutMode(mode);
      resetTest();
      return;
    }

    const typedSoFar = hiddenInput.value;
    UI.setLayoutMode(mode); // also clears both renderers' DOM

    const rebuilt = UI.appendWords(testWords.map((w) => w.target));
    for (let i = 0; i < currentIndex; i++) {
      UI.lockWord(rebuilt[i], testWords[i].status);
    }
    testWords = rebuilt;

    const current = testWords[currentIndex];
    if (current) {
      UI.markCurrent(current);
      UI.renderTyping(current, typedSoFar);
      UI.scrollToWord(current);
    }
  }

  function bindRestartEvents() {
    restartBtn.addEventListener("click", resetTest);
    tryAgainBtn.addEventListener("click", resetTest);
  }

  function restoreLayoutPreference() {
    let mode = "scroll";
    try {
      const stored = localStorage.getItem(LAYOUT_STORAGE_KEY);
      if (stored === "rows" || stored === "scroll") mode = stored;
    } catch (e) {
      /* non-fatal */
    }
    UI.setActivePill(layoutGroup, "layout", mode);
    UI.setLayoutMode(mode);
  }

  function restoreFocusPreference() {
    try {
      focusModeEnabled = localStorage.getItem(FOCUS_STORAGE_KEY) === "on";
    } catch (e) {
      focusModeEnabled = false;
    }
    UI.setActivePill(focusGroup, "focus", focusModeEnabled ? "on" : "off");
  }

  function init() {
    restoreLayoutPreference();
    restoreFocusPreference();
    bindInputEvents();
    bindSettingsEvents();
    bindRestartEvents();
    resetTest();
  }

  init();
})();
