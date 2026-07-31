# [Typeow](https://lelouc01101000.github.io/Typeow/) 

Typeow is a zero dependency, pure client side web application designed for real time typing speed and accuracy measurement. The application is built using standard ES6 JavaScript modules formatted as Immediately Invoked Function Expressions (IIFEs), CSS3 custom properties, and an event driven DOM interface.

Available at: https://lelouc01101000.github.io/Typeow/

---

## Architecture Overview

The system operates entirely within the browser context without reliance on external backend infrastructure or framework dependencies. State management, time calculation, mathematical metrics, vector rendering, and persistence are decoupled into specialized singleton modules.

```
                  ┌──────────────────────────────────────────┐
                  │                 app.js                   │
                  │        (Finite State Controller)         │
                  └────┬──────────────┬──────────────┬───────┘
                       │              │              │
         ┌─────────────▼───┐   ┌──────▼──────┐   ┌───▼─────────────┐
         │ CountdownTimer  │   │ WordManager │   │   AudioEngine   │
         │   (timer.js)    │   │             │   │   (audio.js)    │
         └─────────────────┘   └──────┬──────┘   └─────────────────┘
                                      │
                               ┌──────▼──────┐
                               │ Data Stores │
                               │ (words-*.js)│
                       ┌───────└─────────────┘───────┐
                       │              │              │
         ┌─────────────▼───┐   ┌──────▼──────┐   ┌───▼─────────────┐
         │ UI / Renderers  │   │    Gauge    │   │   LocalScores   │
         │ (ui.js, uiRows) │   │ (gauge.js)  │   │   (scores.js)   │
         └─────────────────┘   └─────────────┘   └─────────────────┘

```

---

## Directory & File Structure

```
typeow/
├── index.html                 # application DOM entry point and container definitions
├── css/
│   └── style.css              # custom property schema, layout rules, and keyframes
├── data/                      # lexicon definitions for word structures
│   ├── words-easy.js          
│   ├── words-medium.js        
terminology
│   └── words-hard.js          
sets
├── js/
│   ├── app.js                 # central orchestrator and state machine
│   ├── audio.js               # audio pipeline, sound pooling, and volume controls
│   ├── gauge.js               # dynamic SVG tachometer renderer and animation engine
│   ├── scores.js              # synchronous localStorage adapter for test metrics
│   ├── settings.js            # settings modal controller and DOM event bindings
│   ├── stats.js               # mathematical transformation functions for WPM/accuracy
│   ├── timer.js               # delta time countdown timer engine
│   ├── ui.js                  # main UI controller and horizontal track renderer
│   ├── uiRows.js              # multi line classic wrap layout renderer
│   └── wordManager.js         # bag shuffle word generation engine
├── images/
│   └── typeowLogo.png         # system branding asset
└── audio/                     # application sound effects and ambient tracks
    ├── typing1.mp3 ... typing3.mp3
    └── music1.mp3 ... music5.mp3

```

---

## Subsystem Specifications

### 1. State Machine Engine (`app.js`)

The core execution logic is governed by a finite state machine maintaining four distinct execution phases:

* **`idle`**: The initial stage. Input element focus listeners are registered, the DOM buffers initial words, and time values reset.
* **`running`**: Activated upon the first non-modifier keystroke in the hidden input field. Starts the delta timer, streams dynamic live WPM stats, and enables focus-mode layout adjustments.
* **`paused`**: Triggered when the input element loses focus or when mouse movement exceeds a designated spatial threshold (`MOUSE_MOVE_THRESHOLD_PX = 6`) while focus mode is enabled. Pauses timer incrementation and obscures content.
* **`finished`**: Triggered when the timer reaches zero. Input fields are disabled, final statistical calculations are compiled, results are saved via `LocalScores`, and the SVG gauge sweep is executed.

### 2. Word Generation Subsystem (`wordManager.js`)

Word selection uses a shuffle-bag algorithm to guarantee uniform distribution without word repetition during a single pass through the library.

When a difficulty tier (`easy`, `medium`, or `hard`) is selected, `WordManager` creates a copy of the corresponding word list, executes a Fisher-Yates shuffle, and yields words sequentially. To prevent boundary duplicates when refilling the bag, the engine checks the first element of the newly shuffled array against the last served word and swaps positions if a match occurs.

### 3. Metric Calculation & Formulae (`stats.js`)

Typing speeds are calculated using standard normalized character-length conventions where 1 word = 5 characters.

**Net WPM** = `max(0, floor(Correct Characters / (5 * Elapsed Minutes)))`

**Raw WPM** = `max(0, floor(Total Typed Characters / (5 * Elapsed Minutes)))`

**Accuracy (%)** = `min(100, max(0, floor((Correct Characters / Total Typed Characters) * 100)))`

A word typed perfectly awards an additional character credit representing the trailing space key. Unattempted characters in committed words are counted as incorrect missing characters.

### 4. High-Precision Timing Engine (`timer.js`)

`CountdownTimer` avoids standard `setInterval` drift (caused by browser tab throttling and event loop delay) by measuring real time deltas using high-resolution timestamps via `performance.now()`.

When initiated, the timer captures the absolute target timestamp. On each tick (configured to execute every 100ms), it computes remaining time by calculating `performance.now() - startTime`. Pausing captures remaining time and clears the interval, allowing precise resumption without time leakage.

### 5. UI & Viewport Rendering Engines (`ui.js`, `uiRows.js`)

The visual viewport supports two distinct rendering modes through a shared interface:

* **Track Mode (`TrackRenderer`)**: Renders words in a single horizontal row. As the user advances through words, the container applies a CSS 2D transform (`translateX(-Npx)`) offset relative to the active target element's `offsetLeft` property, achieving a hardware-accelerated horizontal scrolling effect.
* **Classic Mode (`RowsRenderer`)**: Renders words inside a multi-line flex container. Vertical translation (`translateY(-Npx)`) is calculated using the active word's `offsetTop` value to ensure the current line always locks to the top boundary of the viewport.

### 6. Audio Architecture & Object Pooling (`audio.js`)

The audio subsystem manages sound playback via HTML5 `Audio` instances without blocking the main event thread:

* **Polyphonic Typing Sound Pool**: To avoid sound truncation during high-frequency typing, a circular buffer of pre-allocated `Audio` objects (`TYPING_POOL_SIZE = 6`) handles keystroke sounds.
* **Keystroke Throttling**: A rate limiter enforces a minimum 40ms interval (`TYPING_SOUND_MIN_INTERVAL_MS`) between keystroke audio triggers to prevent decoding queue congestion.
* **Ambient Audio Loop**: Streams selected ambient tracks with loop parameters based on user preferences. Missing audio assets trigger soft error catches to allow execution without failing.

### 7. Vector Visualization Subsystem (`gauge.js`)

The results screen incorporates a tachometer-style SVG gauge calculated dynamically via polar-to-Cartesian coordinate transformations:

**x** = `C_x + r * cos((theta * pi) / 180)`

**y** = `C_y - r * sin((theta * pi) / 180)`

The arc paths represent speed ranges (0–50 WPM, 50–90 WPM, and 90–150+ WPM). When rendering results, an animation frame loop applies a cubic easing function **f(t)** = `1 - (1 - t)^3` to sweep the needle and arc highlight smoothly from zero to the target WPM value.

### 8. Persistence Layer (`scores.js`)

Test metrics are saved synchronously to the browser's `localStorage` under the key `typeow:bestScores`.

---

## Configuration & Customization

### Modifying Word Libraries

Word banks are exposed globally on the `window` object via `data/words-easy.js`, `data/words-medium.js`, and `data/words-hard.js`. To expand a word library, append string items to the target array export:

```javascript
// example modification in data/words-hard.js
const WORDS_HARD = Object.freeze([
  "information", 
  "business", 
  "services",
  // add additional string entries here
]);

```

### Adjusting Custom Timing Boundaries

Custom test durations are validated inside `app.js` and `index.html`. Permissible range defaults are min `5` seconds and max `600` seconds:

```html
<input
  type="number"
  id="customDurationInput"
  class="custom-duration-input hidden"
  min="5"
  max="600"
  placeholder="sec"
/>

```

---

## Deployment Requirements

Because Typeow is implemented as a static client side web application, deployment simply requires serving the root directory through any HTTP server (e.g., NGINX, Apache, GitHub Pages, or Caddy). No node runtime, build pipeline, or database services are required.
