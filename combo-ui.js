/* Комбо-панель «Комбинации» для Bridge Guardians.
 *
 *  VERSION 86 — добавлена локализация ru/en (требование 2.14 Яндекс.Игр):
 *   - все строки берутся из i18n.js (window.NeonI18N); без него работают
 *     fallback-тексты (ru) — микрокопия эффектов ниже;
 *   - при смене языка (NeonI18N.onChange) пересобираются модалка и кнопка;
 *   - модалка строится лениво при первом открытии, поэтому перевод всегда
 *     актуален на момент показа;
 *   - кнопка возвращается на место, если оболочка перерисовала шапку.
 *   Ранее (v85): клик по кнопке через делегирование на document; ошибки
 *   первого клика больше не «съедают» кнопку; старый fetch-патч удалён.
 */
(() => {
  "use strict";

  // Перевод через i18n.js. Без i18n.js ключ возвращается как есть, поэтому
  // fallback-тексты (в EFFECTS.ru и словарях) остаются страховкой.
  const t = (key, params) =>
    (window.NeonI18N && typeof window.NeonI18N.t === "function")
      ? window.NeonI18N.t(key, params) : key;
  const isEn = () => !!(window.NeonI18N && window.NeonI18N.lang === "en");

  // Краткие «эффекты» комбо — UI-микрокопия только этого модуля.
  const EFFECTS = {
    pulse:       { ru: "Уничтожает всех врагов в радиусе мины", en: "Destroys every enemy in the mine radius" },
    rail:        { ru: "Мощный пробивающий удар",                 en: "Powerful piercing shot" },
    frost:       { ru: "Массовая заморозка",                      en: "Mass freeze" },
    blast:       { ru: "Мощный метеоритный удар",                 en: "Powerful meteor strike" },
    arc:         { ru: "Цепная атака",                            en: "Chain attack" },
    titan:       { ru: "Орбитальный удар",                        en: "Orbital strike" },
    nova:        { ru: "Глобальный взрыв",                        en: "Global explosion" },
    devastator:  { ru: "Аннигиляционный удар",                    en: "Annihilation strike" },
    singularity: { ru: "Чёрная дыра",                            en: "Black hole" }
  };
  const effectText = (id) => {
    const e = EFFECTS[id];
    if (!e) return "";
    return isEn() ? e.en : e.ru;
  };

  // id башен; башня, название и описание комбо берутся из словаря.
  const COMBO_IDS = ["pulse", "rail", "frost", "blast", "arc", "titan", "nova", "devastator", "singularity"];

  const BADGES = {
    pulse: "✹", rail: "╳", frost: "❄", blast: "✦", arc: "ϟ",
    titan: "◉", nova: "✺", devastator: "✹", singularity: "◉"
  };

  const CSS = `
    .combo-trigger{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-width:112px;height:44px;padding:0 12px;border:1px solid rgba(116,196,118,.34);border-radius:12px;background:linear-gradient(135deg,rgba(20,25,40,.94),rgba(13,16,26,.94));color:#eef1f7;font:700 13px/1 system-ui,sans-serif;cursor:pointer;box-shadow:none;transition:.18s ease;white-space:nowrap}
    .combo-trigger:hover{border-color:rgba(116,196,118,.7);box-shadow:none;transform:translateY(-1px)}
    .combo-trigger .combo-trigger-icon{font-size:17px}
    .combo-modal{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(9,11,20,.72);backdrop-filter:blur(7px)}
    .combo-modal.hidden{display:none}
    .combo-card{width:min(760px,calc(100vw - 32px));max-height:min(82vh,720px);overflow:hidden;border:1px solid rgba(116,196,118,.34);border-radius:20px;background:linear-gradient(180deg,rgba(16,20,32,.98),rgba(10,13,22,.99));box-shadow:0 18px 70px rgba(0,0,0,.55);color:#eef1f7}
    .combo-head{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:18px 20px;border-bottom:1px solid rgba(255,255,255,.08)}
    .combo-head h2{margin:0;font:800 20px/1.2 system-ui,sans-serif}
    .combo-head p{margin:5px 0 0;color:rgba(238,241,247,.54);font:500 12px/1.4 system-ui,sans-serif}
    .combo-close{width:36px;height:36px;border:1px solid rgba(255,255,255,.12);border-radius:10px;background:rgba(255,255,255,.05);color:#eef1f7;font-size:20px;cursor:pointer}
    .combo-list{padding:14px 16px 18px;display:grid;gap:10px;overflow:auto;max-height:calc(min(82vh,720px) - 82px)}
    .combo-row{display:grid;grid-template-columns:minmax(250px,1fr) minmax(180px,.7fr);gap:12px;align-items:center;padding:12px;border:1px solid rgba(255,255,255,.07);border-radius:14px;background:rgba(255,255,255,.025)}
    .combo-flow{display:flex;align-items:center;gap:7px;min-width:0}
    .combo-icons{display:flex;align-items:center;gap:3px}
    .combo-icons .tower-icon{width:38px;height:38px;flex:none}
    .combo-plus{color:rgba(238,241,247,.54);font-weight:800}
    .combo-arrow{margin:0 3px;color:#74c476;font-size:20px;font-weight:900}
    .combo-result{display:flex;align-items:center;gap:9px;min-width:0}
    .combo-result-badge{width:42px;height:42px;display:grid;place-items:center;flex:none;border:1px solid rgba(116,196,118,.32);border-radius:12px;background:radial-gradient(circle,rgba(116,196,118,.18),rgba(116,196,118,.025));font-size:19px;box-shadow:none}
    .combo-result strong{display:block;font:800 14px/1.2 system-ui,sans-serif}
    .combo-result small{display:block;margin-top:3px;color:rgba(238,241,247,.54);font:500 11px/1.35 system-ui,sans-serif}
    .combo-desc{color:#98a2b8;font:500 11px/1.45 system-ui,sans-serif;text-align:right}
    @media (max-width:650px){.combo-trigger{min-width:92px;padding:0 9px}.combo-row{grid-template-columns:1fr}.combo-desc{text-align:left}.combo-card{max-height:88vh}.combo-list{max-height:calc(88vh - 82px)}}
  `;

  let modalEl = null;
  let triggerBtn = null;

  function addStyles() {
    if (document.getElementById("combo-ui-styles")) return;
    const style = document.createElement("style");
    style.id = "combo-ui-styles";
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function cloneTowerIcon(type) {
    try {
      const source = document.querySelector(`.tower-card[data-tower="${type}"] .tower-icon`);
      if (!source || typeof source.cloneNode !== "function") return null;
      const icon = source.cloneNode(true);
      icon.removeAttribute("hidden");
      icon.setAttribute("aria-hidden", "true");
      return icon;
    } catch (error) {
      return null;
    }
  }

  function buildModal() {
    if (modalEl) return modalEl;

    modalEl = document.createElement("div");
    modalEl.id = "comboModal";
    modalEl.className = "combo-modal hidden";
    modalEl.setAttribute("role", "dialog");
    modalEl.setAttribute("aria-modal", "true");

    const card = document.createElement("div");
    card.className = "combo-card";

    const head = document.createElement("div");
    head.className = "combo-head";
    const titleBox = document.createElement("div");
    const title = document.createElement("h2");
    title.textContent = t("ui.comboModalTitle");
    const subtitle = document.createElement("p");
    subtitle.textContent = t("ui.comboModalSub");
    titleBox.append(title, subtitle);
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "combo-close";
    closeBtn.setAttribute("aria-label", t("ui.comboClose"));
    closeBtn.textContent = "×";
    head.append(titleBox, closeBtn);

    const list = document.createElement("div");
    list.className = "combo-list";

    for (const type of COMBO_IDS) {
      const row = document.createElement("div");
      row.className = "combo-row";

      const flow = document.createElement("div");
      flow.className = "combo-flow";

      const icons = document.createElement("div");
      icons.className = "combo-icons";
      for (let i = 0; i < 3; i++) {
        const icon = cloneTowerIcon(type);
        if (!icon) continue;
        if (i > 0) {
          const plus = document.createElement("span");
          plus.className = "combo-plus";
          plus.textContent = "+";
          icons.appendChild(plus);
        }
        icons.appendChild(icon);
      }

      const arrow = document.createElement("span");
      arrow.className = "combo-arrow";
      arrow.textContent = "→";

      const resultBox = document.createElement("div");
      resultBox.className = "combo-result";
      const badge = document.createElement("span");
      badge.className = "combo-result-badge";
      badge.textContent = BADGES[type] || "✦";
      const labels = document.createElement("div");
      const strong = document.createElement("strong");
      strong.textContent = t("data.combo." + type + ".name");
      const small = document.createElement("small");
      small.textContent = effectText(type);
      labels.append(strong, small);
      resultBox.append(badge, labels);

      const desc = document.createElement("div");
      desc.className = "combo-desc";
      desc.textContent = t("data.combo." + type + ".desc");

      flow.append(icons, arrow, resultBox);
      row.append(flow, desc);
      list.appendChild(row);
    }

    card.append(head, list);
    modalEl.appendChild(card);
    document.body.appendChild(modalEl);
    return modalEl;
  }

  function destroyModal() {
    if (modalEl && modalEl.parentNode) {
      modalEl.parentNode.removeChild(modalEl);
    }
    modalEl = null;
  }

  function openModal() {
    buildModal().classList.remove("hidden");
  }

  function closeModal() {
    if (modalEl) modalEl.classList.add("hidden");
  }

  function isModalOpen() {
    return !!modalEl && !modalEl.classList.contains("hidden");
  }

  // Делегированные обработчики: работают, даже если кнопку создали заново.
  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!target || typeof target.closest !== "function") return;
    if (target.closest("#comboTrigger")) {
      event.preventDefault();
      openModal();
      return;
    }
    if (target.closest(".combo-close")) {
      closeModal();
      return;
    }
    if (target.classList && target.classList.contains("combo-modal")) {
      closeModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeModal();
  });

  function addButton() {
    const strip = document.querySelector(".status-strip");
    const cash = document.querySelector(".cash-status");
    if (!strip || !cash) return false;

    let btn = document.getElementById("comboTrigger");
    if (btn && btn.isConnected) { triggerBtn = btn; return true; }

    if (!btn) {
      btn = document.createElement("button");
      btn.id = "comboTrigger";
      btn.className = "combo-trigger";
      btn.type = "button";
      btn.title = t("ui.comboBtnTitle");
      const icon = document.createElement("span");
      icon.className = "combo-trigger-icon";
      icon.textContent = "✦";
      const label = document.createElement("span");
      label.className = "combo-trigger-label";
      label.textContent = t("ui.comboBtn");
      btn.append(icon, label);
    }
    triggerBtn = btn;

    strip.insertBefore(btn, cash);
    return !!btn.isConnected;
  }

  function localizeButton() {
    if (!triggerBtn && typeof document.getElementById === "function") {
      triggerBtn = document.getElementById("comboTrigger");
    }
    if (!triggerBtn) return;
    triggerBtn.title = t("ui.comboBtnTitle");
    const label = triggerBtn.querySelector(".combo-trigger-label");
    if (label) label.textContent = t("ui.comboBtn");
  }

  function onLangChange() {
    // Модалка пересобирается сразу в новом языке: клик по кнопке остаётся
    // «бесплатным» (урок v85 — никаких опасных построений в обработчике).
    destroyModal();
    try { buildModal(); } catch (error) { /* будет построена при открытии */ }
    localizeButton();
  }

  function init() {
    addStyles();
    try { buildModal(); } catch (error) { /* построим при открытии */ }
    if (window.NeonI18N && typeof window.NeonI18N.onChange === "function") {
      window.NeonI18N.onChange(onLangChange);
    }

    // Кнопка возвращается на место, если оболочка перерисовала шапку.
    const keepButton = () => {
      try { addButton(); } catch (error) { /* оболочка ещё не готова */ }
    };
    keepButton();
    setInterval(keepButton, 500);
  }

  // Небольшой публичный API для отладки.
  window.NeonComboUI = { openModal, closeModal, isModalOpen, addButton };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
