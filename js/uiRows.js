/**
 * RowsRenderer ("Classic" layout)
 * -------------------------------
 * Words wrap naturally left-to-right into lines, three lines visible at
 * once. The line holding the word you're currently typing is always the
 * topmost visible line — advancing to a word on a new line scrolls the
 * whole block up by exactly one line, so the finished line disappears off
 * the top, the old 2nd line becomes the 1st, the old 3rd becomes the 2nd,
 * and (once enough words exist) a fresh line appears at the bottom.
 *
 * Implementation mirrors TrackRenderer's horizontal scroll, just vertical:
 * words flow via CSS flex-wrap (the browser decides line breaks based on
 * container width), and we translateY the whole block by exactly the
 * current word's offsetTop so its line always sits at y = 0.
 */
(function (global) {
  "use strict";

  const rowsInner = document.getElementById("rowsInner");

  function appendWords(targets) {
    const frag = document.createDocumentFragment();
    const created = targets.map((target) => {
      const word = UI.buildWordElement(target);
      frag.appendChild(word.el);
      return word;
    });
    rowsInner.appendChild(frag);
    return created;
  }

  function clearRow() {
    rowsInner.innerHTML = "";
    rowsInner.style.transform = "translateY(0)";
  }

  function markCurrent(word) {
    word.el.classList.remove("pending");
    word.el.classList.add("current");
  }

  function lockWord(word, status) {
    UI.paintLock(word, status);
  }

  function renderTyping(word, typed) {
    UI.paintTyping(word, typed);
  }

  function scrollToWord(word) {
    const offset = word.el.offsetTop;
    rowsInner.style.transform = "translateY(-" + offset + "px)";
  }

  global.RowsRenderer = { appendWords, clearRow, markCurrent, lockWord, renderTyping, scrollToWord };
})(window);
