/* =========================================================
   duel.js — «Рейтинговый бой» (соревновательный онлайн-режим v0)
   Вход: кнопка «⚔ Рейтинговый бой» в главном меню -> core.startRankedGame().
   Отличия боя от обычной партии (реализованы в game-core.js): нет паузы,
   нет ускорителя x2/x3, вместо «Главное меню» — «Сдаться» (2 клика).

   Реальный realtime-PvP на Яндекс.Играх недоступен: у платформы нет
   сокетов/матчмейкинга, а свои серверы правилами запрещены. Поэтому обмен
   живёт по LOW-FREQUENCY каналу — таблице лидеров:
     · каждые PUSH_MS шлём setScore(score = рейтинг, extraScore = волна);
     · каждые POLL_MS читаем getScores ищем соперника по uniqueId;
     · панель показывает его волну и разницу;
   «побеждает тот, кто дожил дольше» — на game over сравниваем финальные
   волны. Волна монотонна, а «лучший результат» в ЛБ = текущая, так что
   канал работает честно в обе стороны (задержка 5–15 с — асинхронный
   формат). Код таблицы: window.NEON_DUEL_LB_CODE, иначе — первая из
   getList(). Вне платформы (git/file://), при пустой таблице или 3
   ошибках канала — соперник «призрачный игрок» (бот-гоуст); панель честно
   подписывает режим.
   ========================================================= */
(function () {
  "use strict";

  const PUSH_MS = 8000;    // как часто отправляем свою волну
  const POLL_MS = 10000;   // как часто читаем соперника
  const RENDER_MS = 900;   // перерисовка панели (и языка)
  const STALE_MS = 45000;  // соперник не двигается — «замолчал»
  const RATING_STEP = 25;  // рейтинг за победу против человека (сдача = −25)

  const duel = {
    running: false,
    mode: "bot",             // "yandex" | "bot"
    board: null,             // код таблицы лидеров
    myUid: null,
    opponent: null,          // { uid, name, wave, seenAt }
    bot: null,               // { wave, acc, step, final, done }
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
      "ui.duelTitle": "⚔ Рейтинговый бой",
      "ui.duelSearching": "Ищем соперника…",
      "ui.duelOnline": "онлайн",
      "ui.duelBot": "призрачный игрок",
      "ui.duelLead": "опережаете на {n}",
      "ui.duelBehind": "отстаёте на {n}",
      "ui.duelEven": "волна в волну",
      "ui.duelWin": "Выжили дольше соперника: волна {a} против {b}",
      "ui.duelLose": "Соперник выжил дольше: {b} против {a}",
      "ui.duelDraw": "Одинаковая волна — ничья",
      "ui.duelSurrendered": "Сдались — соперник побеждает",
    };
    return (RU[key] || key).replace(/\{(\w)\}/g, (_, k) => (params && params[k] != null ? params[k] : `{${k}}`));
  };

  /* ---------------- панель ---------------- */
  function makeEl(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  // Панель боя — НЕ над полем, а в.top-bar'е рядом с кассой (v59.15): box в
  // .status-strip, тот же стиль, что у счётчиков ВОЛНА/УБИЙСТВА/ЖИЗНИ/CASH.
  // Никакого абсолютного позиционирования и «съезжания» в яндекс-оболочке.
  function buildPanel() {
    if (duel.panel) return;
    const strip = document.querySelector(".status-strip") ||
      document.querySelector(".topbar") || document.body;
    if (!strip || !strip.appendChild) return;
    const box = makeEl("div", "duel-panel");
    box.id = "duelPanel";
    box.setAttribute("aria-live", "polite");
    const dot = makeEl("span", "duel-dot");
    const wave = makeEl("span", "duel-wave", "…");
    const label = makeEl("small", "duel-label", T("ui.duelTitle"));
    box.append(dot, wave, label);
    strip.appendChild(box);
    duel.panel = box;
    duel.texts = { wave, label, dot };
  }

  function renderPanel() {
    buildPanel();
    if (!duel.panel) return;
    const t = duel.texts;
    const show = duel.running || duel.result;
    duel.panel.style.display = show ? "block" : "none";
    duel.panel.classList.toggle("is-shown", show); // мобильный flex в yandex.css
    if (!show) return;

    const mode = duel.mode === "yandex" ? T("ui.duelOnline") : T("ui.duelBot");

    if (duel.mode === "yandex" && !duel.opponent) {
      t.wave.textContent = "…";
      t.label.textContent = T("ui.duelSearching");
      duel.panel.classList.remove("is-losing", "is-stale", "has-result");
      return;
    }
    const oppWaveRaw = duel.opponent ? duel.opponent.wave : duel.bot.wave;
    const who = duel.opponent && duel.opponent.name ? duel.opponent.name : mode;
    if (oppWaveRaw == null) {
      // Волна соперника ещё не прилетела в extraScore — честно показываем прочерк.
      t.wave.textContent = "—";
      t.label.textContent = who;
      duel.panel.classList.toggle("is-stale", true);
      duel.panel.classList.toggle("is-losing", false);
      duel.panel.classList.toggle("has-result", !!duel.result);
      if (duel.result) t.label.textContent = duel.result;
      return;
    }
    const oppWave = oppWaveRaw;
    t.wave.textContent = String(oppWave);

    const stale = duel.opponent && Date.now() - duel.opponent.seenAt > STALE_MS;
    const diff = duel.myWave - oppWave;
    let delta;
    if (diff > 0) delta = T("ui.duelLead", { n: diff });
    else if (diff < 0) delta = T("ui.duelBehind", { n: -diff });
    else delta = T("ui.duelEven");

    duel.panel.classList.toggle("is-losing", diff < 0);
    duel.panel.classList.toggle("is-stale", !!stale);
    duel.panel.classList.toggle("has-result", !!duel.result);
    t.label.textContent = duel.result ? duel.result : who + " · " + delta;
  }

  /* ---------------- выбор соперника ---------------- */
  function bridgePlayer() {
    const b = window.NeonBridgeYandex;
    return b && b.player && b.player.getLeaderboards ? b.player.getLeaderboards() : null;
  }

  // Рейтинговая модель v59.16: в лидерборде score = РЕЙТИНГ (то, что видит
  // таблица Яндекса), extraScore = волна последней синхронизации (технический
  // канал гонки). extraScore старше версии без поля или null -> волна неизвестна.
  function ratingOf(s) {
    return Math.max(0, Math.round((s && (s.score ?? s.value ?? s.integerValue)) || 0));
  }
  function waveOf(s) {
    if (!s || s.extraScore == null) return null;
    const w = Math.round(+s.extraScore);
    return Number.isFinite(w) && w >= 0 ? w : null;
  }
  function myRating() {
    try { return window.NeonRating ? window.NeonRating.get() : 0; } catch (e) { return 0; }
  }

  async function findOnlineOpponent() {
    const lb = bridgePlayer();
    if (!lb || typeof lb.getScores !== "function") { duel.mode = "bot"; startBot(); renderPanel(); return; }
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
      // Окно подбора: ~10 мест вокруг своей позиции (если она известна),
      // иначе верх таблицы.
      let offset = 0;
      if (typeof lb.getPlayerScore === "function") {
        try {
          const us = await lb.getPlayerScore(duel.board);
          if (us && us.rank) offset = Math.max(0, us.rank - 11);
        } catch (e) {}
      }
      const res = await lb.getScores(duel.board, { quantity: 20, offset });
      const rows = (res && res.scores || [])
        .map(r => r && r.score)
        .filter(s => s && (!duel.myUid || !s.player || s.player.uniqueId !== duel.myUid));
      if (!rows.length) throw new Error("empty board");
      // Матчмейкинг по рейтингу: ближайший к своему значению.
      const mine = myRating();
      rows.sort((a, b) => Math.abs(ratingOf(a) - mine) - Math.abs(ratingOf(b) - mine));
      const pick = rows[0];
      duel.opponent = {
        uid: pick.player ? pick.player.uniqueId : null,
        name: (pick.player && pick.player.publicName) || "—",
        rating: ratingOf(pick),
        wave: waveOf(pick),
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
      const wave = waveOf(row);
      const rating = ratingOf(row);
      if (wave !== duel.opponent.wave || rating !== duel.opponent.rating) duel.opponent.seenAt = Date.now();
      duel.opponent.wave = wave;
      duel.opponent.rating = rating;
      duel.errors = 0;
      renderPanel();
    }).catch(() => {});
  }

  function pushRating() {
    const lb = bridgePlayer();
    if (!lb || !duel.board || typeof lb.setScore !== "function") return;
    lb.setScore(duel.board, { score: myRating(), extraScore: duel.myWave }).then(() => {
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
    duel.pushTimer = setInterval(() => { if (duel.mode === "yandex") pushRating(); }, PUSH_MS);
    duel.pollTimer = setInterval(() => { if (duel.mode === "yandex") pollOpponent(); }, POLL_MS);
    duel.renderTimer = setInterval(() => { loop(); renderPanel(); }, RENDER_MS);
  }
  function stopTimers() {
    [duel.pushTimer, duel.pollTimer, duel.renderTimer].forEach(id => id && clearInterval(id));
    duel.pushTimer = duel.pollTimer = duel.renderTimer = null;
  }

  // core вызывает при каждой новой партии; панель нужна только в бою.
  duel.onGameStart = function (ranked) {
    duel.result = null;
    duel.myWave = 0;
    duel.opponent = null;
    duel.bot = null;
    duel.errors = 0;
    duel.running = false;
    if (!ranked) { stopTimers(); renderPanel(); return; }
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

  duel.onGameOver = function (finalWave, surrendered) {
    if (!duel.running) { renderPanel(); return; }
    duel.running = false;
    stopTimers();
    duel.myWave = Math.max(duel.myWave, finalWave || duel.myWave);
    const oppWaveRaw = duel.opponent ? duel.opponent.wave : (duel.bot ? duel.bot.wave : null);
    const oppWave = oppWaveRaw == null ? duel.myWave : oppWaveRaw; // неизвестно -> «волна в волну»
    // Рейтингованная партия — только человек против человека (живой лидерборд).
    const rated = duel.mode === "yandex" && !!duel.opponent;
    const base = surrendered ? T("ui.duelSurrendered")
      : duel.myWave > oppWave ? T("ui.duelWin", { a: duel.myWave, b: oppWave })
      : duel.myWave < oppWave ? T("ui.duelLose", { a: duel.myWave, b: oppWave })
      : T("ui.duelDraw");
    let delta = 0;
    if (rated && oppWaveRaw != null) {
      if (surrendered || duel.myWave < oppWave) delta = -RATING_STEP;
      else if (duel.myWave > oppWave) delta = RATING_STEP;
    }
    if (delta) {
      try { window.NeonRating && window.NeonRating.add(delta); } catch (e) {}
      duel.result = base + " · " + (delta > 0 ? "+" : "") + delta + " " + T("ui.ratingWord");
      pushRating(); // таблица обновляется сразу, не дожидаясь тика
    } else {
      duel.result = rated ? base : base + " · " + T("ui.duelUnrated");
    }
    renderPanel();
    refreshMenuButton();
  };

  /* ---------------- кнопка в меню ---------------- */
  function rankedLabel() {
    try { return T("ui.rankedBtn", { rating: myRating() }); } catch (e) { return "⚔ Рейтинговый бой"; }
  }
  function refreshMenuButton() {
    if (duel.menuBtn) duel.menuBtn.textContent = rankedLabel();
  }
  duel.refreshMenuButton = refreshMenuButton;
  function buildMenuButton() {
    const startBtn = document.getElementById("startGameBtn");
    if (!startBtn || duel.menuBtn) return;
    const btn = makeEl("button", "menu-ranked", rankedLabel());
    btn.id = "rankedBattleBtn";
    btn.type = "button";
    // data-i18n НЕ вешаем: в подписи живое число рейтинга, его пишет duel.js
    // (при смене языка текст вернётся через applyDom->перезапуск меню не нужен:
    //  кнопка перелинковывается refreshMenuButton по тикам и после боёв).
    btn.addEventListener("click", () => {
      // core.startRankedGame — глобальная функция game-core.js
      if (typeof startRankedGame === "function") startRankedGame();
    });
    startBtn.insertAdjacentElement("afterend", btn);
    duel.menuBtn = btn;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => { buildMenuButton(); });
  } else {
    buildMenuButton();
  }
  // Смена языка: у кнопки нет data-i18n (в подписи рейтинг) — перелинковка по hook.
  try { window.NeonI18N && window.NeonI18N.onChange(refreshMenuButton); } catch (e) {}

  // Хуки для автотестов (harness.js): прокрутка призрака без реальных таймеров.
  duel.testHooks = {
    tick: dt => tickBot(dt),
    render: renderPanel,
    match: findOnlineOpponent,
  };
})();
