/**
 * CountdownTimer
 * --------------
 * A pausable countdown driven by real elapsed time (not tick counting),
 * so it stays accurate even if the tab throttles setInterval.
 */
class CountdownTimer {
  constructor({ onTick, onComplete }) {
    this.onTick = onTick || (() => {});
    this.onComplete = onComplete || (() => {});
    this.duration = 60;
    this.remaining = 60;
    this._intervalId = null;
    this._runStartedAt = null;
    this._remainingAtStart = 60;
    this.running = false;
  }

  setDuration(seconds) {
    this.duration = seconds;
    this.remaining = seconds;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this._runStartedAt = performance.now();
    this._remainingAtStart = this.remaining;
    this._intervalId = setInterval(() => this._tick(), 100);
  }

  _tick() {
    const elapsedSec = (performance.now() - this._runStartedAt) / 1000;
    this.remaining = Math.max(0, this._remainingAtStart - elapsedSec);
    this.onTick(this.remaining);
    if (this.remaining <= 0) {
      this.stop();
      this.onComplete();
    }
  }

  pause() {
    if (!this.running) return;
    clearInterval(this._intervalId);
    this.running = false;
  }

  stop() {
    clearInterval(this._intervalId);
    this.running = false;
  }
}
