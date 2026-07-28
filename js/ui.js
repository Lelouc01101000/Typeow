/**
 * UI
 * --
 * All direct DOM manipulation lives here: shared chrome (timer, live wpm,
 * hint, pause overlay, pills, results screen) plus the word-rendering area.
 *
 * The word-rendering area itself is pluggable: TrackRenderer (the original
 * single scrolling row) and RowsRenderer (the classic 3-line wrap, defined
 * in uiRows.js) both implement the same small interface — appendWords,
 * clearRow, markCurrent, lockWord, renderTyping, scrollToWord — and
 * setLayoutMode() swaps which one is active. app.js doesn't need to know
 * which layout is active; it just calls UI.appendWords() etc as usual.
 */
const UI = (() => {
  const wordViewport = document.getElementById("wordViewport");
  const wordViewportRows = document.getElementById("wordViewportRows");
  const wordRow = document.getElementById("wordRow");
  const stagePause = document.getElementById("stagePause");
  const timerValueEl = document.getElementById("timerValue");
  const liveWpmValueEl = document.getElementById("liveWpmValue");
  const topbarHint = document.getElementById("topbarHint");
  const testStage = document.getElementById("testStage");
  const resultsPanel = document.getElementById("resultsPanel");
  const resultWpmEl = document.getElementById("resultWpm");
  const resultAccuracyEl = document.getElementById("resultAccuracy");
  const resultRawWpmEl = document.getElementById("resultRawWpm");
  const resultWordsEl = document.getElementById("resultWords");
  const resultCharsEl = document.getElementById("resultChars");
  const gaugeSvg = document.getElementById("gaugeSvg");
  const resultCompareEl = document.getElementById("resultCompare");
  const resultPbBadge = document.getElementById("resultPbBadge");

  Gauge.build(gaugeSvg);

  function buildWordElement(target) {
    const el = document.createElement("span");
    el.className = "word pending";
    const charEls = [];
    for (let i = 0; i < target.length; i++) {
      const charEl = document.createElement("span");
      charEl.className = "char char-pending";
      charEl.textContent = target[i];
      el.appendChild(charEl);
      charEls.push(charEl);
    }
    return { el, target, charEls, extraEls: [], status: "pending" };
  }

  function paintTyping(word, typed) {
    const target = word.target;
    for (let i = 0; i < target.length; i++) {
      const span = word.charEls[i];
      if (i < typed.length) {
        span.className = typed[i] === target[i] ? "char char-correct" : "char char-incorrect";
      } else {
        span.className = "char char-pending";
      }
    }
    word.extraEls.forEach((n) => n.remove());
    word.extraEls = [];
    if (typed.length > target.length) {
      for (let i = target.length; i < typed.length; i++) {
        const extra = document.createElement("span");
        extra.className = "char char-extra";
        extra.textContent = typed[i];
        word.el.appendChild(extra);
        word.extraEls.push(extra);
      }
    }
  }

  function paintLock(word, status) {
    word.status = status;
    word.el.classList.remove("current", "pending");
    word.el.classList.add(status === "correct" ? "locked-correct" : "locked-incorrect");
    // Keep the per-character colors exactly as typed (this is what makes
    // "applt" for "apple" show as green-green-green-green-red instead of
    // the whole word flattening to one color) — only convert any letters
    // that were never reached at all into a distinct "missed" style.
    word.charEls.forEach((c) => {
      if (c.classList.contains("char-pending")) {
        c.classList.remove("char-pending");
        c.classList.add("char-missed");
      }
    });
  }

  // ---------------- Track renderer (single scrolling row) ----------------
  const TrackRenderer = (() => {
    function appendWords(targets) {
      const frag = document.createDocumentFragment();
      const created = targets.map((target) => {
        const word = buildWordElement(target);
        frag.appendChild(word.el);
        return word;
      });
      wordRow.appendChild(frag);
      return created;
    }

    function clearRow() {
      wordRow.innerHTML = "";
      wordRow.style.transform = "translateX(0)";
    }

    function markCurrent(word) {
      word.el.classList.remove("pending");
      word.el.classList.add("current");
    }

    function lockWord(word, status) {
      paintLock(word, status);
    }

    function renderTyping(word, typed) {
      paintTyping(word, typed);
    }

    function scrollToWord(word) {
      const offset = word.el.offsetLeft;
      wordRow.style.transform = "translateX(-" + offset + "px)";
    }

    return { appendWords, clearRow, markCurrent, lockWord, renderTyping, scrollToWord };
  })();

  let activeRenderer = TrackRenderer;

  function setLayoutMode(mode) {
    const useRows = mode === "rows";
    TrackRenderer.clearRow();
    if (window.RowsRenderer) window.RowsRenderer.clearRow();
    activeRenderer = useRows && window.RowsRenderer ? window.RowsRenderer : TrackRenderer;
    wordViewport.hidden = useRows;
    wordViewportRows.hidden = !useRows;
  }

  function appendWords(targets) {
    return activeRenderer.appendWords(targets);
  }
  function clearRow() {
    activeRenderer.clearRow();
  }
  function markCurrent(word) {
    activeRenderer.markCurrent(word);
  }
  function lockWord(word, status) {
    activeRenderer.lockWord(word, status);
  }
  function renderTyping(word, typed) {
    activeRenderer.renderTyping(word, typed);
  }
  function scrollToWord(word) {
    activeRenderer.scrollToWord(word);
  }

  function updateTimer(remainingSeconds) {
    timerValueEl.textContent = Math.ceil(remainingSeconds);
  }

  function updateLiveWpm(wpm) {
    liveWpmValueEl.textContent = wpm;
  }

  function setHintVisible(visible) {
    topbarHint.classList.toggle("hidden", !visible);
  }

  function setPauseVisible(visible) {
    stagePause.classList.toggle("visible", visible);
  }

  function setActivePill(groupEl, datasetKey, value) {
    groupEl.querySelectorAll(".pill[data-" + datasetKey + "]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset[datasetKey] === String(value));
    });
  }

  function showStage() {
    testStage.hidden = false;
    resultsPanel.hidden = true;
  }

  function showResults(finalStats) {
    testStage.hidden = true;
    resultsPanel.hidden = false;

    resultAccuracyEl.textContent = finalStats.accuracy + "%";
    resultRawWpmEl.textContent = finalStats.rawWpm;
    resultWordsEl.textContent = finalStats.correctWords + " / " + finalStats.incorrectWords;
    resultCharsEl.textContent = finalStats.correctChars + " / " + finalStats.incorrectChars;
    resultWpmEl.textContent = "0";

    if (resultCompareEl) {
      resultCompareEl.textContent = "";
      resultCompareEl.className = "result-compare";
    }
    if (resultPbBadge) {
      resultPbBadge.hidden = true;
    }

    Gauge.animateTo(finalStats.wpm, (n) => {
      resultWpmEl.textContent = n;
    });
  }

  /** Called right after saving locally — no async wait needed, it's instant. */
  function showPersonalBestBadge(isNewBest) {
    if (resultPbBadge) {
      resultPbBadge.hidden = !isNewBest;
    }
  }

  return {
    buildWordElement,
    paintTyping,
    paintLock,
    appendWords,
    clearRow,
    markCurrent,
    lockWord,
    renderTyping,
    scrollToWord,
    setLayoutMode,
    updateTimer,
    updateLiveWpm,
    setHintVisible,
    setPauseVisible,
    setActivePill,
    showStage,
    showResults,
    showPersonalBestBadge,
  };
})();
