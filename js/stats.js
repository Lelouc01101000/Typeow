/**
 * Stats
 * -----
 * Pure functions for turning raw character counts into the numbers shown
 * on the results gauge.
 *
 * WPM uses the standard convention (the same one MonkeyType and virtually
 * every other typing test uses): 1 "word" = 5 characters, regardless of
 * real word length. This is why WPM = (chars / 5) / minutes rather than
 * counting whole dictionary words — normalizing by character count is
 * what makes scores comparable across tests with different average word
 * lengths (and across tools — a character-count mismatch here is exactly
 * why the same typing could read differently between two typing tests).
 */
const Stats = {
  /** Net WPM — correct characters only (5 chars = 1 word), per minute. */
  computeWPM(correctChars, minutes) {
    if (minutes <= 0) return 0;
    return Math.max(0, Math.round(correctChars / 5 / minutes));
  },

  /** Raw WPM — every character typed (correct or not), per minute. */
  computeRawWPM(totalTypedChars, minutes) {
    if (minutes <= 0) return 0;
    return Math.max(0, Math.round(totalTypedChars / 5 / minutes));
  },

  /** Accuracy as a percentage of characters typed correctly. */
  computeAccuracy(correctChars, totalTypedChars) {
    if (totalTypedChars <= 0) return 100;
    return Math.max(0, Math.min(100, Math.round((correctChars / totalTypedChars) * 100)));
  },
};
