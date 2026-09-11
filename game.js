const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const moneyEl = document.getElementById("money");
const livesEl = document.getElementById("lives");
const waveEl = document.getElementById("wave");
const killsEl = document.getElementById("kills");

const hintEl = document.getElementById("hint");
const towerList = document.getElementById("towerList");
const selectionInfo = document.getElementById("selectionInfo");

const upgradeBtn = document.getElementById("upgradeBtn");
const rangeBtn = document.getElementById("rangeBtn");
const speedBtnUpgrade = document.getElementById("speedBtnUpgrade");
const sellBtn = document.getElementById("sellBtn");

const waveNameEl = document.getElementById("waveName");
const enemyCountEl = document.getElementById("enemyCount");

const pauseBtn = document.getElementById("pauseBtn");
const speedBtn = document.getElementById("speedBtn");
const fullscreenBtn = document.getElementById("fullscreenBtn");
const settingsBtn = document.getElementById("settingsBtn");
const settingsPanel = document.getElementById("settingsPanel");
const settingsWidget = document.getElementById("settingsWidget");
const volumeSlider = document.getElementById("volumeSlider");
const volumeValue = document.getElementById("volumeValue");
const pauseOverlay = document.getElementById("pauseOverlay");
const resumeBtn = document.getElementById("resumeBtn");

const endModal = document.getElementById("endModal");
const endTitle = document.getElementById("endTitle");
const endText = document.getElementById("endText");
const restartBtn = document.getElementById("restartBtn");
const endMenuBtn = document.getElementById("endMenuBtn");
const mainMenu = document.getElementById("mainMenu");
const gameScreen = document.getElementById("gameScreen");
const startGameBtn = document.getElementById("startGameBtn");
const menuBtn = document.getElementById("menuBtn");
const nextWaveBtn = document.getElementById("nextWaveBtn");
const newGameBtn = document.getElementById("newGameBtn");
const mapList = document.getElementById("mapList");
const selectedMapNameEl = document.getElementById("selectedMapName");
const difficultyList = document.getElementById("difficultyList");
const selectedDifficultyNameEl = document.getElementById("selectedDifficultyName");

/* =========================================================
   САУНД-ДИЗАЙН
========================================================= */

let audioContext = null;
let audioMaster = null;
const VOLUME_KEY = "neonBridgeDefenseVolume_v1";
let audioVolume = 0.55;

try {
  const storedVolume = Number(localStorage.getItem(VOLUME_KEY));
  if (Number.isFinite(storedVolume)) {
    audioVolume = Math.max(0, Math.min(1, storedVolume));
  }
} catch (error) {
  // Используем значение по умолчанию.
}

function applyAudioVolume() {
  if (audioMaster) {
    audioMaster.gain.value = 0.055 * audioVolume;
  }
  if (volumeSlider) {
    volumeSlider.value = String(Math.round(audioVolume * 100));
  }
  if (volumeValue) {
    volumeValue.textContent = `${Math.round(audioVolume * 100)}%`;
  }
}

function ensureAudio() {
  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      audioMaster = audioContext.createGain();
      audioMaster.gain.value = 0.055 * audioVolume;
      audioMaster.connect(audioContext.destination);
      applyAudioVolume();
    }

    if (audioContext.state === "suspended") {
      audioContext.resume();
    }
  } catch (error) {
    // Игра продолжает работать и без Web Audio API.
  }
}

function playShotSound(type) {
  if (!audioContext || !audioMaster) {
    return;
  }

  const frequencies = {
    pulse: 520,
    rail: 150,
    frost: 720,
    blast: 105,
    arc: 880,
    singularity: 55
  };

  const frequency = frequencies[type] || 420;
  const now = audioContext.currentTime;

  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const filter = audioContext.createBiquadFilter();

  oscillator.type = type === "rail" || type === "blast" ? "sawtooth" : "triangle";
  oscillator.frequency.setValueAtTime(frequency, now);
  oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(55, frequency * 0.55),
      now + 0.075
  );

  filter.type = "lowpass";
  filter.frequency.setValueAtTime(2200, now);
  filter.frequency.exponentialRampToValueAtTime(700, now + 0.075);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.42, now + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.085);

  oscillator.connect(filter);
  filter.connect(gain);
  gain.connect(audioMaster);

  oscillator.start(now);
  oscillator.stop(now + 0.09);
}

function playDefeatSound() {
  if (!audioContext || !audioMaster) {
    return;
  }

  const now = audioContext.currentTime;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const filter = audioContext.createBiquadFilter();

  oscillator.type = "sawtooth";
  oscillator.frequency.setValueAtTime(220, now);
  oscillator.frequency.exponentialRampToValueAtTime(72, now + 0.65);

  filter.type = "lowpass";
  filter.frequency.setValueAtTime(1200, now);
  filter.frequency.exponentialRampToValueAtTime(260, now + 0.65);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.55, now + 0.025);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);

  oscillator.connect(filter);
  filter.connect(gain);
  gain.connect(audioMaster);

  oscillator.start(now);
  oscillator.stop(now + 0.72);
}


function playLeakSound() {
  if (!audioContext || !audioMaster) {
    return;
  }

  const now = audioContext.currentTime;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const filter = audioContext.createBiquadFilter();

  oscillator.type = "square";
  oscillator.frequency.setValueAtTime(180, now);
  oscillator.frequency.exponentialRampToValueAtTime(82, now + 0.22);

  filter.type = "lowpass";
  filter.frequency.setValueAtTime(900, now);
  filter.frequency.exponentialRampToValueAtTime(320, now + 0.22);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.34, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);

  oscillator.connect(filter);
  filter.connect(gain);
  gain.connect(audioMaster);

  oscillator.start(now);
  oscillator.stop(now + 0.26);
}


/* =========================================================
   НАСТРОЙКИ ИГРЫ
========================================================= */

const GAME_WIDTH = 1000;
const GAME_HEIGHT = 640;

canvas.width = GAME_WIDTH;
canvas.height = GAME_HEIGHT;

const MAX_UPGRADE_LEVEL = 8;
const SPEED_OVERDRIVE_CHANCE = 0.25;
const SPEED_OVERDRIVE_INTERVAL = 5;
const SPEED_OVERDRIVE_DURATION = 10;
const SPEED_OVERDRIVE_SHAKE_DURATION = SPEED_OVERDRIVE_DURATION;

const towerTypes = {
  pulse: {
    name: "Импульс",
    cost: 55,
    damage: 18,
    range: 125,
    fireRate: 0.45,
    color: "#63e6ff",
    projectileSpeed: 500
  },

  rail: {
    name: "Рельсотрон",
    cost: 85,
    damage: 65,
    range: 220,
    fireRate: 1.5,
    color: "#b88cff",
    projectileSpeed: 800
  },

  frost: {
    name: "Криоузел",
    cost: 75,
    damage: 8,
    range: 145,
    fireRate: 0.75,
    color: "#7fffd4",
    projectileSpeed: 450,
    slow: 0.45,
    slowTime: 1.5
  },

  blast: {
    name: "Разлом",
    cost: 110,
    damage: 42,
    range: 135,
    fireRate: 1.3,
    color: "#ff8b6b",
    projectileSpeed: 380,
    splash: 55
  },

  arc: {
    name: "Дуга",
    cost: 140,
    damage: 32,
    range: 165,
    fireRate: 0.9,
    color: "#ffe66d",
    projectileSpeed: 650,
    chain: 2
  },

  titan: {
    name: "Титан",
    cost: 10000,
    unlockWave: 20,
    damage: 520,
    range: 230,
    fireRate: 1.05,
    color: "#ff9f43",
    projectileSpeed: 760,
    splash: 42,
    description: "мощный удар с уроном по области"
  },

  nova: {
    name: "Нова",
    cost: 20000,
    unlockWave: 40,
    damage: 980,
    range: 250,
    fireRate: 1.25,
    color: "#5ee7ff",
    projectileSpeed: 820,
    splash: 70,
    description: "сильный взрыв с большим радиусом"
  },

  devastator: {
    name: "Опустошитель",
    cost: 50000,
    unlockWave: 70,
    damage: 3200,
    range: 275,
    fireRate: 1.65,
    color: "#ff5577",
    projectileSpeed: 900,
    splash: 95,
    description: "тяжёлый урон по большой области"
  },

  singularity: {
    name: "Нуль-коллайдер",
    cost: 100000,
    unlockWave: 100,
    damage: 25000,
    range: 300,
    fireRate: 4.5,
    color: "#ff4dff",
    projectileSpeed: 520,
    splash: 105,
    description: "ультимативная башня с колоссальным уроном"
  }
};


/* =========================================================
   СОСТОЯНИЕ
========================================================= */

const state = {
  money: 170,
  lives: 12,

  wave: 0,
  maxWaves: Infinity,

  kills: 0,

  towers: [],
  enemies: [],
  projectiles: [],
  effects: [],

  selectedType: null,
  selectedTower: null,
  rangeUpgradeHover: false,
  previewX: 0,
  previewY: 0,
  previewValid: false,

  waveActive: false,
  spawning: false,
  spawnTimer: 0,
  enemiesToSpawn: 0,
  enemiesSpawned: 0,
  nextWaveTimer: 1.25,
  queuedWaves: 0,
  activeWaves: [],

  paused: false,
  speed: 1,

  gameOver: false,

  lastTime: 0
};


/* =========================================================
   ДОРОГА
========================================================= */

const maps = {
  ridge: {
    name: "Неоновый мост",
    description: "Базовый маршрут с длинными прямыми участками.",
    path: [
      { x: -40, y: 120 },
      { x: 150, y: 120 },
      { x: 150, y: 250 },
      { x: 350, y: 250 },
      { x: 350, y: 110 },
      { x: 560, y: 110 },
      { x: 560, y: 390 },
      { x: 790, y: 390 },
      { x: 790, y: 220 },
      { x: 1040, y: 220 }
    ]
  },
  circuit: {
    name: "Кибер-контур",
    description: "Извилистая трасса с большим количеством поворотов.",
    path: [
      { x: -40, y: 500 },
      { x: 140, y: 500 },
      { x: 140, y: 150 },
      { x: 330, y: 150 },
      { x: 330, y: 430 },
      { x: 520, y: 430 },
      { x: 520, y: 180 },
      { x: 720, y: 180 },
      { x: 720, y: 500 },
      { x: 1040, y: 500 }
    ]
  },
  coreline: {
    name: "Жизненная линия",
    description: "Открытая карта с длинным центральным маршрутом.",
    path: [
      { x: -40, y: 320 },
      { x: 180, y: 320 },
      { x: 180, y: 120 },
      { x: 430, y: 120 },
      { x: 430, y: 500 },
      { x: 680, y: 500 },
      { x: 680, y: 300 },
      { x: 1040, y: 300 }
    ]
  }
};

let currentMap = "ridge";
let path = maps[currentMap].path;


/* =========================================================
   ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
========================================================= */

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function setHint(text) {
  if (hintEl) {
    hintEl.textContent = text;
  }
}

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();

  return {
    x: (event.clientX - rect.left) * (canvas.width / rect.width),
    y: (event.clientY - rect.top) * (canvas.height / rect.height)
  };
}


/* =========================================================
   ПРОВЕРКА ДОРОГИ
========================================================= */

function distanceToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;

  if (dx === 0 && dy === 0) {
    return Math.hypot(px - x1, py - y1);
  }

  const t = clamp(
      ((px - x1) * dx + (py - y1) * dy) /
      (dx * dx + dy * dy),
      0,
      1
  );

  const x = x1 + t * dx;
  const y = y1 + t * dy;

  return Math.hypot(px - x, py - y);
}

function isOnRoad(x, y) {
  const roadWidth = 72;
  const towerBodyRadius = 22;

  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];

    if (
        distanceToSegment(
            x,
            y,
            a.x,
            a.y,
            b.x,
            b.y
        ) < roadWidth / 2 + towerBodyRadius
    ) {
      return true;
    }
  }

  return false;
}


/* =========================================================
   БАШНИ
========================================================= */

function isTowerUnlocked(type) {
  const unlockWave = towerTypes[type]?.unlockWave;
  return !unlockWave || state.wave >= unlockWave;
}

function updateTowerAvailability() {
  document.querySelectorAll(".tower-card").forEach(card => {
    const type = card.dataset.tower;
    const def = towerTypes[type];
    if (!def) return;

    const unlocked = isTowerUnlocked(type);
    card.classList.toggle("locked", !unlocked);
    card.classList.toggle("mystery", !unlocked);
    card.setAttribute("aria-disabled", String(!unlocked));

    const icon = card.querySelector(".tower-icon");
    const mysteryIcon = card.querySelector(".tower-mystery-icon");
    const name = card.querySelector(".tower-name");
    const desc = card.querySelector(".tower-desc");
    const price = card.querySelector(".cash-price");
    const unlock = card.querySelector(".tower-unlock");

    if (icon) icon.hidden = !unlocked;
    if (mysteryIcon) mysteryIcon.hidden = unlocked;

    if (name) name.textContent = unlocked ? def.name : "???";
    if (desc) {
      if (unlocked) {
        desc.textContent = def.description || desc.dataset.defaultText || "";
      } else {
        desc.textContent = def.unlockWave
          ? `Открывается с ${def.unlockWave}-й волны`
          : "Скрытая башня";
      }
    }
    if (price) price.textContent = unlocked ? `$${def.cost}` : "???";
    if (unlock) {
      unlock.textContent = unlocked
        ? (unlock.dataset.defaultText || "")
        : "";
    }
  });
}

function towerAt(x, y) {
  const towerHitRadius = 24;

  for (let i = state.towers.length - 1; i >= 0; i--) {
    const tower = state.towers[i];

    if (distance({ x, y }, tower) <= towerHitRadius) {
      return tower;
    }
  }

  return null;
}

function canPlaceTower(x, y) {
  if (!state.selectedType || !towerTypes[state.selectedType]) {
    return false;
  }

  const towerBodyRadius = 22;
  const towerGap = 2;

  if (x < towerBodyRadius || x > GAME_WIDTH - towerBodyRadius) {
    return false;
  }

  if (y < towerBodyRadius || y > GAME_HEIGHT - towerBodyRadius) {
    return false;
  }

  if (isOnRoad(x, y)) {
    return false;
  }

  for (const tower of state.towers) {
    if (distance({ x, y }, tower) < towerBodyRadius * 2 + towerGap) {
      return false;
    }
  }

  return true;
}

function clearTowerTypeSelection() {
  state.selectedType = null;
  state.previewValid = false;

  document.querySelectorAll(".tower-card").forEach((card) => {
    card.classList.remove("active");
  });
}

function placeSelectedTower(x, y) {
  const type = towerTypes[state.selectedType];

  if (!type) {
    return;
  }

  if (state.money < type.cost) {
    clearTowerTypeSelection();
    state.selectedTower = null;
        state.rangeUpgradeHover = false;
    setHint("Недостаточно долларов. Выбор башни снят.");
    updateUi();
    return;
  }

  if (!canPlaceTower(x, y)) {
    clearTowerTypeSelection();
    state.selectedTower = null;
        state.rangeUpgradeHover = false;
    setHint("Здесь нельзя поставить башню. Выбор башни снят.");
    updateUi();
    return;
  }

  const tower = {
    x,
    y,

    type: state.selectedType,

    level: 1,
    damageLevel: 1,
    rangeLevel: 1,
    speedLevel: 1,

    damage: type.damage,
    range: type.range,
    fireRate: type.fireRate,

    cooldown: 0,
    speedOverdrive: false,
    speedOverdriveTimer: 0,
    speedOverdriveCheckTimer: SPEED_OVERDRIVE_INTERVAL,
    speedOverdriveShake: 0,

    totalSpent: type.cost
  };

  state.money -= type.cost;

  state.towers.push(tower);

  // После установки выбор типа башни полностью снимается.
  // Чтобы поставить следующую башню, нужно снова нажать её карточку.
  state.selectedTower = null;
  clearTowerTypeSelection();

  setHint(
      `${type.name} установлена. Выберите башню заново для следующей установки.`
  );

  updateUi();
}


/* =========================================================
   ПАРАМЕТРЫ БАШНИ
========================================================= */

function getTowerStats(tower) {
  const base = towerTypes[tower.type];
  const damageLevel = tower.damageLevel || 1;
  const rangeLevel = tower.rangeLevel || 1;
  const speedLevel = tower.speedLevel || 1;

  return {
    damage: Math.round(
        base.damage * (1 + (damageLevel - 1) * 0.35)
    ),
    range: base.range + (rangeLevel - 1) * 15,
    fireRate: Math.max(
        0.12,
        base.fireRate * Math.pow(0.92, speedLevel - 1) *
          (tower.speedOverdrive ? 0.5 : 1)
    )
  };
}

function getUpgradeCost(tower, kind) {
  const baseCost = towerTypes[tower.type].cost;
  const level = tower[`${kind}Level`] || 1;

  if (level >= MAX_UPGRADE_LEVEL) {
    return Infinity;
  }

  const multipliers = {
    damage: 0.42,
    range: 0.34,
    speed: 0.48
  };

  return Math.floor(baseCost * (0.75 + level * multipliers[kind]));
}


/* =========================================================
   ВРАГИ
========================================================= */

function getPointOnPath(distanceAlongPath) {
  let remaining = distanceAlongPath;

  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];

    const segmentLength = distance(a, b);

    if (remaining <= segmentLength) {
      const t = remaining / segmentLength;

      return {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        segment: i
      };
    }

    remaining -= segmentLength;
  }

  return {
    ...path[path.length - 1],
    segment: path.length - 2
  };
}

function totalPathLength() {
  let result = 0;

  for (let i = 0; i < path.length - 1; i++) {
    result += distance(path[i], path[i + 1]);
  }

  return result;
}

let PATH_LENGTH = totalPathLength();

const difficulties = {
  easy: {
    name: "Легкий",
    hpMultiplier: 0.78,
    speedMultiplier: 0.90,
    countMultiplier: 0.88,
    rewardMultiplier: 1.18,
    waveRewardMultiplier: 1.15
  },
  normal: {
    name: "Средний",
    hpMultiplier: 1.00,
    speedMultiplier: 1.00,
    countMultiplier: 1.00,
    rewardMultiplier: 1.00,
    waveRewardMultiplier: 1.00
  },
  hard: {
    name: "Сложный",
    hpMultiplier: 1.30,
    speedMultiplier: 1.10,
    countMultiplier: 1.14,
    rewardMultiplier: 0.88,
    waveRewardMultiplier: 0.90
  }
};

let currentDifficulty = "easy";

function getDifficulty() {
  return difficulties[currentDifficulty] || difficulties.normal;
}

function getWaveScaling(wave) {
  const w = Math.max(1, wave);
  const difficulty = getDifficulty();

  const hpGrowth = Math.pow(1 + 0.085 * (w - 1), 1.12);
  const speedGrowth = Math.min(2.15, 1 + 0.0105 * (w - 1));
  const rewardGrowth = Math.pow(1 + 0.040 * (w - 1), 0.92);
  const countGrowth =
      6 +
      Math.floor(2.35 * Math.sqrt(w - 1)) +
      Math.floor((w - 1) * 0.07);

  return {
    hp: Math.max(1, 70 * hpGrowth * difficulty.hpMultiplier),
    speed: 45 * speedGrowth * difficulty.speedMultiplier,
    reward: Math.max(1, 7 * rewardGrowth * difficulty.rewardMultiplier),
    count: Math.max(4, Math.round(countGrowth * difficulty.countMultiplier)),
    spawnInterval: Math.max(0.25, 0.72 - Math.min(0.38, (w - 1) * 0.0038))
  };
}


const enemyTypes = [
  { color: "#ff5277", glow: "#ff5277", shape: "circle" },
  { color: "#ff9f43", glow: "#ff9f43", shape: "square" },
  { color: "#ffe66d", glow: "#ffe66d", shape: "triangle" },
  { color: "#62f6ff", glow: "#62f6ff", shape: "diamond" },
  { color: "#5c7cfa", glow: "#5c7cfa", shape: "hex" },
  { color: "#b86bff", glow: "#b86bff", shape: "star" },
  { color: "#42e6a4", glow: "#42e6a4", shape: "pentagon" },
  { color: "#f36cff", glow: "#f36cff", shape: "cross" },
  { color: "#78a9ff", glow: "#78a9ff", shape: "octagon" },
  { color: "#ff6b9a", glow: "#ff6b9a", shape: "bolt" }
];

function getEnemyType(waveNumber) {
  return enemyTypes[(Math.max(1, waveNumber) - 1) % enemyTypes.length];
}

function drawEnemyShape(x, y, radius, shape) {
  ctx.beginPath();
  if (shape === "circle") { ctx.arc(x, y, radius, 0, Math.PI * 2); return; }
  if (shape === "square") { ctx.rect(x - radius, y - radius, radius * 2, radius * 2); return; }
  const count = shape === "triangle" ? 3 : shape === "pentagon" ? 5 : shape === "hex" ? 6 : shape === "octagon" ? 8 : shape === "diamond" ? 4 : 5;
  if (shape === "cross") {
    ctx.moveTo(x - radius * .35, y - radius); ctx.lineTo(x + radius * .35, y - radius);
    ctx.lineTo(x + radius * .35, y - radius * .35); ctx.lineTo(x + radius, y - radius * .35);
    ctx.lineTo(x + radius, y + radius * .35); ctx.lineTo(x + radius * .35, y + radius * .35);
    ctx.lineTo(x + radius * .35, y + radius); ctx.lineTo(x - radius * .35, y + radius);
    ctx.lineTo(x - radius * .35, y + radius * .35); ctx.lineTo(x - radius, y + radius * .35);
    ctx.lineTo(x - radius, y - radius * .35); ctx.lineTo(x - radius * .35, y - radius * .35); ctx.closePath(); return;
  }
  if (shape === "star") {
    for (let i=0;i<10;i++) { const a=-Math.PI/2+i*Math.PI/5; const r=i%2?radius*.45:radius; const px=x+Math.cos(a)*r, py=y+Math.sin(a)*r; i?ctx.lineTo(px,py):ctx.moveTo(px,py); } ctx.closePath(); return;
  }
  if (shape === "bolt") {
    ctx.moveTo(x+radius*.15,y-radius); ctx.lineTo(x-radius*.7,y+radius*.05); ctx.lineTo(x-radius*.08,y+radius*.02); ctx.lineTo(x-radius*.35,y+radius); ctx.lineTo(x+radius*.72,y-radius*.18); ctx.lineTo(x+radius*.12,y-radius*.12); ctx.closePath(); return;
  }
  for (let i=0;i<count;i++) { const a=-Math.PI/2+i*Math.PI*2/count; const px=x+Math.cos(a)*radius, py=y+Math.sin(a)*radius; i?ctx.lineTo(px,py):ctx.moveTo(px,py); }
  ctx.closePath();
}

function spawnEnemy(waveNumber = state.wave) {
  const scaling = getWaveScaling(waveNumber);
  const maxHp = Math.round(scaling.hp);

  const enemyType = getEnemyType(waveNumber);

  const enemy = {
    waveNumber,
    enemyType,
    distance: 0,
    x: path[0].x,
    y: path[0].y,
    hp: maxHp,
    maxHp,
    speed: scaling.speed,
    radius: 13,
    reward: Math.max(1, Math.round(scaling.reward)),
    slowMultiplier: 1,
    slowTimer: 0,
    dead: false
  };

  state.enemies.push(enemy);
}

function updateEnemy(enemy, dt) {
  if (enemy.dead) {
    return;
  }

  if (enemy.slowTimer > 0) {
    enemy.slowTimer -= dt;
  } else {
    enemy.slowMultiplier = 1;
  }

  enemy.distance +=
      enemy.speed *
      enemy.slowMultiplier *
      dt;

  const position = getPointOnPath(enemy.distance);

  enemy.x = position.x;
  enemy.y = position.y;

  if (enemy.distance >= PATH_LENGTH) {
    enemy.dead = true;

    state.lives--;
    ensureAudio();
    playLeakSound();

    createExplosion(
        enemy.x,
        enemy.y,
        "#ff5c7a"
    );

    if (state.lives <= 0) {
      endGame(false);
    }
  }
}


/* =========================================================
   СНАРЯДЫ
========================================================= */

function createProjectile(tower, target) {
  const stats = getTowerStats(tower);
  const type = towerTypes[tower.type];

  state.projectiles.push({
    x: tower.x,
    y: tower.y,

    target,

    speed: type.projectileSpeed || 500,

    damage: stats.damage,

    towerType: tower.type,

    splash: type.splash || 0,

    color: type.color
  });
}

function updateProjectile(projectile, dt) {
  if (!projectile.target || projectile.target.dead) {
    projectile.dead = true;
    return;
  }

  const target = projectile.target;

  const dx = target.x - projectile.x;
  const dy = target.y - projectile.y;

  const dist = Math.hypot(dx, dy);

  if (dist < 10) {
    hitTarget(projectile, target);
    projectile.dead = true;
    return;
  }

  projectile.x +=
      (dx / dist) *
      projectile.speed *
      dt;

  projectile.y +=
      (dy / dist) *
      projectile.speed *
      dt;
}


/* =========================================================
   ПОПАДАНИЕ
========================================================= */

function hitTarget(projectile, target) {
  if (target.dead) {
    return;
  }

  target.hp -= projectile.damage;

  const type = towerTypes[projectile.towerType];

  if (type.slow) {
    target.slowMultiplier = type.slow;
    target.slowTimer = type.slowTime;
  }

  if (projectile.splash) {
    for (const enemy of state.enemies) {
      if (
          enemy !== target &&
          !enemy.dead &&
          distance(enemy, target) <= projectile.splash
      ) {
        enemy.hp -= projectile.damage * 0.55;

        if (enemy.hp <= 0) {
          killEnemy(enemy);
        }
      }
    }

    createExplosion(
        target.x,
        target.y,
        type.color
    );
  }

  if (projectile.towerType === "arc") {
    chainLightning(
        target,
        projectile.damage
    );
  }

  if (target.hp <= 0) {
    killEnemy(target);
  }
}

function chainLightning(source, damage) {
  const candidates = state.enemies
      .filter(enemy =>
          !enemy.dead &&
          enemy !== source &&
          distance(enemy, source) < 95
      )
      .sort(
          (a, b) =>
              distance(a, source) -
              distance(b, source)
      )
      .slice(0, 2);

  for (const enemy of candidates) {
    enemy.hp -= damage * 0.65;

    createLightning(
        source,
        enemy
    );

    if (enemy.hp <= 0) {
      killEnemy(enemy);
    }
  }
}

function killEnemy(enemy) {
  if (enemy.dead) {
    return;
  }

  enemy.dead = true;

  state.kills++;

  state.money += enemy.reward;

  createCashPopup(
      enemy.x,
      enemy.y - 10,
      enemy.reward
  );

  createExplosion(
      enemy.x,
      enemy.y,
      "#ffffff"
  );
}


/* =========================================================
   ВЫБОР ЦЕЛИ
========================================================= */

function findTarget(tower) {
  const stats = getTowerStats(tower);

  let best = null;
  let bestProgress = -Infinity;

  for (const enemy of state.enemies) {
    if (enemy.dead) {
      continue;
    }

    const dist = distance(tower, enemy);

    if (dist > stats.range) {
      continue;
    }

    if (enemy.distance > bestProgress) {
      bestProgress = enemy.distance;
      best = enemy;
    }
  }

  return best;
}


/* =========================================================
   БАШНИ СТРЕЛЯЮТ
========================================================= */

function updateTowers(dt) {
  for (const tower of state.towers) {
    if ((tower.speedLevel || 1) >= 6) {
      tower.speedOverdriveCheckTimer = Math.max(0, (tower.speedOverdriveCheckTimer ?? SPEED_OVERDRIVE_INTERVAL) - dt);
      if (tower.speedOverdriveCheckTimer <= 0) {
        tower.speedOverdriveCheckTimer = SPEED_OVERDRIVE_INTERVAL;
        if (Math.random() < SPEED_OVERDRIVE_CHANCE) {
          tower.speedOverdrive = true;
          tower.speedOverdriveTimer = SPEED_OVERDRIVE_DURATION;
          tower.speedOverdriveShake = SPEED_OVERDRIVE_SHAKE_DURATION;
          tower.cooldown = 0;
        }
      }
    } else {
      tower.speedOverdriveCheckTimer = SPEED_OVERDRIVE_INTERVAL;
    }

    if (tower.speedOverdrive) {
      tower.speedOverdriveTimer = Math.max(0, (tower.speedOverdriveTimer || 0) - dt);
      if (tower.speedOverdriveTimer <= 0) tower.speedOverdrive = false;
    }

    if (tower.speedOverdriveShake > 0) {
      tower.speedOverdriveShake = Math.max(0, tower.speedOverdriveShake - dt);
    }
    tower.cooldown -= dt;

    if (tower.cooldown > 0) {
      continue;
    }

    const target = findTarget(tower);

    if (!target) {
      continue;
    }

    createProjectile(
        tower,
        target
    );

    playShotSound(tower.type);

    const stats = getTowerStats(tower);

    tower.cooldown = stats.fireRate;
  }
}


/* =========================================================
   ЭФФЕКТЫ
========================================================= */

function createExplosion(x, y, color) {
  state.effects.push({
    type: "explosion",
    x,
    y,
    radius: 5,
    maxRadius: 28,
    life: 0.35,
    maxLife: 0.35,
    color
  });
}

function createLightning(a, b) {
  state.effects.push({
    type: "lightning",
    x1: a.x,
    y1: a.y,
    x2: b.x,
    y2: b.y,
    life: 0.15,
    maxLife: 0.15
  });
}

function createCashPopup(x, y, amount) {
  state.effects.push({
    type: "cash",
    x,
    y,
    amount,
    life: 0.9,
    maxLife: 0.9,
    velocityY: -28
  });
}

function updateEffects(dt) {
  for (const effect of state.effects) {
    effect.life -= dt;

    if (effect.type === "explosion") {
      effect.radius +=
          (effect.maxRadius / effect.maxLife) *
          dt;
    }

    if (effect.type === "cash") {
      effect.y += effect.velocityY * dt;
      effect.velocityY += 12 * dt;
    }
  }

  state.effects =
      state.effects.filter(
          effect => effect.life > 0
      );
}


/* =========================================================
   ВОЛНЫ
========================================================= */

function startWave() {
  if (state.gameOver) {
    return;
  }

  state.wave++;
  const waveNumber = state.wave;
  const scaling = getWaveScaling(waveNumber);

  state.activeWaves.push({
    waveNumber,
    spawning: true,
    spawnTimer: 0,
    enemiesToSpawn: scaling.count,
    enemiesSpawned: 0
  });

  state.waveActive = true;
  state.spawning = true;
  state.nextWaveTimer = 2.25;

  waveNameEl.textContent =
      state.activeWaves.length > 1
          ? `Волны ${state.activeWaves.map(w => w.waveNumber).join(' + ')}`
          : `Волна ${waveNumber}`;

  setHint(
      state.activeWaves.length > 1
          ? `Запущена дополнительная волна ${waveNumber} параллельно текущей.`
          : `Волна ${waveNumber} началась.`
  );

  updateUi();
}

function updateWave(dt) {
  if (state.gameOver) {
    return;
  }

  if (state.activeWaves.length === 0) {
    state.waveActive = false;
    state.spawning = false;
    state.nextWaveTimer -= dt;
    if (state.nextWaveTimer <= 0) {
      startWave();
    }
    return;
  }

  for (const wave of state.activeWaves) {
    if (!wave.spawning) {
      continue;
    }

    wave.spawnTimer -= dt;

    if (wave.spawnTimer <= 0 && wave.enemiesSpawned < wave.enemiesToSpawn) {
      spawnEnemy(wave.waveNumber);
      wave.enemiesSpawned++;
      wave.spawnTimer = getWaveScaling(wave.waveNumber).spawnInterval;
    }

    if (wave.enemiesSpawned >= wave.enemiesToSpawn) {
      wave.spawning = false;
    }
  }

  // Удаляем только те волны, для которых уже вышли все мобы и не осталось
  // живых врагов именно этой волны. Другие запущенные волны продолжаются.
  const completed = [];
  state.activeWaves = state.activeWaves.filter(wave => {
    const spawning = wave.spawning;
    const alive = state.enemies.some(enemy =>
        !enemy.dead && enemy.waveNumber === wave.waveNumber
    );

    if (!spawning && !alive) {
      completed.push(wave.waveNumber);
      const reward = Math.round(
          (25 + Math.floor(wave.waveNumber * 2.5)) *
          getDifficulty().waveRewardMultiplier
      );
      state.money += reward;
      return false;
    }
    return true;
  });

  state.waveActive = state.activeWaves.length > 0;
  state.spawning = state.activeWaves.some(wave => wave.spawning);

  if (completed.length > 0) {
    const label = completed.length === 1
        ? `Волна ${completed[0]} завершена.`
        : `Завершены волны: ${completed.join(', ')}.`;

    if (state.waveActive) {
      setHint(`${label} Остальные запущенные волны продолжаются.`);
    } else {
      state.nextWaveTimer = 2.25;
      waveNameEl.textContent = 'Готовность';
      setHint(`${label} Следующая волна начнётся автоматически.`);
    }
  }
}


/* =========================================================
   УЛУЧШЕНИЕ
========================================================= */

function upgradeTowerStat(kind) {
  const tower = state.selectedTower;
  if (!tower || !['damage', 'range', 'speed'].includes(kind)) {
    return;
  }

  const currentLevel = tower[`${kind}Level`] || 1;
  if (currentLevel >= MAX_UPGRADE_LEVEL) {
    setHint(`${towerTypes[tower.type].name}: этот параметр уже на максимуме.`);
    return;
  }

  const cost = getUpgradeCost(tower, kind);
  if (state.money < cost) {
    setHint("Недостаточно долларов для улучшения.");
    return;
  }

  state.money -= cost;
  tower[`${kind}Level`] = (tower[`${kind}Level`] || 1) + 1;
  tower.totalSpent += cost;

  if (kind === 'speed' && tower['speedLevel'] === 6) {
    tower.speedOverdrive = false;
    tower.speedOverdriveTimer = 0;
    tower.speedOverdriveCheckTimer = SPEED_OVERDRIVE_INTERVAL;
  }

  const names = {
    damage: 'урон',
    range: 'радиус',
    speed: 'скорость атаки'
  };

  setHint(
      `${towerTypes[tower.type].name}: ${names[kind]} улучшен до уровня ${tower[`${kind}Level`]}.`
  );
  updateUi();
}

function upgradeSelectedTower() {
  upgradeTowerStat('damage');
}

function sellSelectedTower() {
  const tower = state.selectedTower;

  if (!tower) {
    return;
  }

  const refund =
      Math.floor(
          tower.totalSpent * 0.7
      );

  const index =
      state.towers.indexOf(tower);

  if (index !== -1) {
    state.towers.splice(index, 1);
  }

  state.selectedTower = null;

  state.money += refund;

  setHint(
      `Башня продана за $${refund}.`
  );

  updateUi();
}


/* =========================================================
   UI
========================================================= */

function updateUi() {
  updateTowerAvailability();

  moneyEl.textContent =
      `$${Math.floor(state.money)}`;

  livesEl.textContent =
      Math.max(0, state.lives);

  waveEl.textContent =
      `${state.wave} ∞`;

  killsEl.textContent =
      state.kills;

  if (state.selectedTower) {
    const tower =
        state.selectedTower;

    const type =
        towerTypes[tower.type];

    const stats =
        getTowerStats(tower);

    const damageCost = getUpgradeCost(tower, 'damage');
    const rangeCost = getUpgradeCost(tower, 'range');
    const speedCost = getUpgradeCost(tower, 'speed');

    const damageLevel = tower.damageLevel || 1;
    const rangeLevel = tower.rangeLevel || 1;
    const speedLevel = tower.speedLevel || 1;
    const nextDamage = damageLevel < MAX_UPGRADE_LEVEL
        ? Math.round(type.damage * (1 + damageLevel * 0.35))
        : stats.damage;
    const nextRange = rangeLevel < MAX_UPGRADE_LEVEL
        ? type.range + rangeLevel * 15
        : stats.range;
    const nextFireRate = speedLevel < MAX_UPGRADE_LEVEL
        ? Math.max(0.12, type.fireRate * Math.pow(0.92, speedLevel))
        : stats.fireRate;

    const statRow = (label, kind, level, current, next, suffix = '') => {
      const bars = Array.from({ length: MAX_UPGRADE_LEVEL }, (_, index) => {
        const n = index + 1;
        const filled = n <= level;
        const preview = n === level + 1 && level < MAX_UPGRADE_LEVEL;
        return `<span class="stat-bar ${filled ? `filled ${kind}` : ''} ${preview ? `preview ${kind}` : ''}" title="${n === level ? `Текущий уровень: ${level}` : preview ? `Следующий уровень: ${level + 1}` : `Уровень ${n}`}" aria-hidden="true"></span>`;
      }).join('');
      return `
        <div class="stat-preview">
          <span class="stat-preview-label">${label}</span>
          <div class="stat-bars" aria-label="${label}: уровень ${level} из ${MAX_UPGRADE_LEVEL}${level < MAX_UPGRADE_LEVEL ? `, следующий уровень ${level + 1}` : ', максимум'}">${bars}</div>
        </div>`;
    };

    selectionInfo.innerHTML = `
      <div class="selection-title-row">
        <strong>${type.name}</strong>
        <span class="selection-cost">$${Math.floor(tower.totalSpent || type.cost)}</span>
      </div>
      <p>Текущие параметры · следующий уровень подсвечен пунктиром</p>
      <div class="stat-preview-list">
        ${statRow('Урон', 'damage', damageLevel, stats.damage, nextDamage)}
        ${statRow('Радиус', 'range', rangeLevel, Math.round(stats.range), Math.round(nextRange))}
        ${statRow('Темп', 'speed', speedLevel, stats.fireRate.toFixed(2), nextFireRate.toFixed(2), 'с')}
      </div>
    `;

    upgradeBtn.textContent = damageCost === Infinity ? "Урон MAX" : `Урон + ($${damageCost})`;
    rangeBtn.textContent = rangeCost === Infinity ? "Радиус MAX" : `Радиус + ($${rangeCost})`;
    speedBtnUpgrade.textContent = speedCost === Infinity ? "Скорость MAX" : `Скорость + ($${speedCost})`;

    upgradeBtn.disabled = damageCost === Infinity || state.money < damageCost;
    rangeBtn.disabled = rangeCost === Infinity || state.money < rangeCost;
    speedBtnUpgrade.disabled = speedCost === Infinity || state.money < speedCost;
    sellBtn.disabled = false;
  } else {
    const type = state.selectedType
        ? towerTypes[state.selectedType]
        : null;

    selectionInfo.innerHTML = type
        ? `
            <div class="selection-title-row">
              <strong>${type.name}</strong>
              <span class="selection-cost">$${type.cost}</span>
            </div>
            <p>Выберите место на поле для установки.</p>
          `
        : `
            <div class="selection-title-row">
              <strong>Башня не выбрана</strong>
              <span class="selection-cost">—</span>
            </div>
            <p>Выберите башню справа для установки.</p>
          `;

    upgradeBtn.textContent = "Урон +";
    rangeBtn.textContent = "Радиус +";
    speedBtnUpgrade.textContent = "Скорость +";
    upgradeBtn.disabled = true;
    rangeBtn.disabled = true;
    speedBtnUpgrade.disabled = true;
    sellBtn.disabled = true;
  }

  if (state.waveActive) {
    const spawningLeft = state.activeWaves.reduce(
        (sum, wave) => sum + Math.max(0, wave.enemiesToSpawn - wave.enemiesSpawned),
        0
    );
    const alive = state.enemies.filter(enemy => !enemy.dead).length;

    enemyCountEl.textContent =
        `Активных волн: ${state.activeWaves.length} · мобов: ${spawningLeft + alive}`;
  } else {
    const seconds = Math.max(0, Math.ceil(state.nextWaveTimer));
    enemyCountEl.textContent = state.gameOver
        ? "Волны остановлены"
        : `Следующая волна через ${seconds}с`;
  }

  if (nextWaveBtn) {
    nextWaveBtn.textContent = state.waveActive
        ? `Запустить ещё одну волну`
        : "Запустить волну";
    nextWaveBtn.disabled = state.gameOver;
  }
}


/* =========================================================
   КЛИК ПО ПОЛЮ
========================================================= */

canvas.addEventListener(
    "click",
    (event) => {
      if (state.gameOver) {
        return;
      }

      const p =
          canvasPoint(event);

      const existing =
          towerAt(p.x, p.y);

      /*
       * Нажали на уже выбранную башню.
       * Снимаем выделение.
       */
      if (
          existing &&
          existing === state.selectedTower
      ) {
        state.selectedTower = null;

        setHint(
            "Выделение снято. Теперь можно выбрать место для новой башни."
        );

        updateUi();

        return;
      }

      /*
       * Нажали на другую башню.
       * Переключаем выделение.
       */
      if (existing) {
        state.selectedTower = existing;

        const type =
            towerTypes[existing.type];

        setHint(
            `${type.name}, уровень ${existing.level}.`
        );

        updateUi();

        return;
      }

      /*
       * Нажали на пустое место,
       * когда башня уже выделена.
       *
       * Просто снимаем выделение.
       */
      if (state.selectedTower) {
        state.selectedTower = null;

        setHint(
            "Выделение снято. Теперь можно выбрать место для новой башни."
        );

        updateUi();

        return;
      }

      /*
       * Ничего не выделено —
       * ставим выбранную башню.
       */
      placeSelectedTower(
          p.x,
          p.y
      );
    }
);


canvas.addEventListener("mousemove", (event) => {
  const p = canvasPoint(event);
  state.previewX = p.x;
  state.previewY = p.y;
  state.previewValid = !!state.selectedType && canPlaceTower(p.x, p.y);
});

canvas.addEventListener("mouseleave", () => {
  state.previewValid = false;
});

/* =========================================================
   ВЫБОР ТИПА БАШНИ
========================================================= */

towerList.addEventListener(
    "click",
    (event) => {
      const button =
          event.target.closest(
              ".tower-card"
          );

      if (!button) {
        return;
      }

      const type =
          button.dataset.tower;

      if (!towerTypes[type]) {
        return;
      }

      if (!isTowerUnlocked(type)) {
        setHint(`Эта башня ещё не разблокирована. Нужна ${towerTypes[type].unlockWave}-я волна.`);
        return;
      }

      const wasSelected = state.selectedType === type;

      state.selectedTower = null;

      if (wasSelected) {
        state.selectedType = null;
      } else {
        state.selectedType = type;
      }

      document
          .querySelectorAll(
              ".tower-card"
          )
          .forEach(card => {
            card.classList.toggle(
                "active",
                !wasSelected && card === button
            );
          });

      if (wasSelected) {
        state.previewValid = false;
        setHint(
            "Выбор башни снят. Теперь ни одна башня не выбрана."
        );
      } else {
        setHint(
            `${towerTypes[type].name}: выберите место вне дороги.`
        );
      }

      updateUi();
    }
);


/* =========================================================
   КНОПКИ
========================================================= */

upgradeBtn.addEventListener(
    "click",
    () => {
      ensureAudio();
      upgradeTowerStat('damage');
    }
);

rangeBtn.addEventListener(
    "click",
    () => {
      ensureAudio();
      upgradeTowerStat('range');
    }
);

rangeBtn.addEventListener("mouseenter", () => {
  state.rangeUpgradeHover = true;
});

rangeBtn.addEventListener("mouseleave", () => {
  state.rangeUpgradeHover = false;
});

speedBtnUpgrade.addEventListener(
    "click",
    () => {
      ensureAudio();
      upgradeTowerStat('speed');
    }
);

sellBtn.addEventListener(
    "click",
    sellSelectedTower
);

function queueNextWave() {
  if (state.gameOver) {
    return;
  }

  ensureAudio();
  // Важно: это НЕ очередь. Каждый клик немедленно создаёт новую волну,
  // которая идёт параллельно уже запущенным.
  startWave();
  updateUi();
}


function setPaused(paused) {
  state.paused = paused;

  pauseBtn.textContent =
      state.paused
          ? "Продолжить"
          : "Пауза";

  if (pauseOverlay) {
    pauseOverlay.classList.toggle("hidden", !state.paused);
  }

  if (!state.paused) {
    state.lastTime = performance.now();
  }
}

pauseBtn.addEventListener(
    "click",
    () => {
      ensureAudio();
      setPaused(!state.paused);
    }
);

if (resumeBtn) {
  resumeBtn.addEventListener(
      "click",
      () => {
        ensureAudio();
        setPaused(false);
      }
  );
}

speedBtn.addEventListener(
    "click",
    () => {
      if (state.speed === 1) {
        state.speed = 2;
      } else if (state.speed === 2) {
        state.speed = 3;
      } else {
        state.speed = 1;
      }

      speedBtn.textContent =
          `x${state.speed}`;
    }
);

startGameBtn.addEventListener(
    "click",
    startGame
);

if (volumeSlider) {
  applyAudioVolume();
  volumeSlider.addEventListener("input", () => {
    audioVolume = Number(volumeSlider.value) / 100;
    applyAudioVolume();
    try {
      localStorage.setItem(VOLUME_KEY, String(audioVolume));
    } catch (error) {
      // Настройка громкости остаётся рабочей и без localStorage.
    }
  });
}

async function toggleFullscreen() {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  } catch (error) {
    setHint("Полноэкранный режим недоступен в этом браузере.");
  }
}

function closeSettings() {
  if (!settingsPanel || !settingsBtn) return;
  settingsPanel.classList.add("hidden");
  settingsBtn.setAttribute("aria-expanded", "false");
}

function toggleSettings() {
  if (!settingsPanel || !settingsBtn) return;
  const isOpen = !settingsPanel.classList.contains("hidden");
  settingsPanel.classList.toggle("hidden", isOpen);
  settingsBtn.setAttribute("aria-expanded", String(!isOpen));
}

if (settingsBtn) {
  settingsBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    ensureAudio();
    toggleSettings();
  });
}

if (settingsPanel) {
  settingsPanel.addEventListener("click", (event) => event.stopPropagation());
}

document.addEventListener("click", (event) => {
  if (settingsWidget && !settingsWidget.contains(event.target)) {
    closeSettings();
  }
});

if (fullscreenBtn) {
  fullscreenBtn.addEventListener("click", () => {
    ensureAudio();
    toggleFullscreen();
    closeSettings();
  });
}

document.addEventListener("fullscreenchange", () => {
  if (fullscreenBtn) {
    fullscreenBtn.textContent = document.fullscreenElement
        ? "Выйти из полного экрана"
        : "Весь экран";
  }
});

if (nextWaveBtn) {
  nextWaveBtn.addEventListener("click", queueNextWave);
}

menuBtn.addEventListener(
    "click",
    showMainMenu
);

if (difficultyList) {
  difficultyList.addEventListener(
      "click",
      event => {
        const button = event.target.closest(".difficulty-card");
        if (!button) return;
        selectDifficulty(button.dataset.difficulty);
      }
  );
}

mapList.addEventListener(
    "click",
    event => {
      const button = event.target.closest(".map-card");
      if (!button) return;
      selectMap(button.dataset.map);
    }
);

restartBtn.addEventListener(
    "click",
    startNewGame
);

if (endMenuBtn) {
  endMenuBtn.addEventListener("click", () => {
    ensureAudio();
    endModal.classList.add("hidden");
    showMainMenu();
  });
}

if (newGameBtn) {
  newGameBtn.addEventListener("click", startNewGame);
}

window.addEventListener("beforeunload", () => {
  // Сохраняем именно активную игру при закрытии/обновлении страницы.
  if (!state.gameOver && !gameScreen.classList.contains("hidden")) {
    saveGame();
  }
});


/* =========================================================
   ОТРИСОВКА ФОНА
========================================================= */

function drawBackground() {
  ctx.fillStyle = "#07101b";
  ctx.fillRect(
      0,
      0,
      GAME_WIDTH,
      GAME_HEIGHT
  );

  /*
   * Сетка.
   */
  ctx.strokeStyle =
      "rgba(80, 180, 255, 0.07)";

  ctx.lineWidth = 1;

  for (
      let x = 0;
      x <= GAME_WIDTH;
      x += 40
  ) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(
        x,
        GAME_HEIGHT
    );
    ctx.stroke();
  }

  for (
      let y = 0;
      y <= GAME_HEIGHT;
      y += 40
  ) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(
        GAME_WIDTH,
        y
    );
    ctx.stroke();
  }

  /*
   * Декоративные точки.
   */
  ctx.fillStyle =
      "rgba(100, 220, 255, 0.18)";

  for (
      let x = 20;
      x < GAME_WIDTH;
      x += 80
  ) {
    for (
        let y = 20;
        y < GAME_HEIGHT;
        y += 80
    ) {
      ctx.beginPath();
      ctx.arc(
          x,
          y,
          1.5,
          0,
          Math.PI * 2
      );
      ctx.fill();
    }
  }
}


/* =========================================================
   ДОРОГА
========================================================= */

function drawRoad() {
  /*
   * Внешнее свечение.
   */
  ctx.save();

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.strokeStyle =
      "rgba(40, 220, 255, 0.12)";

  ctx.lineWidth = 92;

  ctx.beginPath();

  ctx.moveTo(
      path[0].x,
      path[0].y
  );

  for (let i = 1; i < path.length; i++) {
    ctx.lineTo(
        path[i].x,
        path[i].y
    );
  }

  ctx.stroke();

  /*
   * Основная дорога.
   */
  ctx.strokeStyle =
      "#142d42";

  ctx.lineWidth = 72;

  ctx.beginPath();

  ctx.moveTo(
      path[0].x,
      path[0].y
  );

  for (let i = 1; i < path.length; i++) {
    ctx.lineTo(
        path[i].x,
        path[i].y
    );
  }

  ctx.stroke();

  /*
   * Светящаяся линия.
   */
  ctx.strokeStyle =
      "rgba(79, 220, 255, 0.5)";

  ctx.lineWidth = 2;

  ctx.setLineDash([
    10,
    10
  ]);

  ctx.beginPath();

  ctx.moveTo(
      path[0].x,
      path[0].y
  );

  for (let i = 1; i < path.length; i++) {
    ctx.lineTo(
        path[i].x,
        path[i].y
    );
  }

  ctx.stroke();

  ctx.setLineDash([]);

  ctx.restore();
}


/* =========================================================
   ТОЧКА ВЫХОДА
========================================================= */

function drawCore() {
  const core =
      path[path.length - 1];

  ctx.save();

  ctx.shadowBlur = 25;
  ctx.shadowColor =
      "#ff5577";

  ctx.fillStyle =
      "rgba(255, 70, 110, 0.2)";

  ctx.beginPath();

  ctx.arc(
      core.x - 5,
      core.y,
      30,
      0,
      Math.PI * 2
  );

  ctx.fill();

  ctx.shadowBlur = 0;

  ctx.strokeStyle =
      "#ff5577";

  ctx.lineWidth = 3;

  ctx.beginPath();

  ctx.arc(
      core.x - 5,
      core.y,
      18,
      0,
      Math.PI * 2
  );

  ctx.stroke();

  ctx.fillStyle =
      "#ff5577";

  ctx.beginPath();

  ctx.arc(
      core.x - 5,
      core.y,
      7,
      0,
      Math.PI * 2
  );

  ctx.fill();

  ctx.restore();
}


/* =========================================================
   БАШНИ
========================================================= */

function drawTower(tower) {
  const type =
      towerTypes[tower.type];

  const selected =
      tower === state.selectedTower;

  const stats =
      getTowerStats(tower);

  if (selected && state.rangeUpgradeHover) {
    drawRangeUpgradePreview(tower, type);
  }

  drawTowerUpgradeVisual(tower, type);

  /*
   * Свечение.
   */
  ctx.save();

  if (tower.speedOverdriveShake > 0) {
    const intensity = 6.5 * (tower.speedOverdriveShake / SPEED_OVERDRIVE_SHAKE_DURATION);
    ctx.translate((Math.random() - 0.5) * intensity, (Math.random() - 0.5) * intensity);
  }

  ctx.shadowBlur =
      selected ? 34 : 14;

  ctx.shadowColor =
      type.color;

  if (selected) {
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle =
      "#0d1826";

  ctx.strokeStyle =
      type.color;

  ctx.lineWidth =
      selected ? 3 : 2;

  /*
   * Разные формы башен.
   */
  if (tower.type === "rail") {
    ctx.beginPath();

    ctx.moveTo(
        tower.x - 18,
        tower.y + 12
    );

    ctx.lineTo(
        tower.x + 12,
        tower.y - 18
    );

    ctx.lineTo(
        tower.x + 20,
        tower.y - 10
    );

    ctx.lineTo(
        tower.x - 10,
        tower.y + 20
    );

    ctx.closePath();

    ctx.fill();
    ctx.stroke();
  } else if (tower.type === "blast") {
    ctx.beginPath();

    for (let i = 0; i < 8; i++) {
      const angle =
          i *
          Math.PI /
          4;

      const radius =
          i % 2 === 0
              ? 22
              : 12;

      const x =
          tower.x +
          Math.cos(angle) *
          radius;

      const y =
          tower.y +
          Math.sin(angle) *
          radius;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.closePath();

    ctx.fill();
    ctx.stroke();
  } else if (tower.type === "singularity") {
    ctx.beginPath();
    ctx.arc(tower.x, tower.y, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(tower.x, tower.y, 13, 0, Math.PI * 2);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = type.color;
    ctx.beginPath();
    ctx.arc(tower.x, tower.y, 5, 0, Math.PI * 2);
    ctx.fill();
  } else if (tower.type === "arc") {
    ctx.beginPath();

    ctx.moveTo(
        tower.x,
        tower.y - 22
    );

    ctx.lineTo(
        tower.x + 15,
        tower.y + 16
    );

    ctx.lineTo(
        tower.x - 15,
        tower.y + 16
    );

    ctx.closePath();

    ctx.fill();
    ctx.stroke();
  } else {
    ctx.beginPath();

    ctx.arc(
        tower.x,
        tower.y,
        20,
        0,
        Math.PI * 2
    );

    ctx.fill();
    ctx.stroke();
  }

  ctx.shadowBlur = 0;

  /*
   * Центральная точка жизней.
   */
  ctx.fillStyle =
      type.color;

  ctx.beginPath();

  ctx.arc(
      tower.x,
      tower.y,
      6,
      0,
      Math.PI * 2
  );

  ctx.fill();

  ctx.restore();



}


/* =========================================================
   ВРАГИ
========================================================= */

function drawEnemy(enemy) {
  if (enemy.dead) return;

  const hpPercent = Math.max(0, enemy.hp / enemy.maxHp);
  const type = enemy.enemyType || getEnemyType(enemy.waveNumber);

  ctx.save();
  ctx.shadowBlur = 14;
  ctx.shadowColor = type.glow;
  ctx.fillStyle = "#20111d";
  ctx.strokeStyle = type.color;
  ctx.lineWidth = 2;
  drawEnemyShape(enemy.x, enemy.y, enemy.radius, type.shape);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.fillStyle = type.color;
  ctx.beginPath();
  ctx.arc(enemy.x, enemy.y, 3.5, 0, Math.PI * 2);
  ctx.fill();

  const barWidth = 30, barHeight = 4;
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(enemy.x - barWidth / 2, enemy.y - 23, barWidth, barHeight);
  ctx.fillStyle = type.color;
  ctx.fillRect(enemy.x - barWidth / 2, enemy.y - 23, barWidth * hpPercent, barHeight);
  ctx.restore();
}


/* =========================================================
   СНАРЯДЫ
========================================================= */

function drawProjectile(projectile) {
  ctx.save();

  ctx.shadowBlur = 15;
  ctx.shadowColor =
      projectile.color;

  ctx.fillStyle =
      projectile.color;

  ctx.beginPath();

  ctx.arc(
      projectile.x,
      projectile.y,
      4,
      0,
      Math.PI * 2
  );

  ctx.fill();

  ctx.restore();
}


/* =========================================================
   ЭФФЕКТЫ
========================================================= */

function drawEffects() {
  for (const effect of state.effects) {
    const alpha =
        effect.life /
        effect.maxLife;

    ctx.save();

    if (
        effect.type ===
        "explosion"
    ) {
      ctx.globalAlpha =
          alpha;

      ctx.strokeStyle =
          effect.color;

      ctx.lineWidth = 3;

      ctx.shadowBlur = 15;
      ctx.shadowColor =
          effect.color;

      ctx.beginPath();

      ctx.arc(
          effect.x,
          effect.y,
          effect.radius,
          0,
          Math.PI * 2
      );

      ctx.stroke();
    }

    if (
        effect.type ===
        "lightning"
    ) {
      ctx.globalAlpha =
          alpha;

      ctx.strokeStyle =
          "#fff6a0";

      ctx.shadowBlur = 15;
      ctx.shadowColor =
          "#ffe66d";

      ctx.lineWidth = 3;

      ctx.beginPath();

      ctx.moveTo(
          effect.x1,
          effect.y1
      );

      const midX =
          (effect.x1 +
              effect.x2) /
          2;

      const midY =
          (effect.y1 +
              effect.y2) /
          2;

      ctx.lineTo(
          midX + 10,
          midY - 10
      );

      ctx.lineTo(
          effect.x2,
          effect.y2
      );

      ctx.stroke();
    }

    if (effect.type === "place") {
      ctx.globalAlpha = Math.max(0, effect.life / effect.maxLife);
      const progress = 1 - effect.life / effect.maxLife;
      ctx.strokeStyle = effect.color || "#63e6ff";
      ctx.lineWidth = 3;
      ctx.shadowBlur = 18; ctx.shadowColor = effect.color || "#63e6ff";
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, 10 + progress * 30, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (effect.type === "cash") {
      ctx.globalAlpha = alpha;
      ctx.font = "800 16px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#ffd36a";
      ctx.shadowBlur = 12;
      ctx.shadowColor = "#ffb52e";
      ctx.fillText(`+$${effect.amount}`, effect.x, effect.y);
    }

    ctx.restore();
  }
}


function drawTowerUpgradeVisual(tower, type) {
  const damageLevel = tower.damageLevel || 1;
  const rangeLevel = tower.rangeLevel || 1;
  const speedLevel = tower.speedLevel || 1;
  const levels = [damageLevel, rangeLevel, speedLevel];
  const colors = ["#ff4055", "#ffd43b", "#35d9ff"];
  const selected = tower === state.selectedTower;
  const allMax = levels.every(level => level >= MAX_UPGRADE_LEVEL);

  ctx.save();

  // Цвета находятся внутри корпуса самой башни, а не на радиусе атаки.
  ctx.globalCompositeOperation = "source-atop";

  if (allMax) {
    const greenGlow = ctx.createRadialGradient(
        tower.x, tower.y, 2,
        tower.x, tower.y, 25
    );
    greenGlow.addColorStop(0, "rgba(90, 255, 130, 0.95)");
    greenGlow.addColorStop(0.55, "rgba(40, 220, 100, 0.72)");
    greenGlow.addColorStop(1, "rgba(40, 220, 100, 0)");

    ctx.fillStyle = greenGlow;
    ctx.fillRect(tower.x - 25, tower.y - 25, 50, 50);
  } else {
    const offsets = [
      [-9, 4],
      [0, -9],
      [9, 4]
    ];

    levels.forEach((level, index) => {
      const progress = (level - 1) / (MAX_UPGRADE_LEVEL - 1);
      if (progress <= 0) {
        return;
      }
      const [ox, oy] = offsets[index];
      const gradient = ctx.createRadialGradient(
          tower.x + ox, tower.y + oy, 1,
          tower.x + ox, tower.y + oy, 18
      );

      gradient.addColorStop(0, `${colors[index]}${Math.round(85 + progress * 115).toString(16).padStart(2, "0")}`);
      gradient.addColorStop(0.5, `${colors[index]}55`);
      gradient.addColorStop(1, `${colors[index]}00`);

      ctx.fillStyle = gradient;
      ctx.fillRect(tower.x - 25, tower.y - 25, 50, 50);
    });
  }

  ctx.globalCompositeOperation = "source-over";

  // Три маленьких энергетических индикатора встроены в корпус.
  if (!allMax) {
    levels.forEach((level, index) => {
      const angle = [-2.5, -Math.PI / 2, -0.64][index];
      const distanceFromCenter = 13;
      const x = tower.x + Math.cos(angle) * distanceFromCenter;
      const y = tower.y + Math.sin(angle) * distanceFromCenter;
      const progress = clamp(level / MAX_UPGRADE_LEVEL, 0.2, 1);

      ctx.shadowBlur = selected ? 10 : 6;
      ctx.shadowColor = colors[index];
      ctx.fillStyle = colors[index];
      ctx.globalAlpha = 0.35 + progress * 0.65;
      ctx.beginPath();
      ctx.arc(x, y, 2.2 + progress * 1.5, 0, Math.PI * 2);
      ctx.fill();
    });
  } else {
    ctx.shadowBlur = 18;
    ctx.shadowColor = "#5cff8d";
    ctx.fillStyle = "#5cff8d";
    ctx.globalAlpha = 0.95;
    ctx.beginPath();
    ctx.arc(tower.x, tower.y, 7, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawRangeUpgradePreview(tower, type) {
  const rangeLevel = tower.rangeLevel || 1;
  if (rangeLevel >= MAX_UPGRADE_LEVEL) return;

  const stats = getTowerStats(tower);
  const currentRange = stats.range;
  const nextRange = type.range + rangeLevel * 15;

  ctx.save();

  // Текущий радиус — тонкий спокойный контур.
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = '#ffd43b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(tower.x, tower.y, currentRange, 0, Math.PI * 2);
  ctx.stroke();

  // Новый радиус — яркий пунктир, чтобы сразу видеть прибавку.
  ctx.globalAlpha = 0.75;
  ctx.strokeStyle = '#fff0a6';
  ctx.lineWidth = 2.5;
  ctx.setLineDash([8, 7]);
  ctx.beginPath();
  ctx.arc(tower.x, tower.y, nextRange, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Лёгкая подсветка только дополнительной области.
  ctx.globalAlpha = 0.055;
  ctx.fillStyle = '#ffd43b';
  ctx.beginPath();
  ctx.arc(tower.x, tower.y, nextRange, 0, Math.PI * 2);
  ctx.arc(tower.x, tower.y, currentRange, 0, Math.PI * 2, true);
  ctx.fill('evenodd');

  ctx.restore();
}

/* =========================================================
   ПРЕДПРОСМОТР УСТАНОВКИ
========================================================= */

function drawPlacementPreview() {
  if (state.selectedTower || !state.previewValid && !state.previewX && !state.previewY) {
    return;
  }

  const type = towerTypes[state.selectedType];
  if (!type) return;

  const x = state.previewX;
  const y = state.previewY;
  const valid = canPlaceTower(x, y);
  const alpha = valid ? 0.5 : 0.18;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = type.color;
  ctx.strokeStyle = valid ? type.color : "#ff5577";
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.arc(x, y, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.globalAlpha = 0.08;
  ctx.beginPath();
  ctx.arc(x, y, type.range, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = valid ? type.color : "#ff5577";
  ctx.beginPath();
  ctx.arc(x, y, type.range, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/* =========================================================
   ОТРИСОВКА
========================================================= */

function draw() {
  ctx.clearRect(
      0,
      0,
      GAME_WIDTH,
      GAME_HEIGHT
  );

  drawBackground();

  drawRoad();

  drawCore();

  for (const tower of state.towers) {
    drawTower(tower);
  }

  for (const enemy of state.enemies) {
    drawEnemy(enemy);
  }

  for (const projectile of state.projectiles) {
    drawProjectile(projectile);
  }

  drawPlacementPreview();
  drawEffects();
}


/* =========================================================
   ИГРОВОЙ ЦИКЛ
========================================================= */

function update(dt) {
  updateWave(dt);

  for (const enemy of state.enemies) {
    updateEnemy(
        enemy,
        dt
    );
  }

  updateTowers(dt);

  for (const projectile of state.projectiles) {
    updateProjectile(
        projectile,
        dt
    );
  }

  updateEffects(dt);

  state.enemies =
      state.enemies.filter(
          enemy =>
              !enemy.dead ||
              enemy.hp > 0
      );

  state.projectiles =
      state.projectiles.filter(
          projectile =>
              !projectile.dead
      );
}

function gameLoop(timestamp) {
  if (!state.lastTime) {
    state.lastTime =
        timestamp;
  }

  let dt =
      (timestamp -
          state.lastTime) /
      1000;

  state.lastTime =
      timestamp;

  dt = Math.min(
      dt,
      0.05
  );

  if (
      !state.paused &&
      !state.gameOver
  ) {
    update(
        dt *
        state.speed
    );
  }

  draw();

  updateUi();

  requestAnimationFrame(
      gameLoop
  );
}


/* =========================================================
   КОНЕЦ ИГРЫ
========================================================= */

function endGame(win) {
  if (state.gameOver) {
    return;
  }

  state.gameOver = true;

  state.waveActive = false;
  state.spawning = false;

  if (win) {
    endTitle.textContent =
        "Победа!";

    endText.textContent =
        `Все ${state.maxWaves} волн уничтожены. Сбито врагов: ${state.kills}.`;
  } else {
    ensureAudio();
    playDefeatSound();

    endTitle.textContent =
        "Игра окончена";

    endText.textContent =
        `Жизни закончились. Сбито врагов: ${state.kills}.`;
  }

  endModal.classList.remove(
      "hidden"
  );
}

function selectDifficulty(difficultyId) {
  if (!difficulties[difficultyId]) {
    return;
  }

  currentDifficulty = difficultyId;

  document
      .querySelectorAll(".difficulty-card")
      .forEach(card => {
        card.classList.toggle(
            "active",
            card.dataset.difficulty === difficultyId
        );
      });

  if (selectedDifficultyNameEl) {
    selectedDifficultyNameEl.textContent =
        difficulties[difficultyId].name;
  }
}

function selectMap(mapId) {
  if (!maps[mapId]) {
    return;
  }

  currentMap = mapId;
  path = maps[mapId].path;
  PATH_LENGTH = totalPathLength();

  document
      .querySelectorAll(".map-card")
      .forEach(card => {
        card.classList.toggle(
            "active",
            card.dataset.map === mapId
        );
      });

  if (selectedMapNameEl) {
    selectedMapNameEl.textContent = maps[mapId].name;
  }
}

const SAVE_KEY = "neonBridgeDefenseSave_v5";
const LEGACY_SAVE_KEYS = [
  "neonBridgeDefenseSave_v4",
  "neonBridgeDefenseSave_v3"
];
let hasStartedGame = false;

// Старое сохранение предыдущей версии не считается активным прогрессом.
// Это важно для первого запуска новой версии: «Продолжить игру» не появляется
// только потому, что браузер сохранил тестовое состояние старой версии.
try {
  for (const legacyKey of LEGACY_SAVE_KEYS) {
    localStorage.removeItem(legacyKey);
  }
} catch (error) {
  // LocalStorage может быть недоступен — игра продолжает работать.
}

function hasSavedGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) {
      return false;
    }

    const save = JSON.parse(raw);

    // Сохранением считается только реально созданный во время игры
    // файл. Пустое состояние меню никогда не даёт кнопку «Продолжить».
    return !!(
      save &&
      save.version === 5 &&
      save.startedByUser === true &&
      save.sessionId
    );
  } catch (error) {
    return false;
  }
}

function saveGame() {
  // Не создаём сохранение, пока пользователь ни разу не запускал игру.
  // Это позволяет показывать «Начать игру» при первом входе в меню.
  if (!hasStartedGame) {
    return false;
  }

  try {
    const save = {
      version: 5,
      startedByUser: true,
      sessionId: hasStartedGame ? (state.sessionId || "active") : "active",
      money: state.money,
      lives: state.lives,
      wave: state.wave,
      kills: state.kills,
      towers: state.towers,
      enemies: state.enemies,
      waveActive: state.waveActive,
      spawning: state.spawning,
      spawnTimer: state.spawnTimer,
      enemiesToSpawn: state.enemiesToSpawn,
      enemiesSpawned: state.enemiesSpawned,
      nextWaveTimer: state.nextWaveTimer,
      queuedWaves: 0,
      activeWaves: state.activeWaves.map(wave => ({ ...wave })),
      speed: state.speed,
      currentMap,
      currentDifficulty
    };

    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    updateResumeButton();
    return true;
  } catch (error) {
    return false;
  }
}

function clearSavedGame() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch (error) {
    // LocalStorage может быть недоступен — игра всё равно работает.
  }
  updateResumeButton();
}

function updateResumeButton() {
  const exists = hasSavedGame();
  if (exists) {
    startGameBtn.textContent = "Продолжить игру";
    newGameBtn?.classList.remove("hidden");
  } else {
    startGameBtn.textContent = "Новая игра";
    newGameBtn?.classList.add("hidden");
  }
}

function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;

    const save = JSON.parse(raw);
    if (
      !save ||
      save.version !== 5 ||
      save.startedByUser !== true ||
      !save.sessionId
    ) {
      return false;
    }

    currentMap = maps[save.currentMap] ? save.currentMap : "ridge";
    currentDifficulty = difficulties[save.currentDifficulty] ? save.currentDifficulty : "normal";
    path = maps[currentMap].path;
    PATH_LENGTH = totalPathLength();

    state.money = Number.isFinite(save.money) ? save.money : 170;
    state.lives = Number.isFinite(save.lives) ? save.lives : 12;
    state.wave = Number.isFinite(save.wave) ? save.wave : 0;
    state.kills = Number.isFinite(save.kills) ? save.kills : 0;
    state.towers = Array.isArray(save.towers) ? save.towers : [];
    state.enemies = Array.isArray(save.enemies) ? save.enemies : [];
    state.projectiles = [];
    state.effects = [];
    state.waveActive = !!save.waveActive;
    state.spawning = !!save.spawning;
    state.spawnTimer = Number.isFinite(save.spawnTimer) ? save.spawnTimer : 0;
    state.enemiesToSpawn = Number.isFinite(save.enemiesToSpawn) ? save.enemiesToSpawn : 0;
    state.enemiesSpawned = Number.isFinite(save.enemiesSpawned) ? save.enemiesSpawned : 0;
    state.nextWaveTimer = Number.isFinite(save.nextWaveTimer) ? save.nextWaveTimer : 2.25;
    state.queuedWaves = Number.isFinite(save.queuedWaves) ? clamp(save.queuedWaves, 0, 9) : 0;
    state.speed = [1, 2, 3].includes(save.speed) ? save.speed : 1;
    state.sessionId = save.sessionId;
    state.selectedType = "pulse";
    state.selectedTower = null;
    state.previewValid = false;
    state.paused = false;
    state.gameOver = false;

    selectDifficulty(currentDifficulty);
    selectMap(currentMap);
    speedBtn.textContent = `x${state.speed}`;
    pauseBtn.textContent = "Пауза";
    pauseOverlay?.classList.add("hidden");
    endModal.classList.add("hidden");
    document.querySelectorAll(".tower-card").forEach(card => {
      card.classList.toggle("active", card.dataset.tower === "pulse");
    });
    waveNameEl.textContent = state.waveActive ? `Волна ${state.wave}` : "Готовность";
    hasStartedGame = true;
    setHint("Прогресс восстановлен. Игра продолжается.");
    updateUi();
    return true;
  } catch (error) {
    return false;
  }
}

function showMainMenu() {
  if (!state.gameOver) {
    saveGame();
  }
  state.paused = true;
  endModal.classList.add("hidden");
  gameScreen.classList.add("hidden");
  mainMenu.classList.remove("hidden");
  updateResumeButton();
}

function startGame() {
  ensureAudio();
  if (hasSavedGame()) {
    if (!loadGame()) {
      clearSavedGame();
      restartGame();
    }
  } else {
    restartGame();
    state.sessionId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
  hasStartedGame = true;
  state.paused = false;
  state.lastTime = performance.now();
  mainMenu.classList.add("hidden");
  gameScreen.classList.remove("hidden");
}

function startNewGame() {
  ensureAudio();
  clearSavedGame();
  restartGame();
  state.sessionId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  hasStartedGame = true;
  state.paused = false;
  state.lastTime = performance.now();
  mainMenu.classList.add("hidden");
  gameScreen.classList.remove("hidden");
}

function restartGame() {
  state.sessionId = state.sessionId || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  state.money = 170;
  state.lives = 12;

  state.wave = 0;
  state.kills = 0;

  state.towers = [];
  state.enemies = [];
  state.projectiles = [];
  state.effects = [];

  state.selectedType =
      "pulse";

  path = maps[currentMap].path;
  PATH_LENGTH = totalPathLength();

  state.selectedTower =
      null;

  state.waveActive =
      false;

  state.spawning =
      false;

  state.spawnTimer = 0;
  state.enemiesToSpawn = 0;
  state.enemiesSpawned = 0;
  state.nextWaveTimer = 1.25;
  state.activeWaves = [];
  state.queuedWaves = 0;

  state.paused = false;
  state.speed = 1;

  state.gameOver = false;

  pauseBtn.textContent =
      "Пауза";

  if (pauseOverlay) {
    pauseOverlay.classList.add("hidden");
  }

  speedBtn.textContent =
      "x1";

  endModal.classList.add(
      "hidden"
  );

  document
      .querySelectorAll(
          ".tower-card"
      )
      .forEach(card => {
        card.classList.toggle(
            "active",
            card.dataset.tower ===
            "pulse"
        );
      });

  waveNameEl.textContent =
      "Готовность";

  setHint(
      "Выберите башню справа, затем поставьте её вне дороги."
  );

  updateUi();
}


/* =========================================================
   ЗАПУСК
========================================================= */

selectDifficulty(currentDifficulty);
selectMap(currentMap);

setHint(
    "Выберите башню справа, затем поставьте её вне дороги."
);

updateUi();

// Главное меню открывается при запуске.
gameScreen.classList.add("hidden");
mainMenu.classList.remove("hidden");
updateResumeButton();

requestAnimationFrame(
    gameLoop
);