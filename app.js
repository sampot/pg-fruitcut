import { FruitcutAudio } from "./audio.js";
import { FruitcutGame, FRUIT_DEFS, W, H, ROUND_SEC } from "./game.js";

const audio = new FruitcutAudio();
const game = new FruitcutGame();

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const timeEl = document.getElementById("time");
const livesEl = document.getElementById("lives");
const comboEl = document.getElementById("combo");
const statusEl = document.getElementById("status");
const btnStart = document.getElementById("btn-start");
const btnMute = document.getElementById("btn-mute");
const btnReset = document.getElementById("btn-reset");

canvas.width = W;
canvas.height = H;

/** @type {{ x: number, y: number, age: number }[]} */
let trail = [];
let swiping = false;
let lastPx = 0;
let lastPy = 0;
let lastTs = 0;
let lastTickSec = -1;
let running = true;
let scrollLock = false;

function cssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return v || fallback;
}

function setStatus(msg, tone = "") {
  statusEl.textContent = msg;
  statusEl.dataset.tone = tone;
}

function syncHud() {
  scoreEl.textContent = String(game.score);
  timeEl.textContent = String(Math.ceil(game.timeLeft));
  livesEl.textContent = String(game.lives);
  comboEl.textContent = String(game.combo);

  if (game.status === "ready") {
    btnStart.textContent = "開始";
    btnStart.disabled = false;
  } else if (game.status === "playing") {
    btnStart.textContent = "遊戲中";
    btnStart.disabled = true;
  } else {
    btnStart.textContent = "再來一局";
    btnStart.disabled = false;
  }
}

/**
 * @param {number} clientX
 * @param {number} clientY
 */
function toGame(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const sx = canvas.width / rect.width;
  const sy = canvas.height / rect.height;
  return {
    x: (clientX - rect.left) * sx,
    y: (clientY - rect.top) * sy,
  };
}

function unlockAudio() {
  void audio.unlock();
}

function handleEvents(events) {
  for (const e of events) {
    if (e.type === "cut") {
      audio.fruitPop(e.kind || "apple");
      if (e.combo && e.combo >= 2) {
        setStatus(`連切 ×${e.combo}！ +${e.pts}`, "combo");
      } else {
        setStatus(`切開！ +${e.pts}`, "");
      }
    } else if (e.type === "combo") {
      audio.combo(e.combo || 2);
    } else if (e.type === "bomb") {
      audio.bomb();
      setStatus(`炸彈！剩 ${game.lives} 命`, "warn");
    } else if (e.type === "miss") {
      audio.miss();
    } else if (e.type === "timeup") {
      audio.timeUp();
      setStatus(
        `時間到！分數 ${game.score} · 最高連切 ×${game.bestCombo}`,
        "win"
      );
    } else if (e.type === "over") {
      audio.gameOver();
      setStatus(`遊戲結束 · 分數 ${game.score}`, "lose");
    }
  }
}

function drawBoard() {
  const top = cssVar("--board-top", "#2a5242");
  const bot = cssVar("--board", "#1e3a2f");
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, top);
  g.addColorStop(1, bot);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Soft vignette / dojo floor hint
  ctx.fillStyle = "rgba(0,0,0,0.12)";
  ctx.beginPath();
  ctx.ellipse(W / 2, H + 20, W * 0.55, 90, 0, Math.PI, 0, true);
  ctx.fill();
}

/**
 * @param {CanvasRenderingContext2D} c
 * @param {string} kind
 * @param {number} rx
 * @param {number} ry
 * @param {boolean} [half]
 * @param {number} [side]
 * @param {number} [cutAngle]
 */
function drawFruitShape(c, kind, rx, ry, half = false, side = 1, cutAngle = 0) {
  const def = FRUIT_DEFS[/** @type {keyof typeof FRUIT_DEFS} */ (kind)];
  if (!def) return;

  c.save();
  if (half) {
    c.rotate(cutAngle);
    c.beginPath();
    c.rect(side > 0 ? 0 : -rx - 2, -ry - 2, rx + 4, ry * 2 + 4);
    c.clip();
    c.rotate(-cutAngle);
  }

  // Body
  c.beginPath();
  c.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  const grad = c.createRadialGradient(-rx * 0.3, -ry * 0.35, 2, 0, 0, rx);
  grad.addColorStop(0, lighten(def.fill, 0.22));
  grad.addColorStop(1, def.fill);
  c.fillStyle = grad;
  c.fill();

  // Banana crescent hint
  if (kind === "banana") {
    c.beginPath();
    c.ellipse(0, 2, rx * 0.85, ry * 0.7, 0, 0, Math.PI * 2);
    c.strokeStyle = "rgba(180,140,20,0.35)";
    c.lineWidth = 2;
    c.stroke();
  }

  // Watermelon stripes
  if (kind === "watermelon") {
    c.strokeStyle = "rgba(20,80,40,0.45)";
    c.lineWidth = 2.5;
    for (let i = -2; i <= 2; i++) {
      c.beginPath();
      c.ellipse(i * 7, 0, 3, ry * 0.95, 0, 0, Math.PI * 2);
      c.stroke();
    }
  }

  // Grape cluster dots
  if (kind === "grape") {
    c.fillStyle = "rgba(255,255,255,0.2)";
    c.beginPath();
    c.arc(-4, -3, 3, 0, Math.PI * 2);
    c.arc(5, 2, 2.5, 0, Math.PI * 2);
    c.fill();
  }

  // Stem + leaf (skip for halves cut through center on bomb-like)
  if (!half || side > 0) {
    c.strokeStyle = "#5c4030";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(0, -ry + 2);
    c.lineTo(0, -ry - 8);
    c.stroke();
    c.fillStyle = def.leaf;
    c.beginPath();
    c.ellipse(7, -ry - 6, 8, 4, -0.5, 0, Math.PI * 2);
    c.fill();
  }

  // Flesh edge for halves
  if (half) {
    c.rotate(cutAngle);
    c.fillStyle = def.juice;
    c.globalAlpha = 0.85;
    c.fillRect(side > 0 ? -1 : -2, -ry * 0.9, 3, ry * 1.8);
    c.globalAlpha = 1;
  }

  c.restore();
}

function drawBomb() {
  ctx.beginPath();
  ctx.arc(0, 0, 20, 0, Math.PI * 2);
  const g = ctx.createRadialGradient(-6, -6, 2, 0, 0, 20);
  g.addColorStop(0, "#444");
  g.addColorStop(1, "#111");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = "#ff4444";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-6, -6);
  ctx.lineTo(6, 6);
  ctx.moveTo(6, -6);
  ctx.lineTo(-6, 6);
  ctx.stroke();
  // Fuse
  ctx.strokeStyle = "#c4a574";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, -20);
  ctx.quadraticCurveTo(8, -28, 4, -36);
  ctx.stroke();
  ctx.fillStyle = "#fbbf24";
  ctx.beginPath();
  ctx.arc(4, -36, 4, 0, Math.PI * 2);
  ctx.fill();
}

/** @param {string} hex @param {number} amt */
function lighten(hex, amt) {
  const n = hex.replace("#", "");
  const r = Math.min(255, parseInt(n.slice(0, 2), 16) + Math.floor(amt * 255));
  const g = Math.min(255, parseInt(n.slice(2, 4), 16) + Math.floor(amt * 255));
  const b = Math.min(255, parseInt(n.slice(4, 6), 16) + Math.floor(amt * 255));
  return `rgb(${r},${g},${b})`;
}

function drawTrail() {
  if (trail.length < 2) return;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (let i = 1; i < trail.length; i++) {
    const a = trail[i - 1];
    const b = trail[i];
    const t = i / trail.length;
    ctx.strokeStyle = `rgba(255,255,255,${0.15 + t * 0.65})`;
    ctx.lineWidth = 2 + t * 8;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  // Hot tip
  const tip = trail[trail.length - 1];
  ctx.fillStyle = "rgba(255,240,180,0.9)";
  ctx.beginPath();
  ctx.arc(tip.x, tip.y, 5, 0, Math.PI * 2);
  ctx.fill();
}

function draw() {
  drawBoard();

  // Particles
  for (const p of game.particles) {
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 2));
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(0.5, p.r), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Halves
  for (const h of game.halves) {
    ctx.save();
    ctx.translate(h.x, h.y);
    ctx.rotate(h.rot);
    ctx.globalAlpha = Math.min(1, h.life * 1.2);
    drawFruitShape(ctx, h.kind, h.rx, h.ry, true, h.side, h.cutAngle);
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  // Live fruits / bombs
  for (const f of game.fruits) {
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.rot);
    if (f.isBomb) drawBomb();
    else drawFruitShape(ctx, f.kind, f.rx, f.ry);
    ctx.restore();
  }

  drawTrail();

  // Floating scores
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const ft of game.floats) {
    ctx.globalAlpha = Math.min(1, ft.life * 1.5);
    ctx.fillStyle = ft.color;
    ctx.font = "700 20px system-ui, sans-serif";
    ctx.fillText(ft.text, ft.x, ft.y);
  }
  ctx.globalAlpha = 1;

  // Overlay
  if (game.status === "ready") {
    banner("滑動切開水果 · 避開炸彈");
  } else if (game.status === "over") {
    const reason =
      game.timeLeft <= 0 ? "時間到" : "命用盡";
    banner(`${reason} · ${game.score} 分`);
  }

  // Combo badge
  if (game.status === "playing" && game.combo >= 2) {
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    roundRect(ctx, W / 2 - 48, 16, 96, 32, 10);
    ctx.fill();
    ctx.fillStyle = cssVar("--neon", "#fbbf24");
    ctx.font = "700 16px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`連切 ×${game.combo}`, W / 2, 32);
  }
}

function banner(msg) {
  ctx.fillStyle = "rgba(0,0,0,0.48)";
  roundRect(ctx, 36, H / 2 - 30, W - 72, 60, 12);
  ctx.fill();
  ctx.fillStyle = cssVar("--neon", "#fbbf24");
  ctx.font = "600 17px system-ui, 'PingFang TC', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(msg, W / 2, H / 2);
}

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

/**
 * @param {number} ts
 */
function frame(ts) {
  if (!running) return;
  const dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 0.016;
  lastTs = ts;

  const events = game.update(dt);
  handleEvents(events);

  // Countdown tick in last 5s
  if (game.status === "playing" && game.timeLeft <= 5) {
    const sec = Math.ceil(game.timeLeft);
    if (sec !== lastTickSec && sec > 0) {
      lastTickSec = sec;
      audio.tick();
    }
  }

  // Age trail
  for (const p of trail) p.age += dt;
  trail = trail.filter((p) => p.age < 0.18);

  draw();
  syncHud();
  requestAnimationFrame(frame);
}

function startGame() {
  unlockAudio();
  game.start();
  lastTickSec = -1;
  trail = [];
  audio.start();
  setStatus(`限時 ${ROUND_SEC} 秒 · 避開炸彈`, "");
  syncHud();
}

function resetGame() {
  unlockAudio();
  game.reset();
  trail = [];
  lastTickSec = -1;
  setStatus("點「開始」進入 60 秒對局", "");
  syncHud();
}

function onPointerDown(ev) {
  unlockAudio();
  if (ev.pointerType === "touch") {
    scrollLock = true;
    ev.preventDefault();
  }
  const { x, y } = toGame(ev.clientX, ev.clientY);
  swiping = true;
  lastPx = x;
  lastPy = y;
  trail.push({ x, y, age: 0 });
  try {
    canvas.setPointerCapture(ev.pointerId);
  } catch {
    /* ignore */
  }
}

function onPointerMove(ev) {
  if (!swiping) return;
  if (scrollLock) ev.preventDefault();
  const { x, y } = toGame(ev.clientX, ev.clientY);
  const dist = Math.hypot(x - lastPx, y - lastPy);
  if (dist < 2) return;

  if (dist > 14) audio.slice();

  const events = game.tryCut(lastPx, lastPy, x, y);
  handleEvents(events);

  trail.push({ x, y, age: 0 });
  if (trail.length > 28) trail.shift();
  lastPx = x;
  lastPy = y;
}

function onPointerUp(ev) {
  swiping = false;
  scrollLock = false;
  try {
    canvas.releasePointerCapture(ev.pointerId);
  } catch {
    /* ignore */
  }
}

canvas.addEventListener("pointerdown", onPointerDown, { passive: false });
canvas.addEventListener("pointermove", onPointerMove, { passive: false });
canvas.addEventListener("pointerup", onPointerUp);
canvas.addEventListener("pointercancel", onPointerUp);
canvas.addEventListener(
  "touchmove",
  (e) => {
    if (swiping) e.preventDefault();
  },
  { passive: false }
);

btnStart.addEventListener("click", () => {
  if (game.status === "playing") return;
  startGame();
});

btnReset.addEventListener("click", () => {
  resetGame();
});

btnMute.addEventListener("click", () => {
  unlockAudio();
  const on = !(btnMute.getAttribute("aria-pressed") === "true");
  btnMute.setAttribute("aria-pressed", String(on));
  btnMute.textContent = on ? "音效開" : "音效關";
  audio.setEnabled(on);
});

document.addEventListener(
  "pointerdown",
  () => {
    unlockAudio();
  },
  { once: true }
);

syncHud();
requestAnimationFrame(frame);
