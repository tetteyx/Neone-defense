/* Yandex Games SDK bootstrap for Neon Bridge Defense.
 * The original game logic lives in game-core.js so index.html can keep loading game.js.
 */
(() => {
  "use strict";

  const GAME_SAVE_KEY = "neonBridgeDefenseSave_v5";
  const CORE_SCRIPT = "game-core.js";
  const ADAPTIVE_STYLE = "yandex.css";

  window.NeonBridgeYandex = {
    sdk: null,
    player: null,
    ready: false,
    platformPaused: false,
    platformPausedGame: false,
    gameplayActive: false,
    language: "ru"
  };

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
    return new Promise((resolve, reject) => {
      fetch(CORE_SCRIPT, { cache: "no-store" })
        .then(response => {
          if (!response.ok) throw new Error(`Не удалось загрузить ${CORE_SCRIPT}: ${response.status}`);
          return response.text();
        })
        .then(source => {
          // Тестовый редизайн только установленной башни «Импульс».
          // Механика, характеристики и логика атаки остаются в game-core.js.
          const oldPulseBranch = `  } else {\n    ctx.beginPath();\n\n    ctx.arc(\n        tower.x,\n        tower.y,\n        20,\n        0,\n        Math.PI * 2\n    );\n\n    ctx.fill();\n    ctx.stroke();\n  }`;

          const newPulseBranch = `  } else if (tower.type === "pulse") {\n    // Импульс: компактный технологичный реактор вместо простого круга.\n    const now = performance.now();\n    const pulse = 0.5 + 0.5 * Math.sin(now / 210);\n\n    // Внешний энергетический ореол.\n    ctx.save();\n    ctx.globalAlpha = 0.16 + pulse * 0.10;\n    ctx.strokeStyle = type.color;\n    ctx.shadowBlur = 24;\n    ctx.shadowColor = type.color;\n    ctx.lineWidth = 3;\n    ctx.beginPath();\n    ctx.arc(tower.x, tower.y, 24 + pulse * 3, 0, Math.PI * 2);\n    ctx.stroke();\n    ctx.restore();\n\n    // Шестиугольный корпус.\n    ctx.beginPath();\n    for (let i = 0; i < 6; i++) {\n      const angle = -Math.PI / 2 + i * Math.PI / 3;\n      const radius = 21;\n      const x = tower.x + Math.cos(angle) * radius;\n      const y = tower.y + Math.sin(angle) * radius;\n      if (i === 0) ctx.moveTo(x, y);\n      else ctx.lineTo(x, y);\n    }\n    ctx.closePath();\n    ctx.fill();\n    ctx.stroke();\n\n    // Внутренний реактор.\n    const coreGradient = ctx.createRadialGradient(\n        tower.x, tower.y, 1,\n        tower.x, tower.y, 13\n    );\n    coreGradient.addColorStop(0, "#f3ffff");\n    coreGradient.addColorStop(0.24, type.color);\n    coreGradient.addColorStop(0.62, "rgba(34, 230, 255, 0.55)");\n    coreGradient.addColorStop(1, "rgba(34, 230, 255, 0)");\n    ctx.fillStyle = coreGradient;\n    ctx.beginPath();\n    ctx.arc(tower.x, tower.y, 13, 0, Math.PI * 2);\n    ctx.fill();\n\n    ctx.strokeStyle = "#dfffff";\n    ctx.lineWidth = 1.6;\n    ctx.beginPath();\n    ctx.arc(tower.x, tower.y, 9, 0, Math.PI * 2);\n    ctx.stroke();\n\n    // Четыре силовых контакта.\n    ctx.fillStyle = type.color;\n    ctx.shadowBlur = 8;\n    ctx.shadowColor = type.color;\n    for (let i = 0; i < 4; i++) {\n      const angle = i * Math.PI / 2 + Math.PI / 4;\n      const x = tower.x + Math.cos(angle) * 14;\n      const y = tower.y + Math.sin(angle) * 14;\n      ctx.beginPath();\n      ctx.arc(x, y, 2.1, 0, Math.PI * 2);\n      ctx.fill();\n    }\n\n    // Пульсирующее ядро.\n    ctx.fillStyle = "#ffffff";\n    ctx.shadowBlur = 16 + pulse * 8;\n    ctx.shadowColor = type.color;\n    ctx.beginPath();\n    ctx.arc(tower.x, tower.y, 3.2 + pulse * 1.4, 0, Math.PI * 2);\n    ctx.fill();\n  } else {\n    ctx.beginPath();\n\n    ctx.arc(\n        tower.x,\n        tower.y,\n        20,\n        0,\n        Math.PI * 2\n    );\n\n    ctx.fill();\n    ctx.stroke();\n  }`;

          if (!source.includes(oldPulseBranch)) {
            throw new Error("Не найден блок отрисовки обычной башни для редизайна Импульса");
          }

          source = source.replace(oldPulseBranch, newPulseBranch);

          const script = document.createElement("script");
          script.textContent = `${source}\n//# sourceURL=game-core.js`;
          document.body.appendChild(script);
          resolve();
        })
        .catch(reject);
    });
  }

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
      // Some browsers expose a non-configurable AudioContext constructor.
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

  function gameplayStart() {
    if (window.NeonBridgeYandex.platformPaused) return;
    window.NeonBridgeYandex.gameplayActive = true;
    window.NeonBridgeYandex.sdk?.features?.GameplayAPI?.start?.();
  }

  function gameplayStop() {
    window.NeonBridgeYandex.gameplayActive = false;
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
        setTimeout(() => {
          resumeAudio();
          gameplayStart();
        }, 0);
      }
    };

    start?.addEventListener("click", startGameplay);
    continueButton?.addEventListener("click", startGameplay);
    restart?.addEventListener("click", startGameplay);

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
        } else if (isGameVisible() && !window.NeonBridgeYandex.platformPaused) {
          resumeAudio();
          gameplayStart();
        }
      }, 0);
    });

    resume?.addEventListener("click", () => {
      setTimeout(() => {
        if (!window.NeonBridgeYandex.platformPaused && isGameVisible() && !isGamePaused()) {
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

  function bindPlatformEvents() {
    const sdk = window.NeonBridgeYandex.sdk;
    if (!sdk?.on) return;

    sdk.on("game_api_pause", () => {
      window.NeonBridgeYandex.platformPaused = true;
      stopAudio();

      if (isGameVisible() && !isGamePaused() && window.NeonBridgeYandex.gameplayActive) {
        const pauseButton = document.getElementById("pauseBtn");
        if (pauseButton) {
          window.NeonBridgeYandex.platformPausedGame = true;
          pauseButton.click();
        }
      } else {
        window.NeonBridgeYandex.platformPausedGame = false;
        gameplayStop();
      }
    });

    sdk.on("game_api_resume", () => {
      window.NeonBridgeYandex.platformPaused = false;

      if (window.NeonBridgeYandex.platformPausedGame && isGameVisible() && isGamePaused()) {
        const resumeButton = document.getElementById("resumeBtn");
        window.NeonBridgeYandex.platformPausedGame = false;
        resumeButton?.click();
        return;
      }

      window.NeonBridgeYandex.platformPausedGame = false;
    });
  }

  function bindBrowserFocusFallback() {
    const syncFocus = () => {
      if (document.visibilityState === "hidden" || !document.hasFocus()) {
        stopAudio();
        if (window.NeonBridgeYandex.gameplayActive) gameplayStop();
        return;
      }

      // Yandex normally sends game_api_resume. Do not start gameplay here:
      // a manually paused game must remain paused.
      if (isGameVisible() && !isGamePaused()) resumeAudio();
    };

    document.addEventListener("visibilitychange", syncFocus);
    window.addEventListener("blur", () => stopAudio());
    window.addEventListener("focus", syncFocus);
  }

  function installAudioGestureUnlock() {
    const unlock = () => setTimeout(resumeAudio, 0);
    document.addEventListener("pointerdown", unlock, { capture: true, passive: true });
    document.addEventListener("touchstart", unlock, { capture: true, passive: true });
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
        player.setData({ [GAME_SAVE_KEY]: "" }, true).catch(() => {});
      }
    };
  }

  async function initYandex() {
    if (!window.YaGames) {
      try {
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
        if (typeof window.updateResumeButton === "function") window.updateResumeButton();
      }
    } catch (error) {
      // Local save remains the fallback when cloud storage is unavailable.
    }
  }

  function removeAllFullscreenControls() {
    // Полноэкранный режим больше не показываем ни в одном меню игры.
    document.getElementById("menuFullscreenBtn")?.remove();
    document.getElementById("fullscreenBtn")?.remove();
  }

  async function boot() {
    installAudioFocusGuard();
    await initYandex();
    await loadStyle(ADAPTIVE_STYLE);

    // The game itself is still usable outside Yandex Games.
    await loadCore();

    removeAllFullscreenControls();

    const canvas = document.getElementById("game");
    if (canvas) canvas.style.touchAction = "none";

    await restoreCloudSave();
    installCloudSaveBridge();
    bindGameplayControls();
    bindEndStateObserver();
    bindPlatformEvents();
    bindBrowserFocusFallback();
    installAudioGestureUnlock();

    // Game Ready is called only after the complete game UI, adaptive shell,
    // and game logic are loaded and interactive.
    window.NeonBridgeYandex.sdk?.features?.LoadingAPI?.ready?.();
    window.NeonBridgeYandex.ready = true;
  }

  boot().catch(() => {
    loadCore().catch(() => {});
  });
})();
