/**
 * 切水果 — arc spawns, swipe cuts, bombs, combo. Original ruleset.
 */

export const W = 480;
export const H = 640;
export const ROUND_SEC = 60;
export const MAX_LIVES = 3;
export const COMBO_WINDOW_MS = 520;

/** @typedef {"apple"|"orange"|"watermelon"|"banana"|"grape"|"peach"|"lemon"} FruitKind */

/** @type {Record<FruitKind, { fill: string, leaf: string, rx: number, ry: number, pts: number, juice: string }>} */
export const FRUIT_DEFS = {
  apple: {
    fill: "#e23d3d",
    leaf: "#3d8c40",
    rx: 22,
    ry: 20,
    pts: 10,
    juice: "#ff6b6b",
  },
  orange: {
    fill: "#f08c2e",
    leaf: "#4a9c3a",
    rx: 20,
    ry: 20,
    pts: 10,
    juice: "#ffb347",
  },
  watermelon: {
    fill: "#2f8f4e",
    leaf: "#1f6b38",
    rx: 30,
    ry: 24,
    pts: 20,
    juice: "#ff4d6d",
  },
  banana: {
    fill: "#f5d031",
    leaf: "#6b9e3a",
    rx: 28,
    ry: 14,
    pts: 15,
    juice: "#ffe566",
  },
  grape: {
    fill: "#7b4bb7",
    leaf: "#3d8c40",
    rx: 14,
    ry: 14,
    pts: 25,
    juice: "#c084fc",
  },
  peach: {
    fill: "#ff9a8b",
    leaf: "#4a9c3a",
    rx: 19,
    ry: 18,
    pts: 12,
    juice: "#ffb4a8",
  },
  lemon: {
    fill: "#f0e05a",
    leaf: "#5a9e3a",
    rx: 18,
    ry: 22,
    pts: 15,
    juice: "#fff3a0",
  },
};

const FRUIT_KINDS = /** @type {FruitKind[]} */ (Object.keys(FRUIT_DEFS));

/**
 * Segment–circle intersection (fruit approximated as circle of max(rx,ry)).
 * @param {number} x1
 * @param {number} y1
 * @param {number} x2
 * @param {number} y2
 * @param {number} cx
 * @param {number} cy
 * @param {number} r
 */
export function segmentHitsCircle(x1, y1, x2, y2, cx, cy, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const fx = x1 - cx;
  const fy = y1 - cy;
  const a = dx * dx + dy * dy;
  if (a < 1e-8) {
    return fx * fx + fy * fy <= r * r;
  }
  let t = -(fx * dx + fy * dy) / a;
  t = Math.max(0, Math.min(1, t));
  const px = x1 + t * dx - cx;
  const py = y1 + t * dy - cy;
  return px * px + py * py <= r * r;
}

export class FruitcutGame {
  constructor() {
    this.reset();
  }

  reset() {
    /** @type {"ready"|"playing"|"over"} */
    this.status = "ready";
    this.score = 0;
    this.lives = MAX_LIVES;
    this.timeLeft = ROUND_SEC;
    this.combo = 0;
    this.bestCombo = 0;
    this.comboTimer = 0;
    this.spawnAcc = 0;
    this.wave = 0;
    /** @type {import('./game.js').FruitBody[]} */
    this.fruits = [];
    /** @type {HalfFruit[]} */
    this.halves = [];
    /** @type {Particle[]} */
    this.particles = [];
    /** @type {FloatText[]} */
    this.floats = [];
    this.sliced = 0;
    this.bombsHit = 0;
  }

  start() {
    this.reset();
    this.status = "playing";
    this.spawnWave(true);
  }

  /**
   * @param {number} dt
   * @returns {GameEvent[]}
   */
  update(dt) {
    /** @type {GameEvent[]} */
    const events = [];
    if (this.status !== "playing") {
      this.stepVisuals(dt);
      return events;
    }

    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.status = "over";
      events.push({ type: "timeup" });
      return events;
    }

    if (this.combo > 0) {
      this.comboTimer -= dt * 1000;
      if (this.comboTimer <= 0) {
        this.combo = 0;
        this.comboTimer = 0;
      }
    }

    this.spawnAcc += dt;
    const interval = Math.max(0.55, 1.35 - this.wave * 0.04);
    if (this.spawnAcc >= interval) {
      this.spawnAcc = 0;
      this.spawnWave(false);
    }

    const g = 980;
    for (const f of this.fruits) {
      if (!f.alive) continue;
      f.vy += g * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.rot += f.spin * dt;
      if (f.y > H + 80 && f.vy > 0) {
        f.alive = false;
        if (!f.isBomb) {
          events.push({ type: "miss", kind: f.kind });
        }
      }
    }
    this.fruits = this.fruits.filter((f) => f.alive);

    this.stepVisuals(dt);
    return events;
  }

  stepVisuals(dt) {
    for (const h of this.halves) {
      h.vy += 900 * dt;
      h.x += h.vx * dt;
      h.y += h.vy * dt;
      h.rot += h.spin * dt;
      h.life -= dt;
    }
    this.halves = this.halves.filter((h) => h.life > 0 && h.y < H + 60);

    for (const p of this.particles) {
      p.vy += 600 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      p.r *= 0.985;
    }
    this.particles = this.particles.filter((p) => p.life > 0);

    for (const ft of this.floats) {
      ft.y -= 48 * dt;
      ft.life -= dt;
    }
    this.floats = this.floats.filter((ft) => ft.life > 0);
  }

  /** @param {boolean} opening */
  spawnWave(opening) {
    this.wave += 1;
    const count = opening
      ? 3
      : 2 + Math.floor(Math.random() * 3) + (this.wave > 8 ? 1 : 0);
    const bombChance = Math.min(0.22, 0.06 + this.wave * 0.012);

    for (let i = 0; i < count; i++) {
      const isBomb = !opening && Math.random() < bombChance;
      const delay = i * 0.08;
      this.spawnOne(isBomb, delay);
    }
  }

  /**
   * @param {boolean} isBomb
   * @param {number} delay
   */
  spawnOne(isBomb, delay = 0) {
    const fromLeft = Math.random() < 0.5;
    const x = fromLeft
      ? 40 + Math.random() * 100
      : W - 40 - Math.random() * 100;
    const y = H + 20 + delay * 40;
    const targetX = W * (0.25 + Math.random() * 0.5);
    const peak = 120 + Math.random() * 160;
    const flight = 0.95 + Math.random() * 0.35;
    const g = 980;
    // Solve for initial velocity to arc toward targetX / peak-ish
    const vy = -Math.sqrt(2 * g * (y - peak));
    const tUp = -vy / g;
    const tTotal = tUp + Math.sqrt((2 * (H + 40 - peak)) / g);
    const t = Math.min(flight, tTotal * 0.85);
    const vx = (targetX - x) / Math.max(0.4, t) + (fromLeft ? 40 : -40);

    /** @type {FruitKind} */
    const kind = FRUIT_KINDS[Math.floor(Math.random() * FRUIT_KINDS.length)];
    const def = FRUIT_DEFS[kind];

    this.fruits.push({
      id: Math.random().toString(36).slice(2, 9),
      kind,
      isBomb,
      x,
      y,
      vx,
      vy: vy * (0.92 + Math.random() * 0.12),
      rot: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 6,
      rx: isBomb ? 20 : def.rx,
      ry: isBomb ? 20 : def.ry,
      alive: true,
    });
  }

  /**
   * Try cutting along a swipe segment.
   * @param {number} x1
   * @param {number} y1
   * @param {number} x2
   * @param {number} y2
   * @returns {GameEvent[]}
   */
  tryCut(x1, y1, x2, y2) {
    /** @type {GameEvent[]} */
    const events = [];
    if (this.status !== "playing") return events;

    let hitAny = false;
    for (const f of this.fruits) {
      if (!f.alive) continue;
      const r = Math.max(f.rx, f.ry) + 6;
      if (!segmentHitsCircle(x1, y1, x2, y2, f.x, f.y, r)) continue;

      f.alive = false;
      hitAny = true;

      if (f.isBomb) {
        this.bombsHit += 1;
        this.lives -= 1;
        this.combo = 0;
        this.comboTimer = 0;
        this.burstBomb(f.x, f.y);
        events.push({ type: "bomb", x: f.x, y: f.y });
        if (this.lives <= 0) {
          this.lives = 0;
          this.status = "over";
          events.push({ type: "over" });
        }
        continue;
      }

      const def = FRUIT_DEFS[f.kind];
      this.combo += 1;
      this.comboTimer = COMBO_WINDOW_MS;
      if (this.combo > this.bestCombo) this.bestCombo = this.combo;

      const mult = this.combo >= 2 ? this.combo : 1;
      const pts = def.pts * mult;
      this.score += pts;
      this.sliced += 1;

      this.splitFruit(f, x1, y1, x2, y2);
      this.burstJuice(f.x, f.y, def.juice, 14 + Math.floor(Math.random() * 8));
      this.floats.push({
        x: f.x,
        y: f.y - 10,
        text: `+${pts}`,
        life: 0.85,
        color: this.combo >= 3 ? "#f59e0b" : "#fff",
      });

      events.push({
        type: "cut",
        kind: f.kind,
        combo: this.combo,
        pts,
        x: f.x,
        y: f.y,
      });

      if (this.combo >= 2) {
        events.push({ type: "combo", combo: this.combo });
      }
    }

    if (hitAny) {
      this.fruits = this.fruits.filter((f) => f.alive);
    }
    return events;
  }

  /**
   * @param {FruitBody} f
   * @param {number} x1
   * @param {number} y1
   * @param {number} x2
   * @param {number} y2
   */
  splitFruit(f, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const speed = 180 + Math.random() * 120;

    for (const side of [-1, 1]) {
      this.halves.push({
        kind: f.kind,
        x: f.x + nx * side * 4,
        y: f.y + ny * side * 4,
        vx: f.vx * 0.4 + nx * side * speed,
        vy: f.vy * 0.3 - 80 + Math.random() * 40,
        rot: f.rot,
        spin: side * (4 + Math.random() * 5),
        rx: f.rx,
        ry: f.ry,
        side,
        cutAngle: Math.atan2(dy, dx),
        life: 1.4,
      });
    }
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {string} color
   * @param {number} n
   */
  burstJuice(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 80 + Math.random() * 220;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 60,
        r: 2.5 + Math.random() * 4,
        life: 0.35 + Math.random() * 0.45,
        color,
      });
    }
  }

  /** @param {number} x @param {number} y */
  burstBomb(x, y) {
    for (let i = 0; i < 22; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 100 + Math.random() * 280;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 40,
        r: 3 + Math.random() * 5,
        life: 0.4 + Math.random() * 0.5,
        color: i % 2 ? "#1a1a1a" : "#ff4444",
      });
    }
  }
}

/**
 * @typedef {{
 *   id: string,
 *   kind: FruitKind,
 *   isBomb: boolean,
 *   x: number, y: number,
 *   vx: number, vy: number,
 *   rot: number, spin: number,
 *   rx: number, ry: number,
 *   alive: boolean
 * }} FruitBody
 *
 * @typedef {{
 *   kind: FruitKind,
 *   x: number, y: number,
 *   vx: number, vy: number,
 *   rot: number, spin: number,
 *   rx: number, ry: number,
 *   side: number,
 *   cutAngle: number,
 *   life: number
 * }} HalfFruit
 *
 * @typedef {{
 *   x: number, y: number,
 *   vx: number, vy: number,
 *   r: number, life: number,
 *   color: string
 * }} Particle
 *
 * @typedef {{
 *   x: number, y: number,
 *   text: string, life: number,
 *   color: string
 * }} FloatText
 *
 * @typedef {{
 *   type: "cut"|"bomb"|"combo"|"miss"|"timeup"|"over",
 *   kind?: FruitKind,
 *   combo?: number,
 *   pts?: number,
 *   x?: number,
 *   y?: number
 * }} GameEvent
 */
