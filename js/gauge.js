/**
 * Gauge
 * -----
 * Draws and animates the tachometer-style WPM gauge shown on the
 * results screen. Built with plain SVG math (polar -> cartesian),
 * no external charting library.
 */
const Gauge = (() => {
  const CX = 120;
  const CY = 118;
  const RADIUS = 96;
  const TICK_R1 = 96;
  const TICK_R2 = 107;
  const LABEL_R = 123;
  const MAX_SCALE = 150;
  const TICKS = [0, 25, 50, 75, 100, 125, 150];

  const COLOR_GREEN = "#35c97a";
  const COLOR_AMBER = "#ffb627";
  const COLOR_RED = "#ff5c5c";
  const COLOR_BORDER = "#3d3456";
  const COLOR_TEXT = "#ece7f7";
  const COLOR_PURPLE = "#a78bfa";

  const ZONES = [
    { from: 0, to: 50, color: COLOR_GREEN },
    { from: 50, to: 90, color: COLOR_AMBER },
    { from: 90, to: 150, color: COLOR_RED },
  ];

  const SVG_NS = "http://www.w3.org/2000/svg";

  let needleEl = null;
  let progressEl = null;
  let animFrame = null;

  function angleFor(value) {
    const clamped = Math.max(0, Math.min(MAX_SCALE, value));
    return 180 - (clamped / MAX_SCALE) * 180;
  }

  function polar(r, angleDeg) {
    const rad = (angleDeg * Math.PI) / 180;
    return { x: CX + r * Math.cos(rad), y: CY - r * Math.sin(rad) };
  }

  function arcPath(r, fromValue, toValue) {
    const a1 = angleFor(fromValue);
    const a2 = angleFor(toValue);
    const p1 = polar(r, a1);
    const p2 = polar(r, a2);
    const sweep = a1 - a2;
    const largeArc = Math.abs(sweep) > 180 ? 1 : 0;
    return (
      "M " + p1.x.toFixed(2) + " " + p1.y.toFixed(2) +
      " A " + r + " " + r + " 0 " + largeArc + " 1 " +
      p2.x.toFixed(2) + " " + p2.y.toFixed(2)
    );
  }

  function el(tag, attrs) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const key in attrs) node.setAttribute(key, attrs[key]);
    return node;
  }

  function colorForValue(value) {
    if (value < 50) return COLOR_GREEN;
    if (value < 90) return COLOR_AMBER;
    return COLOR_RED;
  }

  /** Builds the static gauge face (zones, ticks, labels) into the given <svg>. */
  function build(svg) {
    svg.innerHTML = "";

    ZONES.forEach((z) => {
      svg.appendChild(
        el("path", {
          d: arcPath(RADIUS, z.from, z.to),
          fill: "none",
          stroke: z.color,
          "stroke-width": "14",
          "stroke-linecap": "butt",
          opacity: "0.16",
        })
      );
    });

    TICKS.forEach((v) => {
      const angle = angleFor(v);
      const p1 = polar(TICK_R1, angle);
      const p2 = polar(TICK_R2, angle);
      svg.appendChild(
        el("line", {
          x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y,
          stroke: COLOR_BORDER,
          "stroke-width": "2",
        })
      );
      const lp = polar(LABEL_R, angle);
      const text = el("text", {
        x: lp.x, y: lp.y,
        "text-anchor": "middle",
        "dominant-baseline": "middle",
        class: "gauge-tick-label",
      });
      text.textContent = v === 150 ? "150+" : String(v);
      svg.appendChild(text);
    });

    progressEl = el("path", {
      d: arcPath(RADIUS, 0, 0),
      fill: "none",
      stroke: COLOR_AMBER,
      "stroke-width": "14",
      "stroke-linecap": "round",
    });
    svg.appendChild(progressEl);

    needleEl = el("line", {
      x1: CX, y1: CY,
      x2: polar(RADIUS - 8, 180).x,
      y2: polar(RADIUS - 8, 180).y,
      stroke: COLOR_TEXT,
      "stroke-width": "3",
      "stroke-linecap": "round",
    });
    svg.appendChild(needleEl);

    svg.appendChild(el("circle", { cx: CX, cy: CY, r: 6, fill: COLOR_PURPLE }));
  }

  function setNeedle(value) {
    const clamped = Math.max(0, Math.min(MAX_SCALE, value));
    progressEl.setAttribute("d", arcPath(RADIUS, 0, clamped));
    progressEl.setAttribute("stroke", colorForValue(clamped));
    const tip = polar(RADIUS - 8, angleFor(clamped));
    needleEl.setAttribute("x2", tip.x);
    needleEl.setAttribute("y2", tip.y);
  }

  /** Animates the needle sweep from 0 to finalValue, reporting the counting-up number via onUpdate. */
  function animateTo(finalValue, onUpdate, duration) {
    if (animFrame) cancelAnimationFrame(animFrame);
    duration = duration || 1100;
    const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setNeedle(finalValue);
      if (onUpdate) onUpdate(Math.round(finalValue));
      return;
    }
    const start = performance.now();
    function frame(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = finalValue * eased;
      setNeedle(current);
      if (onUpdate) onUpdate(Math.round(current));
      if (t < 1) {
        animFrame = requestAnimationFrame(frame);
      } else {
        setNeedle(finalValue);
        if (onUpdate) onUpdate(Math.round(finalValue));
      }
    }
    animFrame = requestAnimationFrame(frame);
  }

  return { build, animateTo };
})();
