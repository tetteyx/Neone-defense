/* =========================================================
   duel.js — «Рейтинговый бой» (соревновательный онлайн-режим v2)
   Вход: кнопка «⚔ Рейтинговый бой» в главном меню -> core.startRankedGame().
   Отличия боя от обычной партии (game-core.js): нет паузы, нет ускорителя
   (x1), вместо «Главное меню» — «Сдаться» (2 клика).

   Реальный realtime-PvP на Яндекс.Играх недоступен (нет сокетов/матчмейкинга,
   свои серверы запрещены), поэтому обмен живёт по LOW-FREQUENCY каналу —
   таблице лидеров современного API ysdk.leaderboards:
     · score = РЕЙТИНГ (его показывает лидерборд), extraData (строка) = волна
       — технический канал гонки;
     · каждые PUSH_MS setScore(name, рейтинг, String(волна)); каждые POLL_MS
       getEntries ищем соперника по player.uniqueID;
     · панель — пилюля ПО ЦЕНТРУ НАД игровым полем: «вы ⚔ соперник» обеими
       волнами и подписью режима;
     · ПОБЕДА ЗАСЧИТЫВАЕТСЯ СРАЗУ: как только наша волна обогнала волну
       соперника и его счёт молчит WIN_LOCK_MS (завершил партию) — +25
       начисляются немедленно, ещё до нашего game over;
     · на game over — добиваем итог: поражение/сдача = −25, ничья 0; бой с
       «призрачным игроком» (вне платформы/без авторизации/пустой таблицы/
       3 ошибок канала) нерейтингов («бой без рейтинга»);
     · дельта лежит в duel.lastDelta — финальный экран core печатает
       «Рейтинг: N (+25/−25)».
   Код таблицы: window.NEON_DUEL_LB_CODE, по умолчанию neon_rating — обязан
   совпасть с «Техническим названием лидерборда» в Консоли, иначе 404.
   ========================================================= */
(function () {
  "use strict";

  const PUSH_MS = 8000;     // как часто отправляем свой результат
  const POLL_MS = 10000;    // как часто читаем соперника
  const RENDER_MS = 900;    // перерисовка панели / тик призрака
  const STALE_MS = 45000;   // соперник молчит дольше — гасим индикатор
  const RATING_STEP = 25;   // рейтинг за победу против человека (сдача = −25)
  const WIN_LOCK_MS = 35000; // тишины в волне соперника = «партию он закончил»

  const duel = {
    running: false,
    mode: "bot",             // "yandex" | "bot"
    board: null,             // код таблицы лидеров
    myUid: null,
    opponent: null,          // { uid, name, rating, wave, seenAt }
    oppLastChange: 0,        // когда волна соперника в последний раз двигалась
    bot: null,               // { wave, acc, step, final, done }
    myWave: 0,
    result: null,
    lastDelta: 0,            // дельта рейтинга за бой (0 для нерейтинговых)
    wonEarly: false,         // победа зафиксирована до game over
    ratingApplied: false,
    pushTimer: null,
    pollTimer: null,
    renderTimer: null,
    errors: 0,
    panel: null,
    texts: null,
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
      "ui.duelYou": "вы",
      "ui.duelOpp": "соперник",
      "ui.duelLead": "опережаете на {n}",
      "ui.duelBehind": "отстаёте на {n}",
      "ui.duelEven": "волна в волну",
      "ui.duelWin": "Выжили дольше соперника: волна {a} против {b}",
      "ui.duelWinLocked": "Победа! Соперник завершил бой на волне {b}",
      "ui.duelLose": "Соперник выжил дольше: {b} против {a}",
      "ui.duelDraw": "Одинаковая волна — ничья",
      "ui.duelSurrendered": "Сдались — соперник побеждает",
      "ui.duelUnrated": "бой без рейтинга",
      "ui.ratingWord": "рейтинга",
      "ui.rankedBtn": "⚔ Рейтинговый бой · {rating}",
    };
    const raw = RU[key] || key;
    return params ? raw.replace(/\{(\w+)\}/g, (_, k) => (params[k] != null ? params[k] : `{${k}}`)) : raw;
  };

  /* ---------------- панель: пилюля по центру над игровым полем ---------- */
  function makeEl(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function gameCanvas() {
    return document.getElementById("game") || document.querySelector("canvas");
  }
  // Хост = ближайший позиционированный предок канваса (в реальной вёрстке —
  // .arena-wrap с position:relative), иначе — экран игры.
  function panelHost() {
    const canvas = gameCanvas();
    let el = canvas && canvas.parentElement;
    while (el && el !== document.body) {
      try {
        const pos = window.getComputedStyle ? window.getComputedStyle(el).position : null;
        if (pos && pos !== "static") return el;
      } catch (e) {}
      if (el.id === "gameScreen") return el;
      el = el.parentElement;
    }
    return document.getElementById("gameScreen") || document.body;
  }
  function buildPanel() {
    if (duel.panel) return;
    const host = panelHost();
    if (!host || !host.appendChild) return;
    const box = makeEl("div", "duel-panel");
    box.id = "duelPanel";
    box.setAttribute("aria-live", "polite");
    const dot = makeEl("span", "duel-dot");
    const meSide = makeEl("span", "duel-side duel-me");
    const meNum = makeEl("b", null, "…");
    meSide.append(meNum, makeEl("small", null, T("ui.duelYou")));
    const vs = makeEl("span", "duel-vs", "⚔");
    const oppSide = makeEl("span", "duel-side duel-opp");
    const oppNum = makeEl("b", null, "…");
    oppSide.append(oppNum, makeEl("small", null, T("ui.duelOpp")));
    const label = makeEl("small", "duel-label", T("ui.duelTitle"));
    box.append(dot, meSide, vs, oppSide, label);
    host.appendChild(box);
    duel.panel = box;
    duel.texts = { me: meNum, opp: oppNum, label, dot, vs, meSide, oppSide };
  }

  // Абсолютная привязка к фактическому прямоугольнику канваса: по центру
  // горизонтали поля, на WIN_GAP над ним; если запаса нет — в верхнюю полосу
  // канваса (пилюля не должна клиповаться overflow-хостом).
  function positionPanel() {
    try {
      const p = duel.panel;
      if (!p || p.style.display === "none") return;
      const canvas = gameCanvas();
      const host = p.offsetParent || p.parentElement;
      if (!canvas || !host || typeof canvas.getBoundingClientRect !== "function" ||
          typeof host.getBoundingClientRect !== "function" || typeof p.getBoundingClientRect !== "function") return;
      const cr = canvas.getBoundingClientRect();
      const hr = host.getBoundingClientRect();
      const pr = p.getBoundingClientRect();
      if (!cr.width || !pr.width) return;
      const left = cr.left - hr.left + (cr.width - pr.width) / 2;
      let top = cr.top - hr.top - pr.height - 8;
      if (top < 4) top = cr.top - hr.top + 6;
      p.style.left = Math.round(left) + "px";
      p.style.top = Math.round(top) + "px";
    } catch (e) { /* стенды без геометрии */ }
  }

  /* ---------------- ранний замок победы ---------------- */
  function applyRating(delta) {
    if (duel.ratingApplied || !delta) return;
    duel.ratingApplied = true;
    duel.lastDelta = delta;
    try { window.NeonRating && window.NeonRating.add(delta); } catch (e) {}
    pushRating();
    refreshMenuButton();
  }
  function checkEarlyWin() {
    if (!duel.running || duel.result || duel.wonEarly) return;
    if (duel.mode !== "yandex" || !duel.opponent || duel.opponent.wave == null) return;
    if (duel.myWave <= duel.opponent.wave) return;
    if (Date.now() - duel.oppLastChange < WIN_LOCK_MS) return;
    // Соперник молчит на своей финальной волне, а мы её пережили — победа.
    duel.wonEarly = true;
    duel.result = T("ui.duelWinLocked", { b: duel.opponent.wave });
    applyRating(RATING_STEP);
  }

  function renderPanel() {
    buildPanel();
    if (!duel.panel) return;
    checkEarlyWin();
    const t = duel.texts;
    const show = duel.running || duel.result;
    duel.panel.style.display = show ? "flex" : "none";
    duel.panel.classList.toggle("is-shown", show);
    if (!show) return;

    const mode = duel.mode === "yandex" ? T("ui.duelOnline") : T("ui.duelBot");
    const names = duel.panel.querySelectorAll(".duel-side small");
    if (names.length === 2) { names[0].textContent = T("ui.duelYou"); names[1].textContent = T("ui.duelOpp"); }
    t.me.textContent = String(duel.myWave);

    if (duel.mode === "yandex" && !duel.opponent) {
      t.opp.textContent = "…";
      t.label.textContent = T("ui.duelSearching");
      duel.panel.classList.remove("is-losing", "is-stale", "has-result", "is-won");
      positionPanel();
      return;
    }
    const oppWave = duel.opponent ? duel.opponent.wave : (duel.bot ? duel.bot.wave : null);
    const who = duel.opponent && duel.opponent.name ? duel.opponent.name : mode;
    t.opp.textContent = oppWave == null ? "—" : String(oppWave);

    const stale = duel.opponent && Date.now() - duel.opponent.seenAt > STALE_MS;
    let deltaText = who;
    if (oppWave != null) {
      const diff = duel.myWave - oppWave;
      const rel = diff > 0 ? T("ui.duelLead", { n: diff })
        : diff < 0 ? T("ui.duelBehind", { n: -diff })
        : T("ui.duelEven");
      deltaText = who + " · " + rel;
    }
    duel.panel.classList.toggle("is-losing", !duel.result && oppWave != null && duel.myWave < oppWave);
    duel.panel.classList.toggle("is-stale", !!stale && !duel.result);
    duel.panel.classList.toggle("has-result", !!duel.result && !duel.wonEarly);
    duel.panel.classList.toggle("is-won", !!duel.result && duel.wonEarly);
    t.label.textContent = duel.result ? duel.result : deltaText;
    positionPanel();
  }

  /* ---------------- канал лидерборда (современный ysdk.leaderboards) ----- */
  // Реальный API SDK (docs: sdk/sdk-leaderboard):
  //   ysdk.leaderboards.setScore(name, score:number, extraData?:string)
  //   ysdk.leaderboards.getEntries(name, {quantityTop, quantityAround, includeUser})
  //     -> { entries: [{ score, extraData, rank, player:{ publicName, uniqueID } }], userRank }
  // ysdk.getLeaderboards() устарел, player.getLeaderboards() не существует.
  let lbApiPromise = null;
  function leaderboardsApi() {
    if (lbApiPromise) return lbApiPromise;
    lbApiPromise = (async () => {
      const s = window.NeonBridgeYandex && window.NeonBridgeYandex.sdk;
      if (!s) return null;
      const l = s.leaderboards;
      if (l && typeof l.getEntries === "function" && typeof l.setScore === "function") return l;
      if (typeof s.getLeaderboards === "function") { // deprecated-мост на всякий
        try {
          const old = await s.getLeaderboards();
          if (old && typeof old.getLeaderboardEntries === "function") {
            return {
              getEntries: (n, o) => old.getLeaderboardEntries(n, o),
              setScore: (n, v, x) => old.setLeaderboardScore(n, v, x),
              getPlayerEntry: n => old.getLeaderboardPlayerEntry(n),
            };
          }
        } catch (e) {}
      }
      return null;
    })();
    return lbApiPromise;
  }
  function duelAuthorized() {
    try {
      const p = window.NeonBridgeYandex && window.NeonBridgeYandex.player;
      return !!p && (typeof p.isAuthorized !== "function" || p.isAuthorized());
    } catch (e) { return false; }
  }

  function uidOf(e) {
    try { return String((e && e.player && (e.player.uniqueID ?? e.player.uniqueId)) || "").toLowerCase(); } catch (err) { return ""; }
  }
  function ratingOf(e) {
    return Math.max(0, Math.round(+(e && e.score) || 0));
  }
  function waveOf(e) {
    if (!e || e.extraData == null) return null;
    const w = parseInt(e.extraData, 10);
    return Number.isFinite(w) && w >= 0 ? w : null;
  }
  function myRating() {
    try { return window.NeonRating ? window.NeonRating.get() : 0; } catch (e) { return 0; }
  }

  async function findOnlineOpponent() {
    // Синхронный выход: моста/SDK нет вовсе (git-сборка до boot, file://) —
    // заведомый бот без лишней вереницы микротасок.
    if (!window.NeonBridgeYandex || !window.NeonBridgeYandex.sdk) { duel.mode = "bot"; startBot(); renderPanel(); return; }
    const api = await leaderboardsApi();
    if (!api || !duelAuthorized()) { duel.mode = "bot"; startBot(); renderPanel(); return; }
    try {
      duel.board = window.NEON_DUEL_LB_CODE || "neon_rating";
      try { duel.myUid = String(window.NeonBridgeYandex.player.getUniqueID()).toLowerCase(); } catch (e) {}
      // Верх таблицы + окно вокруг своей позиции: для новичка это топ,
      // для крепкого середняка — свои «весовые».
      const res = await api.getEntries(duel.board, { quantityTop: 10, quantityAround: 15, includeUser: true });
      const rows = (res && res.entries || []).filter(e => uidOf(e) && uidOf(e) !== duel.myUid);
      if (!rows.length) throw new Error("empty board");
      // Матчмейкинг по рейтингу: ближайший к своему значению.
      const mine = myRating();
      rows.sort((a, b) => Math.abs(ratingOf(a) - mine) - Math.abs(ratingOf(b) - mine));
      const pick = rows[0];
      duel.opponent = {
        uid: uidOf(pick),
        name: (pick.player && pick.player.publicName) || "—",
        rating: ratingOf(pick),
        wave: waveOf(pick),
        seenAt: Date.now(),
      };
      duel.oppLastChange = Date.now();
      duel.mode = "yandex";
    } catch (e) {
      duel.mode = "bot";
      startBot();
    }
    renderPanel();
  }

  function pollOpponent() {
    if (!duel.board || !duel.opponent) return;
    leaderboardsApi().then(api => {
      if (!api) return;
      api.getEntries(duel.board, { quantityAround: 30, includeUser: true }).then(res => {
        const row = (res && res.entries || []).find(e => uidOf(e) === duel.opponent.uid);
        if (!row) return;
        const wave = waveOf(row);
        const rating = ratingOf(row);
        if (wave !== duel.opponent.wave) duel.oppLastChange = Date.now();
        if (wave !== duel.opponent.wave || rating !== duel.opponent.rating) duel.opponent.seenAt = Date.now();
        duel.opponent.wave = wave;
        duel.opponent.rating = rating;
        duel.errors = 0;
        renderPanel();
      }).catch(() => {});
    });
  }

  function pushRating() {
    if (!duel.board) return;
    leaderboardsApi().then(api => {
      if (!api) return;
      api.setScore(duel.board, myRating(), String(Math.max(0, duel.myWave | 0))).then(() => {
        duel.errors = 0;
      }).catch(() => {
        if (++duel.errors >= 3) { duel.mode = "bot"; duel.opponent = null; startBot(); }
      });
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
  try { window.addEventListener("resize", () => positionPanel()); } catch (e) {}

  // core вызывает при каждой новой партии; панель нужна только в бою.
  duel.onGameStart = function (ranked) {
    duel.result = null;
    duel.myWave = 0;
    duel.opponent = null;
    duel.bot = null;
    duel.oppLastChange = 0;
    duel.lastDelta = 0;
    duel.wonEarly = false;
    duel.ratingApplied = false;
    duel.errors = 0;
    duel.running = false;
    if (!ranked) { stopTimers(); renderPanel(); return; }
    duel.running = true;
    buildPanel();
    refreshMenuButton();
    // Оптимистично в «поиске» (yandex без соперника = «…»); findOnlineOpponent
    // сам решит канал: современный API лидербордов или честный возврат в бота.
    duel.mode = "yandex";
    findOnlineOpponent();
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
    if (duel.wonEarly && duel.result) {
      // Победа уже зафиксирована и рейтинг начислен — итог не меняем,
      // но финальную волну дописываем в extraData таблицы.
      pushRating();
      renderPanel();
      refreshMenuButton();
      return;
    }
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
      applyRating(delta);
      duel.result = base + " · " + (delta > 0 ? "+" : "") + delta + " " + T("ui.ratingWord");
    } else {
      duel.lastDelta = 0;
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
    // data-i18n НЕ вешаем: в подписи живое число рейтинга — рулит refresh.
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

  // Хуки для автотестов (harness.js).
  duel.testHooks = {
    tick: dt => tickBot(dt),
    render: renderPanel,
    match: findOnlineOpponent,
    // «соперник замолчал навсегда» — для проверки раннего замка победы;
    // и его волна: setter без живого лидерборда.
    silence: () => { duel.oppLastChange = 0; },
    oppWave: n => { if (duel.opponent) { duel.opponent.wave = n; duel.oppLastChange = Date.now(); } },
  };
})();
