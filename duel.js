/* =========================================================
   duel.js — «Дуэль волн» (асинхронный мультиплеер v0)
   Реальный realtime-PvP на Яндекс.Играх недоступен: у платформы нет
   сокетов/матчмейкинга, а свои серверы правилами запрещены. Поэтому
   обмен живётся по LOW-FREQUENCY каналу — таблице лидеров:
     · каждые PUSH_MS шлём setScore(value = текущая волна);
     · каждые POLL_MS читаем getScores ищем выбранного соперника по uniqueId;
     · панель показывает его волну и разницу;
   «побеждает тот, кто дожил дольше» — на game over сравниваем финальные
   волны. Волна монотонна, а «лучший результат» в ЛБ = текущая, так что
   канал работает честно в обе стороны (задержка 5–15 с — это асинхронный
   формат, как «дуэли» в словесных играх, а не realtime).
   Вне платформы (git/file://) или при пустой таблице — соперник «призрачный
   игрок» (бот-гоуст): детерминированная кривая волны; панель это честно
   подписывает. Код таблицы: window.NEON_DUEL_LB_CODE, иначе — первая из
   getList().
   ========================================================= */
(function () {
  "use strict";

  const PUSH_MS = 8000;    // как часто отправляем свою волну
  const POLL_MS = 10000;   // как часто читаем соперника
  const RENDER_MS = 900;   // перерисовка панели (и языка)
  const STALE_MS = 45000;  // соперник не двигается — «замолчал»
  const LS_KEY = "neonDuelOn_v1";

  const duel = {
    enabled: false,
    running: false,
    mode: "offline",         // "yandex" | "bot"
    board: null,             // код таблицы лидеров
    myUid: null,
    opponent: null,          // { uid, name, wave, seenAt }
    bot: null,               // { wave, t, step, final }
    myWave: 0,
    result: null,
    pushTimer: null,
    pollTimer: null,
    renderTimer: null,
    errors: 0,
    panel: null,
    menuBtn: null,
  };
  window.NeonDuel = duel;

  const T = (key, params) => {
    try {
      if (typeof tl === "function") return tl(key, params);
    } catch (e) {}
    const RU = {
      "ui.duelTitle": "⚔ Дуэль волн",
      "ui.duelSearching": "Ищем соперника…",
      "ui.duelOnline": "онлайн",
      "ui.duelBot": "призрачный игрок",
      "ui.duelWin": "Выжили дольше: волна {a} против {b}",
      "ui.duelLose": "Соперник выжил дольше: {b} против {a}",
      "ui.duelDraw": "Одинаковая волна — ничья",
    };
    return (RU[key] || key).replace(/\{(\w)\}/g, (_, k) => params && params[k] != null ? params[k] : `{${k}}`);
  };

  /* ---------------- панель ---------------- */
  function makeEl(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function buildPanel() {
    const arena = document.querySelector(".arena-wrap");
    if (!arena || duel.panel) return;
    const box = makeEl("div", "duel-panel");
    box.id = "duelPanel";
    box.setAttribute("aria-live", "polite");
    const head = makeEl("div", "duel-head");
    const title = makeEl("span", "duel-title");
    const mode = makeEl("span", "duel-mode");
    head.append(title, mode);
    const body = makeEl("div", "duel-body");
    const dot = makeEl("span", "duel-dot");
    const name = makeEl("span", "duel-opp-name");
    const wave = makeEl("b", "duel-opp-wave");
    body.append(dot, name, wave);
    const foot = makeEl("div", "duel-foot");
    const delta = makeEl("span", "duel-delta");
    foot.append(delta);
    box.append(head, body, foot);
    arena.appendChild(box);
    duel.panel = box;
    duel.texts = { title, mode, name, wave, delta, dot };
  }

  function renderPanel() {
    if (!duel.enabled) return;
    buildPanel();
    if (!duel.panel) return;
    const t = duel.texts;
    duel.panel.style.display = duel.running || duel.result ? "block" : "none";
    if (!duel.running && !duel.result) return;

    t.title.textContent = T("ui.duelTitle");
    t.mode.textContent = duel.mode === "yandex" ? T("ui.duelOnline") : T("ui.duelBot");

    if (duel.mode === "yandex" && !duel.opponent) {
      t.name.textContent = "";
      t.wave.textContent = T("ui.duelSearching");
      t.delta.textContent = "";
      return;
    }
    const oppWave = duel.opponent ? duel.opponent.wave : duel.bot.wave;
    t.name.textContent = duel.opponent ? duel.opponent.name : "";
    t.wave.textContent = String(oppWave);

    const stale = duel.opponent && Date.now() - duel.opponent.seenAt > STALE_MS;
    const diff = duel.myWave - oppWave;
    if (diff > 0) t.delta.textContent = T("ui.duelLead", { n: diff });
    else if (diff < 0) t.delta.textContent = T("ui.duelBehind", { n: -diff });
    else t.delta.textContent = T("ui.duelEven");

    duel.panel.classList.toggle("is-losing", diff < 0);
    duel.panel.classList.toggle("is-stale", !!stale);
    duel.panel.classList.toggle("has-result", !!duel.result);
    if (duel.result) t.delta.textContent = duel.result;
  }

  /* ---------------- выбор соперника ---------------- */
  function bridgePlayer() {
    const b = window.NeonBridgeYandex;
    return b && b.player && b.player.getLeaderboards ? b.player.getLeaderboards() : null;
  }

  function scoreValue(s) {
    return Math.max(0, Math.round(s && (s.value ?? s.integerValue ?? s.score) || 0));
  }

  async function findOnlineOpponent() {
    const lb = bridgePlayer();
    if (!lb || typeof lb.getScores !== "function") { duel.mode = "bot"; startBot(); return; }
    try {
      if (!duel.board) {
        duel.board = window.NEON_DUEL_LB_CODE || null;
        if (!duel.board && lb.getList) {
          const list = await lb.getList();
          duel.board = (list && list.leaderboardCodes && list.leaderboardCodes[0]) || null;
        }
      }
      if (!duel.board) throw new Error("no leaderboard");
      try { duel.myUid = window.NeonBridgeYandex.player.getUniqueID(); } catch (e) {}
      const res = await lb.getScores(duel.board, { quantity: 20 });
      const rows = (res && res.scores || [])
        .map(r => r && r.score)
        .filter(s => s && scoreValue(s) > 0 && (!duel.myUid || !s.player || s.player.uniqueId !== duel.myUid));
      if (!rows.length) throw new Error("empty board");
      // «рейтинговость»: берём случайного из ближних по волне к нашей истории
      rows.sort((a, b) => scoreValue(b) - scoreValue(a));
      const pool = rows.slice(0, Math.max(3, Math.ceil(rows.length / 2)));
      const pick = pool[Math.floor(Math.random() * pool.length)];
      duel.opponent = {
        uid: pick.player ? pick.player.uniqueId : null,
        name: (pick.player && pick.player.publicName) || "—",
        wave: scoreValue(pick),
        seenAt: Date.now(),
      };
      duel.mode = "yandex";
    } catch (e) {
      duel.mode = "bot";
      startBot();
    }
    renderPanel();
  }

  function pollOpponent() {
    const lb = bridgePlayer();
    if (!lb || !duel.board || !duel.opponent) return;
    lb.getScores(duel.board, { quantity: 20 }).then(res => {
      const row = (res && res.scores || [])
        .map(r => r && r.score)
        .find(s => s && s.player && s.player.uniqueId === duel.opponent.uid);
      if (!row) return;
      const wave = scoreValue(row);
      if (wave !== duel.opponent.wave || !duel.opponent.seenAt) duel.opponent.seenAt = Date.now();
      duel.opponent.wave = wave;
      duel.errors = 0;
      renderPanel();
    }).catch(() => {});
  }

  function pushWave() {
    const lb = bridgePlayer();
    if (!lb || !duel.board || typeof lb.setScore !== "function") return;
    lb.setScore(duel.board, { value: duel.myWave }).then(() => {
      duel.errors = 0;
    }).catch(() => {
      if (++duel.errors >= 3) { duel.mode = "bot"; duel.opponent = null; startBot(); }
    });
  }

  /* ---------------- призрачный игрок (бот) ---------------- */
  function startBot() {
    duel.bot = {
      wave: 1,
      acc: 0,
      // темп «как у среднего игрока»: 2.2–4.6 с на волну + случайный финал 15..140
      step: 2.2 + Math.random() * 2.4,
      final: 15 + Math.floor(Math.pow(Math.random(), 1.6) * 125),
      done: false,
    };
  }
  function tickBot(dtSec) {
    const b = duel.bot;
    if (!b || b.done) return;
    b.acc += dtSec;
    while (b.acc >= b.step && b.wave < b.final) {
      b.acc -= b.step;
      b.wave++;
    }
    if (b.wave >= b.final) b.done = true;
  }

  /* ---------------- жизненный цикл ---------------- */
  let lastTick = 0;
  function loop() {
    const now = Date.now();
    const dt = lastTick ? Math.min(2, (now - lastTick) / 1000) : 1;
    lastTick = now;
    if (duel.running && duel.mode === "bot") tickBot(dt);
  }

  function startTimers() {
    stopTimers();
    duel.pushTimer = setInterval(() => { if (duel.mode === "yandex") pushWave(); }, PUSH_MS);
    duel.pollTimer = setInterval(() => { if (duel.mode === "yandex") pollOpponent(); }, POLL_MS);
    duel.renderTimer = setInterval(() => { loop(); renderPanel(); }, RENDER_MS);
  }
  function stopTimers() {
    [duel.pushTimer, duel.pollTimer, duel.renderTimer].forEach(id => id && clearInterval(id));
    duel.pushTimer = duel.pollTimer = duel.renderTimer = null;
  }

  duel.onGameStart = function () {
    duel.result = null;
    duel.myWave = 0;
    duel.opponent = null;
    duel.bot = null;
    duel.errors = 0;
    duel.running = false;
    if (!duel.enabled) { renderPanel(); return; }
    duel.running = true;
    buildPanel();
    if (bridgePlayer()) findOnlineOpponent();
    else { duel.mode = "bot"; startBot(); }
    startTimers();
    renderPanel();
  };

  duel.onWave = function (n) {
    duel.myWave = Math.max(duel.myWave, n || 0);
  };

  duel.onGameOver = function (finalWave) {
    if (!duel.running) { renderPanel(); return; }
    duel.running = false;
    stopTimers();
    duel.myWave = Math.max(duel.myWave, finalWave || duel.myWave);
    const oppWave = duel.opponent ? duel.opponent.wave : (duel.bot ? duel.bot.wave : 0);
    if (duel.myWave > oppWave) duel.result = T("ui.duelWin", { a: duel.myWave, b: oppWave });
    else if (duel.myWave < oppWave) duel.result = T("ui.duelLose", { a: duel.myWave, b: oppWave });
    else duel.result = T("ui.duelDraw");
    renderPanel();
  };

  /* ---------------- кнопка в меню ---------------- */
  function buildMenuButton() {
    const startBtn = document.getElementById("startGameBtn");
    if (!startBtn || duel.menuBtn) return;
    const btn = document.createElement("button");
    btn.id = "duelToggleBtn";
    btn.type = "button";
    btn.className = "menu-duel";
    btn.addEventListener("click", () => {
      duel.enabled = !duel.enabled;
      try { localStorage.setItem(LS_KEY, duel.enabled ? "1" : "0"); } catch (e) {}
      btn.classList.toggle("active", duel.enabled);
      btn.setAttribute("aria-pressed", String(duel.enabled));
      btn.textContent = duel.enabled ? T("ui.duelOn") : T("ui.duelOff");
    });
    startBtn.insertAdjacentElement("afterend", btn);
    duel.menuBtn = btn;
    try { duel.enabled = localStorage.getItem(LS_KEY) === "1"; } catch (e) {}
    btn.classList.toggle("active", duel.enabled);
    btn.setAttribute("aria-pressed", String(duel.enabled));
    btn.textContent = duel.enabled ? T("ui.duelOn") : T("ui.duelOff");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => { buildMenuButton(); });
  } else {
    buildMenuButton();
  }

  // Хуки для автотестов (harness.js): прокрутка бота без реальных таймеров.
  duel.testHooks = {
    tick: dt => tickBot(dt),
    render: renderPanel,
    match: findOnlineOpponent,
  };
})();
