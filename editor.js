/* =========================================================
   Bridge Guardians — РЕДАКТОР КАРТ (editor.js)
   Простой редактор маршрута: ставишь/тянешь точки, сохраняешь.
   Карты пишутся в localStorage (neonBridgeDefenseMaps_v1) —
   тот же ключ читает игра, поэтому карта сразу появляется
   в меню «Выберите карту».

   file:// friendly: никаких fetch/eval, только DOM + JSON.
========================================================= */
(function () {
  "use strict";

  const GAME_W = 1000;
  const GAME_H = 640;
  const MAPS_KEY = "neonBridgeDefenseMaps_v1";
  const GRID = 20;

  /* Перевод через i18n.js (требование 2.14). RU-фолбэк встроен: редактор
     работает и без словаря (например, в изолированных тестах). */
  const RU_FALL = {
    "editor.defaultName": "Моя карта",
    "editor.defaultDesc": "Пользовательский маршрут",
    "editor.start": "СТАРТ",
    "editor.core": "ЯДРО",
    "editor.emptyCanvas1": "Кликните в любом месте, чтобы начать маршрут",
    "editor.emptyCanvas2": "Затем кликайте по дороге, чтобы добавлять повороты",
    "editor.noStorage": "Хранилище недоступно — используйте «Экспорт» ниже.",
    "editor.saved": "Сохранено! Карта уже в списке в игре — закрывайте редактор.",
    "editor.emptyList": "Сохранённых карт пока нет.",
    "editor.notitled": "Без названия",
    "editor.pointsShort": "Точки: {n}",
    "editor.open": "Открыть",
    "ui.deleteMap": "Удалить карту",
    "editor.deleted": "Карта удалена.",
    "editor.editing": "Редактируется «{n}».",
    "editor.exported": "Карта готова к экспорту в поле ниже.",
    "editor.noPoints": "Вставьте JSON в поле.",
    "editor.importedName": "Импортированная",
    "editor.imported": "Импорт выполнен.",
    "editor.badJson": "Неверный JSON: {e}",
    "editor.cantDeleteEdge": "Стартовую и конечную точку удалить нельзя.",
    "editor.snapOn": "Сетка: вкл",
    "editor.snapOff": "Сетка: выкл",
    "valid.need2": "Нужно минимум 2 точки.",
    "valid.startEdge": "Начало маршрута должно выходить за левый край поля (враги приходят слева).",
    "valid.coreEdge": "Конец маршрута (ядро) должен быть у правого края поля.",
    "valid.short": "Две точки стоят слишком близко — разведите их подальше.",
    "valid.notArray": "Точки не заданы."
  };
  function tl(key, params) {
    let s;
    if (window.NeonI18N && typeof window.NeonI18N.t === "function") s = window.NeonI18N.t(key, params);
    else s = (RU_FALL[key] !== undefined ? RU_FALL[key] : key);
    if (params) s = s.replace(/\{(\w+)\}/g, (m, k) => (params[k] !== undefined ? String(params[k]) : m));
    return s;
  }

  const BUILTIN = {
    ridge: { name: "Первый мост", path: [[-40,120],[150,120],[150,250],[350,250],[350,110],[560,110],[560,390],[790,390],[790,220],[946,220]] },
    circuit: { name: "Кибер-контур", path: [[-40,500],[140,500],[140,150],[330,150],[330,430],[520,430],[520,180],[720,180],[720,500],[946,500]] },
    coreline: { name: "Жизненная линия", path: [[-40,320],[180,320],[180,120],[430,120],[430,500],[680,500],[680,300],[946,300]] }
  };

  const $ = sel => document.querySelector(sel);

  // Редактор обычно открыт iframe-оверлеем поверх игры (index.html).
  // Тогда вместо навигации общаемся с родительской страницей.
  const embedded = (() => {
    try { return window.parent !== window; } catch (e) { return false; }
  })();
  function post(msg) {
    if (!embedded) return;
    try { window.parent.postMessage(msg, "*"); } catch (e) { /* noop */ }
  }
  function requestBack() {
    if (embedded) { post({ type: "neon-editor-close" }); return true; }
    return false;
  }

  const state = {
    points: [],
    name: tl("editor.defaultName"),
    description: tl("editor.defaultDesc"),
    selected: -1,
    dragging: false,
    snap: true,
    undo: []
  };

  let canvas, ctx;
  let view = { scale: 1, offX: 0, offY: 0 };   // безопасное значение до resize()
  let statusEl, nameEl, descEl, pointsEl, listEl;

  /* ---------- утилиты ---------- */
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function snapVal(v) { return state.snap ? Math.round(v / GRID) * GRID : Math.round(v); }
  function copyPoints() { return state.points.map(p => ({ x: p.x, y: p.y })); }
  function pushUndo() { state.undo.push(copyPoints()); if (state.undo.length > 40) state.undo.shift(); }

  function setStatus(msg, ok) {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.classList.toggle("ok", !!ok);
    statusEl.classList.toggle("bad", ok === false);
  }

  function distToSegment(px, py, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy || 1;
    let t = ((px - a.x) * dx + (py - a.y) * dy) / len2;
    t = clamp(t, 0, 1);
    return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
  }

  /* ---------- валидация маршрута (чистая функция, доступна тестам) ---------- */
  function validatePath(points) {
    const errs = [];
    if (!Array.isArray(points)) return [tl("valid.notArray")];
    if (points.length < 2) { errs.push(tl("valid.need2")); return errs; }
    const a = points[0], e = points[points.length - 1];
    if (a.x > 40) errs.push(tl("valid.startEdge"));
    if (e.x < 860) errs.push(tl("valid.coreEdge"));
    for (let i = 1; i < points.length; i++) {
      if (Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y) < 24) {
        errs.push(tl("valid.short"));
        break;
      }
    }
    return errs;
  }

  function validate() { return validatePath(state.points); }

  try {
    (typeof window !== "undefined" ? window : globalThis).NeonEditorLogic = {
      validatePath,
      snapValue: (v, on) => (on ? Math.round(v / GRID) * GRID : Math.round(v)),
      distToSegment,
      // Хуки для автотестов (harvest): реальный прогон init/click/save на заглушках.
      __test: {
        state,
        pointerDown: (x, y) => onPointerDown({ clientX: x, clientY: y }),
        save: () => commit(false)
      }
    };
  } catch (e) { /* не браузер */ }

  /* ---------- координаты ---------- */
  function toWorld(evt) {
    const rect = canvas.getBoundingClientRect();
    const sx = (evt.clientX - rect.left) * (canvas.width / rect.width);
    const sy = (evt.clientY - rect.top) * (canvas.height / rect.height);
    return {
      x: clamp(snapVal((sx - view.offX) / view.scale), 0, GAME_W),
      y: clamp(snapVal((sy - view.offY) / view.scale), 0, GAME_H)
    };
  }
  function toRaw(evt) {
    const rect = canvas.getBoundingClientRect();
    const sx = (evt.clientX - rect.left) * (canvas.width / rect.width);
    const sy = (evt.clientY - rect.top) * (canvas.height / rect.height);
    return { x: (sx - view.offX) / view.scale, y: (sy - view.offY) / view.scale };
  }
  function nearestPoint(w) {
    let best = -1, bestD = 16;
    state.points.forEach((p, i) => {
      const d = Math.hypot(p.x - w.x, p.y - w.y);
      if (d < bestD) { bestD = d; best = i; }
    });
    return best;
  }
  function nearestSegmentInsert(w) {
    let best = -1, bestD = 18;
    for (let i = 0; i < state.points.length - 1; i++) {
      const d = distToSegment(w.x, w.y, state.points[i], state.points[i + 1]);
      if (d < bestD) { bestD = d; best = i; }
    }
    return best < 0 ? null : { index: best + 1, point: { x: w.x, y: w.y } };
  }

  /* ---------- отрисовка ---------- */
  function resize() {
    const wrap = $("#editorWrap");
    const cssW = Math.max(320, wrap.clientWidth);
    const cssH = Math.round(cssW * GAME_H / GAME_W);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.style.width = cssW + "px";
    canvas.style.height = cssH + "px";
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    view = { scale: canvas.width / GAME_W, offX: 0, offY: 0 };
    draw();
  }

  function strokePath(pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
  }

  function draw() {
    if (!ctx) return;
    const s = view.scale;
    ctx.setTransform(s, 0, 0, s, 0, 0);
    ctx.clearRect(0, 0, GAME_W, GAME_H);

    ctx.fillStyle = "#0d1018";
    ctx.fillRect(0, 0, GAME_W, GAME_H);

    // сетка
    ctx.strokeStyle = "rgba(116,196,118,.09)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= GAME_W; x += GRID * 2) { ctx.moveTo(x, 0); ctx.lineTo(x, GAME_H); }
    for (let y = 0; y <= GAME_H; y += GRID * 2) { ctx.moveTo(0, y); ctx.lineTo(GAME_W, y); }
    ctx.stroke();

    // коридоры: приход (слева) и ядро (справа)
    ctx.fillStyle = "rgba(91,159,214,.08)";
    ctx.fillRect(0, 0, 40, GAME_H);
    ctx.fillStyle = "rgba(223,106,95,.08)";
    ctx.fillRect(GAME_W - 90, 0, 90, GAME_H);

    const pts = state.points;

    if (pts.length >= 2) {
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.strokeStyle = "#1a2033"; ctx.lineWidth = 72; strokePath(pts);
      ctx.strokeStyle = "rgba(116,196,118,.55)"; ctx.lineWidth = 3.5; strokePath(pts);
    }

    // точки
    pts.forEach((p, i) => {
      const first = i === 0, last = i === pts.length - 1;
      const col = first ? "#5b9fd6" : last ? "#df6a5f" : "#8fd0e8";
      const sel = i === state.selected;
      ctx.beginPath();
      ctx.arc(p.x, p.y, sel ? 11 : first || last ? 8 : 6.5, 0, Math.PI * 2);
      ctx.fillStyle = "#191e30"; ctx.fill();
      ctx.lineWidth = sel ? 3 : 2; ctx.strokeStyle = col; ctx.stroke();
      if (sel) { ctx.beginPath(); ctx.arc(p.x, p.y, 16, 0, Math.PI * 2); ctx.strokeStyle = "rgba(116,196,118,.5)"; ctx.lineWidth = 1; ctx.stroke(); }
    });

    // подписи + номер порядка
    ctx.textAlign = "center";
    ctx.font = "700 13px Inter, system-ui, sans-serif";
    pts.forEach((p, i) => {
      const first = i === 0, last = i === pts.length - 1;
      ctx.fillStyle = first ? "#8fd0e8" : last ? "#cf8e97" : "#8fd0e8";
      ctx.fillText(first ? tl("editor.start") : last ? tl("editor.core") : String(i + 1), clamp(p.x, 24, GAME_W - 24), clamp(p.y - 20, 16, GAME_H - 6));
    });
    ctx.textAlign = "left";

    if (pts.length === 0) {
      ctx.fillStyle = "rgba(238,241,247,.6)";
      ctx.font = "600 22px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(tl("editor.emptyCanvas1"), GAME_W / 2, GAME_H / 2 - 12);
      ctx.font = "500 15px Inter, system-ui, sans-serif";
      ctx.fillStyle = "rgba(238,241,247,.55)";
      ctx.fillText(tl("editor.emptyCanvas2"), GAME_W / 2, GAME_H / 2 + 16);
      ctx.textAlign = "left";
    }
  }

  /* ---------- хранилище ---------- */
  function loadStored() {
    try {
      const raw = localStorage.getItem(MAPS_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }
  function saveStored(arr) {
    try { localStorage.setItem(MAPS_KEY, JSON.stringify(arr)); return true; }
    catch (e) { return false; }
  }
  function uid() { return "cm_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  function buildEntry() {
    return {
      id: ($("#mapId") && $("#mapId").value) || uid(),
      name: (state.name || tl("editor.defaultName")).slice(0, 28),
      description: (state.description || tl("editor.defaultDesc")).slice(0, 60),
      path: copyPoints()
    };
  }

  function commit(silent) {
    const errs = validate();
    if (errs.length) { if (!silent) setStatus(errs[0], false); return null; }
    const entry = buildEntry();
    const arr = loadStored();
    const i = arr.findIndex(m => m.id === entry.id);
    if (i >= 0) arr[i] = entry; else arr.push(entry);
    if (arr.length > 12) arr.splice(0, arr.length - 12);
    if (!saveStored(arr)) { if (!silent) setStatus(tl("editor.noStorage"), false); return null; }
    post({ type: "neon-editor-saved", id: entry.id });   // игра обновит список на лету
    return entry;
  }

  function onSave() {
    const entry = commit(false);
    if (entry) { setStatus(tl("editor.saved"), true); renderList(); }
  }
  function onPlayNow() {
    const entry = commit(false);
    if (!entry) return;
    if (!requestBack()) window.location.href = "index.html";
  }

  /* ---------- список карт ---------- */
  function renderList() {
    if (!listEl) return;
    const arr = loadStored();
    listEl.innerHTML = "";
    if (!arr.length) {
      const empty = document.createElement("li");
      empty.className = "editor-empty";
      empty.textContent = tl("editor.emptyList");
      listEl.appendChild(empty);
      return;
    }
    arr.forEach(m => {
      const li = document.createElement("li");
      li.className = "editor-map-item";

      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 1000 640");
      svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
      const pl = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
      pl.setAttribute("points", (m.path || []).map(p => `${p.x},${p.y}`).join(" "));
      pl.setAttribute("fill", "none");
      pl.setAttribute("stroke", "#74c476");
      pl.setAttribute("stroke-width", "46");
      pl.setAttribute("stroke-linejoin", "round");
      pl.setAttribute("stroke-linecap", "round");
      svg.appendChild(pl);
      li.appendChild(svg);

      const meta = document.createElement("div");
      meta.className = "editor-map-meta";
      const b = document.createElement("b"); b.textContent = m.name || tl("editor.notitled");
      const s = document.createElement("small"); s.textContent = tl("editor.pointsShort", { n: (m.path || []).length });
      meta.appendChild(b); meta.appendChild(s);
      li.appendChild(meta);

      const load = document.createElement("button");
      load.className = "editor-mini"; load.textContent = tl("editor.open");
      load.addEventListener("click", () => editEntry(m));
      li.appendChild(load);

      const del = document.createElement("button");
      del.className = "editor-mini danger"; del.textContent = "✕";
      del.title = tl("ui.deleteMap");
      del.addEventListener("click", () => { saveStored(loadStored().filter(x => x.id !== m.id)); renderList(); setStatus(tl("editor.deleted"), true); });
      li.appendChild(del);

      listEl.appendChild(li);
    });
  }

  function editEntry(m) {
    pushUndo();
    state.points = (m.path || []).map(p => ({ x: p.x, y: p.y }));
    state.name = m.name || tl("editor.defaultName");
    state.description = m.description || tl("editor.defaultDesc");
    state.selected = -1;
    if (nameEl) nameEl.value = state.name;
    if (descEl) descEl.value = state.description;
    if ($("#mapId")) $("#mapId").value = m.id;
    updateMeta(); draw();
    setStatus(tl("editor.editing", { n: state.name }), true);
  }

  /* ---------- экспорт / импорт (для file://) ---------- */
  function exportMap() {
    const entry = buildEntry();
    const json = JSON.stringify({ neonMap: 1, maps: [entry] }, null, 2);
    try { navigator.clipboard && navigator.clipboard.writeText(json); } catch (e) {}
    const ta = $("#importBox"); if (ta) ta.value = json;
    setStatus(tl("editor.exported"), true);
  }
  function importMap() {
    const ta = $("#importBox");
    if (!ta || !ta.value.trim()) { setStatus(tl("editor.noPoints"), false); return; }
    try {
      const data = JSON.parse(ta.value);
      const list = Array.isArray(data.maps) ? data.maps : (data.path ? [data] : []);
      const arr = loadStored();
      list.forEach(m => {
        if (!m || !Array.isArray(m.path)) return;
        const id = typeof m.id === "string" ? m.id : uid();
        const entry = { id, name: String(m.name || tl("editor.importedName")).slice(0, 28), description: String(m.description || "").slice(0, 60), path: m.path };
        const i = arr.findIndex(x => x.id === id);
        if (i >= 0) arr[i] = entry; else arr.push(entry);
      });
      saveStored(arr.slice(-12));
      renderList();
      setStatus(tl("editor.imported"), true);
    } catch (e) { setStatus(tl("editor.badJson", { e: e.message }), false); }
  }

  /* ---------- шаблоны ---------- */
  function loadTemplate(kind) {
    pushUndo();
    let src;
    if (kind === "empty") src = [];
    else if (kind === "straight") src = [{ x: -40, y: GAME_H / 2 }, { x: 946, y: GAME_H / 2 }];
    else if (kind === "serpentine") {
      src = [{ x: -40, y: 120 }];
      let dir = 1, y = 120;
      for (let x = 150; x < 946; x += 175) { y = dir > 0 ? 520 : 120; dir *= -1; src.push({ x: snapVal(x), y }); }
      src.push({ x: 946, y: 300 });
    } else {
      src = (BUILTIN[kind] || BUILTIN.ridge).path.map(p => ({ x: p[0], y: p[1] }));
    }
    state.points = src.map(p => ({ x: p.x, y: p.y }));
    state.selected = -1;
    if ($("#mapId")) $("#mapId").value = "";
    updateMeta(); draw();
  }

  function updateMeta() { if (pointsEl) pointsEl.textContent = tl("editor.pointsShort", { n: state.points.length }); }

  /* ---------- события поля ---------- */
  function onPointerDown(evt) {
    const w = toWorld(evt);
    const hit = nearestPoint(w);
    if (hit >= 0) {
      state.selected = hit;
      state.dragging = true;
      pushUndo();
      canvas.setPointerCapture && canvas.setPointerCapture(evt.pointerId);
    } else {
      pushUndo();
      const ins = nearestSegmentInsert(w);
      const np = { x: clamp(w.x, 0, GAME_W), y: clamp(w.y, 0, GAME_H) };
      if (ins) { state.points.splice(ins.index, 0, np); state.selected = ins.index; }
      else { state.points.push(np); state.selected = state.points.length - 1; }
      updateMeta();
    }
    draw();
  }
  function onPointerMove(evt) {
    if (!state.dragging || state.selected < 0) return;
    const w = toWorld(evt);
    state.points[state.selected] = { x: clamp(w.x, 0, GAME_W), y: clamp(w.y, 0, GAME_H) };
    draw();
  }
  function onPointerUp() { state.dragging = false; }
  function onDblClick(evt) {
    const raw = toRaw(evt);
    let best = -1, bestD = 18;
    state.points.forEach((p, i) => { const d = Math.hypot(p.x - raw.x, p.y - raw.y); if (d < bestD) { bestD = d; best = i; } });
    if (best > 0 && best < state.points.length - 1) { pushUndo(); state.points.splice(best, 1); state.selected = -1; updateMeta(); draw(); }
  }
  function deleteSelected() {
    const i = state.selected;
    if (i <= 0 || i >= state.points.length - 1) { setStatus(tl("editor.cantDeleteEdge"), false); return; }
    pushUndo(); state.points.splice(i, 1); state.selected = -1; updateMeta(); draw();
  }
  function undo() { if (!state.undo.length) return; state.points = state.undo.pop(); state.selected = -1; updateMeta(); draw(); }

  /* ---------- запуск ---------- */
  function init() {
    canvas = $("#editorCanvas");
    if (!canvas) return;
    ctx = canvas.getContext("2d");
    statusEl = $("#editorStatus");
    nameEl = $("#editorName");
    descEl = $("#editorDesc");
    pointsEl = $("#editorPointCount");
    listEl = $("#editorMapList");

    // ВАЖНО: resize() задаёт view (масштаб) и делает первый кадр ДО любого draw().
    resize();

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("dblclick", onDblClick);
    window.addEventListener("resize", resize);
    window.addEventListener("keydown", e => {
      if (e.key === "Escape" && requestBack()) { /* закрыли оверлей */ }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); undo(); }
      else if (e.key === "Delete") deleteSelected();
    });
    const backLink = $("#backLink");
    if (backLink && embedded) {
      backLink.addEventListener("click", e => { if (requestBack()) e.preventDefault(); });
    }

    if (nameEl) nameEl.addEventListener("input", () => state.name = nameEl.value);
    if (descEl) descEl.addEventListener("input", () => state.description = descEl.value);

    $("#btnSave").addEventListener("click", onSave);
    const playBtn = $("#btnPlayNow"); if (playBtn) playBtn.addEventListener("click", onPlayNow);
    $("#btnExport").addEventListener("click", exportMap);
    $("#btnImport").addEventListener("click", importMap);
    $("#btnUndo").addEventListener("click", undo);
    $("#btnClear").addEventListener("click", () => { pushUndo(); state.points = []; state.selected = -1; updateMeta(); draw(); });
    const snapBtn = $("#btnSnap");
    const setSnapLabel = () => {
      if (snapBtn) snapBtn.textContent = tl(state.snap ? "editor.snapOn" : "editor.snapOff");
    };
    setSnapLabel();
    if (snapBtn) snapBtn.addEventListener("click", e => {
      state.snap = !state.snap;
      e.currentTarget.classList.toggle("active", state.snap);
      setSnapLabel();
    });
    document.querySelectorAll("[data-template]").forEach(b => {
      b.addEventListener("click", () => loadTemplate(b.dataset.template));
    });

    // Реакция на смену языка (требование 2.14): динамические тексты и
    // плейсхолдерные значения полей обновляются без перезагрузки.
    const DEFAULT_TEXTS = ["Моя карта", "My Map", "Пользовательский маршрут", "Custom route"];
    function retranslateInputs() {
      if (nameEl && (!nameEl.value || DEFAULT_TEXTS.indexOf(nameEl.value) >= 0)) {
        nameEl.value = tl("editor.defaultName");
        state.name = nameEl.value;
      }
      if (descEl && (!descEl.value || DEFAULT_TEXTS.indexOf(descEl.value) >= 0)) {
        descEl.value = tl("editor.defaultDesc");
        state.description = descEl.value;
      }
    }
    retranslateInputs();
    try { document.title = tl("editor.pageTitle"); } catch (e) {}
    if (window.NeonI18N && typeof window.NeonI18N.onChange === "function") {
      window.NeonI18N.onChange(() => {
        retranslateInputs();
        try { document.title = tl("editor.pageTitle"); } catch (e) {}
        setSnapLabel();
        updateMeta();
        renderList();
        draw();
      });
    }

    loadTemplate("serpentine");   // понятный старт: готовая дорожка, которую можно править
    renderList();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
