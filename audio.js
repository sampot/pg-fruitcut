/**
 * Original kitchen-arcade SFX via Web Audio — no commercial samples.
 * Master gain ~0.24; unlock on first user gesture.
 */

export class FruitcutAudio {
  constructor() {
    /** @type {AudioContext | null} */
    this.ctx = null;
    this.enabled = true;
    this.master = 0.24;
  }

  async unlock() {
    this.ensure();
    if (this.ctx?.state === "suspended") await this.ctx.resume();
  }

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
  }

  setEnabled(on) {
    this.enabled = on;
  }

  /**
   * @param {number} freq
   * @param {number} dur
   * @param {OscillatorType} [type]
   * @param {number} [gain]
   * @param {number} [when]
   * @param {number} [slideTo]
   */
  tone(freq, dur, type = "sine", gain = 0.12, when = 0, slideTo = 0) {
    if (!this.enabled) return;
    this.ensure();
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo > 0) {
      osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    }
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain * this.master, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(0.03, dur));
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.04);
  }

  /** Band-limited noise burst for whooshes / thuds. */
  noise(dur, gain = 0.1, when = 0, filterFreq = 1200, type = "bandpass") {
    if (!this.enabled) return;
    this.ensure();
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = ctx.currentTime + when;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(filterFreq, t0);
    filter.Q.setValueAtTime(0.8, t0);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain * this.master, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(ctx.destination);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  /** Blade swipe whoosh. */
  slice() {
    this.noise(0.09, 0.14, 0, 2800, "bandpass");
    this.tone(680, 0.07, "sawtooth", 0.05, 0, 220);
    this.tone(920, 0.05, "triangle", 0.035, 0.01, 400);
  }

  /**
   * Fruit pop — pitch/timbre by type.
   * @param {"apple"|"orange"|"watermelon"|"banana"|"grape"|"peach"|"lemon"} kind
   */
  fruitPop(kind = "apple") {
    const table = {
      apple: { f: 520, f2: 780, n: 1800 },
      orange: { f: 440, f2: 660, n: 1400 },
      watermelon: { f: 280, f2: 420, n: 900 },
      banana: { f: 620, f2: 940, n: 2100 },
      grape: { f: 760, f2: 1140, n: 2600 },
      peach: { f: 500, f2: 740, n: 1600 },
      lemon: { f: 700, f2: 1050, n: 2400 },
    };
    const t = table[kind] || table.apple;
    this.noise(0.06, 0.11, 0, t.n, "bandpass");
    this.tone(t.f, 0.07, "triangle", 0.11);
    this.tone(t.f2, 0.09, "sine", 0.07, 0.03);
    this.tone(t.f * 1.8, 0.05, "square", 0.04, 0.05);
  }

  /** Bomb hit thud. */
  bomb() {
    this.noise(0.22, 0.18, 0, 180, "lowpass");
    this.tone(90, 0.2, "sawtooth", 0.14, 0, 45);
    this.tone(55, 0.28, "triangle", 0.1, 0.04);
    this.tone(140, 0.08, "square", 0.06, 0.02);
  }

  /**
   * Combo stinger — brighter with higher combo.
   * @param {number} combo
   */
  combo(combo = 2) {
    const n = Math.min(6, Math.max(2, combo));
    for (let i = 0; i < n; i++) {
      const f = 440 * Math.pow(1.18, i);
      this.tone(f, 0.07, i % 2 ? "triangle" : "square", 0.08, i * 0.045);
    }
    this.tone(880 * Math.pow(1.12, n - 2), 0.12, "sine", 0.09, n * 0.045);
  }

  /** Missed fruit / life warning. */
  miss() {
    this.tone(260, 0.1, "triangle", 0.07);
    this.tone(180, 0.14, "sine", 0.055, 0.07);
    this.noise(0.08, 0.05, 0.04, 600, "lowpass");
  }

  start() {
    this.tone(392, 0.08, "square", 0.1);
    this.tone(523, 0.1, "triangle", 0.09, 0.07);
    this.tone(659, 0.12, "sine", 0.08, 0.14);
  }

  gameOver() {
    this.tone(330, 0.12, "triangle", 0.09);
    this.tone(247, 0.16, "sawtooth", 0.07, 0.1);
    this.tone(165, 0.28, "triangle", 0.1, 0.22);
  }

  timeUp() {
    this.tone(523, 0.08, "square", 0.08);
    this.tone(392, 0.1, "triangle", 0.07, 0.08);
    this.tone(294, 0.18, "sine", 0.09, 0.16);
  }

  tick() {
    this.tone(880, 0.04, "square", 0.05);
  }
}
