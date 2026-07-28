/**
 * WordManager
 * -----------
 * Pulls words from the bundled word libraries (see data/words-*.js).
 * Uses a "shuffle bag": the full list for the chosen difficulty is
 * shuffled once, words are drawn off the top one at a time, and only
 * once the whole bag is empty does it reshuffle and refill. That
 * guarantees every word appears once before any word repeats, so each
 * pass through the list is random *and* unique.
 */
const WordManager = (() => {
  let bag = [];
  let bagIndex = 0;
  let difficulty = "medium";
  let lastWord = null;

  function sourceFor(diff) {
    if (diff === "easy") return WORDS_EASY;
    if (diff === "hard") return WORDS_HARD;
    return WORDS_MEDIUM;
  }

  function shuffle(list) {
    const arr = list.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  function refill() {
    bag = shuffle(sourceFor(difficulty));
    // avoid an immediate repeat right at the reshuffle boundary
    if (bag.length > 1 && bag[0] === lastWord) {
      const tmp = bag[0];
      bag[0] = bag[1];
      bag[1] = tmp;
    }
    bagIndex = 0;
  }

  function reset(newDifficulty) {
    difficulty = newDifficulty || difficulty;
    lastWord = null;
    refill();
  }

  function next() {
    if (bagIndex >= bag.length) refill();
    const word = bag[bagIndex++];
    lastWord = word;
    return word;
  }

  function nextBatch(count) {
    const out = new Array(count);
    for (let i = 0; i < count; i++) out[i] = next();
    return out;
  }

  return { reset, next, nextBatch };
})();
