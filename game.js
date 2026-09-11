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

const startWaveBtn = document.getElementById("startWaveBtn");
const pauseBtn = document.getElementById("pauseBtn");
const speedBtn = document.getElementById("speedBtn");

const endModal = document.getElementById("endModal");
const endTitle = document.getElementById("endTitle");
const endText = document.getElementById("endText");
const restartBtn = document.getElementById("restartBtn");
const mainMenu = document.getElementById("mainMenu");
const gameScreen = document.getElementById("gameScreen");
const startGameBtn = document.getElementById("startGameBtn");
const menuBtn = document.getElementById("menuBtn");
const mapList = document.getElementById("mapList");
const selectedMapNameEl = document.getElementById("selectedMapName");


/* =========================================================
   НАСТРОЙКИ ИГРЫ
========================================================= */

const GAME_WIDTH = 1000;
const GAME_HEIGHT = 640;

canvas.width = GAME_WIDTH;
canvas.height = GAME_HEIGHT;

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
  }
};


/* =========================================================
   СОСТОЯНИЕ
========================================================= */

const state = {
  money: 170,
  lives: 24,

  wave: 0,
  maxWaves: Infinity,

  kills: 0,

  towers: [],
  enemies: [],
  projectiles: [],
  effects: [],

  selectedType: "pulse",
  selectedTower: null,
  previewX: 0,
  previewY: 0,
  previewValid: false,

  waveActive: false,
  spawning: false,
  spawnTimer: 0,
  enemiesToSpawn: 0,
  enemiesSpawned: 0,

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
    name: "Неоновый хребет",
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
    name: "Ядровая линия",
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
        ) < roadWidth / 2
    ) {
      return true;
    }
  }

  return false;
}


/* =========================================================
   БАШНИ
========================================================= */

function towerAt(x, y) {
  for (let i = state.towers.length - 1; i >= 0; i--) {
    const tower = state.towers[i];

    if (distance({ x, y }, tower) <= 25) {
      return tower;
    }
  }

  return null;
}

function canPlaceTower(x, y) {
  if (!state.selectedType || !towerTypes[state.selectedType]) {
    return false;
  }

  if (x < 30 || x > GAME_WIDTH - 30) {
    return false;
  }

  if (y < 30 || y > GAME_HEIGHT - 30) {
    return false;
  }

  if (isOnRoad(x, y)) {
    return false;
  }

  for (const tower of state.towers) {
    if (distance({ x, y }, tower) < 55) {
      return false;
    }
  }

  return true;
}

function placeSelectedTower(x, y) {
  const type = towerTypes[state.selectedType];

  if (!type) {
    return;
  }

  if (state.money < type.cost) {
    setHint("Недостаточно осколков.");
    return;
  }

  if (!canPlaceTower(x, y)) {
    setHint("Здесь нельзя поставить башню.");
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

    totalSpent: type.cost
  };

  state.money -= type.cost;

  state.towers.push(tower);
  state.selectedTower = tower;

  setHint(
      `${type.name} установлена. Нажмите на неё ещё раз, чтобы снять выделение.`
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
        base.fireRate * Math.pow(0.92, speedLevel - 1)
    )
  };
}

function getUpgradeCost(tower, kind) {
  const baseCost = towerTypes[tower.type].cost;
  const level = tower[`${kind}Level`] || 1;
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

const PATH_LENGTH = totalPathLength();

function spawnEnemy() {
  const wave = state.wave;

  const maxHp = 70 + wave * 22;

  const enemy = {
    distance: 0,

    x: path[0].x,
    y: path[0].y,

    hp: maxHp,
    maxHp,

    speed: 45 + wave * 2.5,

    radius: 13,

    reward: 7 + Math.floor(wave * 1.5),

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

function updateEffects(dt) {
  for (const effect of state.effects) {
    effect.life -= dt;

    if (effect.type === "explosion") {
      effect.radius +=
          (effect.maxRadius / effect.maxLife) *
          dt;
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
  if (state.waveActive || state.gameOver) {
    return;
  }

  state.wave++;

  state.waveActive = true;
  state.spawning = true;

  state.enemiesSpawned = 0;

  state.enemiesToSpawn =
      5 + state.wave * 2;

  state.spawnTimer = 0;

  waveNameEl.textContent =
      `Волна ${state.wave}`;

  setHint(
      `Волна ${state.wave} началась.`
  );

  updateUi();
}

function updateWave(dt) {
  if (!state.waveActive) {
    return;
  }

  if (state.spawning) {
    state.spawnTimer -= dt;

    if (
        state.spawnTimer <= 0 &&
        state.enemiesSpawned <
        state.enemiesToSpawn
    ) {
      spawnEnemy();

      state.enemiesSpawned++;

      state.spawnTimer = 0.75;
    }

    if (
        state.enemiesSpawned >=
        state.enemiesToSpawn
    ) {
      state.spawning = false;
    }
  }

  const aliveEnemies =
      state.enemies.filter(
          enemy => !enemy.dead
      ).length;

  if (
      !state.spawning &&
      aliveEnemies === 0
  ) {
    state.waveActive = false;

    state.money += 25 + Math.floor(state.wave * 2.5);

    waveNameEl.textContent =
        "Готовность";

    setHint(
        `Волна ${state.wave} завершена. Можно улучшить башни или начать следующую.`
    );

    updateUi();
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

  const cost = getUpgradeCost(tower, kind);
  if (state.money < cost) {
    setHint("Недостаточно осколков для улучшения.");
    return;
  }

  state.money -= cost;
  tower[`${kind}Level`] = (tower[`${kind}Level`] || 1) + 1;
  tower.totalSpent += cost;

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
      `Башня продана за ${refund} ◈.`
  );

  updateUi();
}


/* =========================================================
   UI
========================================================= */

function updateUi() {
  moneyEl.textContent =
      `${Math.floor(state.money)} ◈`;

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

    selectionInfo.innerHTML = `
            <p>Башня: ${type.name}</p>
            <p>Урон: ${stats.damage} · ур. ${tower.damageLevel || 1}</p>
            <p>Радиус: ${Math.round(stats.range)} · ур. ${tower.rangeLevel || 1}</p>
            <p>Скорость атаки: ${stats.fireRate.toFixed(2)}с · ур. ${tower.speedLevel || 1}</p>
        `;

    upgradeBtn.textContent = `Урон + (${damageCost} ◈)`;
    rangeBtn.textContent = `Радиус + (${rangeCost} ◈)`;
    speedBtnUpgrade.textContent = `Скорость + (${speedCost} ◈)`;

    upgradeBtn.disabled = state.money < damageCost;
    rangeBtn.disabled = state.money < rangeCost;
    speedBtnUpgrade.disabled = state.money < speedCost;
    sellBtn.disabled = false;
  } else {
    const type = state.selectedType
        ? towerTypes[state.selectedType]
        : null;

    selectionInfo.innerHTML = type
        ? `
            <p>Башня: ${type.name}</p>
            <p>Стоимость: ${type.cost} ◈</p>
          `
        : `
            <p>Башня не выбрана</p>
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
    const remaining =
        state.enemiesToSpawn -
        state.enemiesSpawned;

    const alive =
        state.enemies.filter(
            enemy => !enemy.dead
        ).length;

    enemyCountEl.textContent =
        `Осталось: ${Math.max(
            0,
            remaining + alive
        )}`;

    startWaveBtn.disabled = true;
  } else {
    enemyCountEl.textContent =
        "Нажмите старт для следующей бесконечной волны";

    startWaveBtn.disabled =
        state.gameOver;
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
    () => upgradeTowerStat('damage')
);

rangeBtn.addEventListener(
    "click",
    () => upgradeTowerStat('range')
);

speedBtnUpgrade.addEventListener(
    "click",
    () => upgradeTowerStat('speed')
);

sellBtn.addEventListener(
    "click",
    sellSelectedTower
);

startWaveBtn.addEventListener(
    "click",
    startWave
);

pauseBtn.addEventListener(
    "click",
    () => {
      state.paused =
          !state.paused;

      pauseBtn.textContent =
          state.paused
              ? "Продолжить"
              : "Пауза";

      if (!state.paused) {
        state.lastTime =
            performance.now();
      }
    }
);

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

menuBtn.addEventListener(
    "click",
    showMainMenu
);

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
    startGame
);


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

  /*
   * Радиус действия выделенной башни.
   */
  if (selected) {
    ctx.save();

    ctx.fillStyle =
        `${type.color}12`;

    ctx.strokeStyle =
        `${type.color}55`;

    ctx.lineWidth = 2;

    ctx.beginPath();

    ctx.arc(
        tower.x,
        tower.y,
        stats.range,
        0,
        Math.PI * 2
    );

    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  /*
   * Свечение.
   */
  ctx.save();

  ctx.shadowBlur =
      selected ? 25 : 14;

  ctx.shadowColor =
      type.color;

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
   * Центральное ядро.
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

  /*
   * Уровень.
   */
  if (tower.level > 1) {
    ctx.fillStyle =
        "#ffffff";

    ctx.font =
        "bold 11px Arial";

    ctx.textAlign = "center";

    ctx.fillText(
        `L${tower.level}`,
        tower.x,
        tower.y + 36
    );
  }
}


/* =========================================================
   ВРАГИ
========================================================= */

function drawEnemy(enemy) {
  if (enemy.dead) {
    return;
  }

  const hpPercent =
      Math.max(
          0,
          enemy.hp /
          enemy.maxHp
      );

  ctx.save();

  ctx.shadowBlur = 14;
  ctx.shadowColor =
      "#ff5277";

  ctx.fillStyle =
      "#20111d";

  ctx.strokeStyle =
      "#ff5277";

  ctx.lineWidth = 2;

  ctx.beginPath();

  ctx.arc(
      enemy.x,
      enemy.y,
      enemy.radius,
      0,
      Math.PI * 2
  );

  ctx.fill();
  ctx.stroke();

  ctx.shadowBlur = 0;

  /*
   * Глаз.
   */
  ctx.fillStyle =
      "#ff8ba3";

  ctx.beginPath();

  ctx.arc(
      enemy.x,
      enemy.y,
      4,
      0,
      Math.PI * 2
  );

  ctx.fill();

  /*
   * HP полоска.
   */
  const barWidth = 30;
  const barHeight = 4;

  ctx.fillStyle =
      "rgba(0,0,0,0.5)";

  ctx.fillRect(
      enemy.x - barWidth / 2,
      enemy.y - 23,
      barWidth,
      barHeight
  );

  ctx.fillStyle =
      "#ff5277";

  ctx.fillRect(
      enemy.x - barWidth / 2,
      enemy.y - 23,
      barWidth * hpPercent,
      barHeight
  );

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

    ctx.restore();
  }
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
    endTitle.textContent =
        "Игра окончена";

    endText.textContent =
        `Ядро уничтожено. Сбито врагов: ${state.kills}.`;
  }

  endModal.classList.remove(
      "hidden"
  );
}

function selectMap(mapId) {
  if (!maps[mapId]) {
    return;
  }

  currentMap = mapId;
  path = maps[mapId].path;

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

function showMainMenu() {
  state.paused = true;
  gameScreen.classList.add("hidden");
  mainMenu.classList.remove("hidden");
}

function startGame() {
  restartGame();
  state.paused = false;
  state.lastTime = performance.now();
  mainMenu.classList.add("hidden");
  gameScreen.classList.remove("hidden");
}

function restartGame() {
  state.money = 170;
  state.lives = 24;

  state.wave = 0;
  state.kills = 0;

  state.towers = [];
  state.enemies = [];
  state.projectiles = [];
  state.effects = [];

  state.selectedType =
      "pulse";

  path = maps[currentMap].path;

  state.selectedTower =
      null;

  state.waveActive =
      false;

  state.spawning =
      false;

  state.spawnTimer = 0;
  state.enemiesToSpawn = 0;
  state.enemiesSpawned = 0;

  state.paused = false;
  state.speed = 1;

  state.gameOver = false;

  pauseBtn.textContent =
      "Пауза";

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
      "Выберите башню справа, затем поставьте ее вне светящейся дороги."
  );

  updateUi();
}


/* =========================================================
   ЗАПУСК
========================================================= */

selectMap(currentMap);

setHint(
    "Выберите башню справа, затем поставьте ее вне светящейся дороги."
);

updateUi();

// Главное меню открывается при запуске.
gameScreen.classList.add("hidden");
mainMenu.classList.remove("hidden");

requestAnimationFrame(
    gameLoop
);