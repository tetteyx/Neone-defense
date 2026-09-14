/* =========================================================
   game.js — оболочка Яндекс.Игр для Neon Bridge Defense.

   Реализовано по официальной документации:
   yandex.ru/dev/games/doc/ru/sdk (подключение — относительный /sdk.js,
   затем документированный CDN https://yandex.ru/games/sdk/v2 как резерв для
   локальной разработки вне платформы):
     · 1.1  / sdk-about  — инициализация YaGames.init();
     · 2.14 / sdk-environment#structure-i18n — язык определяется на старте
       из ysdk.environment.i18n.lang (i18n.js применяет ru/en);
     · 1.19.2 / sdk-game-events — LoadingAPI.ready() только когда игра
       полностью загружена и доступна для взаимодействия;
     · 1.19.3 / sdk-game-events — GameplayAPI.start()/stop() на всех переходах
       «игрок начал/прекратил игровой процесс»;
     · 1.19.4 / sdk-events — обработка game_api_pause / game_api_resume
       (стартовая полноэкранная реклама платформы, переключение вкладок):
       пауза звука и геймплея, возобновление только если игрок был в игре;
     · 1.12 / sdk-adv — монетизация подключена: полноэкранный блок показывается
       по пользовательскому действию («Начать заново») с callbacks, rewarded
       видео — по явной кнопке с наградой; звук и геймплей останавливаются на
       время показа (4.7);
     · sdk-review — запрос оценки игры после победы (canPerformNewFeedback);
     · sdk-player — player.getData/setData: облачное сохранение прогресса и
       пользовательских карт (гость может играть без авторизации, 1.2.2).
   Без SDK (file://, локальный сервер) игра остаётся полностью играбельной.
========================================================= */
(() => {
  "use strict";

  const GAME_SAVE_KEY = "neonBridgeDefenseSave_v5";
  const GAME_MAPS_KEY = "neonBridgeDefenseMaps_v1";
  const GAME_MAPS_DELETED_KEY = "neonBridgeDefenseMapsDeleted_v1";
  const GAME_RATING_KEY = "neonBridgeDefenseRating_v1";
  const CORE_SCRIPT = "game-core.js";
  const ADAPTIVE_STYLE = "yandex.css";
  const FULLSCREEN_AD_COOLDOWN = 60000;

  const state = window.NeonBridgeYandex = {
    sdk: null,
    player: null,
    ready: false,
    platformPaused: false,
    platformPausedGame: false,
    platformEventsBound: false,
    gameplayActive: false,
    language: "ru",
    lastFullscreenAt: 0,
    reviewAsked: false
  };

  /* ---------------- утилиты загрузки ---------------- */

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  function loadStyle(href) {
    return new Promise((resolve) => {
      if (document.querySelector(`link[data-neon-yandex-style="${href}"]`)) {
        resolve();
        return;
      }
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      link.dataset.neonYandexStyle = href;
      link.onload = resolve;
      link.onerror = resolve;
      document.head.appendChild(link);
    });
  }

  function loadCore() {
    // Ядро игры грузится обычным тегом <script>: работает и с http(s)-сервера,
    // и при открытии index.html двойным кликом (file://), где fetch заблокирован CORS.
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = CORE_SCRIPT;
      script.async = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Не удалось загрузить ${CORE_SCRIPT}`));
      document.body.appendChild(script);
    });
  }

  /* ---------------- аудио: остановка при потере фокуса (п. 1.3) ---------------- */

  function installAudioFocusGuard() {
    const NativeAudioContext = window.AudioContext;
    const NativeWebkitAudioContext = window.webkitAudioContext;
    const AudioCtor = NativeAudioContext || NativeWebkitAudioContext;
    if (!AudioCtor || window.__neonBridgeAudioContextWrapped) return;

    try {
      const WrappedAudioContext = new Proxy(AudioCtor, {
        construct(target, args) {
          const context = Reflect.construct(target, args);
          window.__neonBridgeAudioContext = context;
          return context;
        }
      });

      window.AudioContext = WrappedAudioContext;
      if (NativeWebkitAudioContext) window.webkitAudioContext = WrappedAudioContext;
      window.__neonBridgeAudioContextWrapped = true;
    } catch (error) {
      // Некоторые браузеры не позволяют переопределить конструктор AudioContext.
    }
  }

  function stopAudio() {
    const context = window.__neonBridgeAudioContext;
    if (context && typeof context.suspend === "function") context.suspend().catch(() => {});
  }

  function resumeAudio() {
    const context = window.__neonBridgeAudioContext;
    if (context && typeof context.resume === "function") context.resume().catch(() => {});
  }

  /* ---------------- разметка геймплея (sdk-game-events) ---------------- */

  function gameplayStart() {
    if (state.platformPaused) return;
    state.gameplayActive = true;
    state.sdk?.features?.GameplayAPI?.start?.();
    tryEnterMobileFullscreen();
  }

  function gameplayStop() {
    state.gameplayActive = false;
    state.sdk?.features?.GameplayAPI?.stop?.();
  }

  let mobileFullscreenAsked = false;
  function tryEnterMobileFullscreen() {
    // П. 1.6.1.1: на мобильных игра должна быть в полноэкранном режиме.
    // Вход — только по пользовательскому жесту и только если платформа
    // сообщает, что устройство мобильное.
    if (mobileFullscreenAsked || !state.sdk) return;
    const isMobile = !!state.sdk.deviceInfo?.isMobile;
    if (!isMobile) return;
    mobileFullscreenAsked = true;
    try {
      if (state.sdk.screenFull?.canEnter?.() !== false) state.sdk.screenFull?.enter?.();
    } catch (error) { /* полноэкранный режим недоступен — не критично */ }
  }

  function isGameVisible() {
    const gameScreen = document.getElementById("gameScreen");
    return !!gameScreen && !gameScreen.classList.contains("hidden");
  }

  function isGamePaused() {
    // Источник правды — state.paused ядра (оверлей паузы в этой игре не
    // показывается); оверлей остаётся запасным вариантом.
    if (window.NeonGameHooks && typeof window.NeonGameHooks.isPaused === "function") {
      try { return !!window.NeonGameHooks.isPaused(); } catch (e) {}
    }
    const overlay = document.getElementById("pauseOverlay");
    return !!overlay && !overlay.classList.contains("hidden");
  }

  // Финал партии: экран «Game Over» открыт — паузу/оверлей вешать бессмысленно,
  // а resume не должен «оживлять» завершённую игру.
  function isGameOverShown() {
    const hooks = window.NeonGameHooks;
    if (hooks && typeof hooks.isGameOver === "function") {
      try { return !!hooks.isGameOver(); } catch (e) {}
    }
    const modal = document.getElementById("endModal");
    return !!modal && !modal.classList.contains("hidden");
  }

  // Индикатор платформенной паузы: стартовая реклама/панель отладки показаны
  // игроку оверлеем, ручная пауза игрока оверлей не использует (исторически).
  function setPlatformPauseOverlay(on) {
    const overlay = document.getElementById("pauseOverlay");
    if (!overlay) return;
    try { overlay.classList[on ? "remove" : "add"]("hidden"); } catch (e) {}
  }

  /* ---------------- реклама (sdk-adv) ---------------- */

  // Полноэкранный блок показывается по действию пользователя («Начать заново»),
  // не во время геймплея и не на загрузке. Частоту также огранивает платформа;
  // local cooldown защищает от случайных двойных кликов (риск рекламного фрода).
  function showFullscreenAd(onDone) {
    const sdk = state.sdk;
    const finish = () => { try { onDone?.(); } catch (e) {} };
    if (!sdk?.adv?.showFullscreenAdv) { finish(); return; }

    const now = Date.now();
    if (now - state.lastFullscreenAt < FULLSCREEN_AD_COOLDOWN) { finish(); return; }
    state.lastFullscreenAt = now;

    let settled = false;
    const once = (fn) => () => { if (!settled) { settled = true; fn?.(); } };
    const onClose = once(finish);
    const onError = once(finish);

    try {
      sdk.adv.showFullscreenAdv({
        callbacks: {
          onOpen: () => { stopAudio(); },
          onClose: (wasShown) => { onClose(); void wasShown; },
          onError: () => { onError(); }
        }
      });
    } catch (error) {
      onError();
    }
  }

  // Rewarded-видео: явная кнопка в панели, награда — бонусные доллары.
  // Показ ведёт к game_api_pause/game_api_resume (геймплей и звук
  // останавливаются и восстанавливаются платформенными событиями).
  function showRewardedAd(onRewarded, onDone) {
    const sdk = state.sdk;
    const finish = () => { try { onDone?.(); } catch (e) {} };
    if (!sdk?.adv?.showRewardedVideo) { finish(); return false; }

    let rewarded = false;
    let settled = false;
    const done = () => { if (!settled) { settled = true; if (rewarded) { try { onRewarded?.(); } catch (e) {} } finish(); } };

    try {
      sdk.adv.showRewardedVideo({
        callbacks: {
          onOpen: () => { stopAudio(); },
          onRewarded: () => { rewarded = true; },
          onClose: () => { done(); },
          onError: () => { done(); }
        }
      });
    } catch (error) {
      done();
    }
    return true;
  }

  /* ---------------- оценка игры (sdk-review) ---------------- */

  function requestReview() {
    if (state.reviewAsked || !state.sdk) return;
    state.reviewAsked = true;
    Promise.resolve()
      .then(() => state.sdk.feedback?.())
      .then((feedback) => {
        if (!feedback) return null;
        return Promise.resolve(feedback.canPerformNewFeedback?.()).then((can) => {
          if (can) feedback.performNewFeedback?.();
        });
      })
      .catch(() => {});
  }

  /* ---------------- игрок и облачные данные (sdk-player) ---------------- */

  async function initYandex() {
    if (!window.YaGames) {
      // На хостинге Яндекса SDK отдаётся по относительному /sdk.js (рекомендуемый
      // способ для загрузки архива через Консоль); вне платформы — документированный CDN.
      try {
        await loadScript("/sdk.js");
      } catch (error) {
        try {
          await loadScript("https://yandex.ru/games/sdk/v2");
        } catch (error2) {
          return;
        }
      }
    }

    if (!window.YaGames) return;

    try {
      const sdk = await window.YaGames.init();
      window.ysdk = sdk;
      state.sdk = sdk;

      // П. 2.14: автоопределение языка выполняется во время запуска, до
      // отрисовки интерфейса. Поддерживаются ru и en; прочее -> en.
      const lang = sdk?.environment?.i18n?.lang;
      if (typeof lang === "string" && lang) {
        state.language = lang;
        document.documentElement.dataset.yandexLanguage = lang;
      }
      window.NeonI18N?.applyPlatformLang?.(lang || "");

      try {
        state.player = await sdk.getPlayer();
      } catch (error) {
        // Гостевой режим: игра доступна без авторизации (п. 1.2.2),
        // облачные сохранения просто отключаются.
        state.player = null;
      }
    } catch (error) {
      state.sdk = null;
      window.ysdk = null;
    }
  }

  function readLocalJson(key, fallback) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed ?? fallback;
    } catch (error) {
      return fallback;
    }
  }

  function readLocalArray(key) {
    const arr = readLocalJson(key, []);
    return Array.isArray(arr) ? arr.slice() : [];
  }

  function readStringArray(key) {
    return readLocalArray(key).filter(x => typeof x === "string");
  }

  function writeLocalJson(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) { /* хранилище недоступно */ }
  }

  async function restoreCloudSave() {
    const player = state.player;
    if (!player) return;

    try {
      const data = await player.getData([GAME_SAVE_KEY, `${GAME_MAPS_KEY}_cloud`, GAME_RATING_KEY]);
      const cloudSave = data?.[GAME_SAVE_KEY];
      if (typeof cloudSave === "string" && cloudSave) {
        window.localStorage.setItem(GAME_SAVE_KEY, cloudSave);
        window.NeonGameBridge?.refreshMenu?.();
      }

      // Рейтинг привязан к аккаунту: локальный ключ суффиксится uniqueID
      // (схема идентична ratingStorageKey() в game-core). Миграция со
      // «общего» ключа старых версий + облако (перетягивает, только если
      // больше локального — свежий офлайн-прогресс не затирается).
      try {
        let uid = "";
        try { uid = String(player.getUniqueID ? player.getUniqueID() || "" : ""); } catch (e) {}
        const acctKey = uid ? `${GAME_RATING_KEY}_${uid}` : GAME_RATING_KEY;
        const readRating = k => {
          try { return parseInt(window.localStorage.getItem(k), 10); } catch (e) { return NaN; }
        };
        if (acctKey !== GAME_RATING_KEY) {
          const acct = readRating(acctKey);
          const legacy = readRating(GAME_RATING_KEY);
          if (!Number.isFinite(acct) && Number.isFinite(legacy)) {
            window.localStorage.setItem(acctKey, String(Math.max(0, legacy)));
          }
        }
        const cloudRating = parseInt(data?.[GAME_RATING_KEY], 10);
        const localRating = readRating(acctKey) || 0;
        if (Number.isFinite(cloudRating) && cloudRating > localRating) {
          window.localStorage.setItem(acctKey, String(cloudRating));
        }
      } catch (e) {}

      // Пользовательские карты: объединение «локальные ∪ облачные» минус
      // удалённые. Локальные всегда приоритетнее — свежая редакторская карта
      // не может быть затёрта старым облаком, а удалённая — вернуться.
      // Формат хранения (как в game-core/editor): массив объектов под key.
      const cloudMaps = (() => {
        try { return JSON.parse(data?.[`${GAME_MAPS_KEY}_cloud`] || "null"); } catch (e) { return null; }
      })();
      if (cloudMaps && Array.isArray(cloudMaps.maps)) {
        const deleted = new Set([
          ...readStringArray(GAME_MAPS_DELETED_KEY),
          ...(Array.isArray(cloudMaps.deleted) ? cloudMaps.deleted : [])
        ]);
        const local = readLocalArray(GAME_MAPS_KEY);
        const localIds = new Set(local.map(m => m && m.id));
        let changed = false;
        for (const entry of cloudMaps.maps) {
          const id = entry && entry.id;
          if (!id || deleted.has(id) || localIds.has(id)) continue;
          local.push(entry);
          changed = true;
        }
        if (changed) {
          writeLocalJson(GAME_MAPS_KEY, local);
          window.NeonGameBridge?.mapsRestored?.();
        }
        pushCloudMaps();
      }
    } catch (error) {
      // Локальное сохранение остаётся запасным вариантом.
    }
  }

  function pushCloudMaps() {
    const player = state.player;
    if (!player) return;
    try {
      const maps = readLocalArray(GAME_MAPS_KEY).slice(0, 12);
      const deleted = readStringArray(GAME_MAPS_DELETED_KEY).slice(0, 60);
      player.setData({ [`${GAME_MAPS_KEY}_cloud`]: JSON.stringify({ maps, deleted }) }, true).catch(() => {});
    } catch (error) { /* ignore */ }
  }

  function installCloudSaveBridge() {
    const player = state.player;
    if (!player) return;

    const storage = window.localStorage;
    const nativeSetItem = storage.setItem.bind(storage);
    const nativeRemoveItem = storage.removeItem.bind(storage);

    const cloudKeyFor = key => {
      if (key === GAME_SAVE_KEY) return GAME_SAVE_KEY;
      if (key === GAME_RATING_KEY || key.indexOf(GAME_RATING_KEY + "_") === 0) return GAME_RATING_KEY;
      return null;
    };

    storage.setItem = function (key, value) {
      nativeSetItem(key, value);
      const cloudKey = cloudKeyFor(key);
      if (cloudKey && typeof value === "string") {
        player.setData({ [cloudKey]: value }, true).catch(() => {});
      }
    };

    storage.removeItem = function (key) {
      nativeRemoveItem(key);
      if (key === GAME_SAVE_KEY) {
        player.setData({ [GAME_SAVE_KEY]: "" }, true).catch(() => {});
      }
    };
  }

  /* ---------------- привязка элементов управления ---------------- */

  function bindGameplayControls() {
    const start = document.getElementById("startGameBtn");
    const continueButton = document.getElementById("newGameBtn");
    const menu = document.getElementById("menuBtn");
    const endMenu = document.getElementById("endMenuBtn");
    const pause = document.getElementById("pauseBtn");
    const resume = document.getElementById("resumeBtn");

    const startGameplay = () => {
      setTimeout(() => {
        if (state.platformPaused) {
          // Осознанный клик пользователя по «играть» отменяет платформенную
          // паузу (реклама закрылась событием позже или не дошло resume).
          state.platformPaused = false;
          state.platformPausedGame = false;
          setPlatformPauseOverlay(false);
        }
        resumeAudio();
        gameplayStart();
      }, 0);
    };

    start?.addEventListener("click", startGameplay);
    continueButton?.addEventListener("click", startGameplay);

    menu?.addEventListener("click", () => {
      stopAudio();
      gameplayStop();
    });

    endMenu?.addEventListener("click", () => {
      stopAudio();
      gameplayStop();
    });

    pause?.addEventListener("click", () => {
      setTimeout(() => {
        if (isGamePaused()) {
          stopAudio();
          gameplayStop();
        } else if (isGameVisible()) {
          // Ручное продолжение игрока важнее платформенной паузы (в т.ч.
          // страховка от «залипшего» Gameplay is stopped): снимаем флаг и
          // возобновляем разметку — gameplayStart сам проверит состояние.
          state.platformPaused = false;
          state.platformPausedGame = false;
          setPlatformPauseOverlay(false);
          resumeAudio();
          gameplayStart();
        }
      }, 0);
    });

    resume?.addEventListener("click", () => {
      setTimeout(() => {
        if (isGameVisible() && !isGamePaused()) {
          state.platformPaused = false;
          state.platformPausedGame = false;
          setPlatformPauseOverlay(false);
          resumeAudio();
          gameplayStart();
        }
      }, 0);
    });
  }

  function bindEndStateObserver() {
    const endModal = document.getElementById("endModal");
    if (!endModal) return;

    const sync = () => {
      if (!endModal.classList.contains("hidden")) {
        stopAudio();
        gameplayStop();
      }
    };

    const observer = new MutationObserver(sync);
    observer.observe(endModal, { attributes: true, attributeFilter: ["class"] });
    sync();
  }

  /* ---------------- единая платформенная пауза ---------------- */

  // Пауза по инициативе платформы: реклама (в т.ч. стартовая и кнопка
  // «имитация паузы» в панели отладки debug-mode), окна покупок, переключение
  // вкладки. Идемпотентна: повторный вызов не ломает состояние.
  function pauseGameplay() {
    const hooks = window.NeonGameHooks;
    if (hooks && typeof hooks.pause === "function") {
      try { hooks.pause(); return; } catch (e) {}
    }
    const button = document.getElementById("pauseBtn");
    if (button) { try { button.click(); } catch (e) {} }
  }

  function resumeGameplay() {
    const hooks = window.NeonGameHooks;
    if (hooks && typeof hooks.resume === "function") {
      try { hooks.resume(); return; } catch (e) {}
    }
    const button = document.getElementById("resumeBtn");
    if (button) { try { button.click(); } catch (e) {} }
  }

  function interruptGameplay() {
    const alreadyPlatformPaused = state.platformPaused;
    state.platformPaused = true;
    stopAudio();
    if (isGameVisible() && !isGamePaused() && !isGameOverShown()) {
      state.platformPausedGame = true;   // возобновлять будем только своё
      pauseGameplay();
      setPlatformPauseOverlay(true);
    } else if (!alreadyPlatformPaused) {
      // Уже на паузе / в меню / финал — размечать авто-resume не надо.
      // ВАЖНО: при ДВОЙНОЙ паузе (уход со вкладки шлёт и visibilitychange,
      // и game_api_pause) второй вызов не должен стирать намерение
      // возобновления, выставленное первым, — иначе возврат во вкладку
      // оставляет «Gameplay is stopped» навечно.
      state.platformPausedGame = false;
    }
    gameplayStop();
  }

  function restoreGameplay() {
    state.platformPaused = false;
    if (state.platformPausedGame && isGameVisible() && isGamePaused()) {
      state.platformPausedGame = false;
      resumeGameplay();
      setPlatformPauseOverlay(false);
      resumeAudio();
      gameplayStart();
      return;
    }
    state.platformPausedGame = false;
    setPlatformPauseOverlay(false);
    if (isGameVisible() && !isGamePaused()) resumeAudio();
  }

  function bindPlatformEvents() {
    const sdk = state.sdk;
    if (!sdk?.on || state.platformEventsBound) return;
    state.platformEventsBound = true;

    // Подписка — сразу после инициализации SDK: стартовая полноэкранная
    // реклама показывается платформой без коллбэков, и game_api_pause может
    // прийти раньше, чем ядро вообще загрузится (см. docs sdk-events).
    sdk.on("game_api_pause", () => interruptGameplay());
    sdk.on("game_api_resume", () => restoreGameplay());
  }

  function bindBrowserFocusFallback() {
    // Единственный надёжный сигнал «игрок ушёл/вернулся во вкладку» —
    // visibilityState. document.hasFocus() внутри iframe платформы НЕЛЬЗЯ
    // использовать как «ушёл»: при возврате во вкладку фокус остаётся на
    // родительской странице yandex.ru, hasFocus() iframe'а — false, и игра
    // никогда не возобновлялась ( баг «Gameplay is stopped» после смены вкладки).
    const syncVisibility = () => {
      if (document.visibilityState === "hidden") {
        interruptGameplay();
      } else {
        restoreGameplay();
      }
    };

    document.addEventListener("visibilitychange", syncVisibility);
    // Потеря фокуса окна (не вкладки) — только приглушаем звук; паузу ставит
    // платформа событием game_api_pause либо visibilitychange при сворачивании.
    window.addEventListener("blur", () => stopAudio());
    window.addEventListener("focus", () => {
      if (document.visibilityState !== "hidden") resumeAudio();
    });
  }

  function installAudioGestureUnlock() {
    const unlock = () => setTimeout(resumeAudio, 0);
    document.addEventListener("pointerdown", unlock, { capture: true, passive: true });
    document.addEventListener("touchstart", unlock, { capture: true, passive: true });
  }

  /* ---------------- кнопки переключения языка ---------------- */

  function bindLanguageButtons() {
    const ru = document.getElementById("langRuBtn");
    const en = document.getElementById("langEnBtn");
    if (!ru && !en) return;

    const mark = () => {
      const current = window.NeonI18N?.lang || "ru";
      ru?.classList?.toggle("active", current === "ru");
      en?.classList?.toggle("active", current === "en");
    };

    ru?.addEventListener("click", () => { window.NeonI18N?.setLang("ru"); mark(); });
    en?.addEventListener("click", () => { window.NeonI18N?.setLang("en"); mark(); });
    window.NeonI18N?.onChange?.(mark);
    mark();
  }

  /* ---------------- очистка неигровых элементов ---------------- */

  function removeAllFullscreenControls() {
    // Системный полноэкранный режим интерфейса убран: на платформе fullscreen
    // обеспечивает сам Яндекс (п. 1.6.1), собственные кнопки не нужны.
    document.getElementById("menuFullscreenBtn")?.remove();
    document.getElementById("fullscreenBtn")?.remove();
  }

  function removeDevControls() {
    // Читерская DEV-кнопка не должна попадать в ПУБЛИЧНУЮ сборку на Яндекс.Играх.
    // Критерий — именно хост Яндекса: в git-версии (GitHub, Pages, file://,
    // localhost) кнопка «DEV: ВСЕ БАШНИ» остаётся доступной для отладки.
    const host = (location.hostname || "").toLowerCase();
    const onYandex = /(^|\.)yandex\.[a-z.]{2,}$/i.test(host);
    if (state.sdk && onYandex) {
      document.getElementById("devUnlockAllBtn")?.remove();
    } else {
      // Вне платформы кнопка rewarded-рекламы бесполезна — скрываем её.
      document.getElementById("adRewardBtn")?.remove();
    }
  }

  /* ---------------- публичный API для ядра ---------------- */

  Object.assign(window.NeonBridgeYandex, {
    isPlatform: () => !!state.sdk,
    gameplayStart,
    gameplayStop,
    showFullscreenAd,
    showRewardedAd,
    requestReview,
    pushCloudMaps,
    // Шлюз рестарта: ядро вызывает его перед «Начать заново»; при наличии SDK
    // рестарт продолжится после закрытия полноэкранного блока (логическая
    // пауза между игровыми сессиями, п. 4.4).
    restartGate(cb) {
      if (!state.sdk) { try { cb(); } catch (e) {} return; }
      // Рестарт отменяет авто-возобновление: после рекламы начнётся новая
      // партия, а не продолжение старой.
      state.platformPausedGame = false;
      gameplayStop();
      showFullscreenAd(cb);
    }
  });

  /* ---------------- старт ---------------- */

  async function boot() {
    installAudioFocusGuard();
    await initYandex();
    // События паузы/возобновления — сразу после init(): стартовая реклама
    // платформы может поставить игру на паузу ещё до того, как догрузятся
    // ядро и UI (docs sdk-events, обработка стартового полноэкранного блока).
    bindPlatformEvents();
    await loadStyle(ADAPTIVE_STYLE);

    // The game itself is still usable outside Yandex Games.
    await loadCore();

    // Локализация статического разметочного текста (сохранённый/платформенный
    // язык; вне SDK — то, что читал i18n.js из localStorage при старте).
    window.NeonI18N?.applyDom?.(document);

    removeAllFullscreenControls();
    removeDevControls();

    const canvas = document.getElementById("game");
    if (canvas) canvas.style.touchAction = "none";

    await restoreCloudSave();
    installCloudSaveBridge();
    bindGameplayControls();
    bindEndStateObserver();
    bindPlatformEvents();
    bindBrowserFocusFallback();
    installAudioGestureUnlock();
    bindLanguageButtons();

    // Game Ready — только когда весь интерфейс загружен и доступен игроку.
    state.sdk?.features?.LoadingAPI?.ready?.();
    state.ready = true;
  }

  boot().catch(() => {
    loadCore().catch(() => {});
  });
})();
