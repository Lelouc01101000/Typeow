/**
 * Settings modal
 * --------------
 * Wires up the gear-icon modal: volume sliders, music/typing-sound
 * pickers (all backed by AudioManager), and the personal-best table
 * (backed by LocalScores) — everything here is local to this browser,
 * synchronous, and instant. No network, no account.
 */
const SettingsPanel = (() => {
  const overlay = document.getElementById("settingsOverlay");
  const openBtn = document.getElementById("settingsBtn");
  const closeBtn = document.getElementById("settingsCloseBtn");

  const musicVolumeSlider = document.getElementById("musicVolumeSlider");
  const musicVolumeValue = document.getElementById("musicVolumeValue");
  const typingVolumeSlider = document.getElementById("typingVolumeSlider");
  const typingVolumeValue = document.getElementById("typingVolumeValue");

  const musicTrackPicker = document.getElementById("musicTrackPicker");
  const typingSoundPicker = document.getElementById("typingSoundPicker");

  const pbTableBody = document.getElementById("pbTableBody");

  const DURATIONS = [15, 30, 60, 120];
  const DIFFICULTIES = ["easy", "medium", "hard"];

  function open() {
    overlay.hidden = false;
    syncAudioControls();
    refreshTable();
  }

  function close() {
    overlay.hidden = true;
  }

  function syncAudioControls() {
    const s = AudioManager.getSettings();
    musicVolumeSlider.value = s.musicVolume;
    musicVolumeValue.textContent = s.musicVolume + "%";
    typingVolumeSlider.value = s.typingVolume;
    typingVolumeValue.textContent = s.typingVolume + "%";

    musicTrackPicker.querySelectorAll(".track-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.music === s.musicTrack);
    });
    typingSoundPicker.querySelectorAll(".track-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.typing === s.typingSound);
    });
  }

  function formatScore(v) {
    if (v === null || v === undefined) return '<span class="pb-empty">—</span>';
    return '<span class="pb-best">' + Math.round(v) + "</span>";
  }

  /** Synchronous — reads straight from localStorage, no loading state needed. */
  function refreshTable() {
    const bests = LocalScores.getAllBests();
    const rows = [];
    DIFFICULTIES.forEach((diff) => {
      DURATIONS.forEach((dur) => {
        const entry = bests[diff + "_" + dur];
        rows.push(
          "<tr><td>" + diff + "</td><td>" + dur + "s</td><td>" + formatScore(entry ? entry.wpm : null) + "</td></tr>"
        );
      });
    });
    pbTableBody.innerHTML = rows.join("");
  }

  function bindEvents() {
    openBtn.addEventListener("click", open);
    closeBtn.addEventListener("click", close);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !overlay.hidden) close();
    });

    musicVolumeSlider.addEventListener("input", () => {
      const v = Number(musicVolumeSlider.value);
      musicVolumeValue.textContent = v + "%";
      AudioManager.setMusicVolume(v);
    });

    typingVolumeSlider.addEventListener("input", () => {
      const v = Number(typingVolumeSlider.value);
      typingVolumeValue.textContent = v + "%";
      AudioManager.setTypingVolume(v);
    });

    musicTrackPicker.addEventListener("click", (e) => {
      const btn = e.target.closest(".track-btn");
      if (!btn) return;
      AudioManager.setMusicTrack(btn.dataset.music);
      syncAudioControls();
    });

    typingSoundPicker.addEventListener("click", (e) => {
      const btn = e.target.closest(".track-btn");
      if (!btn) return;
      AudioManager.setTypingSound(btn.dataset.typing);
      syncAudioControls();
      AudioManager.playTyping();
    });
  }

  bindEvents();

  return { open, close };
})();
