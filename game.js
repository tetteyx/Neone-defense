/* Yandex Games SDK bootstrap for Neon Bridge Defense.
 * The original game logic lives in game-core.js so index.html can keep loading game.js.
 */
(() => {
  "use strict";

  const GAME_SAVE_KEY = "neonBridgeDefenseSave_v5";
  const CORE_SCRIPT = "game-core.js";

  window.NeonBridgeYandex = {
    sdk: null,
    player: null,
    ready: false,
    platformPaused: false,
    platformPausedGame: false,
    language: "ru"
  };

  // Yandex moderation requires that the game area does not expose the browser
  // context menu or text selection on long/right clicks.
  document.addEventListener("contextmenu", (event) => {
    if (event.target instanceof HTMLCanvasElement) event.preventDefault();
  });
  document.addEventListener("selectstart", (event) => {
    if (event.target instanceof HTMLCanvasElement) event.preventDefault();
  });

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

  function loadCore() {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = CORE_SCRIPT;
      script.onload = resolve;
      script.onerror = reject;
      document.body.appendChild(script);
    });
  }

  function installAudioFocusGuard() {
    const NativeAudioContext = window.AudioContext;
    if (!NativeAudioContext || window.__neonBridgeAudioContextWrapped) return;

    try {
      window.AudioContext = new Proxy(NativeAudioContext, {
        construct(target, args) {
          const context = Reflect.construct(target, args);
          window.__neonBridgeAudioContext = context;
          return context;
        }
      });
      window.__neonBridgeAudioContextWrapped = true;
    } catch (error) {
      // Some browsers expose a non-configurable AudioContext constructor.
    }
  }

  function stopAudio() {
    const context = window.__neonBridgeAudioContext;
    if (context && typeof context.suspend === "function") {
      context.suspend().catch(() => {});
    }
  }

  function resumeAudio() {
    const context = window.__neonBridgeAudioContext;
    if (context && typeof context.resume === "function") {
      context.resume().catch(() => {});
    }
  }

  function gameplayStart() {
    window.NeonBridgeYandex.sdk?.features?.GameplayAPI?.start?.();
  }

  function gameplayStop() {
    window.NeonBridgeYandex.sdk?.features?.GameplayAPI?.stop?.();
  }

  function isGameVisible() {
    const gameScreen = document.getElementById("gameScreen");
    return !!gameScreen && !gameScreen.classList.contains("hidden");
  }

  function isGamePaused() {
    const overlay = document.getElementById("pauseOverlay");
    return !!overlay && !overlay.classList.contains("hidden");
  }

  function bindGameplayControls() {
    const start = document.getElementById("startGameBtn");
    const continueButton = document.getElementById("newGameBtn");
    const menu = document.getElementById("menuBtn");
    const endMenu = document.getElementById("endMenuBtn");
    const restart = document.getElementById("restartBtn");
    const pause = document.getElementById("pauseBtn");
    const resume = document.getElementById("resumeBtn");

    const startGameplay = () => {
      if (!window.NeonBridgeYandex.platformPaused) {
        gameplayStart();
      }
    };

    start?.addEventListener("click", () => setTimeout(startGameplay, 0));
    continueButton?.addEventListener("click", () => setTimeout(startGameplay, 0));
    restart?.addEventListener("click", () => setTimeout(startGameplay, 0));

    menu?.addEventListener("click", () => gameplayStop());
    endMenu?.addEventListener("click", () => gameplayStop());
    pause?.addEventListener("click", () => gameplayStop());
    resume?.addEventListener("click", () => setTimeout(() => {
      if (!window.NeonBridgeYandex.platformPaused) {
        gameplayStart();
      }
    }, 0));
  }

  function bindPlatformEvents() {
    const sdk = window.NeonBridgeYandex.sdk;
    if (!sdk?.on) return;

    sdk.on("game_api_pause", () => {
      window.NeonBridgeYandex.platformPaused = true;
      stopAudio();

      if (isGameVisible() && !isGamePaused()) {
        const pauseButton = document.getElementById("pauseBtn");
        if (pauseButton) {
          window.NeonBridgeYandex.platformPausedGame = true;
          pauseButton.click();
        }
      }

      gameplayStop();
    });

    sdk.on("game_api_resume", () => {
      window.NeonBridgeYandex.platformPaused = false;
      resumeAudio();

      if (window.NeonBridgeYandex.platformPausedGame && isGameVisible() && isGamePaused()) {
        const resumeButton = document.getElementById("resumeBtn");
        window.NeonBridgeYandex.platformPausedGame = false;
        resumeButton?.click();
        gameplayStart();
      }
    });
  }

  function installCloudSaveBridge() {
    const player = window.NeonBridgeYandex.player;
    if (!player) return;

    const storage = window.localStorage;
    const nativeSetItem = storage.setItem.bind(storage);
    const nativeRemoveItem = storage.removeItem.bind(storage);

    storage.setItem = function(key, value) {
      nativeSetItem(key, value);
      if (key === GAME_SAVE_KEY && typeof value === "string") {
        player.setData({ [GAME_SAVE_KEY]: value }, true).catch(() => {});
      }
    };

    storage.removeItem = function(key) {
      nativeRemoveItem(key);
      if (key === GAME_SAVE_KEY) {
        // Yandex recommends writing an empty value when cloud progress is cleared.
        player.setData({ [GAME_SAVE_KEY]: "" }, true).catch(() => {});
      }
    };
  }

  async function initYandex() {
    if (!window.YaGames) {
      try {
        // Relative path is the official recommended path when the archive is
        // uploaded to the Yandex Games server.
        await loadScript("/sdk.js");
      } catch (error) {
        return;
      }
    }

    if (!window.YaGames) return;

    try {
      const sdk = await window.YaGames.init();
      window.ysdk = sdk;
      window.NeonBridgeYandex.sdk = sdk;

      const lang = sdk?.environment?.i18n?.lang;
      if (typeof lang === "string" && lang) {
        window.NeonBridgeYandex.language = lang;
        document.documentElement.dataset.yandexLanguage = lang;
        // The current build is Russian-only. We still perform the mandatory
        // SDK language detection during startup; unknown languages fall back to Russian.
        document.documentElement.lang = lang === "ru" ? "ru" : "ru";
      }

      try {
        window.NeonBridgeYandex.player = await sdk.getPlayer();
      } catch (error) {
        window.NeonBridgeYandex.player = null;
      }
    } catch (error) {
      window.NeonBridgeYandex.sdk = null;
      window.ysdk = null;
    }
  }

  async function restoreCloudSave() {
    const player = window.NeonBridgeYandex.player;
    if (!player) return;

    try {
      const data = await player.getData([GAME_SAVE_KEY]);
      const cloudSave = data?.[GAME_SAVE_KEY];
      if (typeof cloudSave === "string" && cloudSave) {
        window.localStorage.setItem(GAME_SAVE_KEY, cloudSave);
        if (typeof window.updateResumeButton === "function") {
          window.updateResumeButton();
        }
      }
    } catch (error) {
      // Local save remains the fallback when cloud storage is unavailable.
    }
  }

  async function boot() {
    installAudioFocusGuard();
    await initYandex();

    // The game itself is still usable outside Yandex Games.
    await loadCore();

    const canvas = document.getElementById("game");
    if (canvas) canvas.style.touchAction = "none";

    await restoreCloudSave();
    installCloudSaveBridge();
    bindGameplayControls();
    bindPlatformEvents();

    // Game Ready is called only after the complete game UI and game logic are loaded.
    window.NeonBridgeYandex.sdk?.features?.LoadingAPI?.ready?.();
    window.NeonBridgeYandex.ready = true;
  }

  boot().catch(() => {
    // Last-resort fallback: the original game must still be launchable.
    loadCore().catch(() => {});
  });
})();
