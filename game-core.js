const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const moneyEl = document.getElementById("money");
const livesEl = document.getElementById("lives");
const waveEl = document.getElementById("wave");
const killsEl = document.getElementById("kills");

const hintEl = document.getElementById("hint");
const towerList = document.getElementById("towerList");
const boostList = document.getElementById("boostList");
const towersTab = document.getElementById("towersTab");
const boostsTab = document.getElementById("boostsTab");
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
const devUnlockAllBtn = document.getElementById("devUnlockAllBtn");
const adRewardBtn = document.getElementById("adRewardBtn");

/* ---- Локализация (i18n.js, требование 2.14 Яндекс.Игр) ------------------
   tl() — быстрый перевод строки по ключу; при отсутствии i18n.js возвращает
   ключ, поэтому игра не ломается. applyDataI18n() подставляет имена и
   описания башен/комбо/карт/сложностей из словаря текущего языка. */
const tl = (key, params) =>
  (window.NeonI18N && typeof window.NeonI18N.t === "function")
    ? window.NeonI18N.t(key, params)
    : key;

function applyDataI18n() {
  const N = window.NeonI18N;
  if (!N || typeof N.has !== "function") return;

  const override = (obj, field, key) => {
    if (obj && N.has(key)) obj[field] = N.t(key);
  };

  for (const id in towerTypes) {
    const tw = towerTypes[id];
    override(tw, "name", "data.tower." + id + ".name");
    override(tw, "description", "data.tower." + id + ".desc");
    if (tw.combo) {
      override(tw.combo, "name", "data.combo." + id + ".name");
      override(tw.combo, "description", "data.combo." + id + ".desc");
    }
  }

  for (const id of ["ridge", "circuit", "coreline"]) {
    override(maps[id], "name", "data.map." + id + ".name");
    override(maps[id], "description", "data.map." + id + ".desc");
  }

  for (const id in difficulties) {
    override(difficulties[id], "name", "data.diff." + id + ".name");
  }
}

if (window.NeonI18N && typeof window.NeonI18N.onChange === "function") {
  window.NeonI18N.onChange(() => {
    applyDataI18n();
    try { renderMapCards(); } catch (e) {}
    try { updateTowerAvailability(); } catch (e) {}
    try { updateUi(); } catch (e) {}
    try { updateResumeButton(); } catch (e) {}
    try {
      if (typeof refreshAdRewardLabel === "function") refreshAdRewardLabel();
    } catch (e) {}
  });
}

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
const SPEED_OVERDRIVE_DURATION = 5;
const SPEED_OVERDRIVE_SHAKE_DURATION = SPEED_OVERDRIVE_DURATION;
const COMBO_RADIUS = 92;
const COMBO_CHECK_INTERVAL = 5;

// DEV-режим: по клику открывает ВСЕ башни и модули поддержки (обход
// волновых отпираний) + выдаёт бесконечные деньги для тестов. Вне платформы.
let DEV_ALL_UNLOCKED = false;
const TEST_MONEY = 999999999;

/* =========================================================
    БАЛАНС — полностью перенесён из Onslaught 2.2 (slipcor/gaby):
    базовые таблицы урона/дальности/скорострельности и цены апгрейдов —
    из официального FAQ (Noober/Oxy, playr.co.uk, 2007–2009, версии 2.1x–2.2),
    механика модерификаторов — со справочных страниц игры.

    Структура типа:
      dmgTiers/rngTiers/rateTiers — значения по уровням 1..N (level > N — максимум);
      upgDmg/upgRng/upgRate       — стоимость каждого следующего уровня;
      rateTiers — очки скорострельности (ROF points), интервал = rofK / pts;
      unlockWave                  — отпирать по НОМЕРУ ВОЛНЫ текущего забега
                                    (v59.15; как волновые отпирания в оригинале).
    Адаптированные (в оригинале не документированы поминутно): rail, цены
    апгрейдов продвинутых турелей, стартовые деньги ($300). Награда за фрага —
    линейно по номеру волны (моб на волне N = $N), как в оригинале. Комбо и
    мины нанесают фиксированный урон от прокачки башни, а НЕ процент от maxHp
    врага (иначе одна башня «стирала» поздние волны и печатала деньги).
    Всё остальное — дословные числа Onslaught 2.2.
========================================================= */
const towerTypes = {
  // v59.20: «тайные» башни и усилители — сетка открытия каждые 30 волн
  // (30/60/…/330) и цена по той же дуге: до 30-й видна только база (5 башен).
  booster: {
    name: "Усилитель", cost: 2400, unlockWave: 120, damage: 0, range: 145, fireRate: 999, color: "#74c476",
    description: "+40% урон (Damage+)",
    support: { dmgPct: 0.40 }
  },
  overcharger: {
    name: "Разгонщик", cost: 3000, unlockWave: 150, damage: 0, range: 120, fireRate: 999, color: "#5b9fd6",
    description: "+120% скорость (Rate+)",
    support: { ratePct: 1.20 }
  },
  range_amp: {
    name: "Дальний модуль", cost: 900, unlockWave: 30, damage: 0, range: 175, fireRate: 999, color: "#8fd0e8",
    description: "+100% радиус (Range+)",
    support: { rngPct: 1.00 }
  },
  reactor: {
    name: "Реактор", cost: 4600, unlockWave: 210, damage: 0, range: 155, fireRate: 999, color: "#e8b64c",
    description: "+100% урон (Damage++)",
    support: { dmgPct: 1.00 }
  },
  nexus: {
    name: "Нексус", cost: 3800, unlockWave: 180, damage: 0, range: 210, fireRate: 999, color: "#eec76a",
    description: "+100% урон, −30% радиус и скорость (Big Dmg Exch.)",
    support: { dmgPct: 1.00, rngPct: -0.30, ratePct: -0.30 }
  },
  rate_xchg: {
    name: "Частотник", cost: 1400, unlockWave: 60, damage: 0, range: 120, fireRate: 999, color: "#e8a04c",
    description: "+60% скорость, −40% урон, −10% радиус (Rate Exch.)",
    support: { ratePct: 0.60, dmgPct: -0.40, rngPct: -0.10 }
  },
  range_xchg: {
    name: "Ретранслятор", cost: 1900, unlockWave: 90, damage: 0, range: 160, fireRate: 999, color: "#cf8e97",
    description: "+100 радиус, −25% скорость (Range Exch.)",
    support: { rngFlat: 100, ratePct: -0.25 }
  },

  // ── БАЗА: Cannon(син.) / Laser(зел.) / Rocket(кр.) / Tazer(жёлт.) + наш рейл ──
  pulse: {
    name: "Импульс",
    cost: 100,
    color: "#74c476",
    projectileSpeed: 500,
    rofK: 45,
    // Onslaught Cannon (Blue): урон 15→46000, 10 уровней.
    dmgTiers: [15, 30, 60, 150, 400, 1200, 3100, 8500, 18400, 46000],
    rngTiers: [130, 140, 150, 165, 180, 220],
    rateTiers: [100, 110, 125, 140, 160, 180, 200, 240],
    upgDmg: [20, 50, 100, 250, 600, 1000, 1100, 1200, 1500],
    upgRng: [30, 100, 200, 500, 950],
    upgRate: [50, 150, 300, 450, 950, 1000, 1450],
    freakout: true,          // «Freak Out» оригинала: ×4 темп, ×3 урон, ~5 c
    damage: 15, range: 130, fireRate: 0.45,
    description: "скорострельная, короткая дистанция",
    combo: { chance: 0.40, cooldown: 5, name: "Мины", description: "40% шанс каждые 5 секунд установить мину на дороге" }
  },

  rail: {
    name: "Рельсотрон",
    cost: 250,
    color: "#5b9fd6",
    projectileSpeed: 1200,
    rofK: 78,
    // Адаптация «раннего снайпера» (оригинальные снайперы открываются поздно).
    dmgTiers: [200, 500, 1250, 3000, 7500, 18000],
    rngTiers: [300, 330, 365, 400, 450],
    rateTiers: [33, 35, 39, 42, 45, 50],
    upgDmg: [60, 120, 240, 480, 960],
    upgRng: [40, 100, 250, 500, 900],
    upgRate: [70, 140, 280, 560, 1120],
    damage: 200, range: 300, fireRate: 2.36,
    description: "дальняя дистанция",
    combo: { chance: 0.35, cooldown: 5, name: "Пробой", description: "35% шанс каждые 5 секунд пробить несколько самых опасных врагов" }
  },

  frost: {
    name: "Криоузел",
    cost: 150,
    color: "#8fd0e8",
    projectileSpeed: 450,
    rofK: 40,
    // Onslaught Tazer (Yellow): яд-замедление, сила яда растёт с уроном.
    dmgTiers: [50, 75, 125, 200, 800, 3500, 11000, 30000],
    rngTiers: [65, 75, 85, 105, 130, 155],
    rateTiers: [60, 70, 80, 90, 100, 120, 150, 180],
    upgDmg: [40, 80, 190, 300, 600, 1000, 1100],
    upgRng: [50, 100, 300, 600, 1000],
    upgRate: [50, 100, 225, 390, 650, 1100, 1450],
    freakout: true,          // у Tazer freakout ещё и усиливает яд
    slow: 0.45,
    slowTime: 1.5,
    damage: 50, range: 65, fireRate: 0.67,
    description: "замедляет врагов",
    combo: { chance: 0.45, cooldown: 5, name: "Крио-волна", description: "45% шанс каждые 5 секунд заморозить группу врагов" }
  },

  blast: {
    name: "Разлом",
    cost: 200,
    color: "#df6a5f",
    projectileSpeed: 380,
    rofK: 65,
    // Onslaught Rocket (Red): самый сильный, дорогой в прокачке, Holding Pattern.
    dmgTiers: [50, 120, 350, 800, 1950, 6050, 11500, 27000, 48900, 65000],
    rngTiers: [190, 210, 220, 230, 250, 275, 300, 325, 350],
    rateTiers: [50, 60, 70, 85, 100, 115, 135, 155, 180, 210],
    upgDmg: [50, 100, 200, 350, 650, 1200, 1200, 1300, 1500, 1500],
    upgRng: [35, 80, 160, 400, 900, 1100, 1300, 1500],
    upgRate: [30, 60, 115, 200, 340, 600, 900, 1050, 1150],
    holding: true,           // « Holding Pattern»: 3 апдейса дальности + 3 темпа
    splash: 44,
    damage: 50, range: 190, fireRate: 1.3,
    description: "урон по области",
    combo: { chance: 0.35, cooldown: 6, name: "Метеор", description: "35% шанс вызвать мощный взрыв на случайном участке дороги" }
  },

  arc: {
    name: "Дуга",
    cost: 125,
    color: "#e8b64c",
    projectileSpeed: 650,
    rofK: 54,
    // Onslaught Laser (Green): дешевле всех в прокачке, линкуется в цепь.
    dmgTiers: [25, 50, 120, 400, 1500, 3900, 9300, 19500, 35000],
    rngTiers: [100, 110, 125, 140, 160, 180, 205, 230, 255, 285, 320],
    rateTiers: [60, 65, 70, 80, 90, 105, 120, 135, 160, 190],
    upgDmg: [20, 50, 125, 300, 700, 850, 950, 1000],
    upgRng: [15, 25, 40, 65, 105, 170, 275, 445, 720, 1100],
    upgRate: [30, 75, 180, 300, 450, 600, 800, 900, 1000],
    laserChain: true,        // линк: (урон_цепи + урон соседа) × 1.25 за каждое звено
    damage: 25, range: 100, fireRate: 0.9,
    description: "связывается в лазерную цепь",
    combo: { chance: 0.35, cooldown: 6, name: "Цепная буря", description: "35% шанс поразить цепью до 6 врагов" }
  },

  // ── ПРОДВИНУТЫЕ: Sniper / Fusion / Railgun / Combonly (цена и $ из FAQ) ──
  titan: {
    name: "Титан",
    cost: 8200,
    unlockWave: 300,
    color: "#e08b52",
    projectileSpeed: 760,
    rofK: 170,
    // Onslaught Fusion: копит урон простаивающих лазеров/тейзеров рядом.
    dmgTiers: [1000000, 3000000, 10000000, 35000000],
    rngTiers: [210, 240],
    rateTiers: [50, 55, 60, 66],
    upgDmg: [1500, 3000, 6000, 12000],
    upgRng: [800, 1600],
    upgRate: [700, 1400, 2800],
    fusion: true,
    splash: 42,
    damage: 1000000, range: 210, fireRate: 3.4,
    description: "поглощает урон соседей-лазеров",
    combo: { chance: 0.30, cooldown: 7, name: "Орбитальный удар", description: "30% шанс обрушить удар на самую плотную группу" }
  },

  nova: {
    name: "Нова",
    cost: 9800,
    unlockWave: 330,
    color: "#eef1f7",
    projectileSpeed: 1400,
    rofK: 150,
    // Onslaught Railgun: пробивает несколько врагов одним выстрелом.
    dmgTiers: [4000000, 9000000, 15000000, 25000000],
    rngTiers: [440, 480],
    rateTiers: [60, 66, 72],
    upgDmg: [1200, 2400, 4800, 9600],
    upgRng: [900, 1800],
    upgRate: [500, 1000, 2000],
    pierce: true,
    damage: 4000000, range: 440, fireRate: 2.5,
    description: "пробивает строй насквозь",
    combo: { chance: 0.25, cooldown: 8, name: "Сверхновая", description: "25% шанс нанести урон всем врагам на дороге" }
  },

  devastator: {
    name: "Опустошитель",
    cost: 5600,
    unlockWave: 240,
    color: "#c9504f",
    projectileSpeed: 2400,
    rofK: 168,
    // Onslaught Sniper: 3M→55M по одной цели, медленный, огромный радиус.
    dmgTiers: [3000000, 7000000, 15000000, 55000000],
    rngTiers: [420],
    rateTiers: [40, 44, 48, 52],
    upgDmg: [1000, 2000, 4000, 8000],
    upgRng: [],
    upgRate: [600, 1200, 2400],
    damage: 3000000, range: 420, fireRate: 4.2,
    description: "огромный урон одной цели",
    combo: { chance: 0.20, cooldown: 9, name: "Аннигиляция", description: "20% шанс сильно ослабить всех врагов" }
  },

  singularity: {
    name: "Нуль-коллайдер",
    cost: 6800,
    unlockWave: 270,
    color: "#eec76a",
    projectileSpeed: 520,
    rofK: 154,
    // Onslaught Combonly: сила зависит от прокачанных в максимум соседей.
    dmgTiers: [150000, 300000, 600000, 1200000],
    rngTiers: [320, 360, 400],
    rateTiers: [55, 60],
    upgDmg: [800, 1600, 3200, 6400],
    upgRng: [700, 1400, 2800],
    upgRate: [900, 1800],
    absorbs: true,           // +30% урона каждой «в максимум» базовой турели рядом
    splash: 70,
    damage: 150000, range: 320, fireRate: 2.8,
    description: "копирует мощь прокачанных соседей",
    combo: { chance: 0.15, cooldown: 10, name: "Сингулярность", description: "15% шанс создать чёрную дыру, разрушающую строй врагов" }
  }
};

const SUPPORT_TYPES = ["booster", "overcharger", "range_amp", "reactor", "nexus", "rate_xchg", "range_xchg"];
const ADVANCED_TYPES = ["titan", "nova", "devastator", "singularity"];


/* =========================================================
   СОСТОЯНИЕ
========================================================= */

const state = {
  money: 300,
  rating: 0,
  lives: 10,

  wave: 0,
  maxWaves: Infinity,

  kills: 0,

  towers: [],
  enemies: [],
  projectiles: [],
  effects: [],
  mines: [],

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

  lastTime: 0,
  comboCheckTimer: 0,
  comboReadyTowers: new Set()
};


/* =========================================================
   ДОРОГА
========================================================= */

const maps = {
  ridge: {
    name: "Первый мост",
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
      { x: 946, y: 220 }
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
      { x: 946, y: 500 }
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
      { x: 946, y: 300 }
    ]
  }
};

let currentMap = "ridge";
let path = maps[currentMap].path;

/* =========================================================
   ПОЛЬЗОВАТЕЛЬСКИЕ КАРТЫ (редактор editor.html) и SVG-превью
   Дороги в карточках меню рисуются по РЕАЛЬНОЙ геометрии
   маршрута каждой карты.
========================================================= */

const CUSTOM_MAPS_KEY = "neonBridgeDefenseMaps_v1";
const BUILTIN_MAP_IDS = Object.keys(maps);

function escapeHtmlText(s) {
  return String(s).replace(/[&<>"]/g, ch => (
    ch === "&" ? "&amp;" : ch === "<" ? "&lt;" : ch === ">" ? "&gt;" : "&quot;"
  ));
}

function sanitizeCustomPath(rawPath) {
  const out = [];
  if (!Array.isArray(rawPath)) return out;
  for (const p of rawPath) {
    if (!p) continue;
    const x = Number(p.x);
    const y = Number(p.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    out.push({
      x: Math.max(-60, Math.min(990, Math.round(x))),
      y: Math.max(30, Math.min(610, Math.round(y)))
    });
  }
  return out;
}

function readCustomMaps() {
  try {
    const raw = localStorage.getItem(CUSTOM_MAPS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    const out = [];
    for (const m of arr) {
      const id = m && typeof m.id === "string" ? m.id.slice(0, 40) : "";
      // Встроенные карты защищены от перезаписи пользовательскими.
      if (!/^cm_[a-z0-9_-]+$/i.test(id) || BUILTIN_MAP_IDS.indexOf(id) >= 0) continue;
      const cleanPath = sanitizeCustomPath(m.path);
      if (cleanPath.length < 2) continue;
      out.push({
        id,
        custom: true,
        name: String(m.name || tl("editor.defaultName")).slice(0, 28),
        description: String(m.description || tl("data.map.custom.desc")).slice(0, 60),
        path: cleanPath
      });
      if (out.length >= 12) break;
    }
    return out;
  } catch (error) {
    return [];
  }
}

function mergeCustomMaps() {
  for (const m of readCustomMaps()) maps[m.id] = m;
}

function writeCustomMaps(list) {
  try {
    localStorage.setItem(CUSTOM_MAPS_KEY, JSON.stringify(list));
  } catch (error) {
    /* LocalStorage может быть недоступен. */
  }
}

function deleteCustomMap(id) {
  writeCustomMaps(readCustomMaps().filter(m => m.id !== id));
  if (maps[id] && maps[id].custom) {
    delete maps[id];
    if (currentMap === id) {
      currentMap = "ridge";
      path = maps.ridge.path;
      PATH_LENGTH = totalPathLength();
    }
  }
  // «Могильная метка» удаления: не даёт карте вернуться из облака на других
  // устройствах, и облако обновляется сразу.
  try {
    const KEY_DEL = "neonBridgeDefenseMapsDeleted_v1";
    const tomb = JSON.parse(localStorage.getItem(KEY_DEL) || "[]");
    const arr = Array.isArray(tomb) ? tomb : [];
    if (id && arr.indexOf(id) < 0) {
      arr.push(String(id).slice(0, 40));
      localStorage.setItem(KEY_DEL, JSON.stringify(arr.slice(-60)));
    }
  } catch (error) { /* хранилище недоступно */ }
  try { window.NeonBridgeYandex && window.NeonBridgeYandex.pushCloudMaps && window.NeonBridgeYandex.pushCloudMaps(); } catch (e) {}
  renderMapCards();
  selectMap(currentMap);
}

function mapPreviewSVG(mapPath) {
  const pts = mapPath
    .map(p => `${Math.max(0, Math.min(1000, p.x))},${Math.max(0, Math.min(640, p.y))}`)
    .join(" ");
  const s = mapPath[0];
  const e = mapPath[mapPath.length - 1];
  const ex = Math.max(40, Math.min(960, e.x));
  return (
    '<svg viewBox="0 0 1000 640" preserveAspectRatio="xMidYMid meet" aria-hidden="true">' +
    `<polyline points="${pts}" fill="none" stroke="#74c476" stroke-opacity=".14" stroke-width="76" stroke-linejoin="round" stroke-linecap="round"/>` +
    `<polyline points="${pts}" fill="none" stroke="#45577e" stroke-opacity=".9" stroke-width="30" stroke-linejoin="round" stroke-linecap="round"/>` +
    `<polyline points="${pts}" fill="none" stroke="#eef1f7" stroke-width="7" stroke-linejoin="round" stroke-linecap="round" stroke-dasharray="28 18"/>` +
    `<circle cx="${Math.max(14, s.x)}" cy="${s.y}" r="30" fill="#1f2638" stroke="#5b9fd6" stroke-width="11"/>` +
    `<circle cx="${ex}" cy="${e.y}" r="60" fill="rgba(223,106,95,.16)"/>` +
    `<circle cx="${ex}" cy="${e.y}" r="30" fill="#1a1330" stroke="#df6a5f" stroke-width="11"/>` +
    "</svg>"
  );
}

function renderMapCards() {
  if (!mapList) return;
  const stored = readCustomMaps();
  for (const m of stored) maps[m.id] = m;
  // Карты, удалённые в редакторе, вычищаем и из памяти.
  for (const id of Object.keys(maps)) {
    if (maps[id].custom && !stored.some(s => s.id === id)) delete maps[id];
  }
  const ids = BUILTIN_MAP_IDS.slice();
  for (const m of stored) {
    if (ids.indexOf(m.id) < 0) ids.push(m.id);
  }
  if (!maps[currentMap]) {
    currentMap = "ridge";
    path = maps.ridge.path;
    PATH_LENGTH = totalPathLength();
  }

  let html = "";
  for (const id of ids) {
    const m = maps[id];
    if (!m) continue;
    html +=
      `<button class="map-card${id === currentMap ? " active" : ""}" data-map="${id}" type="button">` +
      `<span class="map-preview real">${mapPreviewSVG(m.path)}</span>` +
      `<span><b>${escapeHtmlText(m.name)}</b><small>${escapeHtmlText(m.description || "")}</small></span>` +
      (m.custom ? `<span class="map-card-del" data-del-map="${id}" title="${escapeHtmlText(tl("ui.deleteMap"))}">&#10005;</span>` : "") +
      "</button>";
  }
  html +=
    '<button class="map-card map-card-new" data-open-editor="1" type="button" title="' + escapeHtmlText(tl("ui.editorBtnTitle")) + '">' +
    '<span class="map-preview map-preview-new">+</span>' +
    `<span><b>${escapeHtmlText(tl("ui.customNewCard"))}</b><small>${escapeHtmlText(tl("ui.openEditor"))}</small></span></button>`;
  mapList.innerHTML = html;
  if (selectedMapNameEl && maps[currentMap]) {
    selectedMapNameEl.textContent = maps[currentMap].name;
  }
}

/* Редактор открывается в ЭТОЙ ЖЕ вкладке (не popup): всплывающие окна
   блокируются песочницей Яндекс.Игр и file:// не даёт общий localStorage
   iframe'у. Навигация сохраняет общий origin => редактор и игра видят один
   и тот же набор карт, а по возврату boot перечитывает хранилище. */
function openMapEditor() {
  try {
    window.location.href = "editor.html";
  } catch (error) {
    /* навигация недоступна */
  }
}

/* =========================================================
   ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
========================================================= */

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function spendMoney(amount) {
  if (DEV_ALL_UNLOCKED) {
    state.money = TEST_MONEY;
    return;
  }
  state.money -= amount;
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
  if (DEV_ALL_UNLOCKED) return true;
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

    card.classList.toggle("tower-unlocked", unlocked);
    if (icon) icon.removeAttribute("hidden");
    if (mysteryIcon) mysteryIcon.removeAttribute("hidden");

    // Статические карточки (база) переведены через data-i18n — берём tl(),
    // чтобы смена языка не ломалась об этот рендер. У mystery-карточек
    // атрибута нет — их имя/описание НЕ раскрываем до открытия (v59.15).
    const getAttr = el => (el && el.getAttribute ? el.getAttribute("data-i18n") : null);
    const nameKey = getAttr(name);
    if (name) name.textContent = unlocked ? (nameKey ? tl(nameKey) : def.name) : "???";
    if (desc) {
      const descKey = getAttr(desc);
      if (!desc.dataset.defaultText && (unlocked || descKey)) {
        desc.dataset.defaultText = descKey ? tl(descKey) : (def.description || desc.textContent || "");
      }
      desc.textContent = unlocked ? (descKey ? tl(descKey) : desc.dataset.defaultText) : "???";
    }
    if (price) price.textContent = unlocked ? `$${def.cost}` : "???";
    if (mysteryIcon && def.unlockWave) {
      // число-ключ на иконке «?» (пилюлю рисует CSS ::after) — номер волны
      mysteryIcon.dataset.wave = String(def.unlockWave);
    }
    if (unlock) {
      unlock.textContent = unlocked
        ? (unlock.dataset.defaultText || "")
        : (def.unlockWave
            ? tl("ui.unlockShort", { n: def.unlockWave })
            : tl("ui.hiddenTower"));
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
    setHint(tl("hint.noMoney"));
    updateUi();
    return;
  }

  if (!canPlaceTower(x, y)) {
    clearTowerTypeSelection();
    state.selectedTower = null;
        state.rangeUpgradeHover = false;
    setHint(tl("hint.noPlace"));
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
    comboTimer: COMBO_CHECK_INTERVAL,

    totalSpent: type.cost
  };

  spendMoney(type.cost);

  state.towers.push(tower);

  // После установки выбор типа башни полностью снимается.
  // Чтобы поставить следующую башню, нужно снова нажать её карточку.
  state.selectedTower = null;
  clearTowerTypeSelection();

  setHint(
      tl("hint.placed", { n: type.name })
  );

  updateUi();
}


/* =========================================================
   ПАРАМЕТРЫ БАШНИ
========================================================= */

/* Тир-модель улучшений — как в Onslaught 2.2: каждое значение хранится
   отдельным элементом массива, максимум уровня = длина массива. kind:
   'damage' | 'range' | 'speed' */
function statTiers(type, kind) {
  const t = towerTypes[type];
  if (!t) return [];
  return kind === "damage" ? (t.dmgTiers || [])
       : kind === "range"  ? (t.rngTiers || [])
       : (t.rateTiers || []);
}
function statMaxLevel(type, kind) {
  return Math.max(1, statTiers(type, kind).length);
}
function isStatMaxed(tower, kind) {
  return (tower[`${kind}Level`] || 1) >= statMaxLevel(tower.type, kind);
}
function isDamageMaxed(tower) {
  return isStatMaxed(tower, "damage");
}
function tierValue(type, kind, level) {
  const tiers = statTiers(type, kind);
  if (!tiers.length) {
    // Саппорты и совместимость со старыми сохранами: без таблицы берём базовое поле.
    const base = towerTypes[type];
    if (!base) return 0;
    return kind === "damage" ? (base.damage || 0)
         : kind === "range"  ? (base.range || 0)
         : 0;
  }
  return tiers[Math.min(tiers.length, Math.max(1, level)) - 1];
}

function tierInterval(type, level) {
  const base = towerTypes[type];
  const tiers = statTiers(type, "speed");
  if (!tiers.length) return base?.fireRate || 1;
  const pts = tiers[Math.min(tiers.length, Math.max(1, level)) - 1] || 100;
  return (base.rofK || 45) / pts;
}

function getTowerStats(tower) {
  const base = towerTypes[tower.type];
  const damageLevel = tower.damageLevel || 1;
  const rangeLevel = tower.rangeLevel || 1;
  const speedLevel = tower.speedLevel || 1;

  let damage = tierValue(tower.type, "damage", damageLevel);
  let range = tierValue(tower.type, "range", rangeLevel);

  // Скорострельность: очки ROF из таблицы -> интервал в секундах.
  let interval = tierInterval(tower.type, speedLevel);

  if (!isSupportType(tower.type)) {
    const support = getSupportBonus(tower);
    damage *= 1 + support.damage;
    range = range * (1 + support.rangePct) + support.rangeFlat;
    interval /= 1 + support.ratePct;
  }

  // Freak Out (Cannon/Tazer): в четыре раза быстрее, в три сильнее.
  if (tower.speedOverdrive) {
    damage *= 3;
    interval /= 4;
  }

  return {
    damage: Math.round(damage),
    range,
    fireRate: Math.max(0.08, interval)
  };
}

function getProjectedFireRate(tower, speedLevel) {
  let interval = tierInterval(tower.type, speedLevel);

  if (!isSupportType(tower.type)) {
    const support = getSupportBonus(tower);
    interval /= 1 + support.ratePct;
  }

  return Math.max(0.08, interval);
}

function isSupportType(type) {
  return !!towerTypes[type]?.support;
}

function getSupportBonus(tower) {
  const result = { damage: 0, rangePct: 0, rangeFlat: 0, ratePct: 0 };
  if (isSupportType(tower.type) || ADVANCED_TYPES.includes(tower.type)) return result;

  for (const support of state.towers) {
    const supportType = towerTypes[support.type];
    if (!supportType?.support) continue;
    if (distance(support, tower) <= supportType.range) {
      result.damage += supportType.support.dmgPct || 0;
      result.rangePct += supportType.support.rngPct || 0;
      result.rangeFlat += supportType.support.rngFlat || 0;
      result.ratePct += supportType.support.ratePct || 0;
    }
  }

  // Правила Onslaught: % урона и радиуса складываются; Rate-модификаторы
  // стакаются примерно два-три раза, после чего упираются в предел снаряда.
  result.ratePct = Math.min(2.2, Math.max(-0.75, result.ratePct));
  result.damage = Math.max(-0.75, result.damage);
  result.rangePct = Math.max(-0.75, result.rangePct);
  return result;
}

// Совместимость со старой системой усилителя.
function getBoosterBonus(tower) {
  return getSupportBonus(tower);
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

/* Сложность — официальные кривые HP из Onslaught 2.2 (FAQ): множитель шага
   w->w+1 в зависимости от диапазона волн. HP(1) = 10, всё остальное —
   произведение шаговых множителей. Extreme (плоский x1.125) у нас не
   представлен четвёртой карточкой, его роль у нас — «Сложный» выше. */
const difficulties = {
  easy: {
    name: "Легкий",
    hpMultiplier: 1.00,
    speedMultiplier: 0.90,
    countMultiplier: 0.88,
    rewardMultiplier: 1.00,
    waveRewardMultiplier: 1.15,
    hpSegments: [[1, 1.3], [10, 1.2], [30, 1.15], [40, 1.1], [60, 1.09], [80, 1.05], [100, 1.04], [120, 1.03], [200, 1.02]]
  },
  normal: {
    name: "Средний",
    hpMultiplier: 1.00,
    speedMultiplier: 1.00,
    countMultiplier: 1.00,
    rewardMultiplier: 1.00,
    waveRewardMultiplier: 1.00,
    hpSegments: [[1, 1.3], [10, 1.2], [20, 1.25], [30, 1.15], [40, 1.1], [60, 1.09], [80, 1.05], [100, 1.04], [120, 1.03], [200, 1.02]]
  },
  hard: {
    name: "Сложный",
    hpMultiplier: 1.00,
    speedMultiplier: 1.10,
    countMultiplier: 1.14,
    rewardMultiplier: 1.00,
    waveRewardMultiplier: 0.90,
    hpSegments: [[1, 1.4], [10, 1.3], [30, 1.2], [40, 1.1], [60, 1.05], [100, 1.04], [120, 1.03], [200, 1.02]]
  }
};

let currentDifficulty = "easy";

function getDifficulty() {
  return difficulties[currentDifficulty] || difficulties.normal;
}

// Официальная базовая кривая: HP(1)=10, шаг зависит от сегмента сложности.
const hpCurveCache = {};
function hpAtWave(w) {
  const key = currentDifficulty;
  const cache = hpCurveCache[key] || (hpCurveCache[key] = [null, 10]);
  const segments = getDifficulty().hpSegments;
  for (let i = cache.length; i <= w; i++) {
    let f = segments[segments.length - 1][1];
    for (const [start, factor] of segments) {
      if (i - 1 >= start) f = factor;
      else break;
    }
    // i-1 — номер волны, из которой делаем шаг (сегменты заданы по «from wave»)
    cache[i] = cache[i - 1] * f;
  }
  return cache[w];
}

function getWaveScaling(wave) {
  const w = Math.max(1, wave);
  const difficulty = getDifficulty();

  const hp = hpAtWave(w) * difficulty.hpMultiplier;

  const speedGrowth =
      Math.min(2.35, 1 + 0.0105 * (w - 1) + Math.max(0, w - 160) * 0.0015);

  const countGrowth =
      6 +
      Math.floor(2.35 * Math.sqrt(w - 1)) +
      Math.floor((w - 1) * 0.07) +
      Math.floor(Math.max(0, w - 180) * 0.035);

  return {
    hp: Math.max(1, hp),
    speed: 45 * speedGrowth * difficulty.speedMultiplier,
    // Награда за фраг — как в оригинальном Onslaught: линейно по номеру волны
    // (моб на волне 1 = $1, на волне 2 = $2, … на волне N = $N). Поздняя
    // экономика сознательно тугая: копить на продвинутые турели приходится.
    reward: Math.max(1, w * difficulty.rewardMultiplier),
    count: Math.max(4, Math.round(countGrowth * difficulty.countMultiplier)),
    spawnInterval: Math.max(0.20, 0.72 - Math.min(0.43, (w - 1) * 0.0038))
  };
}


const enemyTypes = [
  { color: "#df6a5f", glow: "#df6a5f", shape: "circle" },
  { color: "#e08b52", glow: "#e08b52", shape: "square" },
  { color: "#e8b64c", glow: "#e8b64c", shape: "triangle" },
  { color: "#8fd0e8", glow: "#8fd0e8", shape: "diamond" },
  { color: "#5b9fd6", glow: "#5b9fd6", shape: "hex" },
  { color: "#eec76a", glow: "#eec76a", shape: "star" },
  { color: "#74c476", glow: "#74c476", shape: "pentagon" },
  { color: "#cf8e97", glow: "#cf8e97", shape: "cross" },
  { color: "#e8a04c", glow: "#e8a04c", shape: "octagon" },
  { color: "#eef1f7", glow: "#eef1f7", shape: "bolt" }
];

function getEnemyType(waveNumber) {
  return enemyTypes[(Math.max(1, waveNumber) - 1) % enemyTypes.length];
}

function drawEnemyShipHull(shape, r, color) {
  // Рисует корпус в локальных координатах: нос направлен вдоль +x.
  ctx.fillStyle = "#1f2638";
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.8;

  if (shape === "hex") {
    // НЛО: тарелка с куполом и мигающими огнями по ободу.
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.18, r * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-r * 0.45, -r * 0.1);
    ctx.arc(0, -r * 0.1, r * 0.45, Math.PI, 0);
    ctx.closePath();
    ctx.fillStyle = "rgba(238,241,247, 0.9)";
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.stroke();

    const lightsT = performance.now() / 1000;
    for (let i = 0; i < 5; i++) {
      const lx = -r * 0.85 + (i * r * 1.7) / 4;
      ctx.globalAlpha = 0.3 + 0.7 * Math.max(0, Math.sin(lightsT * 5 + i * 1.7));
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(lx, r * 0.26, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  } else if (shape === "triangle") {
    // Перехватчик: острый дротик.
    ctx.beginPath();
    ctx.moveTo(r * 1.35, 0);
    ctx.lineTo(-r * 0.6, -r * 0.62);
    ctx.lineTo(-r * 0.25, 0);
    ctx.lineTo(-r * 0.6, r * 0.62);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(r * 0.35, 0, 2, 0, Math.PI * 2);
    ctx.fill();
  } else if (shape === "pentagon") {
    // Истребитель: дротик с широкими крыльями.
    ctx.beginPath();
    ctx.moveTo(r * 1.25, 0);
    ctx.lineTo(-r * 0.2, -r * 0.5);
    ctx.lineTo(-r * 0.9, -r * 1.02);
    ctx.lineTo(-r * 0.45, -r * 0.28);
    ctx.lineTo(-r * 0.75, 0);
    ctx.lineTo(-r * 0.45, r * 0.28);
    ctx.lineTo(-r * 0.9, r * 1.02);
    ctx.lineTo(-r * 0.2, r * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#eef1f7";
    ctx.beginPath();
    ctx.arc(r * 0.3, 0, 2.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (shape === "diamond") {
    // Разведчик: ромб с кабиной.
    ctx.beginPath();
    ctx.moveTo(r * 1.25, 0);
    ctx.lineTo(0, -r * 0.72);
    ctx.lineTo(-r * 1.05, 0);
    ctx.lineTo(0, r * 0.72);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(r * 0.55, 0);
    ctx.lineTo(0, -r * 0.28);
    ctx.lineTo(-r * 0.4, 0);
    ctx.lineTo(0, r * 0.28);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  } else if (shape === "square" || shape === "octagon") {
    // Бомбардировщик/крейсер: бронированный корпус с плитами.
    const k = shape === "square" ? 0.92 : 1.1;
    ctx.beginPath();
    ctx.moveTo(r * 1.2 * k, -r * 0.42);
    ctx.lineTo(r * 0.35, -r * 0.8 * k);
    ctx.lineTo(-r * 1.0 * k, -r * 0.8 * k);
    ctx.lineTo(-r * 1.0 * k, r * 0.8 * k);
    ctx.lineTo(r * 0.35, r * 0.8 * k);
    ctx.lineTo(r * 1.2 * k, r * 0.42);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(-r * 0.35, -r * 0.8 * k);
    ctx.lineTo(-r * 0.35, r * 0.8 * k);
    ctx.moveTo(r * 0.25, -r * 0.6 * k);
    ctx.lineTo(r * 0.25, r * 0.6 * k);
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(r * 0.62, 0, 2.4, 0, Math.PI * 2);
    ctx.fill();
  } else if (shape === "star") {
    // Штурмовик: корпус с тремя лезвиями.
    ctx.beginPath();
    ctx.moveTo(r * 1.3, 0);
    ctx.lineTo(r * 0.1, -r * 0.35);
    ctx.lineTo(-r * 0.2, -r * 1.05);
    ctx.lineTo(-r * 0.45, -r * 0.3);
    ctx.lineTo(-r * 0.95, -r * 0.5);
    ctx.lineTo(-r * 0.7, 0);
    ctx.lineTo(-r * 0.95, r * 0.5);
    ctx.lineTo(-r * 0.45, r * 0.3);
    ctx.lineTo(-r * 0.2, r * 1.05);
    ctx.lineTo(r * 0.1, r * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#eef1f7";
    ctx.beginPath();
    ctx.arc(r * 0.3, 0, 1.8, 0, Math.PI * 2);
    ctx.fill();
  } else if (shape === "cross") {
    // Носитель: крестообразный корпус с широкими крыльями.
    ctx.beginPath();
    ctx.moveTo(r * 1.2, -r * 0.25);
    ctx.lineTo(r * 1.2, r * 0.25);
    ctx.lineTo(r * 0.3, r * 0.3);
    ctx.lineTo(r * 0.3, r * 0.95);
    ctx.lineTo(-r * 0.3, r * 0.95);
    ctx.lineTo(-r * 0.3, r * 0.3);
    ctx.lineTo(-r * 1.05, r * 0.3);
    ctx.lineTo(-r * 1.05, -r * 0.3);
    ctx.lineTo(-r * 0.3, -r * 0.3);
    ctx.lineTo(-r * 0.3, -r * 0.95);
    ctx.lineTo(r * 0.3, -r * 0.95);
    ctx.lineTo(r * 0.3, -r * 0.25);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  } else if (shape === "bolt") {
    // Рейдер: асимметричный молниеносный корпус.
    ctx.beginPath();
    ctx.moveTo(r * 1.25, -r * 0.2);
    ctx.lineTo(r * 0.15, -r * 0.1);
    ctx.lineTo(r * 0.45, -r * 0.85);
    ctx.lineTo(-r * 1.0, -r * 0.2);
    ctx.lineTo(-r * 0.35, 0);
    ctx.lineTo(-r * 1.05, r * 0.6);
    ctx.lineTo(-r * 0.15, r * 0.3);
    ctx.lineTo(-r * 0.45, r * 1.0);
    ctx.lineTo(r * 0.5, r * 0.25);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#eef1f7";
    ctx.beginPath();
    ctx.arc(r * 0.55, 0, 1.6, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Дрон: обтекаемая капсула с боковыми стабилизаторами.
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.85, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-r * 0.8, -r * 0.15);
    ctx.lineTo(-r * 1.3, -r * 0.55);
    ctx.moveTo(-r * 0.8, r * 0.15);
    ctx.lineTo(-r * 1.3, r * 0.55);
    ctx.stroke();
    ctx.fillStyle = "#eef1f7";
    ctx.beginPath();
    ctx.arc(r * 0.15, 0, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
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

    // Красная пульсация по краям поля — потеря жизни.
    state.effects.push({ type: "leakFlash", life: 0.5, maxLife: 0.5 });
    // Ударная волна по ядру — враг дошёл до цели.
    state.effects.push({
      type: "comboBurst",
      x: enemy.x,
      y: enemy.y,
      radius: 40,
      life: 0.5,
      maxLife: 0.5,
      color: "#df6a5f"
    });

    createExplosion(
        enemy.x,
        enemy.y,
        "#c9504f"
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
  let damage = stats.damage;

  // Fusion (Onslaught): выстрел забирает накопленный простой соседей.
  if (type.fusion && tower.fusionCharge) {
    damage += Math.round(tower.fusionCharge);
    tower.fusionCharge = 0;
  }

  // Combonly (Onslaught): +30% урона каждой «в максимум» базовой турели рядом.
  if (type.absorbs) {
    let absorbed = 0;
    for (const ally of state.towers) {
      if (ally === tower || isSupportType(ally.type) || ADVANCED_TYPES.includes(ally.type)) continue;
      if (isDamageMaxed(ally) && distance(ally, tower) <= stats.range) {
        absorbed += getTowerStats(ally).damage * 0.30;
      }
    }
    damage += Math.round(absorbed);
  }

  // Лазерная цепь (Laser из Onslaught): каждый зелёный сосед в радиусе
  // добавляет своё звено: acc = acc×1.25 + урон соседа (соседи по близости).
  const chainLinks = [];
  if (type.laserChain) {
    const assists = state.towers
        .filter(candidate =>
            candidate !== tower &&
            candidate.type === "arc" &&
            distance(candidate, tower) <= stats.range)
        .sort((a, b) => distance(a, tower) - distance(b, tower))
        .slice(0, 12);
    for (const ally of assists) {
      damage = damage * 1.25 + getTowerStats(ally).damage;
      chainLinks.push(ally);
    }
    damage = Math.round(damage);
  }

  const projectile = {
    x: tower.x,
    y: tower.y,

    target,

    speed: type.projectileSpeed || 500,

    damage,

    towerType: tower.type,

    splash: type.splash || 0,

    color: type.color
  };

  if (tower.type === "frost") {
    projectile.slowLevel = tower.damageLevel || 1;
  }

  // Railgun (Onslaught): снаряд летит прямо и пробивает всех на линии.
  if (type.pierce) {
    projectile.pierce = true;
    projectile.dx = 0;
    projectile.dy = 0;
    projectile.life = 0.9;
  }

  // Holding Pattern (Rocket с 4+4 апдейсами): без цели снаряд кружит над турелью.
  if (tower.holdingReady) {
    projectile.holdTower = tower;
    projectile.holdRange = stats.range;
  }

  state.projectiles.push(projectile);

  for (const ally of chainLinks) {
    createLightning(ally, tower);
  }
}

function updateProjectile(projectile, dt) {
  if (projectile.pierce) {
    const target = projectile.target;
    if (!projectile.dx && target && !target.dead) {
      const dx = target.x - projectile.x;
      const dy = target.y - projectile.y;
      const dist = Math.hypot(dx, dy) || 1;
      projectile.dx = dx / dist;
      projectile.dy = dy / dist;
    }
    projectile.x += projectile.dx * projectile.speed * dt;
    projectile.y += projectile.dy * projectile.speed * dt;
    projectile.life -= dt;

    if (!projectile.hitSet) projectile.hitSet = new Set();
    for (const enemy of state.enemies) {
      if (!enemy.dead && !projectile.hitSet.has(enemy) && distance(enemy, projectile) <= 18) {
        projectile.hitSet.add(enemy);
        enemy.hp -= projectile.damage;
        createExplosion(enemy.x, enemy.y, projectile.color);
        if (enemy.hp <= 0) {
          killEnemy(enemy);
        }
      }
    }

    if (projectile.life <= 0 ||
        projectile.x < -60 || projectile.x > GAME_WIDTH + 60 ||
        projectile.y < -60 || projectile.y > GAME_HEIGHT + 60) {
      projectile.dead = true;
    }
    return;
  }

  const holder = projectile.holdTower;
  if (holder && !state.towers.includes(holder)) {
    projectile.dead = true;
    return;
  }

  if (!projectile.target || projectile.target.dead) {
    if (holder) {
      if (projectile.orbit === undefined) {
        // Промахнувшийся снаряд превращается в «ждущую» ракету.
        const orbiting = state.projectiles.filter(p =>
            !p.dead && p.holdTower === holder && p.orbit !== undefined).length;
        if (orbiting >= 3) {
          projectile.dead = true;
          return;
        }
        projectile.orbit = Math.atan2(projectile.y - holder.y, projectile.x - holder.x);
        projectile.holdAge = 0;
      }
      const fresh = state.enemies.find(enemy =>
          !enemy.dead && distance(enemy, holder) <= projectile.holdRange);
      if (fresh) {
        // Ждущая ракета нашла цель: бьёт вполовину слабее и без splash —
        // это спасённый промах, а не бесплатный второй залп.
        projectile.target = fresh;
        projectile.damage = Math.round(projectile.damage * 0.5);
        projectile.splash = 0;
        projectile.orbit = undefined;
      } else {
        projectile.orbit += 2.6 * dt;
        projectile.x = holder.x + Math.cos(projectile.orbit) * 34;
        projectile.y = holder.y + Math.sin(projectile.orbit) * 34;
        projectile.holdAge = (projectile.holdAge || 0) + dt;
        // В оригинале залп «держится» недолго: через несколько секунд
        // неиспользованная ракета гаснет.
        if (projectile.holdAge > 6) projectile.dead = true;
        return;
      }
    } else {
      projectile.dead = true;
      return;
    }
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
    // Яд Tazer: чем выше уровень урона, тем дольше врагов «ведёт».
    target.slowMultiplier = type.slow;
    target.slowTimer = (type.slowTime || 1.5) + Math.max(0, (projectile.slowLevel || 1) - 1) * 0.15;
  }

  if (projectile.splash) {
    // AoE ограничен: максимум 5 ближайших целей и 50% урона — чтобы один
    // AoE-выстрел не зачищал всю колонну и не превращался в денежный принтер.
    const victims = state.enemies
        .filter(enemy =>
            enemy !== target &&
            !enemy.dead &&
            distance(enemy, target) <= projectile.splash)
        .sort((a, b) => distance(a, target) - distance(b, target))
        .slice(0, 5);

    for (const enemy of victims) {
      enemy.hp -= projectile.damage * 0.5;

      if (enemy.hp <= 0) {
        killEnemy(enemy);
      }
    }

    createExplosion(
        target.x,
        target.y,
        type.color
    );
  }

  // Цепная молния «Дуги» заменена лазерной цепью Onslaught (сбор урона
  // в createProjectile); комбо «Цепная буря» по-прежнему бьёт цепью.

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
      "#eef1f7"
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

function getComboGroups() {
  const groups = [];
  const visited = new Set();

  for (let i = 0; i < state.towers.length; i++) {
    if (visited.has(i)) continue;
    const startTower = state.towers[i];
    if (!isDamageMaxed(startTower)) continue;

    const queue = [i];
    const group = [];
    visited.add(i);

    while (queue.length) {
      const index = queue.shift();
      const tower = state.towers[index];
      group.push(tower);

      for (let j = 0; j < state.towers.length; j++) {
        if (visited.has(j)) continue;
        const other = state.towers[j];
        if (other.type !== startTower.type) continue;
        if (!isDamageMaxed(other)) continue;
        if (distance(tower, other) <= COMBO_RADIUS) {
          visited.add(j);
          queue.push(j);
        }
      }
    }

    if (group.length >= 3) groups.push(group);
  }

  return groups;
}

function getRandomRoadPoint(minRatio = 0.12, maxRatio = 0.88) {
  const ratio = minRatio + Math.random() * (maxRatio - minRatio);
  return getPointOnPath(PATH_LENGTH * ratio);
}

function createComboMine(x, y, color, damage) {
  state.mines.push({
    x,
    y,
    radius: 54,
    life: 18,
    maxLife: 18,
    color,
    // Onslaught: мина — это урон, а не «гарантированная смерть».
    damage: Math.max(1, Math.round(damage || 0)),
    armed: true,
    pulse: 0
  });
  state.effects.push({ type: "minePlace", x, y, life: 0.5, maxLife: 0.5, color });
}

function launchComboMine(tower, target, color) {
  const d = getTowerStats(tower).damage;
  state.comboProjectiles.push({
    x: tower.x,
    y: tower.y,
    startX: tower.x,
    startY: tower.y,
    targetX: target.x,
    targetY: target.y,
    progress: 0,
    duration: 0.55,
    damage: d * 3,
    color,
    dead: false
  });
  state.effects.push({ type: "comboBurst", x: tower.x, y: tower.y, radius: 22, life: 0.3, maxLife: 0.3, color });
}

function updateComboProjectiles(dt) {
  if (!Array.isArray(state.comboProjectiles) || state.comboProjectiles.length === 0) return;

  for (const projectile of state.comboProjectiles) {
    if (!Number.isFinite(projectile.progress)) projectile.progress = 0;
    projectile.progress += dt / Math.max(0.05, projectile.duration || 0.55);
    const t = Math.min(1, projectile.progress);
    const arc = Math.sin(t * Math.PI) * 38;
    projectile.x = projectile.startX + (projectile.targetX - projectile.startX) * t;
    projectile.y = projectile.startY + (projectile.targetY - projectile.startY) * t - arc;

    if (t >= 1 && !projectile.dead) {
      createComboMine(projectile.targetX, projectile.targetY, projectile.color, projectile.damage);
      projectile.dead = true;
    }
  }
  state.comboProjectiles = state.comboProjectiles.filter(projectile => !projectile.dead);
}
function triggerCombo(group) {
  const tower = group[0];
  const type = towerTypes[tower.type];
  const combo = type.combo;
  if (!combo || Math.random() >= combo.chance) return;

  // Комбо не является паузой: оно выполняется внутри обычного игрового тика.
  // Сохраняем состояние паузы и гарантируем, что само срабатывание комбо его не меняет.

  // Баланс Onslaught: комбо-урон привязан к ФАКТИЧЕСКОЙ прокачке башни
  // (getTowerStats), а не к здоровью врага. Процент от maxHp — это вечный
  // «стёр-кнопка»: одна башня выигрывала любые поздние волны и печатала
  // деньги. Теперь сила комбо растёт только вместе с апгрейдами и упирается
  // в потолок, как обычные выстрелы.
  const d = getTowerStats(tower).damage;

  if (tower.type === "pulse") {
    const p = getRandomRoadPoint();
    launchComboMine(tower, p, type.color);
    return;
  }

  if (isSupportType(tower.type)) {
    // Модули поддержки не имеют атакующего комбо — выходим сразу,
    // иначе ветка «проваливалась» в чужие эффекты.
    return;
  } else if (tower.type === "rail") {
    const targets = state.enemies.filter(e => !e.dead).sort((a,b) => b.distance - a.distance).slice(0, 4);
    for (const enemy of targets) {
      enemy.hp -= d * 1.6;
      createLightning(tower, enemy);
      if (enemy.hp <= 0) killEnemy(enemy);
    }
    return;
  }

  if (tower.type === "frost") {
    for (const enemy of state.enemies.filter(e => !e.dead).sort((a,b) => b.distance - a.distance).slice(0, 7)) {
      enemy.slowMultiplier = 0.08;
      enemy.slowTimer = 3.5;
      enemy.hp -= d * 1.2;
      if (enemy.hp <= 0) killEnemy(enemy);
    }
    state.effects.push({ type: "comboBurst", x: tower.x, y: tower.y, radius: 110, life: 0.5, maxLife: 0.5, color: type.color });
    return;
  }

  if (tower.type === "blast") {
    const p = getRandomRoadPoint();
    state.effects.push({ type: "comboBurst", x: p.x, y: p.y, radius: 125, life: 0.55, maxLife: 0.55, color: type.color });
    for (const enemy of state.enemies) {
      if (!enemy.dead && distance(enemy, p) <= 105) {
        enemy.hp -= d * 1.8;
        if (enemy.hp <= 0) killEnemy(enemy);
      }
    }
    return;
  }

  if (tower.type === "arc") {
    const targets = state.enemies.filter(e => !e.dead).sort((a,b) => b.distance - a.distance).slice(0, 6);
    for (const enemy of targets) {
      enemy.hp -= d * 1.4;
      createLightning(tower, enemy);
      if (enemy.hp <= 0) killEnemy(enemy);
    }
    return;
  }

  if (tower.type === "titan") {
    const target = state.enemies.filter(e => !e.dead).sort((a,b) => b.distance - a.distance)[0];
    if (!target) return;
    for (const enemy of state.enemies) {
      if (!enemy.dead && distance(enemy, target) <= 115) {
        enemy.hp -= d * 1.5;
        if (enemy.hp <= 0) killEnemy(enemy);
      }
    }
    createExplosion(target.x, target.y, type.color);
    return;
  }

  if (tower.type === "nova") {
    for (const enemy of state.enemies) {
      if (!enemy.dead) {
        enemy.hp -= d * 0.5;
        if (enemy.hp <= 0) killEnemy(enemy);
      }
    }
    state.effects.push({ type: "comboBurst", x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2, radius: 260, life: 0.65, maxLife: 0.65, color: type.color });
    return;
  }

  if (tower.type === "devastator") {
    for (const enemy of state.enemies) {
      if (!enemy.dead) {
        enemy.hp -= d * 1.0;
        if (enemy.hp <= 0) killEnemy(enemy);
      }
    }
    state.effects.push({ type: "comboBurst", x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2, radius: 320, life: 0.7, maxLife: 0.7, color: type.color });
    return;
  }

  if (tower.type === "singularity") {
    for (const enemy of state.enemies) {
      if (!enemy.dead) {
        enemy.hp -= d * 1.2;
        enemy.slowMultiplier = 0.12;
        enemy.slowTimer = 4;
        if (enemy.hp <= 0) killEnemy(enemy);
      }
    }
    state.effects.push({ type: "comboBurst", x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2, radius: 360, life: 0.9, maxLife: 0.9, color: type.color });
  }
}

function updateComboAbilities(dt) {
  // Комбо проверяем не каждый кадр. Это снижает нагрузку и исключает
  // ситуацию, когда большой набор башен/мобов может задержать игровой цикл.
  state.comboCheckTimer = Math.max(0, (state.comboCheckTimer || 0) - dt);
  if (state.comboCheckTimer > 0) return;
  state.comboCheckTimer = 0.20;

  try {
    const groups = getComboGroups();
    const activeLeaders = new Set();

    for (const group of groups) {
      const leader = group[0];
      const combo = towerTypes[leader.type]?.combo;
      if (!combo) continue;

      activeLeaders.add(leader);
      leader.comboTimer = Math.max(
        0,
        Number.isFinite(leader.comboTimer) ? leader.comboTimer : COMBO_CHECK_INTERVAL
      );
      leader.comboTimer -= 0.20;

      if (leader.comboTimer <= 0) {
        leader.comboTimer = combo.cooldown;
        triggerCombo(group);
      }
    }

    for (const tower of state.towers) {
      if (!activeLeaders.has(tower) && isDamageMaxed(tower)) {
        tower.comboTimer = COMBO_CHECK_INTERVAL;
      }
    }
  } catch (error) {
    // Ошибка одного комбо никогда не должна останавливать основной игровой цикл.
    console.error('Combo error:', error);
    for (const tower of state.towers) {
      tower.comboTimer = COMBO_CHECK_INTERVAL;
    }
  }
}
function updateMines(dt) {
  for (const mine of state.mines) {
    mine.life -= dt;
    mine.pulse = (mine.pulse || 0) + dt;
    const victims = state.enemies.filter(enemy => !enemy.dead && distance(enemy, mine) <= mine.radius);
    if (mine.armed && victims.length) {
      mine.armed = false;
      const targets = victims.sort((a, b) => b.distance - a.distance);
      for (const enemy of targets) {
        enemy.hp -= mine.damage;
        if (enemy.hp <= 0) {
          killEnemy(enemy);
        }
      }
      createExplosion(mine.x, mine.y, mine.color);
      state.effects.push({ type: "comboBurst", x: mine.x, y: mine.y, radius: 90, life: 0.45, maxLife: 0.45, color: mine.color });
      mine.life = 0;
    }
  }
  state.mines = state.mines.filter(mine => mine.life > 0);
}

function updateTowers(dt) {
  updateComboAbilities(dt);

  for (const tower of state.towers) {
    if (isSupportType(tower.type)) {
      tower.cooldown = 0;
      continue;
    }

    // Freak Out (Cannon/Tazer из Onslaught): после 4 апдейсов урона И
    // скорострельности турель периодически «срывает»: ×4 темп, ×3 урон.
    const freakBase = towerTypes[tower.type];
    if (freakBase.freakout && (tower.damageLevel || 1) >= 5 && (tower.speedLevel || 1) >= 5) {
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

    // Holding Pattern (Rocket из Onslaught): держит залп в воздухе.
    tower.holdingReady = !!freakBase.holding &&
        (tower.rangeLevel || 1) >= 4 && (tower.speedLevel || 1) >= 4;

    // Fusion (Onslaught): копит простой ударов соседей-лазеров/тейзеров.
    if (freakBase.fusion) {
      let idle = 0;
      for (const ally of state.towers) {
        if (ally === tower) continue;
        if (ally.type === "arc" || ally.type === "frost") {
          if (distance(ally, tower) <= freakBase.rngTiers[Math.min(freakBase.rngTiers.length, tower.rangeLevel || 1) - 1]) {
            const allyStats = getTowerStats(ally);
            idle += allyStats.damage / Math.max(0.08, allyStats.fireRate);
          }
        }
      }
      const myDps = getTowerStats(tower).damage / Math.max(0.08, getTowerStats(tower).fireRate);
      tower.fusionCharge = Math.min(60 * Math.max(1, myDps), (tower.fusionCharge || 0) + idle * 0.6 * dt);
    }

    if (tower.speedOverdrive) {
      tower.speedOverdriveTimer = Math.max(0, (tower.speedOverdriveTimer || 0) - dt);
      if (tower.speedOverdriveTimer <= 0) tower.speedOverdrive = false;
    }

    if (tower.speedOverdriveShake > 0) {
      tower.speedOverdriveShake = Math.max(0, tower.speedOverdriveShake - dt);
    }
    if (tower.muzzleFlash > 0) {
      tower.muzzleFlash = Math.max(0, tower.muzzleFlash - dt);
    }
    tower.cooldown -= dt;

    if (tower.cooldown > 0) continue;
    const target = findTarget(tower);
    if (!target) continue;
    createProjectile(tower, target);
    // Наведение турели и короткая вспышка у среза ствола.
    tower.aimAngle = Math.atan2(target.y - tower.y, target.x - tower.x);
    tower.muzzleFlash = 0.12;
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

    if (effect.type === "comboBurst") {
      effect.radius += (effect.radius / Math.max(effect.maxLife, 0.01)) * dt * 0.35;
    }

    if (effect.type === "minePlace") {
      effect.radius = 8 + (1 - effect.life / effect.maxLife) * 24;
    }

    // Отрисовка эффектов выполняется только в drawEffects().
    // Нельзя обращаться к canvas здесь: update() должен быть чистой симуляцией.
    // Раньше здесь использовалась несуществующая переменная alpha, из-за чего
    // при первом comboBurst игра падала с ReferenceError и игровое поле исчезало.
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

  // Duel.js: панель «Дуэль волн» следит за номером волны.
  try { window.NeonDuel && window.NeonDuel.onWave(waveNumber); } catch (e) {}

  // Показываем только последнюю запущенную волну. Параллельные волны
  // продолжают работать внутри state.activeWaves, но их номера не
  // накапливаются в интерфейсе.
  waveNameEl.textContent = tl("ui.waveName", { n: waveNumber });

  setHint(
      state.activeWaves.length > 1
          ? tl("hint.waveParallel", { n: waveNumber })
          : tl("hint.waveStarted", { n: waveNumber })
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
      // Onslaught: основной доход — награда за фраги; бонус за волну скромный.
      const reward = Math.round(
          Math.min(500, 8 + 1.5 * wave.waveNumber) *
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
        ? tl("hint.waveDone", { n: completed[0] })
        : tl("hint.wavesDone", { n: completed.join(", ") });

    if (state.waveActive) {
      setHint(tl("hint.wavesDoneMore", { t: label }));
    } else {
      state.nextWaveTimer = 2.25;
      waveNameEl.textContent = tl("ui.ready");
      setHint(tl("hint.wavesDoneNext", { t: label }));
    }
  }
}


/* =========================================================
   УЛУЧШЕНИЕ
========================================================= */

// Стоимость следующего уровня — официальные массивы upgDmg/upgRng/upgRate
// из FAQ Onslaught 2.2 (цена уровня N+1 = элемент [N-1]).
function getUpgradeCost(tower, kind) {
  if (!tower || !towerTypes[tower.type] || !["damage", "range", "speed"].includes(kind)) {
    return Infinity;
  }

  const level = tower[`${kind}Level`] || 1;
  if (level >= statMaxLevel(tower.type, kind) || isSupportType(tower.type)) {
    return Infinity;
  }

  const type = towerTypes[tower.type];
  const list = kind === "damage" ? type.upgDmg : kind === "range" ? type.upgRng : type.upgRate;
  const cost = list ? list[level - 1] : undefined;
  return cost && cost > 0 ? cost : Infinity;
}

function upgradeTowerStat(kind) {
  const tower = state.selectedTower;
  if (!tower || !['damage', 'range', 'speed'].includes(kind)) {
    return;
  }

  const currentLevel = tower[`${kind}Level`] || 1;
  if (isStatMaxed(tower, kind)) {
    setHint(tl("hint.maxedStat", { n: towerTypes[tower.type].name }));
    return;
  }

  const cost = getUpgradeCost(tower, kind);
  if (state.money < cost) {
    setHint(tl("hint.noMoneyUpgrade"));
    return;
  }

  spendMoney(cost);
  tower[`${kind}Level`] = (tower[`${kind}Level`] || 1) + 1;
  tower.totalSpent += cost;

  if (kind === 'speed' && tower['speedLevel'] === 5) {
    tower.speedOverdrive = false;
    tower.speedOverdriveTimer = 0;
    tower.speedOverdriveCheckTimer = SPEED_OVERDRIVE_INTERVAL;
  }

  const names = {
    damage: tl('hint.pName.damage'),
    range: tl('hint.pName.range'),
    speed: tl('hint.pName.speed')
  };

  setHint(
      tl('hint.upgraded', { n: towerTypes[tower.type].name, p: names[kind], lvl: tower[`${kind}Level`] })
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
      tl("hint.sellGeneric", { n: refund })
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

  const lifeCount = Math.max(0, state.lives);
  livesEl.innerHTML =
      `<span class="life-heart ${lifeCount > 0 ? "alive" : "lost"}" aria-hidden="true">♥</span>` +
      `<span class="life-count">${lifeCount}</span>`;

  waveEl.textContent =
      `${state.wave}`;

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
    const support = tower.type === "booster" ? { damage: 0, rangePct: 0, rangeFlat: 0, ratePct: 0 } : getBoosterBonus(tower);

    const damageMax = statMaxLevel(tower.type, "damage");
    const rangeMax = statMaxLevel(tower.type, "range");
    const speedMax = statMaxLevel(tower.type, "speed");

    const nextDamage = damageLevel < damageMax
        ? Math.round(tierValue(tower.type, "damage", damageLevel + 1) * (1 + support.damage))
        : stats.damage;
    const nextRange = rangeLevel < rangeMax
        ? tierValue(tower.type, "range", rangeLevel + 1) * (1 + support.rangePct) + support.rangeFlat
        : stats.range;
    const currentSpeed = 1 / getProjectedFireRate(tower, speedLevel);
    const nextSpeed = speedLevel < speedMax
        ? 1 / getProjectedFireRate(tower, speedLevel + 1)
        : currentSpeed;

    const statRow = (label, kind, level, current, next, maxLevel) => {
      const bars = Array.from({ length: maxLevel }, (_, index) => {
        const n = index + 1;
        const filled = n <= level;
        const preview = n === level + 1 && level < maxLevel;
        return `<span class="stat-bar ${filled ? `filled ${kind}` : ''} ${preview ? `preview ${kind}` : ''}" title="${n === level ? tl('ui.barCurrent', { n: level }) : preview ? tl('ui.barNext', { n: level + 1 }) : tl('ui.barLevel', { n })}" aria-hidden="true"></span>`;
      }).join('');
      const fmt = value => kind === 'speed' ? Number(value).toFixed(2) : Math.round(value);
      const valueText = level >= maxLevel
        ? `${label}: ${fmt(current)}`
        : `${label}: ${fmt(current)} → ${fmt(next)} <span>(+${fmt(Number(next) - Number(current))})</span>`;
      return `
        <div class="stat-preview">
          <span class="stat-preview-label">${label}</span>
          <div class="stat-bars-wrap">
            <div class="stat-bars" aria-label="${tl('ui.barAria', { p: label, n: level, max: maxLevel, next: level < maxLevel ? tl('ui.barAriaNext', { n: level + 1 }) : tl('ui.barAriaMax') })}">${bars}</div>
            <div class="stat-value stat-value-${kind}">${valueText}</div>
          </div>
        </div>`;
    };

    if (isSupportType(tower.type)) {
      selectionInfo.innerHTML = `
        <div class="selection-title-row">
          <strong>${type.name}</strong>
          <span class="selection-cost">$${Math.floor(tower.totalSpent || type.cost)}</span>
        </div>
        <p>${type.description || tl("ui.supportDescFallback")}</p>
        <p>${tl("ui.rangeShown", { n: Math.round(type.range) })}</p>
      `;
      upgradeBtn.textContent = type.name;
      rangeBtn.textContent = tl("ui.upgRange");
      speedBtnUpgrade.textContent = tl("ui.upgSpeed");
      upgradeBtn.disabled = true;
      rangeBtn.disabled = true;
      speedBtnUpgrade.disabled = true;
      sellBtn.disabled = false;
    } else {
      selectionInfo.innerHTML = `
      <div class="selection-title-row">
        <strong>${type.name}</strong>
        <span class="selection-cost">$${Math.floor(tower.totalSpent || type.cost)}</span>
      </div>
      <p>${tl('ui.currentStatsHint')}</p>
      <div class="stat-preview-list">
        ${statRow(tl('ui.statDamage'), 'damage', damageLevel, stats.damage, nextDamage, damageMax)}
        ${statRow(tl('ui.statRange'), 'range', rangeLevel, Math.round(stats.range), Math.round(nextRange), rangeMax)}
        ${statRow(tl('ui.statSpeed'), 'speed', speedLevel, currentSpeed, nextSpeed, speedMax)}
      </div>
    `;

    upgradeBtn.textContent = damageCost === Infinity ? tl('ui.upgMax', { p: tl('ui.statDamage') }) : tl('ui.upgDamageCost', { n: damageCost });
    rangeBtn.textContent = rangeCost === Infinity ? tl('ui.upgMax', { p: tl('ui.statRange') }) : tl('ui.upgRangeCost', { n: rangeCost });
    speedBtnUpgrade.textContent = speedCost === Infinity ? tl('ui.upgMax', { p: tl('ui.statSpeed') }) : tl('ui.upgSpeedCost', { n: speedCost });

    upgradeBtn.disabled = damageCost === Infinity || state.money < damageCost;
    rangeBtn.disabled = rangeCost === Infinity || state.money < rangeCost;
    speedBtnUpgrade.disabled = speedCost === Infinity || state.money < speedCost;
    sellBtn.disabled = false;
    }
  } else {
    const type = state.selectedType
        ? towerTypes[state.selectedType]
        : null;

    if (type) {
      const previewTower = {
        type: state.selectedType,
        damageLevel: 1,
        rangeLevel: 1,
        speedLevel: 1,
        speedOverdrive: false,
        x: state.previewX || 0,
        y: state.previewY || 0
      };
      const previewStats = getTowerStats(previewTower);
      const previewDamage = tierValue(state.selectedType, "damage", Math.min(2, statTiers(state.selectedType, "damage").length));
      const previewRange = tierValue(state.selectedType, "range", Math.min(2, statTiers(state.selectedType, "range").length));
      const previewSpeed = 1 / getProjectedFireRate(previewTower, 1);
      const nextPreviewSpeed = 1 / getProjectedFireRate(previewTower, Math.min(2, statTiers(state.selectedType, "speed").length));
      const previewStatRow = (label, kind, current, next) => {
        const maxLevel = statMaxLevel(state.selectedType, kind);
        const fmt = value => kind === 'speed' ? Number(value).toFixed(2) : Math.round(value);
        return `
          <div class="stat-preview">
            <span class="stat-preview-label">${label}</span>
            <div class="stat-bars-wrap">
              <div class="stat-bars" aria-label="${tl('ui.barAria', { p: label, n: 1, max: maxLevel, next: tl('ui.barAriaNext', { n: 2 }) })}">
                ${Array.from({ length: maxLevel }, (_, index) => `<span class="stat-bar ${index === 0 ? `filled ${kind}` : index === 1 ? `preview ${kind}` : ''}" aria-hidden="true"></span>`).join('')}
              </div>
              <div class="stat-value stat-value-${kind}">${label}: ${fmt(current)} → ${fmt(next)} <span>(+${fmt(Number(next) - Number(current))})</span></div>
            </div>
          </div>`;
      };

      selectionInfo.innerHTML = `
        <div class="selection-title-row">
          <strong>${type.name}</strong>
          <span class="selection-cost">$${type.cost}</span>
        </div>
        <p>${tl('ui.upgradeHint')}</p>
        ${isSupportType(state.selectedType)
          ? `<p>${type.description || tl('ui.supportDescFallback')} · ${tl('ui.rangeSmall', { n: Math.round(type.range) })}</p>`
          : `<div class="stat-preview-list">
              ${previewStatRow(tl('ui.statDamage'), 'damage', previewStats.damage, previewDamage)}
              ${previewStatRow(tl('ui.statRange'), 'range', Math.round(previewStats.range), previewRange)}
              ${previewStatRow(tl('ui.statSpeed'), 'speed', previewSpeed, nextPreviewSpeed)}
            </div>`}
        <p>${tl('ui.pickSpot')}</p>
      `;
    } else {
      selectionInfo.innerHTML = `
        <div class="selection-title-row">
          <strong>${tl('ui.towerNotSelected')}</strong>
          <span class="selection-cost">—</span>
        </div>
        <p>${tl('ui.pickTower')}</p>
      `;
    }

    upgradeBtn.textContent = tl("ui.upgDamage");
    rangeBtn.textContent = tl("ui.upgRange");
    speedBtnUpgrade.textContent = tl("ui.upgSpeed");
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
        tl("ui.activeWaves", { n: state.activeWaves.length, m: spawningLeft + alive });
  } else {
    const seconds = Math.max(0, Math.ceil(state.nextWaveTimer));
    enemyCountEl.textContent = state.gameOver
        ? tl("ui.wavesStopped")
        : tl("ui.nextWaveIn", { n: seconds });
  }

  if (nextWaveBtn) {
    nextWaveBtn.textContent = state.waveActive
        ? tl("ui.startAnother")
        : tl("ui.startWave");
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
            tl("hint.deselectPlace")
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
            tl("ui.towerLevelHint", { n: type.name, lvl: existing.level })
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
            tl("hint.deselectPlace")
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

function selectTowerFromCard(event) {
  const button = event.target.closest(".tower-card");
  if (!button) return;

  const type = button.dataset.tower;
  if (!towerTypes[type]) return;

  if (!isTowerUnlocked(type)) {
    setHint(tl("ui.lockedHint", { n: towerTypes[type].unlockWave }));
    return;
  }

  const wasSelected = state.selectedType === type;
  state.selectedTower = null;
  state.selectedType = wasSelected ? null : type;

  document.querySelectorAll(".tower-card[data-tower]").forEach(card => {
    card.classList.toggle("active", !wasSelected && card === button);
  });

  state.previewValid = !wasSelected && !!state.selectedType && canPlaceTower(state.previewX, state.previewY);
  setHint(wasSelected ? tl("hint.deselected") : tl("hint.selectSpot", { n: towerTypes[type].name }));
  updateUi();
}

towerList.addEventListener("click", selectTowerFromCard);
if (boostList) boostList.addEventListener("click", selectTowerFromCard);

function setPanelCategory(category) {
  const showBoosts = category === "boosts";
  towerList.classList.toggle("hidden", showBoosts);
  boostList?.classList.toggle("hidden", !showBoosts);
  towersTab?.classList.toggle("active", !showBoosts);
  boostsTab?.classList.toggle("active", showBoosts);
  towersTab?.setAttribute("aria-selected", String(!showBoosts));
  boostsTab?.setAttribute("aria-selected", String(showBoosts));
}

towersTab?.addEventListener("click", () => setPanelCategory("towers"));
boostsTab?.addEventListener("click", () => setPanelCategory("boosts"));

/* =========================================================
   ПОДСКАЗКА-ОПИСАНИЕ (v59.19): полный текст башни по наведению
   над карточкой. Тач-устройства (hover:none) не получают поповер —
   там описание видно в selectionInfo после выбора.
========================================================= */

const towerTipEl = document.createElement("div");
towerTipEl.className = "tower-tip";
towerTipEl.hidden = true;
try { document.body.appendChild(towerTipEl); } catch (e) {}
let towerTipCard = null;
let towerTipKids = [];

function clearTowerTip() {
  towerTipKids.forEach(k => {
    try { towerTipEl.removeChild(k); } catch (e) {}
  });
  towerTipKids = [];
}

function hideTowerTip() {
  towerTipCard = null;
  clearTowerTip();
  towerTipEl.hidden = true;
}

function showTowerTip(card) {
  if (!card || card === towerTipCard && !towerTipEl.hidden) return;
  // только десктоп с курсором; в песочницах тестов matchMedia может не быть
  try {
    if (window.matchMedia && !window.matchMedia("(hover: hover)").matches) return;
  } catch (e) {}
  const type = card.dataset && card.dataset.tower;
  const def = type && towerTypes[type];
  if (!def) return;
  const lines = [];
  if (isTowerUnlocked(type)) {
    const head = [def.name];
    if (def.cost) head.push("$" + def.cost);
    lines.push(head.join(" · "));
    if (def.description) lines.push(def.description);
    if (def.combo) lines.push(def.combo.name + ": " + def.combo.description);
  } else {
    lines.push("???");
    lines.push(tl("ui.tipUnlockWave", { n: def.unlockWave || 0 }));
  }
  towerTipCard = card;
  clearTowerTip();
  lines.forEach(s => {
    const p = document.createElement("div");
    p.textContent = s;
    towerTipKids.push(p);
    towerTipEl.appendChild(p);
  });
  towerTipEl.hidden = false;
  try {
    const r = card.getBoundingClientRect();
    const tw = towerTipEl.offsetWidth || 200;
    const th = towerTipEl.offsetHeight || 60;
    let left = r.left + r.width / 2 - tw / 2;
    left = Math.max(6, Math.min(left, (window.innerWidth || 1280) - tw - 6));
    let top = r.top - th - 8;
    if (top < 4) top = r.bottom + 8; // над карточкой нет места — под неё
    towerTipEl.style.left = left + "px";
    towerTipEl.style.top = top + "px";
  } catch (e) {}
}

function towerTipFromEvent(e) {
  const card = e && e.target && e.target.closest ? e.target.closest(".tower-card") : null;
  if (card) showTowerTip(card); else hideTowerTip();
}

towerList.addEventListener("pointerover", towerTipFromEvent);
towerList.addEventListener("pointerleave", hideTowerTip);
towerList.addEventListener("click", hideTowerTip);
towerList.addEventListener("scroll", hideTowerTip);
if (boostList) {
  boostList.addEventListener("pointerover", towerTipFromEvent);
  boostList.addEventListener("pointerleave", hideTowerTip);
  boostList.addEventListener("click", hideTowerTip);
  boostList.addEventListener("scroll", hideTowerTip);
}
window.__towerTip = { show: showTowerTip, hide: hideTowerTip, el: towerTipEl };


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
          ? tl("ui.resume")
          : tl("ui.pause");

  if (!state.paused) {
    state.lastTime = performance.now();
  }
}

pauseBtn.addEventListener(
    "click",
    () => {
      // Рейтинговый бой: паузы нет (п. прав. требования к соревновательным
      // режимам — только системный пауз платформы остаётся).
      if (state.ranked) {
        return;
      }
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
      // Рейтинговый бой: ускорителя скорости нет — только x1.
      if (state.ranked) {
        state.speed = 1;
        speedBtn.textContent = "x1";
        return;
      }
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

if (devUnlockAllBtn) {
  devUnlockAllBtn.addEventListener("click", () => {
    DEV_ALL_UNLOCKED = !DEV_ALL_UNLOCKED;
    if (DEV_ALL_UNLOCKED) state.money = TEST_MONEY;
    updateDevMoneyButton();
    updateTowerAvailability();
    updateUi();
    setHint(tl(DEV_ALL_UNLOCKED ? "ui.devAllOn" : "ui.devAllOff"));
  });
  updateDevMoneyButton();
}

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
    setHint(tl("hint.noFullscreen"));
  }
}

function closeSettings() {
  if (!settingsPanel || !settingsBtn) return;
  settingsPanel.classList.add("hidden");
  settingsBtn.setAttribute("aria-expanded", "false");
}

function toggleSettings() {
  if (!settingsPanel || !settingsBtn) return;
  if (state.gameOver) {
    closeSettings();
    return;
  }
  const isOpen = !settingsPanel.classList.contains("hidden");
  settingsPanel.classList.toggle("hidden", isOpen);
  settingsBtn.setAttribute("aria-expanded", String(!isOpen));
}

function setGameOverUi(isGameOver) {
  if (!gameScreen || !settingsBtn || !settingsWidget) return;
  gameScreen.classList.toggle("game-over-active", isGameOver);
  settingsBtn.disabled = isGameOver;
  settingsBtn.setAttribute("aria-disabled", String(isGameOver));
  settingsBtn.tabIndex = isGameOver ? -1 : 0;
  if (isGameOver) closeSettings();
}

if (settingsBtn) {
  settingsBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    if (state.gameOver) return;
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
        ? tl("ui.exitFullscreen")
        : tl("ui.fullscreen");
  }
});

if (nextWaveBtn) {
  nextWaveBtn.addEventListener("click", queueNextWave);
}

menuBtn.addEventListener(
    "click",
    () => { onMenuButton(); }
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
      const del = event.target.closest("[data-del-map]");
      if (del) {
        event.stopPropagation();
        deleteCustomMap(del.getAttribute("data-del-map"));
        return;
      }
      const editor = event.target.closest("[data-open-editor]");
      if (editor) {
        openMapEditor();
        return;
      }
      const button = event.target.closest(".map-card");
      if (!button || !button.dataset.map) return;
      selectMap(button.dataset.map);
    }
);

const openEditorBtn = document.getElementById("openEditorBtn");
if (openEditorBtn) {
  openEditorBtn.addEventListener("click", openMapEditor);
}

// Если пользователь сохранял карты в редакторе (в другой вкладке),
// при возврате в меню список обновляется без перезагрузки страницы.
let lastMapsSnapshot = "";
window.addEventListener("focus", () => {
  if (mainMenu && !mainMenu.classList.contains("hidden")) {
    renderMapCards();
    try {
      const raw = localStorage.getItem(CUSTOM_MAPS_KEY) || "";
      if (raw !== lastMapsSnapshot) {
        lastMapsSnapshot = raw;
        window.NeonBridgeYandex && window.NeonBridgeYandex.pushCloudMaps && window.NeonBridgeYandex.pushCloudMaps();
      }
    } catch (e) { /* хранилище недоступно */ }
  }
});

restartBtn.addEventListener(
    "click",
    () => {
      // На Яндекс.Играх рестарт продолжится после полноэкранного рекламного
      // блока (пользовательское действие -> логическая пауза, п. 4.4);
      // локально restartGate сразу вызывает колбэк.
      const run = () => startNewGame();
      if (window.NeonBridgeYandex && typeof window.NeonBridgeYandex.restartGate === "function") {
        window.NeonBridgeYandex.restartGate(run);
      } else {
        run();
      }
    }
);

if (endMenuBtn) {
  endMenuBtn.addEventListener("click", () => {
    ensureAudio();
    endModal.classList.add("hidden");
    setGameOverUi(false);
    showMainMenu();
  });
}

if (newGameBtn) {
  newGameBtn.addEventListener("click", startNewGame);
}

/* ---- Rewarded-реклама: явная кнопка с бонусом (п. 4.5 требований) --------
   Награда — только бонусные доллары, продолжение игры не требует рекламы.
   Кнопка удаляется оболочкой game.js, если SDK нет (вне платформы). */
const AD_MONEY_REWARD = 250;
let adRewardBusy = false;
function refreshAdRewardLabel() {
  if (!adRewardBtn) return;
  adRewardBtn.textContent = tl("ui.adReward", { n: AD_MONEY_REWARD });
}
if (adRewardBtn) {
  refreshAdRewardLabel();
  adRewardBtn.addEventListener("click", () => {
    if (adRewardBusy || state.gameOver || state.paused) return;
    const bridge = window.NeonBridgeYandex;
    if (!bridge || typeof bridge.showRewardedAd !== "function") return;
    adRewardBusy = true;
    adRewardBtn.disabled = true;
    const release = () => {
      setTimeout(() => {
        adRewardBusy = false;
        adRewardBtn.disabled = !!state.gameOver;
      }, 1500);
    };
    const shown = bridge.showRewardedAd(
        () => {
          state.money += AD_MONEY_REWARD;
          setHint(tl("hint.adGranted", { n: AD_MONEY_REWARD }));
          updateUi();
        },
        release
    );
    if (!shown) {
      adRewardBusy = false;
      adRewardBtn.disabled = false;
      setHint(tl("hint.adUnavailable"));
    }
  });
}

/* Мост для оболочки: объединение облачных карт применено к localStorage —
   перечитать хранилище и обновить список в меню. */
window.NeonGameBridge = {
  mapsRestored() {
    try {
      mergeCustomMaps();
      renderMapCards();
      selectMap(currentMap);
    } catch (e) { /* меню ещё не готово */ }
  },
  /* После облачного восстановления перечитать состояние кнопки «Продолжить». */
  refreshMenu() {
    try { updateResumeButton(); } catch (e) { /* noop */ }
  }
};

/* Хуки для оболочки game.js (разметка геймплея, пауза). */
window.NeonGameHooks = {
  isPaused: () => !!state.paused,
  isGameOver: () => !!state.gameOver,
  // Прямое управление паузой без синтетических кликов (панель отладки SDK,
  // переключение вкладок): пауза не должна зависеть от listeners в DOM.
  pause() { if (!state.gameOver) setPaused(true); },
  resume() { if (!state.gameOver) setPaused(false); }
};

// Намеренно НЕ сохраняем игру при обновлении/закрытии страницы.
// «Продолжить игру» появляется только после явного выхода в главное меню
// из активной партии.


/* =========================================================
   ОТРИСОВКА ФОНА
========================================================= */

function drawBackground() {
  const t = performance.now() / 1000;

  ctx.fillStyle = "#151a2b";
  ctx.fillRect(
      0,
      0,
      GAME_WIDTH,
      GAME_HEIGHT
  );

  /*
   * Мягкие «туманности» — глубина сцены.
   */
  const blobA = ctx.createRadialGradient(180, 110, 20, 180, 110, 430);
  blobA.addColorStop(0, "rgba(238,241,247, 0.03)");
  blobA.addColorStop(1, "rgba(238,241,247, 0)");
  ctx.fillStyle = blobA;
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  const blobB = ctx.createRadialGradient(850, 560, 20, 850, 560, 470);
  blobB.addColorStop(0, "rgba(75,99,148, 0.10)");
  blobB.addColorStop(1, "rgba(75,99,148, 0)");
  ctx.fillStyle = blobB;
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  /*
   * Сетка с медленным дыханием.
   */
  const gridAlpha = 0.016 + 0.006 * Math.sin(t * 0.8);
  ctx.strokeStyle = `rgba(116,196,118, ${gridAlpha.toFixed(3)})`;

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
   * Мерцающие точки-звёзды.
   */
  let dotIndex = 0;
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
      const tw = 0.5 + 0.5 * Math.sin(t * 1.7 + dotIndex * 1.31 + x * 0.013);
      ctx.fillStyle = `rgba(238,241,247, ${(0.012 + tw * 0.035).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(
          x,
          y,
          1.2 + tw * 0.9,
          0,
          Math.PI * 2
      );
      ctx.fill();
      dotIndex++;
    }
  }

  /*
   * Виньетка — фокус на центр поля.
   */
  const vignette = ctx.createRadialGradient(
      GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_HEIGHT * 0.42,
      GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH * 0.68
  );
  vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
  vignette.addColorStop(1, "rgba(5,7,13, 0.55)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
}


/* =========================================================
   ДОРОГА
========================================================= */

function drawRoad() {
  const t = performance.now() / 1000;

  ctx.save();

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const tracePath = () => {
    ctx.beginPath();
    ctx.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i++) {
      ctx.lineTo(path[i].x, path[i].y);
    }
  };

  /*
   * Дорога в языке «Commons»: глубина светом и тенью, без glow.
   * 1) мягкая cast-тень под полотном; 2) кремовая волосяная кромка;
   * 3) асфальт темнее фона; 4) утопленный жёлоб; 5) бегущая разметка.
   */
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.strokeStyle = "rgba(5,7,13, 0.55)";
  ctx.lineWidth = 84;
  tracePath();
  ctx.stroke();

  ctx.strokeStyle = "rgba(238,241,247, 0.15)";
  ctx.lineWidth = 76;
  tracePath();
  ctx.stroke();

  /*
   * Основная дорога.
   */
  ctx.strokeStyle = "#191e30";
  ctx.lineWidth = 72;
  tracePath();
  ctx.stroke();

  /*
   * Тёмная внутренняя дорожка — объём полотна.
   */
  ctx.strokeStyle = "rgba(9,11,20, 0.5)";
  ctx.lineWidth = 44;
  tracePath();
  ctx.stroke();

  /*
   * Бегущая разметка: куда катит поток.
   */
  ctx.strokeStyle = "rgba(238,199,110, 0.4)";
  ctx.lineWidth = 2;
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";
  ctx.setLineDash([12, 20]);
  ctx.lineDashOffset = -t * 52;
  tracePath();
  ctx.stroke();

  ctx.setLineDash([]);
  ctx.shadowBlur = 0;

  ctx.restore();
}


/* =========================================================
   ТОЧКА ВЫХОДА
========================================================= */

function drawCore() {
  const core =
      path[path.length - 1];
  if (!core) return;

  // Анимированный неоновый реактор в конце дороги.
  const t = performance.now() / 1000;
  const pulse = 0.5 + 0.5 * Math.sin(t * 2.6);
  const cx = core.x;
  const cy = core.y;

  ctx.save();

  // Внешнее энергетическое свечение.
  const halo = ctx.createRadialGradient(cx, cy, 6, cx, cy, 52 + pulse * 8);
  halo.addColorStop(0, "rgba(223,106,95, 0.40)");
  halo.addColorStop(0.45, "rgba(223,106,95, 0.16)");
  halo.addColorStop(1, "rgba(223,106,95, 0)");
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(cx, cy, 52 + pulse * 8, 0, Math.PI * 2);
  ctx.fill();

  // Тёмная посадочная чаша.
  ctx.fillStyle = "rgba(10,13,22, 0.92)";
  ctx.beginPath();
  ctx.arc(cx, cy, 33, 0, Math.PI * 2);
  ctx.fill();

  // Вращающаяся насечка внешней защиты.
  ctx.save();
  ctx.strokeStyle = "rgba(223,106,95, 0.55)";
  ctx.lineWidth = 2;
  ctx.setLineDash([24, 58]);
  ctx.lineDashOffset = -t * 40;
  ctx.beginPath();
  ctx.arc(cx, cy, 41, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Основное кольцо корпуса.
  ctx.shadowBlur = 0;
  ctx.shadowColor = "#df6a5f";
  ctx.strokeStyle = "#df6a5f";
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.arc(cx, cy, 32, 0, Math.PI * 2);
  ctx.stroke();

  // Пульсирующее внутреннее кольцо.
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(207,142,151, 0.85)";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(cx, cy, 23 + pulse * 2.4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Орбитальные искры.
  ctx.shadowBlur = 0;
  ctx.shadowColor = "#df6a5f";
  for (let i = 0; i < 3; i++) {
    const angle = t * 1.9 + (i * Math.PI * 2) / 3;
    const radius = 27 + Math.sin(t * 3 + i * 2) * 3;
    ctx.fillStyle = "rgba(246,248,252, 0.9)";
    ctx.beginPath();
    ctx.arc(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;

  // Раскалённое ядро.
  const heart = ctx.createRadialGradient(cx - 3, cy - 3, 1, cx, cy, 14 + pulse * 3);
  heart.addColorStop(0, "#f6f8fc");
  heart.addColorStop(0.35, "#df6a5f");
  heart.addColorStop(0.75, "#6e2f36");
  heart.addColorStop(1, "rgba(26,17,34, 0.9)");
  ctx.fillStyle = heart;
  ctx.shadowBlur = 0;
  ctx.shadowColor = "#df6a5f";
  ctx.beginPath();
  ctx.arc(cx, cy, 12.5 + pulse * 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Подпись.
  ctx.fillStyle = "rgba(207,142,151, 0.55)";
  ctx.font = "700 10px 'JetBrains Mono', Consolas, ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.fillText("CORE", cx, cy + 52);
  ctx.textAlign = "left";

  ctx.restore();
}


/* =========================================================
   БАШНИ
========================================================= */

function drawComboLinks(groups) {
  if (!groups || !groups.length) return;

  const now = performance.now();
  const pulse = 0.45 + 0.2 * Math.sin(now / 180);

  ctx.save();
  ctx.setLineDash([8, 7]);
  ctx.lineWidth = 2.2;
  ctx.lineCap = "round";

  for (const group of groups) {
    if (group.length < 3) continue;
    const type = towerTypes[group[0].type];
    ctx.strokeStyle = type.color;
    ctx.shadowColor = type.color;
    ctx.shadowBlur = 0;
    ctx.globalAlpha = pulse;

    // Соединяем все башни группы. Это также работает для цепных групп,
    // где первая и третья башня могут быть дальше COMBO_RADIUS друг от друга.
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        ctx.beginPath();
        ctx.moveTo(group[i].x, group[i].y);
        ctx.lineTo(group[j].x, group[j].y);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

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

  const comboReady = (state.comboReadyTowers && state.comboReadyTowers.has(tower)) || false;
  if (comboReady) {
    ctx.save();
    ctx.globalAlpha = 0.35 + 0.15 * Math.sin(performance.now() / 180);
    ctx.strokeStyle = type.color;
    ctx.shadowBlur = 0;
    ctx.shadowColor = type.color;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 6]);
    ctx.beginPath();
    ctx.arc(tower.x, tower.y, 29, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  /*
   * Свечение.
   */
  ctx.save();

  if (tower.speedOverdriveShake > 0) {
    const intensity = 6.5 * (tower.speedOverdriveShake / SPEED_OVERDRIVE_SHAKE_DURATION);
    ctx.translate((Math.random() - 0.5) * intensity, (Math.random() - 0.5) * intensity);
  }

  const t = performance.now() / 1000;
  const phase = (tower.x * 0.013 + tower.y * 0.017) % (Math.PI * 2);
  const pulse = 0.5 + 0.5 * Math.sin(t * 3 + phase);

  const hexPath = (radius) => {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = -Math.PI / 2 + i * Math.PI / 3;
      const px = tower.x + Math.cos(angle) * radius;
      const py = tower.y + Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  };

  ctx.shadowBlur = 0;

  ctx.shadowColor =
      type.color;

  /*
   * Общая база: шестигранный пьедестал с внутренней плитой.
   */
  ctx.fillStyle =
      "#191e30";

  ctx.strokeStyle =
      type.color;

  ctx.lineWidth =
      selected ? 3 : 2;

  hexPath(22);
  ctx.fill();
  ctx.stroke();

  ctx.save();
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 0.4;
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = type.color;
  hexPath(15.5);
  ctx.stroke();
  ctx.restore();

  /*
   * Турель: ствол наведён на последнюю цель («кинетические» башни).
   */
  const hasBarrel =
      tower.type === "rail" ||
      tower.type === "titan" ||
      tower.type === "nova" ||
      tower.type === "devastator";

  if (hasBarrel) {
    const angle = typeof tower.aimAngle === "number" ? tower.aimAngle : -Math.PI / 2;
    const barrelLength = tower.type === "rail" ? 34 : tower.type === "devastator" ? 28 : 22;
    const barrelHalf = tower.type === "devastator" ? 6 : tower.type === "rail" ? 3.4 : 4.4;

    ctx.save();
    ctx.translate(tower.x, tower.y);
    ctx.rotate(angle);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#1f2638";
    ctx.strokeStyle = type.color;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.rect(4, -barrelHalf, barrelLength, barrelHalf * 2);
    ctx.fill();
    ctx.stroke();

    if (tower.type === "rail") {
      // Рельсотрон: две направляющие шины.
      ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(7, -barrelHalf + 1.5);
      ctx.lineTo(4 + barrelLength - 4, -barrelHalf + 1.5);
      ctx.moveTo(7, barrelHalf - 1.5);
      ctx.lineTo(4 + barrelLength - 4, barrelHalf - 1.5);
      ctx.stroke();
    } else if (tower.type === "devastator") {
      // Опустошитель: бронзовое утолщение ствола.
      ctx.fillStyle = "rgba(207,142,151, 0.45)";
      ctx.beginPath();
      ctx.rect(4 + barrelLength * 0.4, -barrelHalf - 1.5, 5, barrelHalf * 2 + 3);
      ctx.fill();
    }

    // Срез ствола.
    ctx.fillStyle = type.color;
    ctx.beginPath();
    ctx.rect(4 + barrelLength - 6, -barrelHalf + 1.2, 6, barrelHalf * 2 - 2.4);
    ctx.fill();

    // Вспышка сразу после выстрела.
    if (tower.muzzleFlash > 0) {
      const flash = tower.muzzleFlash / 0.12;
      ctx.globalAlpha = flash;
      ctx.fillStyle = "#eef1f7";
      ctx.shadowBlur = 0;
      ctx.shadowColor = type.color;
      ctx.beginPath();
      ctx.arc(4 + barrelLength + 3, 0, 3 + flash * 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  /*
   * Надстройка конкретного типа.
   */
  ctx.strokeStyle = type.color;
  ctx.fillStyle = type.color;

  if (isSupportType(tower.type)) {
    // Модуль поддержки: энергетический конденсатор с орбитами.
    const cap = ctx.createRadialGradient(tower.x, tower.y, 1, tower.x, tower.y, 11);
    cap.addColorStop(0, "#eef1f7");
    cap.addColorStop(0.45, type.color);
    cap.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = cap;
    ctx.shadowBlur = 0;
    ctx.shadowColor = type.color;
    ctx.beginPath();
    ctx.arc(tower.x, tower.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = type.color;
    for (let i = 0; i < 2; i++) {
      const orbit = t * 2.2 + i * Math.PI;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(tower.x + Math.cos(orbit) * 17, tower.y + Math.sin(orbit) * 17, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Тонкое кольцо зоны усиления (раньше жило в мёртвом коде и не рисовалось).
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.16;
    ctx.strokeStyle = type.color;
    ctx.lineWidth = 1.2;
    ctx.setLineDash([6, 9]);
    ctx.lineDashOffset = -t * 12;
    ctx.beginPath();
    ctx.arc(tower.x, tower.y, type.range, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  } else if (tower.type === "pulse") {
    // Импульс: реактор с силовыми контактами.
    const coreGradient = ctx.createRadialGradient(
        tower.x, tower.y, 1,
        tower.x, tower.y, 12
    );
    coreGradient.addColorStop(0, "#f6f8fc");
    coreGradient.addColorStop(0.35, type.color);
    coreGradient.addColorStop(1, "rgba(238,241,247, 0)");
    ctx.fillStyle = coreGradient;
    ctx.beginPath();
    ctx.arc(tower.x, tower.y, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#eef1f7";
    ctx.lineWidth = 1.4;
    ctx.globalAlpha = 0.8;
    ctx.setLineDash([5, 7]);
    ctx.lineDashOffset = -t * 26;
    ctx.beginPath();
    ctx.arc(tower.x, tower.y, 17.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = type.color;
    ctx.shadowBlur = 0;
    ctx.shadowColor = type.color;
    for (let i = 0; i < 4; i++) {
      const contact = i * Math.PI / 2 + Math.PI / 4;
      ctx.beginPath();
      ctx.arc(
          tower.x + Math.cos(contact) * 13.5,
          tower.y + Math.sin(contact) * 13.5,
          2.1,
          0,
          Math.PI * 2
      );
      ctx.fill();
    }

    ctx.fillStyle = "#eef1f7";
    ctx.shadowBlur = 0;
    ctx.shadowColor = type.color;
    ctx.beginPath();
    ctx.arc(tower.x, tower.y, 2.8 + pulse * 1.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  } else if (tower.type === "frost") {
    // Криоузел: вращающийся ледяной кристалл из трёх пластин.
    ctx.save();
    ctx.translate(tower.x, tower.y);
    ctx.rotate(t * 0.6);
    ctx.strokeStyle = type.color;
    ctx.lineWidth = 1.8;
    ctx.shadowBlur = 0;
    ctx.shadowColor = type.color;
    for (let i = 0; i < 3; i++) {
      ctx.rotate(Math.PI / 3);
      ctx.fillStyle = "rgba(164,220,184, 0.14)";
      ctx.beginPath();
      ctx.moveTo(0, -17);
      ctx.lineTo(4.4, 0);
      ctx.lineTo(0, 17);
      ctx.lineTo(-4.4, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = "#eef1f7";
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(0, 0, 2.8 + pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.shadowBlur = 0;
  } else if (tower.type === "blast") {
    // Разлом: мортира с вращающимися снарядами.
    ctx.fillStyle = "#10141f";
    ctx.beginPath();
    ctx.arc(tower.x, tower.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.stroke();

    const muzzle = ctx.createRadialGradient(tower.x, tower.y, 1, tower.x, tower.y, 7);
    muzzle.addColorStop(0, "#e8a04c");
    muzzle.addColorStop(0.5, type.color);
    muzzle.addColorStop(1, "rgba(223,106,95, 0)");
    ctx.fillStyle = muzzle;
    ctx.beginPath();
    ctx.arc(tower.x, tower.y, 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = type.color;
    ctx.shadowBlur = 0;
    ctx.shadowColor = type.color;
    for (let i = 0; i < 3; i++) {
      const shell = -t * 1.6 + i * (Math.PI * 2 / 3);
      ctx.beginPath();
      ctx.arc(
          tower.x + Math.cos(shell) * 16.5,
          tower.y + Math.sin(shell) * 16.5,
          2.2,
          0,
          Math.PI * 2
      );
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  } else if (tower.type === "arc") {
    // Дуга: телескоп-катушка с живым разрядом между рогами.
    ctx.fillStyle = "#191e30";
    ctx.beginPath();
    ctx.arc(tower.x, tower.y - 7, 6.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = type.color;
    ctx.lineWidth = 1.8;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(tower.x - 8, tower.y + 13);
    ctx.lineTo(tower.x, tower.y - 1);
    ctx.lineTo(tower.x + 8, tower.y + 13);
    ctx.stroke();

    ctx.strokeStyle = "#e8b64c";
    ctx.shadowBlur = 0;
    ctx.shadowColor = "#e8b64c";
    ctx.lineWidth = 1.4;
    ctx.globalAlpha = 0.45 + pulse * 0.55;
    ctx.beginPath();
    ctx.moveTo(tower.x - 8, tower.y + 13);
    ctx.lineTo(tower.x + (Math.random() - 0.5) * 9, tower.y + 5 + (Math.random() - 0.5) * 6);
    ctx.lineTo(tower.x + 8, tower.y + 13);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    ctx.fillStyle = "#eef1f7";
    ctx.beginPath();
    ctx.arc(tower.x, tower.y - 7, 1.8 + pulse, 0, Math.PI * 2);
    ctx.fill();
  } else if (tower.type === "titan") {
    // Титан: броневые клёпки по ребрам и реактивное сопло.
    ctx.fillStyle = type.color;
    ctx.shadowBlur = 0;
    ctx.shadowColor = type.color;
    for (let i = 0; i < 6; i++) {
      const rivet = -Math.PI / 2 + i * Math.PI / 3;
      ctx.beginPath();
      ctx.arc(
          tower.x + Math.cos(rivet) * 18,
          tower.y + Math.sin(rivet) * 18,
          1.7,
          0,
          Math.PI * 2
      );
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    ctx.fillStyle = "#273049";
    ctx.beginPath();
    ctx.arc(tower.x, tower.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.stroke();

    ctx.fillStyle = "#e08b52";
    ctx.beginPath();
    ctx.arc(tower.x, tower.y, 3 + pulse * 1.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (tower.type === "nova") {
    // Нова: стабилизирующее кольцо вокруг плазменной сферы.
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = type.color;
    ctx.shadowBlur = 0;
    ctx.shadowColor = type.color;
    ctx.setLineDash([10, 8]);
    ctx.lineDashOffset = t * 30;
    ctx.beginPath();
    ctx.arc(tower.x, tower.y, 19, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    const novaOrb = ctx.createRadialGradient(tower.x, tower.y, 1, tower.x, tower.y, 9);
    novaOrb.addColorStop(0, "#eef1f7");
    novaOrb.addColorStop(0.5, type.color);
    novaOrb.addColorStop(1, "rgba(116,196,118, 0)");
    ctx.fillStyle = novaOrb;
    ctx.beginPath();
    ctx.arc(tower.x, tower.y, 9, 0, Math.PI * 2);
    ctx.fill();
  } else if (tower.type === "devastator") {
    // Опустошитель: сигнальное кольцо опасности.
    ctx.save();
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = "#df6a5f";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 7]);
    ctx.lineDashOffset = -t * 34;
    ctx.beginPath();
    ctx.arc(tower.x, tower.y, 25.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = "#151226";
    ctx.beginPath();
    ctx.arc(tower.x, tower.y, 8.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = type.color;
    ctx.lineWidth = 1.6;
    ctx.stroke();

    ctx.fillStyle = "#cf8e97";
    ctx.beginPath();
    ctx.arc(tower.x, tower.y, 3.2 + pulse * 1.3, 0, Math.PI * 2);
    ctx.fill();
  } else if (tower.type === "singularity") {
    // Нуль-коллайдер: горизонт событий и аккреционный диск.
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = type.color;
    ctx.lineWidth = 1.6;
    ctx.setLineDash([14, 22]);
    ctx.lineDashOffset = -t * 60;
    ctx.beginPath();
    ctx.arc(tower.x, tower.y, 27, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = "#0d1018";
    ctx.beginPath();
    ctx.arc(tower.x, tower.y, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#eef1f7";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(tower.x, tower.y, 11, 0, Math.PI * 2);
    ctx.stroke();

    ctx.save();
    ctx.translate(tower.x, tower.y);
    ctx.rotate(t * 1.4);
    ctx.strokeStyle = type.color;
    ctx.shadowBlur = 0;
    ctx.shadowColor = type.color;
    ctx.lineWidth = 2.4;
    ctx.globalAlpha = 0.95;
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0.3, Math.PI * 1.25);
    ctx.stroke();
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(0, 0, 4.5, Math.PI + 0.4, Math.PI * 2.1);
    ctx.stroke();
    ctx.restore();
    ctx.shadowBlur = 0;
  } else {
    ctx.beginPath();
    ctx.arc(tower.x, tower.y, 12, 0, Math.PI * 2);
    ctx.fillStyle = type.color;
    ctx.fill();
  }

  ctx.restore();
}

/* =========================================================
   ВРАГИ
========================================================= */

function drawEnemy(enemy) {
  if (enemy.dead) return;

  const hpPercent = Math.max(0, enemy.hp / enemy.maxHp);
  const type = enemy.enemyType || getEnemyType(enemy.waveNumber);
  const r = enemy.radius;
  const t = performance.now() / 1000;
  const flick = 0.5 + 0.5 * Math.sin(t * 17 + enemy.distance * 0.3);

  // Нос корабля смотрит вдоль маршрута (плавный доворот).
  const ahead = getPointOnPath(Math.min(enemy.distance + 6, PATH_LENGTH));
  const want = Math.atan2(ahead.y - enemy.y, ahead.x - enemy.x);
  if (typeof enemy.angle !== "number" || !Number.isFinite(enemy.angle)) {
    enemy.angle = want;
  } else {
    let diff = want - enemy.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    enemy.angle += diff * 0.18;
  }

  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  ctx.rotate(enemy.angle);
  ctx.shadowBlur = 0;
  ctx.shadowColor = type.glow;

  // Пламя двигателя за кормой.
  const flame = ctx.createLinearGradient(-r * 2.1, 0, -r * 0.3, 0);
  flame.addColorStop(0, "rgba(255, 255, 255, 0)");
  flame.addColorStop(1, type.glow);
  ctx.globalAlpha = 0.45 + 0.4 * flick;
  ctx.fillStyle = flame;
  ctx.beginPath();
  ctx.moveTo(-r * 0.35, -r * 0.4);
  ctx.lineTo(-r * (1.55 + flick * 0.6), 0);
  ctx.lineTo(-r * 0.35, r * 0.4);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;

  drawEnemyShipHull(type.shape, r, type.color);
  ctx.restore();

  ctx.save();
  ctx.shadowBlur = 0;

  // Заморозка: крутящееся ледяное кольцо.
  if (enemy.slowTimer > 0) {
    ctx.strokeStyle = "rgba(164,220,184, 0.75)";
    ctx.lineWidth = 1.4;
    ctx.setLineDash([4, 5]);
    ctx.lineDashOffset = performance.now() / 60;
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.radius + 7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // HP-бар: цвет зависит от остатка здоровья.
  const barWidth = Math.max(24, enemy.radius * 2.4);
  const barHeight = 4;
  const barX = enemy.x - barWidth / 2;
  const barY = enemy.y - enemy.radius - 14;
  const hpColor =
      hpPercent > 0.5 ? "#74c476" :
      hpPercent > 0.25 ? "#e8a04c" : "#c9504f";
  ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
  ctx.fillRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);
  ctx.fillStyle = hpColor;
  ctx.fillRect(barX, barY, barWidth * hpPercent, barHeight);
  ctx.restore();
}

/* =========================================================
   СНАРЯДЫ
========================================================= */

function drawProjectile(projectile) {
  ctx.save();

  const target = projectile.target;
  if (target && !target.dead) {
    projectile.angle = Math.atan2(target.y - projectile.y, target.x - projectile.x);
  }
  const angle = projectile.angle || 0;

  ctx.translate(projectile.x, projectile.y);
  ctx.rotate(angle);

  ctx.shadowBlur = 0;
  ctx.shadowColor =
      projectile.color;

  ctx.fillStyle =
      projectile.color;

  // Светящийся хвост.
  ctx.globalAlpha = 0.32;
  ctx.beginPath();
  ctx.ellipse(-9, 0, 11, 2.6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Тело снаряда.
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.ellipse(0, 0, 6, 3.4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Белая сердцевина.
  ctx.fillStyle = "#eef1f7";
  ctx.beginPath();
  ctx.arc(2.2, 0, 1.8, 0, Math.PI * 2);
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

      ctx.lineWidth = 1 + 3 * alpha;

      ctx.shadowBlur = 0;
      ctx.shadowColor =
          effect.color;

      // Основная ударная волна.
      ctx.beginPath();

      ctx.arc(
          effect.x,
          effect.y,
          effect.radius,
          0,
          Math.PI * 2
      );

      ctx.stroke();

      // Внутреннее кольцо.
      ctx.globalAlpha = alpha * 0.55;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, effect.radius * 0.55, 0, Math.PI * 2);
      ctx.stroke();

      // Белая вспышка в центре.
      const flashR = effect.maxRadius * 0.6;
      if (flashR > 1) {
        const flash = ctx.createRadialGradient(effect.x, effect.y, 1, effect.x, effect.y, flashR);
        flash.addColorStop(0, "rgba(255, 255, 255, " + (0.35 * alpha).toFixed(3) + ")");
        flash.addColorStop(1, "rgba(255, 255, 255, 0)");
        ctx.fillStyle = flash;
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, flashR, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (
        effect.type ===
        "lightning"
    ) {
      ctx.globalAlpha =
          alpha;

      ctx.strokeStyle =
          "#e8b64c";

      ctx.shadowBlur = 0;
      ctx.shadowColor =
          "#e8b64c";

      ctx.lineWidth = 2.5;

      // Живой зигзаг с дёрганием на каждом кадре.
      const dx = effect.x2 - effect.x1;
      const dy = effect.y2 - effect.y1;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;

      ctx.beginPath();
      ctx.moveTo(effect.x1, effect.y1);
      for (let s = 1; s < 4; s++) {
        const p = s / 4;
        const jitter = (Math.random() - 0.5) * Math.min(26, len * 0.22);
        ctx.lineTo(
            effect.x1 + dx * p + nx * jitter,
            effect.y1 + dy * p + ny * jitter
        );
      }
      ctx.lineTo(effect.x2, effect.y2);
      ctx.stroke();

      // Тонкая параллельная ветка.
      ctx.globalAlpha = alpha * 0.5;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(effect.x1, effect.y1);
      ctx.lineTo(effect.x1 + dx * 0.5 + nx * 12, effect.y1 + dy * 0.5 + ny * 12);
      ctx.lineTo(effect.x2, effect.y2);
      ctx.stroke();
    }

    if (effect.type === "place") {
      ctx.globalAlpha = Math.max(0, effect.life / effect.maxLife);
      const progress = 1 - effect.life / effect.maxLife;
      ctx.strokeStyle = effect.color || "#74c476";
      ctx.lineWidth = 3;
      ctx.shadowBlur = 0; ctx.shadowColor = effect.color || "#74c476";
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, 10 + progress * 30, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (effect.type === "cash") {
      ctx.globalAlpha = alpha;
      ctx.translate(effect.x, effect.y);
      const pop = 1 + 0.22 * Math.pow(alpha, 3);
      ctx.scale(pop, pop);
      ctx.font = "800 16px 'JetBrains Mono', Consolas, ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = "rgba(9,11,20, 0.85)";
      ctx.strokeText(`+$${effect.amount}`, 0, 0);
      ctx.fillStyle = "#e8a04c";
      ctx.shadowBlur = 0;
      ctx.shadowColor = "#e08b52";
      ctx.fillText(`+$${effect.amount}`, 0, 0);
    }

    // Комбо-взрыв раньше вообще не рисовался — теперь виден.
    if (effect.type === "comboBurst") {
      ctx.globalAlpha = alpha * 0.9;
      ctx.strokeStyle = effect.color;
      ctx.lineWidth = 2 + 5 * alpha;
      ctx.shadowBlur = 0;
      ctx.shadowColor = effect.color;
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, effect.radius, 0, Math.PI * 2);
      ctx.stroke();

      const burstFill = ctx.createRadialGradient(
          effect.x, effect.y, 2,
          effect.x, effect.y, Math.max(4, effect.radius)
      );
      burstFill.addColorStop(0, "rgba(255, 255, 255, " + (0.30 * alpha).toFixed(3) + ")");
      burstFill.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = burstFill;
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, effect.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Установка мины: пунктирное кольцо, сжимающееся к точке.
    if (effect.type === "minePlace") {
      ctx.globalAlpha = alpha * 0.9;
      ctx.strokeStyle = effect.color || "#74c476";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.shadowBlur = 0;
      ctx.shadowColor = effect.color || "#74c476";
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, effect.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Красная пульсация краёв при потере жизни.
    if (effect.type === "leakFlash") {
      const a = alpha;
      const leakVignette = ctx.createRadialGradient(
          GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_HEIGHT * 0.36,
          GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH * 0.62
      );
      leakVignette.addColorStop(0, "rgba(201,80,79, 0)");
      leakVignette.addColorStop(1, "rgba(201,80,79, " + (0.4 * a).toFixed(3) + ")");
      ctx.fillStyle = leakVignette;
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    }

    ctx.restore();
  }
}


function drawTowerUpgradeVisual(tower, type) {
  const damageLevel = tower.damageLevel || 1;
  const rangeLevel = tower.rangeLevel || 1;
  const speedLevel = tower.speedLevel || 1;
  const levels = [damageLevel, rangeLevel, speedLevel];
  const kindNames = ["damage", "range", "speed"];
  const colors = ["#df6a5f", "#e8a04c", "#eec76a"];
  const selected = tower === state.selectedTower;
  const allMax = kindNames.every(kind => isStatMaxed(tower, kind));
  const comboReady = (state.comboReadyTowers && state.comboReadyTowers.has(tower)) || false;

  ctx.save();

  // Цвета находятся внутри корпуса самой башни, а не на радиусе атаки.
  ctx.globalCompositeOperation = "source-atop";

  if (allMax) {
    const greenGlow = ctx.createRadialGradient(
        tower.x, tower.y, 2,
        tower.x, tower.y, 25
    );
    greenGlow.addColorStop(0, "rgba(116,196,118, 0.95)");
    greenGlow.addColorStop(0.55, "rgba(116,196,118, 0.72)");
    greenGlow.addColorStop(1, "rgba(116,196,118, 0)");

    ctx.fillStyle = greenGlow;
    ctx.fillRect(tower.x - 25, tower.y - 25, 50, 50);
  } else {
    const offsets = [
      [-9, 4],
      [0, -9],
      [9, 4]
    ];

    levels.forEach((level, index) => {
      // У продвинутых башен радиус может иметь ОДИН тир (rngTiers:[420] у
      // «Опустошителя»): (level-1)/(max-1) давал 0/0=NaN, а NaN в строке
      // цвета бросал SyntaxError в реальном canvas — весь draw() падал в
      // catch, и вместо карты оставалась служебная сетка (баг v59.11).
      const maxL = statMaxLevel(tower.type, kindNames[index]);
      const progress = maxL > 1 ? (level - 1) / (maxL - 1) : 0;
      if (!(progress > 0)) {
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
      const progress = clamp(level / statMaxLevel(tower.type, kindNames[index]), 0.2, 1);

      ctx.shadowBlur = 0;
      ctx.shadowColor = colors[index];
      ctx.fillStyle = colors[index];
      ctx.globalAlpha = 0.35 + progress * 0.65;
      ctx.beginPath();
      ctx.arc(x, y, 2.2 + progress * 1.5, 0, Math.PI * 2);
      ctx.fill();
    });
  } else {
    ctx.shadowBlur = 0;
    ctx.shadowColor = "#74c476";
    ctx.fillStyle = "#74c476";
    ctx.globalAlpha = 0.95;
    ctx.beginPath();
    ctx.arc(tower.x, tower.y, 7, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawRangeUpgradePreview(tower, type) {
  const rangeLevel = tower.rangeLevel || 1;
  if (isStatMaxed(tower, "range")) return;

  const stats = getTowerStats(tower);
  const currentRange = stats.range;
  const support = getSupportBonus(tower);
  const nextRange = tierValue(tower.type, "range", rangeLevel + 1) * (1 + support.rangePct) + support.rangeFlat;

  ctx.save();

  // Текущий радиус — тонкий спокойный контур.
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = '#e8a04c';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(tower.x, tower.y, currentRange, 0, Math.PI * 2);
  ctx.stroke();

  // Новый радиус — яркий пунктир, чтобы сразу видеть прибавку.
  ctx.globalAlpha = 0.75;
  ctx.strokeStyle = '#e8a04c';
  ctx.lineWidth = 2.5;
  ctx.setLineDash([8, 7]);
  ctx.beginPath();
  ctx.arc(tower.x, tower.y, nextRange, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Лёгкая подсветка только дополнительной области.
  ctx.globalAlpha = 0.055;
  ctx.fillStyle = '#e8a04c';
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
  ctx.strokeStyle = valid ? type.color : "#c9504f";
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
  ctx.strokeStyle = valid ? type.color : "#c9504f";
  ctx.beginPath();
  ctx.arc(x, y, type.range, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/* =========================================================
   ОТРИСОВКА
========================================================= */

function drawFallbackField() {
  // Всегда оставляем пользователю видимое поле даже если отдельный эффект
  // отрисовки оказался повреждён. Это не вмешивается в симуляцию.
  ctx.save();
  ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  ctx.fillStyle = '#151a2b';
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  ctx.strokeStyle = 'rgba(116,196,118, 0.07)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= GAME_WIDTH; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, GAME_HEIGHT); ctx.stroke();
  }
  for (let y = 0; y <= GAME_HEIGHT; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(GAME_WIDTH, y); ctx.stroke();
  }
  if (Array.isArray(path) && path.length > 1) {
    ctx.strokeStyle = 'rgba(116,196,118, 0.20)';
    ctx.lineWidth = 72;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
    ctx.stroke();
  }
  ctx.restore();
}

function draw() {
  try {
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    drawBackground();
    drawRoad();
    drawCore();

    // Пунктирные связи показывают все башни, входящие в готовую комбинацию.
    const comboGroupsForDraw = getComboGroups();
    state.comboReadyTowers = new Set(comboGroupsForDraw.flat());
    drawComboLinks(comboGroupsForDraw);

    for (const tower of state.towers) drawTower(tower);
    for (const enemy of state.enemies) drawEnemy(enemy);
    for (const projectile of state.projectiles) drawProjectile(projectile);

    for (const projectile of state.comboProjectiles) {
      const t = Math.max(0, Math.min(1, projectile.progress));
      const alpha = Math.max(0.25, 1 - t * 0.45);
      const vx = projectile.targetX - projectile.startX;
      const vy = projectile.targetY - projectile.startY;
      const len = Math.hypot(vx, vy) || 1;
      const nx = vx / len;
      const ny = vy / len;
      ctx.save();
      ctx.globalAlpha = 0.22 * alpha;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(projectile.x, projectile.y + 10, 10 + Math.sin(t * Math.PI) * 7, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.32 * alpha;
      ctx.strokeStyle = projectile.color;
      ctx.lineWidth = 3;
      ctx.shadowBlur = 0;
      ctx.shadowColor = projectile.color;
      ctx.beginPath();
      ctx.moveTo(projectile.x - nx * 24, projectile.y - ny * 24);
      ctx.lineTo(projectile.x, projectile.y);
      ctx.stroke();
      ctx.globalAlpha = alpha;
      ctx.shadowBlur = 0;
      ctx.shadowColor = projectile.color;
      ctx.fillStyle = projectile.color;
      ctx.strokeStyle = '#eef1f7';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(projectile.x, projectile.y, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.restore();
    }

    drawPlacementPreview();

    for (const mine of state.mines) {
      const lifeAlpha = Math.max(0.35, Math.min(1, mine.life / Math.max(0.01, mine.maxLife)));
      const pulse = (Math.sin((mine.pulse || 0) * 5) + 1) * 0.5;
      ctx.save();
      ctx.globalAlpha = lifeAlpha;
      ctx.shadowBlur = 0;
      ctx.shadowColor = mine.color;
      ctx.fillStyle = '#1f2638';
      ctx.strokeStyle = mine.color;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(mine.x, mine.y, 9 + pulse * 1.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = mine.color;
      ctx.beginPath(); ctx.arc(mine.x, mine.y, 3 + pulse, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.18 + pulse * 0.35;
      ctx.beginPath(); ctx.arc(mine.x, mine.y, 13 + pulse * 7, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }

    drawEffects();
  } catch (error) {
    console.error('Render error:', error);
    drawFallbackField();
  }
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
  updateComboProjectiles(dt);
  updateMines(dt);

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
  if (!state.lastTime) state.lastTime = timestamp;
  let dt = (timestamp - state.lastTime) / 1000;
  state.lastTime = timestamp;
  dt = Math.min(Math.max(dt, 0), 0.05);

  if (!state.paused && !state.gameOver) {
    try {
      update(dt * state.speed);
    } catch (error) {
      // Критическая ошибка симуляции не должна убивать requestAnimationFrame.
      console.error('Game update error:', error);
      state.comboProjectiles = [];
      state.effects = Array.isArray(state.effects) ? state.effects : [];
      state.mines = Array.isArray(state.mines) ? state.mines : [];
      state.towers = Array.isArray(state.towers) ? state.towers : [];
      state.enemies = Array.isArray(state.enemies) ? state.enemies : [];
      state.projectiles = Array.isArray(state.projectiles) ? state.projectiles : [];
    }
  }

  draw();

  if (!state.paused && !state.gameOver) {
    state.uiRefreshTimer = (state.uiRefreshTimer || 0) - dt;
    if (state.uiRefreshTimer <= 0) {
      state.uiRefreshTimer = 0.10;
      try { updateUi(); } catch (error) { console.error('UI error:', error); }
    }
  }

  requestAnimationFrame(gameLoop);
}

/* =========================================================
   КОНЕЦ ИГРЫ
========================================================= */

function endGame(win) {
  if (state.gameOver) {
    return;
  }

  state.gameOver = true;

  // Duel.js: подводим итог «кто дожил дольше»; сдача = поражение.
  try { window.NeonDuel && window.NeonDuel.onGameOver(state.wave, !!(state.ranked && state.rankedSurrendered)); } catch (e) {}

  state.waveActive = false;
  state.spawning = false;

  // Рейтинговый бой: итог дуэли на экране финала — «РАУНД ВЫИГРАН» зелёным,
  // «РАУНД ПРОИГРАН» красным, ничья золотом; ниже — волна и «Рейтинг: N (±25)».
  // Исход (duelOutcome) и дельту (lastDelta) считает duel.js — вместе с ранней
  // победой, которая завершает партию сразу через NeonDuelFinish.
  let rankedShown = false;
  if (state.ranked) {
    try {
      const du = window.NeonDuel;
      const delta = Math.round((du && du.lastDelta) || 0);
      const rating = window.NeonRating ? window.NeonRating.get() : (state.rating || 0);
      const outcome = state.rankedSurrendered ? "lose"
        : ((du && du.duelOutcome) || (delta > 0 ? "win" : delta < 0 ? "lose" : "draw"));
      endTitle.classList.remove("res-win", "res-lose", "res-draw");
      endTitle.classList.add("res-" + outcome);
      endTitle.textContent = outcome === "win" ? tl("ranked.winTitle")
        : outcome === "draw" ? tl("ranked.drawTitle")
        : (state.rankedSurrendered ? tl("ranked.surrenderTitle") : tl("ranked.loseTitle"));
      const ratingLine = tl("ranked.ratingLine", { n: rating }) + (delta ? " (" + (delta > 0 ? "+" : "") + delta + ")" : "");
      endText.textContent = (state.rankedSurrendered
        ? tl("ranked.surrenderText", { n: state.wave })
        : tl("ranked.waveText", { n: state.wave })) + "\n" + ratingLine;
      if (outcome !== "win") {
        ensureAudio();
        playDefeatSound();
      }
      rankedShown = true;
    } catch (e) {
      rankedShown = false;
    }
  }

  if (!rankedShown) {
    endTitle.classList.remove("res-win", "res-lose", "res-draw");
    if (win) {
      endTitle.textContent = tl("end.victoryTitle");
      endText.textContent = tl("end.victoryText", { n: state.maxWaves, k: state.kills });
    } else {
      ensureAudio();
      playDefeatSound();
      endTitle.textContent = tl("end.gameoverTitle");
      endText.textContent = tl("end.gameoverText", { k: state.kills });
    }
  }

  setGameOverUi(true);
  endModal.classList.remove(
      "hidden"
  );

  // Запрос оценки игры (sdk-review) после завершённой партии.
  try { window.NeonBridgeYandex && window.NeonBridgeYandex.requestReview && window.NeonBridgeYandex.requestReview(); } catch (e) {}
}

// v59.19: ранняя победа в дуэли завершает партию СРАЗУ (хук duel.js после
// замка результата: рейтинг начислен, зелёный финал — не дожидаясь game over).
window.NeonDuelFinish = function () {
  if (state.ranked && !state.gameOver) {
    endGame(true);
  }
};

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

// При каждом новом запуске страницы начинаем с чистого меню.
// Сохранение может появиться только после того, как пользователь реально
// начал игру и сам вышел в главное меню через кнопку игры.
try {
  localStorage.removeItem(SAVE_KEY);
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
      mines: state.mines,
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
    startGameBtn.textContent = tl("ui.resumeGame");
    newGameBtn?.classList.remove("hidden");
  } else {
    startGameBtn.textContent = tl("ui.newGame");
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

    state.money = DEV_ALL_UNLOCKED ? TEST_MONEY : (Number.isFinite(save.money) ? save.money : 170);
    state.lives = Number.isFinite(save.lives) ? Math.max(0, Math.min(10, save.lives)) : 10;
    state.wave = Number.isFinite(save.wave) ? save.wave : 0;
    state.kills = Number.isFinite(save.kills) ? save.kills : 0;
    state.towers = Array.isArray(save.towers) ? save.towers : [];
    for (const tower of state.towers) {
      tower.comboTimer = Number.isFinite(tower.comboTimer) ? tower.comboTimer : COMBO_CHECK_INTERVAL;
    }
    state.mines = Array.isArray(save.mines) ? save.mines : [];
    state.comboProjectiles = [];
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
    state.uiRefreshTimer = 0;

    selectDifficulty(currentDifficulty);
    selectMap(currentMap);
    speedBtn.textContent = `x${state.speed}`;
    pauseBtn.textContent = tl("ui.pause");
    pauseOverlay?.classList.add("hidden");
    endModal.classList.add("hidden");
    document.querySelectorAll(".tower-card").forEach(card => {
      card.classList.toggle("active", card.dataset.tower === "pulse");
    });
    waveNameEl.textContent = state.waveActive ? tl("ui.waveName", { n: state.wave }) : tl("ui.ready");
    hasStartedGame = true;
    setHint(tl("hint.restored"));
    updateUi();
    return true;
  } catch (error) {
    return false;
  }
}

/* ---------------- Рейтинговый бой (соревновательный режим duel.js) ----------------
   Вход — кнопка «⚔ Рейтинговый бой» в главном меню. Отличия от обычной партии:
   нет кнопки паузы (и она не работает), нет ускорителя x2/x3 (только x1),
   вместо «← Главное меню» — «🏳 Сдаться» с двухшаговым подтверждением
   (повторный клик за 4 с). Сдавшийся не сохраняет партию. Панель соперника
   (дуэль волн через лидерборд/призрака) активна только здесь. */
// ── Рейтинг рейтингового боя ──────────────────────────────────────────────
// Отдельный localStorage-ключ (не внутри сейва партии!): бой на game over не
// должен порождать «мёртвое» сохранение. Привязан к аккаунту Яндекса: при
// авторизации ключ суффиксится uniqueID (…_v1_<uid>), поэтому два аккаунта в
// одном браузере не делят чужой рейтинг. Суффикс-схема идентична game.js
// (restore/migrate/bridge). В облако player.setData уходит под базовым ключом
// (облако и так per-player). duel.js читает/пишет через window.NeonRating.
const RATING_KEY = "neonBridgeDefenseRating_v1";
function ratingStorageKey() {
  let uid = "";
  try {
    const p = window.NeonBridgeYandex && window.NeonBridgeYandex.player;
    if (p && typeof p.getUniqueID === "function") uid = String(p.getUniqueID() || "");
  } catch (e) {}
  return uid ? RATING_KEY + "_" + uid : RATING_KEY;
}
window.NeonRating = {
  key: ratingStorageKey,
  get() {
    try {
      return Math.max(0, parseInt(localStorage.getItem(ratingStorageKey()), 10) || 0);
    } catch (e) {
      return state.rating || 0;
    }
  },
  set(value) {
    const next = Math.max(0, Math.round(+value) || 0);
    try { localStorage.setItem(ratingStorageKey(), String(next)); } catch (e) {}
    state.rating = next;
    try { window.NeonDuel && window.NeonDuel.refreshMenuButton && window.NeonDuel.refreshMenuButton(); } catch (e) {}
    return next;
  },
  add(delta) {
    return this.set(this.get() + (Math.round(delta) || 0));
  },
};
try { state.rating = window.NeonRating.get(); } catch (e) { state.rating = 0; }
// duel.js построил кнопку-меню до загрузки core — перелинковываем подпись с рейтингом.
try { window.NeonDuel && window.NeonDuel.refreshMenuButton && window.NeonDuel.refreshMenuButton(); } catch (e) {}

let rankedSurrenderTimer = 0;

function setRanked(on) {
  state.ranked = !!on;
  state.rankedSurrendered = false;
  if (rankedSurrenderTimer) {
    clearTimeout(rankedSurrenderTimer);
    rankedSurrenderTimer = 0;
  }
  gameScreen.classList.toggle("ranked-mode", state.ranked);
  menuBtn.classList.remove("confirm");
  menuBtn.classList.toggle("surrender", state.ranked);
  menuBtn.textContent = state.ranked ? tl("ui.surrender") : tl("ui.mainMenu");
  if (state.ranked) {
    state.speed = 1;
    speedBtn.textContent = "x1";
    setPaused(false);
  }
}

function onMenuButton() {
  if (!state.ranked || state.gameOver) {
    showMainMenu();
    return;
  }
  if (rankedSurrenderTimer) {          // второй клик — подтверждение сдачи
    clearTimeout(rankedSurrenderTimer);
    rankedSurrenderTimer = 0;
    menuBtn.classList.remove("confirm");
    state.rankedSurrendered = true;
    endGame(false);
    return;
  }
  menuBtn.textContent = tl("ui.surrenderConfirm");
  menuBtn.classList.add("confirm");
  rankedSurrenderTimer = setTimeout(() => {
    rankedSurrenderTimer = 0;
    menuBtn.classList.remove("confirm");
    menuBtn.textContent = tl("ui.surrender");
  }, 4000);
}

function startRankedGame() {
  setRanked(true);
  startNewGame();
}

function showMainMenu() {
  setRanked(false);
  // Единственный штатный способ создать сохранение для «Продолжить игру» —
  // выйти из уже начатой активной партии через кнопку главного меню.
  if (hasStartedGame && !state.gameOver && !gameScreen.classList.contains("hidden")) {
    saveGame();
  }

  state.paused = true;

  // В меню не должно быть ни симуляции, ни звуков игрового процесса.
  try {
    if (audioContext && audioContext.state === "running") {
      audioContext.suspend();
    }
  } catch (error) {
    // Аудио может быть недоступно.
  }

  endModal.classList.add("hidden");
  gameScreen.classList.add("hidden");
  mainMenu.classList.remove("hidden");
  // Свежесозданные в редакторе карты подхватываются без перезагрузки.
  renderMapCards();
  updateResumeButton();
}

function updateDevMoneyButton() {
  if (!devUnlockAllBtn) return;
  devUnlockAllBtn.textContent = DEV_ALL_UNLOCKED
    ? "DEV: ВСЕ БАШНИ + ∞$ — ВКЛ"
    : "DEV: ВСЕ БАШНИ + ∞$ — ВЫКЛ";
  devUnlockAllBtn.classList.toggle("active", DEV_ALL_UNLOCKED);
  devUnlockAllBtn.setAttribute("aria-pressed", String(DEV_ALL_UNLOCKED));
}

function startGame() {
  // Обычная партия (кнопка «Новая игра») никогда не бывает боем; рематч на
  // финальном экране идёт через startNewGame и сохраняет режим ranked.
  setRanked(false);
  setGameOverUi(false);
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
  // Разметка геймплея для платформы (GameplayAPI.start, п. 1.19.3).
  try { window.NeonBridgeYandex && window.NeonBridgeYandex.gameplayStart && window.NeonBridgeYandex.gameplayStart(); } catch (e) {}
}

function startNewGame() {
  setGameOverUi(false);
  ensureAudio();
  clearSavedGame();
  restartGame();
  state.sessionId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  hasStartedGame = true;
  state.paused = false;
  state.lastTime = performance.now();
  mainMenu.classList.add("hidden");
  gameScreen.classList.remove("hidden");
  try { window.NeonBridgeYandex && window.NeonBridgeYandex.gameplayStart && window.NeonBridgeYandex.gameplayStart(); } catch (e) {}
}

function restartGame() {
  setGameOverUi(false);
  state.sessionId = state.sessionId || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  state.money = DEV_ALL_UNLOCKED ? TEST_MONEY : 300;
  state.lives = 10;

  // Duel.js: новая партия — новый зачёт дуэли; панель активна только в рейтинге.
  try { window.NeonDuel && window.NeonDuel.onGameStart(state.ranked === true); } catch (e) {}

  state.wave = 0;
  state.kills = 0;

  state.towers = [];
  state.mines = [];
  state.comboProjectiles = [];
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
  state.uiRefreshTimer = 0;
  state.comboCheckTimer = 0;

  pauseBtn.textContent =
      tl("ui.pause");

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
      tl("ui.ready");

  setHint(
      tl("hint.pickTowerStart")
  );

  // v59.19: перечитать доступность на wave=0 — иначе после прошлой партии
  // открытые башни «появляются все и сразу» до первой волны новой игры.
  updateTowerAvailability();

  updateUi();
}


/* =========================================================
   ЗАПУСК
========================================================= */

applyDataI18n();
mergeCustomMaps();
renderMapCards();
selectDifficulty(currentDifficulty);
selectMap(currentMap);
try { updateTowerAvailability(); } catch (e) {}

setHint(
    tl("hint.pickTowerStart")
);

updateUi();

// Главное меню открывается при запуске. Игровая симуляция и звук в меню
// полностью остановлены до нажатия «Новая игра».
state.paused = true;
gameScreen.classList.add("hidden");
mainMenu.classList.remove("hidden");
updateResumeButton();

requestAnimationFrame(
    gameLoop
);