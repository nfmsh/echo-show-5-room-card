/* echo-show-5-room-card.js
 * Type: custom:echo-show-5-room-card
 *
 * Echo Show 5 intent:
 * - Fullscreen overlay on Show (fixed 960×480 stage scaled with COVER)
 * - Auto-disables fullscreen inside HA editor/preview
 *
 * Layout:
 * - Buttons fixed 2 columns × 4 rows (2x4) = 8 slots
 * - Big icon bottom-left with halo (halo color follows main icon color) - Room Icon
 * - Static badge fixed position; circle changes color by state, icon stays white
 * - Title/subtitle top-left with configurable colors + sizes
 * - Center control preset+entity OR advanced center_card object
 *
 * UX:
 * - Invisible placeholders keep grid stable (no dotted outline)
 * - Service autocomplete via ha-service-picker
 * - Hide center-card "more info" dots automatically (works across shadow DOM)
 *
 * Update:
 * - Removed center_show_name (toggle + config). Names are always hidden for generated presets.
 */

const MAX_BUTTONS = 8;

// Fixed design stage (Echo Show 5 target)
const ES5_STAGE_W = 960;
const ES5_STAGE_H = 480;

// Nudge (known-good centering tweak)
const ES5_NUDGE_X = -30;

// IMPORTANT: user wants 2 columns × 4 rows (2x4)
const BTN_COLS = 2;
const BTN_ROWS = 4;

// Fixed badge position requested (not configurable)
const BADGE_RIGHT_PX = 12;
const BADGE_BOTTOM_PX = 220;

const DEFAULTS = {
  title: "Room",

  // Header styling (user configurable)
  title_color: "", // blank uses theme var(--primary-text-color)
  title_size_px: 26,
  subtitle_color: "", // blank uses theme var(--secondary-text-color)
  subtitle_size_px: 20,

  env_temp_entity: "",
  env_humidity_entity: "",

  background_image: "",
  overlay_opacity: 0.7,

  big_icon: "mdi:home",
  big_icon_color: "teal",
  big_icon_size: 200,

  badge: {
    mode: "none", // "none" | "temp_humidity_thresholds"
    humidity_high: 60,
    temp_hot: 26,
    temp_cold: 18,
    icon_humidity: "mdi:water",
    color_humidity: "blue",
    icon_hot: "mdi:fire",
    color_hot: "red",
    icon_cold: "mdi:snowflake",
    color_cold: "blue",
  },

  // Center control sizing
  center_scale: 1.0,
  center_light_scale: 1.25,

  // Hide more-info dots in the embedded center card
  center_hide_more_info: true,

  center_card: null, // advanced override
  center_preset: "none", // "none" | "thermostat" | "light" | "media" | "fan" | "entity"
  center_entity: "",

  buttons: [],
};

/* -----------------------------
   Helpers
------------------------------*/
function clampInt(v, fallback = 0) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}
function clampNum(v, fallback, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
function toNum(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function stateStr(hass, entityId) {
  return hass?.states?.[entityId]?.state ?? "unknown";
}
function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function deepMerge(base, over) {
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const [k, v] of Object.entries(over || {})) {
    const bv = base?.[k];
    if (
      v &&
      typeof v === "object" &&
      !Array.isArray(v) &&
      bv &&
      typeof bv === "object" &&
      !Array.isArray(bv)
    ) {
      out[k] = deepMerge(bv, v);
    } else {
      out[k] = v;
    }
  }
  return out;
}
function fireMoreInfo(el, entityId) {
  if (!entityId) return;
  el.dispatchEvent(
    new CustomEvent("hass-more-info", {
      detail: { entityId },
      bubbles: true,
      composed: true,
    }),
  );
}

function buildSubtitle(hass, cfg) {
  const parts = [];
  if (cfg.env_temp_entity) parts.push(`${clampInt(stateStr(hass, cfg.env_temp_entity), 0)}ºC`);
  if (cfg.env_humidity_entity) parts.push(`${clampInt(stateStr(hass, cfg.env_humidity_entity), 0)}%`);
  return parts.join(" | ");
}

function computeStaticBadge(hass, cfg) {
  const b = cfg.badge || {};
  if (b.mode !== "temp_humidity_thresholds") return { icon: "", color: "" };

  const t = cfg.env_temp_entity ? clampInt(stateStr(hass, cfg.env_temp_entity), NaN) : NaN;
  const h = cfg.env_humidity_entity ? clampInt(stateStr(hass, cfg.env_humidity_entity), NaN) : NaN;

  if (Number.isFinite(h) && h >= (b.humidity_high ?? 60)) {
    return {
      icon: b.icon_humidity || "mdi:water",
      color: b.color_humidity || cfg.big_icon_color || DEFAULTS.big_icon_color,
    };
  }
  if (Number.isFinite(t) && t >= (b.temp_hot ?? 26)) {
    return {
      icon: b.icon_hot || "mdi:fire",
      color: b.color_hot || cfg.big_icon_color || DEFAULTS.big_icon_color,
    };
  }
  if (Number.isFinite(t) && t <= (b.temp_cold ?? 18)) {
    return {
      icon: b.icon_cold || "mdi:snowflake",
      color: b.color_cold || cfg.big_icon_color || DEFAULTS.big_icon_color,
    };
  }
  return { icon: "", color: "" };
}

function buildCenterCardConfig(cfg) {
  if (cfg.center_card && typeof cfg.center_card === "object") return cfg.center_card;

  const preset = cfg.center_preset || "none";
  const entity = cfg.center_entity || "";
  if (preset === "none" || !entity) return null;

  // Always hide names/titles for generated presets (center_show_name removed)
  if (preset === "thermostat") return { type: "thermostat", entity, name: " " };
  if (preset === "light") return { type: "light", entity, name: " " };
  if (preset === "media") return { type: "media-control", entity };
  if (preset === "fan") {
    return {
      type: "entities",
      show_header_toggle: false,
      title: " ",
      entities: [{ entity, name: " " }],
    };
  }

  // generic entity preset
  return {
    type: "entities",
    show_header_toggle: false,
    title: " ",
    entities: [{ entity, name: " " }],
  };
}

async function createCardFromConfig(hass, cardConfig) {
  if (!cardConfig || typeof cardConfig !== "object") return null;
  if (!window.loadCardHelpers) throw new Error("loadCardHelpers not available");
  const helpers = await window.loadCardHelpers();
  const el = await helpers.createCardElement(cardConfig);
  el.hass = hass;
  return el;
}

/* -----------------------------
   Card
------------------------------*/
class EchoShow5RoomCard extends HTMLElement {
  static getConfigElement() {
    return document.createElement("echo-show-5-room-card-editor");
  }

  static getStubConfig() {
    return {
      type: "custom:echo-show-5-room-card",
      title: "Room",

      title_color: "",
      title_size_px: 26,
      subtitle_color: "",
      subtitle_size_px: 20,

      env_temp_entity: "",
      env_humidity_entity: "",

      background_image: "/local/images/room.jpg",
      overlay_opacity: 0.7,

      big_icon: "mdi:home",
      big_icon_color: "teal",
      big_icon_size: 200,

      badge: { mode: "none" },

      center_preset: "none",
      center_entity: "",
      center_scale: 1.0,
      center_light_scale: 1.25,
      center_hide_more_info: true,

      buttons: [],
    };
  }

  getGridOptions() {
    return { columns: "full" };
  }

  connectedCallback() {
    if (this._ro) return;
    this._ro = new ResizeObserver(() => this._applyScale());
    this._ro.observe(this);
  }

  disconnectedCallback() {
    if (this._ro) {
      this._ro.disconnect();
      this._ro = null;
    }
    if (this._centerMo) {
      this._centerMo.disconnect();
      this._centerMo = null;
    }
    if (this._hideRaf) {
      cancelAnimationFrame(this._hideRaf);
      this._hideRaf = null;
    }
  }

  _closestComposedAny(selectors) {
    let el = this;
    while (el) {
      if (el instanceof Element) {
        for (const sel of selectors) {
          if (el.matches(sel)) return true;
        }
      }
      const root = el.getRootNode?.();
      el = el.parentNode || (root && root.host) || null;
    }
    return false;
  }

  _isInEditorContext() {
    const selectors = [
      "hui-dialog-edit-card",
      "hui-card-preview",
      "hui-card-editor",
      "hui-dialog-manage-cards",
      "hui-dialog-edit-section",
      "hui-dialog-edit-dashboard",
      "ha-dialog",
    ];

    if (this._closestComposedAny(selectors)) return true;
    if (document.querySelector("hui-dialog-edit-card, hui-card-preview, hui-card-editor")) return true;
    if (location?.pathname?.includes("/config")) return true;
    return false;
  }

  _shouldFullscreen() {
    return !this._isInEditorContext();
  }

  setConfig(config) {
    if (!config) throw new Error("echo-show-5-room-card: missing config");
    if (config.buttons && !Array.isArray(config.buttons)) {
      throw new Error("echo-show-5-room-card: 'buttons' must be an array");
    }
    if (config.center_card && typeof config.center_card !== "object") {
      throw new Error("echo-show-5-room-card: 'center_card' must be an object or null");
    }

    // Ignore any legacy sizing keys if present
    if ("width" in config || "height" in config || "offset_left_px" in config) {
      config = { ...config };
      delete config.width;
      delete config.height;
      delete config.offset_left_px;
    }

    // Remove deprecated center_show_name if present in old configs
    if ("center_show_name" in config) {
      config = { ...config };
      delete config.center_show_name;
    }

    // Ignore any old badge positioning keys if they exist in older configs
    if (config.badge && typeof config.badge === "object") {
      config = structuredClone(config);
      delete config.badge.pos_right;
      delete config.badge.pos_bottom;
    }

    this._config = deepMerge(DEFAULTS, config || {});
    if (Array.isArray(this._config.buttons) && this._config.buttons.length > MAX_BUTTONS) {
      this._config.buttons = this._config.buttons.slice(0, MAX_BUTTONS);
    }

    if (!this._root) {
      this.attachShadow({ mode: "open" });
      this._root = document.createElement("div");
      this.shadowRoot.appendChild(this._root);
    }

    this._centerEl = null;
    this._centerKey = null;
    this._renderToken = (this._renderToken || 0) + 1;

    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._centerEl) this._centerEl.hass = hass;
    this._render();
  }

  _applyScale() {
    if (!this._root) return;
    const stage = this._root.querySelector(".stage");
    if (!stage) return;

    const rect = this.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const sx = rect.width / ES5_STAGE_W;
    const sy = rect.height / ES5_STAGE_H;

    // COVER
    const s = Math.max(sx, sy);

    const x = (rect.width - ES5_STAGE_W * s) / 2 + ES5_NUDGE_X;
    const y = (rect.height - ES5_STAGE_H * s) / 2;

    stage.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
  }

  _callButtonAction(btn) {
    const hass = this._hass;
    if (!hass || !btn?.tap) return;

    const action = btn.tap.action || "none";
    const entity = btn.entity || "";
    const service = btn.tap.service || "";
    const data = btn.tap.data || {};

    if (action === "none") return;

    if (action === "toggle") {
      if (!entity.includes(".")) return;
      const domain = entity.split(".")[0];
      hass.callService(domain, "toggle", { entity_id: entity });
      return;
    }

    if (action === "more-info") {
      fireMoreInfo(this, entity);
      return;
    }

    if (action === "navigate") {
      const path = btn.tap.navigation_path || btn.tap.path;
      if (!path) return;
      history.pushState(null, "", path);
      window.dispatchEvent(new Event("location-changed"));
      return;
    }

    if (action === "call-service") {
      if (!service.includes(".")) return;
      const [domain, svc] = service.split(".");
      hass.callService(domain, svc, data);
    }
  }

  _scheduleHideCenterMoreInfo() {
    if (!this._config?.center_hide_more_info) return;
    if (!this._centerEl) return;
    if (this._hideRaf) return;

    this._hideRaf = requestAnimationFrame(() => {
      this._hideRaf = null;
      this._applyHideCenterMoreInfo();
    });
  }

  _applyHideCenterMoreInfo() {
    if (!this._config?.center_hide_more_info) return;
    const rootEl = this._centerEl;
    if (!rootEl) return;

    const hideInNode = (node) => {
      if (!node) return;

      if (node.querySelectorAll) {
        node.querySelectorAll("ha-icon-button.more-info").forEach((b) => {
          b.style.display = "none";
          b.style.pointerEvents = "none";
        });
      }

      if (node.querySelectorAll) {
        node.querySelectorAll("*").forEach((el) => {
          if (el && el.shadowRoot) hideInNode(el.shadowRoot);
        });
      }
    };

    hideInNode(rootEl);
    if (rootEl.shadowRoot) hideInNode(rootEl.shadowRoot);
  }

  _setupCenterObserver() {
    if (this._centerMo) {
      this._centerMo.disconnect();
      this._centerMo = null;
    }
    if (!this._centerEl) return;
    if (!this._config?.center_hide_more_info) return;

    const target = this._centerEl.shadowRoot || this._centerEl;

    this._centerMo = new MutationObserver(() => this._scheduleHideCenterMoreInfo());
    this._centerMo.observe(target, { childList: true, subtree: true });

    this._scheduleHideCenterMoreInfo();
  }

  async _ensureCenterCard(centerCfg, token) {
    const hass = this._hass;
    const key = centerCfg ? JSON.stringify(centerCfg) : "null";

    if (this._centerEl && this._centerKey === key) {
      this._centerEl.hass = hass;
      return;
    }

    this._centerKey = key;
    this._centerEl = null;

    if (this._centerMo) {
      this._centerMo.disconnect();
      this._centerMo = null;
    }

    if (!centerCfg) return;

    try {
      const el = await createCardFromConfig(hass, centerCfg);
      if (token !== this._renderToken) return;
      this._centerEl = el;
    } catch (e) {
      if (token !== this._renderToken) return;
      const err = document.createElement("div");
      err.className = "centerError";
      err.textContent = "Center control failed to load.";
      this._centerEl = err;
      // eslint-disable-next-line no-console
      console.warn("echo-show-5-room-card: center card load failed", e);
    }
  }

  async _render() {
    if (!this._root || !this._config || !this._hass) return;
    const token = (this._renderToken = (this._renderToken || 0) + 1);

    const cfg = this._config;
    const hass = this._hass;

    const mainColor = cfg.big_icon_color || DEFAULTS.big_icon_color;

    const titleSize = Math.max(12, clampInt(cfg.title_size_px, DEFAULTS.title_size_px));
    const subtitleSize = Math.max(10, clampInt(cfg.subtitle_size_px, DEFAULTS.subtitle_size_px));

    const titleColor = (cfg.title_color || "").trim()
      ? cfg.title_color.trim()
      : "var(--primary-text-color, #fff)";
    const subtitleColor = (cfg.subtitle_color || "").trim()
      ? cfg.subtitle_color.trim()
      : "var(--secondary-text-color, rgba(255,255,255,0.88))";

    const subtitle = buildSubtitle(hass, cfg);
    const badge = computeStaticBadge(hass, cfg);

    const centerCfg = buildCenterCardConfig(cfg);
    await this._ensureCenterCard(centerCfg, token);

    const isLightPreset = !cfg.center_card && (cfg.center_preset || "none") === "light";
    const baseScale = clampNum(cfg.center_scale, DEFAULTS.center_scale, 0.75, 1.5);
    const lightScale = clampNum(cfg.center_light_scale, DEFAULTS.center_light_scale, 0.75, 1.5);
    const centerScale = isLightPreset ? lightScale : baseScale;

    const bg = cfg.background_image
      ? `linear-gradient(rgba(0,0,0,${cfg.overlay_opacity}), rgba(0,0,0,${cfg.overlay_opacity})), url('${cfg.background_image}')`
      : `linear-gradient(rgba(0,0,0,${cfg.overlay_opacity}), rgba(0,0,0,${cfg.overlay_opacity}))`;

    const iconSize = Math.max(96, clampInt(cfg.big_icon_size, DEFAULTS.big_icon_size));

    const buttons = Array.isArray(cfg.buttons) ? cfg.buttons.slice(0, MAX_BUTTONS) : [];
    const padded = Array.from({ length: MAX_BUTTONS }, (_, i) => buttons[i] || null);

    const buttonsHtml = padded
      .map((btn, idx) => {
        if (!btn) {
          return `<button class="btnSlot placeholder" disabled aria-hidden="true" tabindex="-1" data-idx="${idx}"></button>`;
        }

        const disabled = !!btn.disabled;
        const label = escapeHtml(btn.label ?? "");
        const icon = escapeHtml(btn.icon || "mdi:gesture-tap");
        const color = escapeHtml(btn.icon_color || mainColor);

        const textColorRaw = (btn.text_color || "").trim();
        const textStyle = textColorRaw ? ` style="color:${escapeHtml(textColorRaw)};"` : "";

        return `
          <button class="btnSlot ${disabled ? "disabled" : ""}" data-idx="${idx}" title="${label}">
            <span class="btnIconWrap">
              <ha-icon class="btnIcon" icon="${icon}" style="color:${color};"></ha-icon>
              <span class="tapFlash"></span>
            </span>
            <span class="btnLabel"${textStyle}>${label}</span>
          </button>
        `;
      })
      .join("");

    const fullscreen = this._shouldFullscreen();

    const hostCss = fullscreen
      ? `
        :host {
          position: fixed;
          inset: 0;
          display: block;
          width: 100vw;
          height: 100vh;
        }
      `
      : `
        :host {
          display: block;
          width: 100%;
          height: 100%;
          position: relative;
        }
      `;

    this._root.innerHTML = `
      <style>
        ${hostCss}

        ha-card {
          position: relative;
          overflow: hidden;
          border: 0 !important;

          width: 100%;
          height: 100%;
          box-sizing: border-box;

          margin: 0 !important;
          border-radius: 0 !important;

          background: ${bg};
          background-position: center;
          background-size: cover;
        }

        .stage {
          width: ${ES5_STAGE_W}px;
          height: ${ES5_STAGE_H}px;
          transform-origin: top left;
          will-change: transform;
        }

        .wrap {
          height: 100%;
          box-sizing: border-box;
          padding: 16px 16px 14px 16px;

          display: grid;
          grid-template-columns: 240px 1fr 340px;
          grid-template-rows: auto 1fr;
          grid-template-areas:
            "header header header"
            "left   center buttons";
          gap: 12px 14px;
        }

        .header {
          grid-area: header;
          padding-left: 40px;
          box-sizing: border-box;
        }
        .title {
          font-size: ${titleSize}px;
          font-weight: 300;
          font-variant: small-caps;
          line-height: 1.1;
          color: ${escapeHtml(titleColor)};
        }
        .subtitle {
          margin-top: 4px;
          font-size: ${subtitleSize}px;
          color: ${escapeHtml(subtitleColor)};
          min-height: 24px;
        }

        .left {
          grid-area: left;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          align-items: flex-start;
          padding-bottom: 6px;
          overflow: visible;
        }

        .bigIconWrap {
          position: relative;
          width: 240px;
          height: 240px;
          display: grid;
          place-items: center;
          overflow: visible;
          transform: translate(-10px, 65px);
        }

        .bigIconWrap::before {
          content: "";
          position: absolute;
          width: 300px;
          height: 300px;
          border-radius: 50%;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          z-index: 0;

          background: ${escapeHtml(mainColor)};
          opacity: 0.28;

          backdrop-filter: blur(2px);
          -webkit-backdrop-filter: blur(2px);
        }

        .bigIconWrap::after {
          content: "";
          position: absolute;
          width: 340px;
          height: 340px;
          border-radius: 50%;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          z-index: 1;
          pointer-events: none;

          box-shadow:
            0 0 0 1px rgba(255,255,255,0.10) inset,
            0 10px 30px rgba(0,0,0,0.25);
        }

        .bigIcon {
          position: relative;
          z-index: 2;
          --mdc-icon-size: ${iconSize}px;
          width: ${iconSize}px;
          height: ${iconSize}px;
          color: ${escapeHtml(mainColor)};
          filter: drop-shadow(0 2px 10px rgba(0,0,0,0.45));
        }

        .badge {
          position: absolute;
          z-index: 3;
          right: ${BADGE_RIGHT_PX}px;
          bottom: ${BADGE_BOTTOM_PX}px;

          width: 44px;
          height: 44px;
          border-radius: 50%;

          display: ${badge.icon ? "grid" : "none"};
          place-items: center;

          background: ${escapeHtml(badge.color || mainColor)};

          box-shadow:
            0 0 0 2px rgba(255,255,255,0.18) inset,
            0 2px 10px rgba(0,0,0,0.35);
        }
        .badgeIcon {
          --mdc-icon-size: 24px;
          color: #fff !important;
          filter: drop-shadow(0 1px 2px rgba(0,0,0,0.45));
        }

        .center {
          grid-area: center;
          display: grid;
          align-content: center;
          justify-items: center;
          min-width: 0;
          overflow: visible;
        }
        .centerSlot {
          width: 100%;
          height: 100%;
          display: grid;
          align-content: center;
          justify-items: center;
          overflow: visible;
        }

        .centerMount, .centerMount > * { width: 100%; }
        .centerMount {
          transform: scale(var(--centerScale, 1));
          transform-origin: center;
          will-change: transform;
        }
        .centerMount ha-card {
          background: transparent !important;
          box-shadow: none !important;
          border: 0 !important;
        }
        .centerMount * {
          --ha-card-background: transparent;
          --card-background-color: transparent;
          --paper-card-background-color: transparent;
        }

        .centerPlaceholder {
          width: 100%;
          height: 100%;
          border-radius: 18px;
          background: rgba(0,0,0,0.12);
          color: rgba(255,255,255,0.75);
          font-size: 14px;
          line-height: 1.4;
          padding: 14px;
          box-sizing: border-box;
          display: grid;
          align-content: center;
        }
        .centerError {
          width: 100%;
          border-radius: 18px;
          background: rgba(255,0,0,0.10);
          color: rgba(255,255,255,0.85);
          font-size: 14px;
          padding: 14px;
          box-sizing: border-box;
          text-align: center;
        }

        .buttons { grid-area: buttons; align-content: center; min-width: 0; transform: translateY(-30px); }

        .grid {
          display: grid;
          grid-template-columns: repeat(${BTN_COLS}, minmax(0, 1fr));
          grid-template-rows: repeat(${BTN_ROWS}, auto);
          gap: 10px;
        }

        button.btnSlot {
          all: unset;
          box-sizing: border-box;
          cursor: pointer;

          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(0,0,0,0.26);
          backdrop-filter: blur(2px);
          -webkit-backdrop-filter: blur(2px);
          border-radius: 18px;
          padding: 10px 10px;

          display: grid;
          grid-template-columns: 54px 1fr;
          align-items: center;
          gap: 10px;

          color: var(--primary-text-color, #fff);
          text-align: left;
          min-height: 72px;
        }
        button.btnSlot.disabled { opacity: 0.45; cursor: not-allowed; }

        button.btnSlot.placeholder {
          visibility: hidden;
          pointer-events: none;
          border: 0;
          background: transparent;
        }

        .btnIconWrap {
          width: 54px;
          height: 54px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          position: relative;
          overflow: hidden;
          background: rgba(0,0,0,0.16);
        }
        .btnIcon { --mdc-icon-size: 45px; z-index: 1; }

        .btnLabel {
          font-size: 25px;
          font-weight: 300;
          font-variant: small-caps;
          line-height: 1.1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .tapFlash {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background: rgba(0, 255, 0, 0.35);
          opacity: 0;
          pointer-events: none;
        }
        button.btnSlot:active .tapFlash { animation: tapFlash 260ms ease-out forwards; }
        @keyframes tapFlash { 0% { opacity: 0.6; } 100% { opacity: 0; } }
      </style>

      <ha-card>
        <div class="stage">
          <div class="wrap">
            <div class="header">
              <div class="title">${escapeHtml(cfg.title)}</div>
              <div class="subtitle">${escapeHtml(subtitle)}</div>
            </div>

            <div class="left">
              <div class="bigIconWrap">
                <ha-icon class="bigIcon" icon="${escapeHtml(cfg.big_icon)}"></ha-icon>

                <div class="badge">
                  <ha-icon class="badgeIcon" icon="${escapeHtml(badge.icon)}"></ha-icon>
                </div>
              </div>
            </div>

            <div class="center">
              <div class="centerSlot">
                ${
                  centerCfg
                    ? `<div class="centerMount" style="--centerScale:${centerScale};"></div>`
                    : `<div class="centerPlaceholder">Pick a center control type + entity in the editor.</div>`
                }
              </div>
            </div>

            <div class="buttons">
              <div class="grid">${buttonsHtml}</div>
            </div>
          </div>
        </div>
      </ha-card>
    `;

    if (centerCfg) {
      const mount = this._root.querySelector(".centerMount");
      if (mount) {
        mount.innerHTML = "";
        if (this._centerEl) {
          mount.appendChild(this._centerEl);
          this._setupCenterObserver();
        }
      }
    }

    this._root.querySelectorAll("button.btnSlot").forEach((el) => {
      el.onclick = () => {
        if (el.classList.contains("placeholder")) return;
        const idx = clampInt(el.getAttribute("data-idx"), -1);
        const btn = cfg.buttons?.[idx];
        if (!btn || btn.disabled) return;
        this._callButtonAction(btn);
      };
    });

    this._applyScale();
    this._scheduleHideCenterMoreInfo();
  }

  getCardSize() {
    return 3;
  }
}

customElements.define("echo-show-5-room-card", EchoShow5RoomCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "echo-show-5-room-card",
  name: "Echo Show 5 Room Card",
  description:
    "Echo Show 5 fixed 960×480 stage; editor-safe fullscreen; invisible empty button slots; center more-info hidden; service autocomplete; center_show_name removed.",
});

/* -----------------------------
   Editor (reordered + grouped)
------------------------------*/
class EchoShow5RoomCardEditor extends HTMLElement {
  set hass(hass) {
    this._hass = hass;
    if (this._envForm) this._envForm.hass = hass;
    if (this._centerForm) this._centerForm.hass = hass;
    this.shadowRoot
      ?.querySelectorAll("ha-icon-picker, ha-entity-picker, ha-service-picker")
      .forEach((p) => (p.hass = hass));
    this._syncAddButtonState();
  }

  setConfig(config) {
    // Remove deprecated center_show_name if present in old configs
    if (config && "center_show_name" in config) {
      config = { ...config };
      delete config.center_show_name;
    }

    // Strip any legacy badge position keys on load too
    if (config?.badge && typeof config.badge === "object") {
      config = structuredClone(config);
      delete config.badge.pos_right;
      delete config.badge.pos_bottom;
    }

    this._config = deepMerge(DEFAULTS, config || {});
    if (Array.isArray(this._config.buttons) && this._config.buttons.length > MAX_BUTTONS) {
      this._config.buttons = this._config.buttons.slice(0, MAX_BUTTONS);
    }

    if (!this.shadowRoot) this.attachShadow({ mode: "open" });

    if (!this._root) {
      this._root = document.createElement("div");
      this.shadowRoot.appendChild(this._root);
      this._renderOnce();
    }

    this._syncUiFromConfig();
  }

  _fireChanged() {
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config: this._config },
        bubbles: true,
        composed: true,
      }),
    );
  }

  _btns() {
    return Array.isArray(this._config.buttons) ? this._config.buttons : [];
  }

  _set(path, value) {
    const next = structuredClone(this._config);
    const parts = path.split(".");
    let obj = next;
    while (parts.length > 1) {
      const k = parts.shift();
      obj[k] = obj[k] && typeof obj[k] === "object" ? obj[k] : {};
      obj = obj[k];
    }
    obj[parts[0]] = value;

    // keep badge position unconfigurable
    if (next.badge) {
      delete next.badge.pos_right;
      delete next.badge.pos_bottom;
    }

    // ensure deprecated key never persists
    if ("center_show_name" in next) delete next.center_show_name;

    this._config = next;
    this._fireChanged();
    this._syncAddButtonState();
  }

  _structuralUpdateButtons(mutator) {
    const next = structuredClone(this._config);
    next.buttons = Array.isArray(next.buttons) ? [...next.buttons] : [];
    mutator(next.buttons);
    if (next.buttons.length > MAX_BUTTONS) next.buttons = next.buttons.slice(0, MAX_BUTTONS);

    // ensure deprecated key never persists
    if ("center_show_name" in next) delete next.center_show_name;

    this._config = next;
    this._fireChanged();
    this._rebuildButtonsSection();
    this._syncUiFromConfig();
    this._syncAddButtonState();
  }

  _renderOnce() {
    const hasIconPicker = !!customElements.get("ha-icon-picker");

    this._root.innerHTML = `
      <style>
        :host { display:block; }

        .wrap { padding: 12px; display: grid; gap: 12px; font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; }
        .card { border: 1px solid rgba(127,127,127,0.25); border-radius: 12px; padding: 12px; }
        .hint { opacity: 0.78; font-size: 12px; margin-top: 6px; line-height: 1.35; }
        hr { opacity: .2; margin: 12px 0; }

        .sectionTitle {
          font-size: 14px;
          font-weight: 700;
          margin: 0 0 8px 0;
          letter-spacing: 0.2px;
        }
        .section {
          border: 1px solid rgba(127,127,127,0.18);
          border-radius: 12px;
          padding: 12px;
          display: grid;
          gap: 10px;
          background: rgba(0,0,0,0.03);
        }

        input, select, textarea {
          padding: 10px;
          border-radius: 10px;
          border: 1px solid rgba(127,127,127,0.35);
          background: rgba(0,0,0,0.08);
          color: var(--primary-text-color);
        }
        select { color: var(--primary-text-color) !important; }
        option { color: var(--primary-text-color) !important; background: var(--card-background-color, #111) !important; }
        textarea { resize: vertical; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace; }

        .row { display:grid; gap:8px; }
        .two { display:grid; grid-template-columns: 1fr 1fr; gap:10px; }
        .field { display:grid; gap:6px; font-size: 13px; color: var(--primary-text-color); }
        .fieldLabel { opacity: 0.92; }

        details { border: 1px solid rgba(127,127,127,0.2); border-radius: 12px; padding: 10px; }
        summary { cursor: pointer; font-weight: 650; opacity: 0.95; }

        .btnRow { border: 1px dashed rgba(127,127,127,0.35); border-radius: 12px; padding: 10px; display: grid; gap: 10px; margin-top: 10px; background: rgba(0,0,0,0.02); }
        .rowHead { display:flex; justify-content: space-between; align-items:center; }
        .rowTitle { font-weight: 700; }
        .rowActions { display:flex; gap: 8px; }
        .mini { border: 1px solid rgba(127,127,127,0.35); background: rgba(0,0,0,0.06); border-radius: 10px; padding: 6px 8px; cursor: pointer; }

        .addBtn {
          border: 1px solid rgba(127,127,127,0.35);
          background: rgba(0,0,0,0.06);
          border-radius: 12px;
          padding: 10px 12px;
          cursor: pointer;
          width: fit-content;
        }
        .addBtn[disabled] { cursor: not-allowed; opacity: 0.45; }
      </style>

      <div class="wrap">
        <div class="card">

          <div class="section">
            <div class="sectionTitle">Room & Background</div>

            <div class="two">
              <div class="field">
                <div class="fieldLabel">Title</div>
                <input id="title" />
              </div>
              <div class="field">
                <div class="fieldLabel">Background image (optional)</div>
                <input id="background_image" placeholder="/local/images/room.jpg" />
              </div>
            </div>

            <div class="two">
              <div class="field">
                <div class="fieldLabel">Overlay opacity (0..1)</div>
                <input id="overlay_opacity" />
              </div>
              <div class="field">
                <div class="fieldLabel">Preview note</div>
                <div class="hint">Fullscreen on Echo Show 5, will appear wrong on large screens.</div>
              </div>
            </div>
          </div>

          <hr>

          <div class="section">
            <div class="sectionTitle">Header styling</div>

            <div class="two">
              <div class="field">
                <div class="fieldLabel">Title colour (CSS)</div>
                <input id="title_color" placeholder="blank = theme, e.g. #fff or rgba(...)" />
              </div>
              <div class="field">
                <div class="fieldLabel">Title size (px)</div>
                <input id="title_size_px" />
              </div>
            </div>

            <div class="two">
              <div class="field">
                <div class="fieldLabel">Subtitle colour (CSS)</div>
                <input id="subtitle_color" placeholder="blank = theme, e.g. #fff or rgba(...)" />
              </div>
              <div class="field">
                <div class="fieldLabel">Subtitle size (px)</div>
                <input id="subtitle_size_px" />
              </div>
            </div>

            <div class="hint">Tip: use slightly transparent colours on bright images (e.g. rgba(255,255,255,0.85)).</div>
          </div>

          <hr>

          <div class="section">
            <div class="sectionTitle">Environment entities</div>
            <div class="hint">These drive the subtitle and (optionally) the badge logic.</div>
            <ha-form id="envForm"></ha-form>
          </div>

          <hr>

          <div class="section">
            <div class="sectionTitle">Room icon</div>

            <div class="two">
              <div class="field">
                <div class="fieldLabel">Room icon</div>
                ${
                  hasIconPicker
                    ? `<ha-icon-picker id="big_icon_picker"></ha-icon-picker>`
                    : `<input id="big_icon" placeholder="mdi:home" />`
                }
              </div>
              <div class="field">
                <div class="fieldLabel">Room icon colour (drives halo + default button icon colour)</div>
                <input id="big_icon_color" />
              </div>
            </div>

            <div class="two">
              <div class="field">
                <div class="fieldLabel">Room icon size (px)</div>
                <input id="big_icon_size" />
              </div>
              <div></div>
            </div>
          </div>

          <hr>

          <div class="section">
            <div class="sectionTitle">Center control</div>

            <div class="hint">Pick a control type + entity. You can scale it up (light default is 1.25).</div>
            <ha-form id="centerForm"></ha-form>

            <div class="two">
              <div class="field">
                <div class="fieldLabel">Center scale (general)</div>
                <input id="center_scale" placeholder="1.0" />
              </div>
              <div class="field">
                <div class="fieldLabel">Light control scale</div>
                <input id="center_light_scale" placeholder="1.25" />
              </div>
            </div>

            <div class="field">
              <div class="fieldLabel">Hide center “more info” dots</div>
              <select id="center_hide_more_info">
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
          </div>

          <hr>

          <details>
            <summary>Badge</summary>
            

            <div class="two" style="margin-top:10px;">
              <div class="field">
                <div class="fieldLabel">Badge mode</div>
                <select id="badge_mode">
                  <option value="none">none</option>
                  <option value="temp_humidity_thresholds">temperature/humidity thresholds</option>
                </select>
              </div>
              <div></div>
            </div>

            <div class="two" style="margin-top:10px;">
              <div class="field">
                <div class="fieldLabel">Humidity high (>=)</div>
                <input id="badge_humidity_high" />
              </div>
              <div class="field">
                <div class="fieldLabel">Temperature hot (>=)</div>
                <input id="badge_temp_hot" />
              </div>
            </div>

            <div class="two" style="margin-top:10px;">
              <div class="field">
                <div class="fieldLabel">Temperature cold (<=)</div>
                <input id="badge_temp_cold" />
              </div>
              <div></div>
            </div>
          </details>

          <hr>

          <div class="section">
            <div class="sectionTitle">Buttons</div>

            <button class="addBtn" id="addBtn">+ Add button</button>
            <div class="hint" id="addHint"></div>

            <div id="buttonsSection"></div>
          </div>

        </div>
      </div>
    `;

    const $ = (id) => this.shadowRoot.getElementById(id);

    // Room & background
    $("title").addEventListener("input", (e) => this._set("title", e.target.value));
    $("background_image").addEventListener("input", (e) => this._set("background_image", e.target.value));
    $("overlay_opacity").addEventListener("input", (e) =>
      this._set("overlay_opacity", toNum(e.target.value, DEFAULTS.overlay_opacity)),
    );

    // Header styling
    $("title_color").addEventListener("input", (e) => this._set("title_color", e.target.value));
    $("title_size_px").addEventListener("input", (e) =>
      this._set("title_size_px", clampInt(e.target.value, DEFAULTS.title_size_px)),
    );
    $("subtitle_color").addEventListener("input", (e) => this._set("subtitle_color", e.target.value));
    $("subtitle_size_px").addEventListener("input", (e) =>
      this._set("subtitle_size_px", clampInt(e.target.value, DEFAULTS.subtitle_size_px)),
    );

    // Env entities form
    this._envForm = $("envForm");
    this._envForm.schema = [
      { name: "env_temp_entity", selector: { entity: {} } },
      { name: "env_humidity_entity", selector: { entity: {} } },
    ];
    this._envForm.computeLabel = (s) => (s.name === "env_temp_entity" ? "Temperature entity" : "Humidity entity");
    this._envForm.addEventListener("value-changed", (e) => {
      const v = e.detail.value || {};
      const next = structuredClone(this._config);
      next.env_temp_entity = v.env_temp_entity ?? next.env_temp_entity ?? "";
      next.env_humidity_entity = v.env_humidity_entity ?? next.env_humidity_entity ?? "";
      if ("center_show_name" in next) delete next.center_show_name;
      this._config = next;
      this._fireChanged();
    });

    // Main icon
    const iconPicker = this.shadowRoot.getElementById("big_icon_picker");
    if (iconPicker) {
      iconPicker.addEventListener("value-changed", (e) => this._set("big_icon", e.detail.value || ""));
    } else {
      this.shadowRoot.getElementById("big_icon").addEventListener("input", (e) => this._set("big_icon", e.target.value));
    }
    $("big_icon_color").addEventListener("input", (e) => this._set("big_icon_color", e.target.value));
    $("big_icon_size").addEventListener("input", (e) =>
      this._set("big_icon_size", clampInt(e.target.value, DEFAULTS.big_icon_size)),
    );

    // Center control form (center_show_name removed)
    this._centerForm = $("centerForm");
    this._centerForm.schema = [
      {
        name: "center_preset",
        selector: {
          select: {
            options: [
              { label: "none", value: "none" },
              { label: "thermostat", value: "thermostat" },
              { label: "light", value: "light" },
              { label: "media player", value: "media" },
              { label: "fan", value: "fan" },
              { label: "generic entity", value: "entity" },
            ],
          },
        },
      },
      { name: "center_entity", selector: { entity: {} } },
    ];
    this._centerForm.computeLabel = (s) => {
      const map = {
        center_preset: "Control type",
        center_entity: "Control entity",
      };
      return map[s.name] || s.name;
    };
    this._centerForm.addEventListener("value-changed", (e) => {
      const v = e.detail.value || {};
      const next = structuredClone(this._config);
      next.center_preset = v.center_preset ?? next.center_preset ?? "none";
      next.center_entity = v.center_entity ?? next.center_entity ?? "";
      if ("center_show_name" in next) delete next.center_show_name;
      this._config = next;
      this._fireChanged();
    });

    $("center_scale").addEventListener("input", (e) =>
      this._set("center_scale", clampNum(e.target.value, DEFAULTS.center_scale, 0.75, 1.5)),
    );
    $("center_light_scale").addEventListener("input", (e) =>
      this._set("center_light_scale", clampNum(e.target.value, DEFAULTS.center_light_scale, 0.75, 1.5)),
    );
    $("center_hide_more_info").addEventListener("change", (e) =>
      this._set("center_hide_more_info", e.target.value === "true"),
    );

    // Badge
    $("badge_mode").addEventListener("change", (e) => this._set("badge.mode", e.target.value));
    $("badge_humidity_high").addEventListener("input", (e) =>
      this._set("badge.humidity_high", clampInt(e.target.value, DEFAULTS.badge.humidity_high)),
    );
    $("badge_temp_hot").addEventListener("input", (e) =>
      this._set("badge.temp_hot", clampInt(e.target.value, DEFAULTS.badge.temp_hot)),
    );
    $("badge_temp_cold").addEventListener("input", (e) =>
      this._set("badge.temp_cold", clampInt(e.target.value, DEFAULTS.badge.temp_cold)),
    );

    // Buttons
    $("addBtn").addEventListener("click", () => {
      if (this._btns().length >= MAX_BUTTONS) return;
      const mainColor = this._config.big_icon_color || DEFAULTS.big_icon_color;

      this._structuralUpdateButtons((arr) => {
        arr.push({
          label: "New",
          icon: "mdi:gesture-tap",
          icon_color: mainColor,
          text_color: "",
          entity: "",
          tap: { action: "none" },
        });
      });
    });

    this._rebuildButtonsSection();
    this._syncAddButtonState();
    this._applyHass();
  }

  _applyHass() {
    if (!this._hass) return;
    if (this._envForm) this._envForm.hass = this._hass;
    if (this._centerForm) this._centerForm.hass = this._hass;
    this.shadowRoot
      .querySelectorAll("ha-icon-picker, ha-entity-picker, ha-service-picker")
      .forEach((p) => (p.hass = this._hass));
  }

  _syncAddButtonState() {
    const addBtn = this.shadowRoot?.getElementById("addBtn");
    const hint = this.shadowRoot?.getElementById("addHint");
    if (!addBtn) return;

    const count = this._btns().length;
    const full = count >= MAX_BUTTONS;

    addBtn.disabled = full;
    if (hint) hint.textContent = full ? `Maximum ${MAX_BUTTONS} buttons reached.` : `${count}/${MAX_BUTTONS} buttons configured.`;
  }

  _syncUiFromConfig() {
    if (!this.shadowRoot) return;
    const c = this._config || DEFAULTS;
    const b = c.badge || DEFAULTS.badge;

    const setVal = (id, v) => {
      const el = this.shadowRoot.getElementById(id);
      if (!el) return;
      if (el.matches(":focus")) return;
      const nv = String(v ?? "");
      if (el.value !== nv) el.value = nv;
    };

    // Room/background
    setVal("title", c.title);
    setVal("background_image", c.background_image);
    setVal("overlay_opacity", c.overlay_opacity);

    // Header styling
    setVal("title_color", c.title_color);
    setVal("title_size_px", c.title_size_px);
    setVal("subtitle_color", c.subtitle_color);
    setVal("subtitle_size_px", c.subtitle_size_px);

    // Env form
    if (this._envForm && !this._envForm.matches(":focus-within")) {
      this._envForm.data = {
        env_temp_entity: c.env_temp_entity || "",
        env_humidity_entity: c.env_humidity_entity || "",
      };
    }

    // Icon picker
    const iconPicker = this.shadowRoot.getElementById("big_icon_picker");
    if (iconPicker) {
      iconPicker.hass = this._hass;
      iconPicker.value = c.big_icon || "";
    } else {
      setVal("big_icon", c.big_icon);
    }
    setVal("big_icon_color", c.big_icon_color);
    setVal("big_icon_size", c.big_icon_size);

    // Center form (center_show_name removed)
    if (this._centerForm && !this._centerForm.matches(":focus-within")) {
      this._centerForm.data = {
        center_preset: c.center_preset || "none",
        center_entity: c.center_entity || "",
      };
    }
    setVal("center_scale", c.center_scale);
    setVal("center_light_scale", c.center_light_scale);

    const hideSel = this.shadowRoot.getElementById("center_hide_more_info");
    if (hideSel && !hideSel.matches(":focus")) hideSel.value = (c.center_hide_more_info ?? true) ? "true" : "false";

    // Badge
    const bm = this.shadowRoot.getElementById("badge_mode");
    if (bm && !bm.matches(":focus")) bm.value = b.mode || "none";
    setVal("badge_humidity_high", b.humidity_high);
    setVal("badge_temp_hot", b.temp_hot);
    setVal("badge_temp_cold", b.temp_cold);

    this._syncButtonsUi();
    this._applyHass();
    this._syncAddButtonState();
  }

  /* ---------- Buttons ---------- */
  _rebuildButtonsSection() {
    const host = this.shadowRoot.getElementById("buttonsSection");
    if (!host) return;

    const buttons = this._btns().slice(0, MAX_BUTTONS);
    const hasIconPicker = !!customElements.get("ha-icon-picker");
    const hasServicePicker = !!customElements.get("ha-service-picker");

    host.innerHTML = buttons.length
      ? buttons
          .map((btn, idx) => `
            <div class="btnRow" data-btnrow="${idx}">
              <div class="rowHead">
                <div class="rowTitle">Button ${idx + 1}</div>
                <div class="rowActions">
                  <button class="mini" data-move="${idx}:-1" title="Move up">⬆️</button>
                  <button class="mini" data-move="${idx}:1" title="Move down">⬇️</button>
                  <button class="mini" data-del="${idx}" title="Delete">🗑️</button>
                </div>
              </div>

              <div class="two">
                <div class="field">
                  <div class="fieldLabel">Label</div>
                  <input data-btn="${idx}" data-k="label" />
                </div>
                <div class="field">
                  <div class="fieldLabel">Disabled</div>
                  <select data-btn="${idx}" data-k="disabled">
                    <option value="false">No</option>
                    <option value="true">Yes</option>
                  </select>
                </div>
              </div>

              <div class="two">
                <div class="field">
                  <div class="fieldLabel">Icon</div>
                  ${
                    hasIconPicker
                      ? `<ha-icon-picker data-btn="${idx}" data-k="icon"></ha-icon-picker>`
                      : `<input data-btn="${idx}" data-k="icon" placeholder="mdi:gesture-tap" />`
                  }
                </div>
                <div class="field">
                  <div class="fieldLabel">Icon colour (blank uses main icon colour)</div>
                  <input data-btn="${idx}" data-k="icon_color" placeholder="${escapeHtml(this._config.big_icon_color || DEFAULTS.big_icon_color)}" />
                </div>
              </div>

              <div class="field">
                <div class="fieldLabel">Label text colour (optional)</div>
                <input data-btn="${idx}" data-k="text_color" placeholder="e.g. #fff or rgba(...)" />
              </div>

              <div class="field">
                <div class="fieldLabel">Entity (optional)</div>
                <ha-entity-picker data-btn="${idx}" data-k="entity" allow-custom-entity></ha-entity-picker>
              </div>

              <div class="two">
                <div class="field">
                  <div class="fieldLabel">Tap action</div>
                  <select data-btn="${idx}" data-k="action">
                    <option value="none">none</option>
                    <option value="toggle">toggle</option>
                    <option value="more-info">more-info</option>
                    <option value="call-service">call-service</option>
                    <option value="navigate">navigate</option>
                  </select>
                </div>

                <div class="field">
                  <div class="fieldLabel">Service (domain.service)</div>
                  ${
                    hasServicePicker
                      ? `<ha-service-picker data-btn="${idx}" data-k="service"></ha-service-picker>`
                      : `<input data-btn="${idx}" data-k="service" placeholder="script.my_script" />`
                  }
                </div>
              </div>

              <div class="field">
                <div class="fieldLabel">Navigation path</div>
                <input data-btn="${idx}" data-k="navigation_path" placeholder="/lovelace/0" />
              </div>

              <details>
                <summary>Advanced service data (JSON)</summary>
                <textarea data-btn="${idx}" data-k="data_json" rows="3" placeholder='{"entity_id":"light.kitchen"}'></textarea>
                <div class="hint">Only used for call-service. Must be valid JSON.</div>
              </details>
            </div>
          `)
          .join("")
      : `<div class="hint" style="margin-top:10px;">No buttons configured yet.</div>`;

    host.querySelectorAll("[data-move]").forEach((el) => {
      el.addEventListener("click", () => {
        const [i, d] = el.getAttribute("data-move").split(":").map((x) => parseInt(x, 10));
        this._structuralUpdateButtons((arr) => {
          const j = i + d;
          if (j < 0 || j >= arr.length) return;
          [arr[i], arr[j]] = [arr[j], arr[i]];
        });
      });
    });

    host.querySelectorAll("[data-del]").forEach((el) => {
      el.addEventListener("click", () => {
        const i = parseInt(el.getAttribute("data-del"), 10);
        this._structuralUpdateButtons((arr) => arr.splice(i, 1));
      });
    });

    host.querySelectorAll("input[data-btn], select[data-btn], textarea[data-btn]").forEach((el) => {
      const idx = parseInt(el.getAttribute("data-btn"), 10);
      const key = el.getAttribute("data-k");
      el.addEventListener("input", () => this._updateButtonField(idx, key, el.value));
      el.addEventListener("change", () => this._updateButtonField(idx, key, el.value));
    });

    host.querySelectorAll("ha-entity-picker[data-btn][data-k='entity']").forEach((p) => {
      p.hass = this._hass;
      const idx = parseInt(p.getAttribute("data-btn"), 10);
      p.addEventListener("value-changed", (e) => this._updateButtonField(idx, "entity", e.detail.value || ""));
    });

    host.querySelectorAll("ha-icon-picker[data-btn][data-k='icon']").forEach((p) => {
      p.hass = this._hass;
      const idx = parseInt(p.getAttribute("data-btn"), 10);
      p.addEventListener("value-changed", (e) => this._updateButtonField(idx, "icon", e.detail.value || ""));
    });

    host.querySelectorAll("ha-service-picker[data-btn][data-k='service']").forEach((p) => {
      p.hass = this._hass;
      const idx = parseInt(p.getAttribute("data-btn"), 10);
      p.addEventListener("value-changed", (e) => this._updateButtonField(idx, "service", e.detail.value || ""));
    });

    this._syncButtonsUi();
  }

  _updateButtonField(idx, key, rawVal) {
    const next = structuredClone(this._config);
    next.buttons = this._btns().slice(0, MAX_BUTTONS);
    const cur = next.buttons[idx] || {};

    if (key === "disabled") {
      next.buttons[idx] = { ...cur, disabled: rawVal === "true" };
      if ("center_show_name" in next) delete next.center_show_name;
      this._config = next;
      this._fireChanged();
      return;
    }

    if (key === "entity") {
      next.buttons[idx] = { ...cur, entity: rawVal };
      if ("center_show_name" in next) delete next.center_show_name;
      this._config = next;
      this._fireChanged();
      return;
    }

    if (key === "action" || key === "service" || key === "navigation_path") {
      const tap = { ...(cur.tap || {}) };
      if (key === "action") tap.action = rawVal;
      if (key === "service") tap.service = rawVal;
      if (key === "navigation_path") tap.navigation_path = rawVal;
      next.buttons[idx] = { ...cur, tap };
      if ("center_show_name" in next) delete next.center_show_name;
      this._config = next;
      this._fireChanged();
      return;
    }

    if (key === "data_json") {
      try {
        const txt = (rawVal || "").trim();
        const parsed = txt ? JSON.parse(txt) : {};
        const tap = { ...(cur.tap || {}), data: parsed };
        next.buttons[idx] = { ...cur, tap };
        if ("center_show_name" in next) delete next.center_show_name;
        this._config = next;
        this._fireChanged();
      } catch (_) {}
      return;
    }

    // Keep any legacy badge position keys out
    if (next.badge) {
      delete next.badge.pos_right;
      delete next.badge.pos_bottom;
    }
    if ("center_show_name" in next) delete next.center_show_name;

    next.buttons[idx] = { ...cur, [key]: rawVal };
    this._config = next;
    this._fireChanged();
  }

  _syncButtonsUi() {
    const host = this.shadowRoot.getElementById("buttonsSection");
    if (!host) return;

    const buttons = this._btns().slice(0, MAX_BUTTONS);

    buttons.forEach((btn, idx) => {
      const row = host.querySelector(`[data-btnrow="${idx}"]`);
      if (!row) return;

      const set = (selector, v) => {
        const el = row.querySelector(selector);
        if (!el) return;
        if (el.matches(":focus")) return;
        const nv = String(v ?? "");
        if (el.value !== nv) el.value = nv;
      };

      set(`input[data-btn="${idx}"][data-k="label"]`, btn.label ?? "");
      set(`input[data-btn="${idx}"][data-k="icon_color"]`, btn.icon_color ?? "");
      set(`input[data-btn="${idx}"][data-k="text_color"]`, btn.text_color ?? "");
      set(`input[data-btn="${idx}"][data-k="navigation_path"]`, btn.tap?.navigation_path ?? "");

      const dis = row.querySelector(`select[data-btn="${idx}"][data-k="disabled"]`);
      if (dis && !dis.matches(":focus")) dis.value = btn.disabled ? "true" : "false";

      const act = row.querySelector(`select[data-btn="${idx}"][data-k="action"]`);
      if (act && !act.matches(":focus")) act.value = btn.tap?.action || "none";

      const sp = row.querySelector(`ha-service-picker[data-btn="${idx}"][data-k="service"]`);
      if (sp) {
        sp.hass = this._hass;
        sp.value = btn.tap?.service || "";
      } else {
        set(`input[data-btn="${idx}"][data-k="service"]`, btn.tap?.service ?? "");
      }

      const ta = row.querySelector(`textarea[data-btn="${idx}"][data-k="data_json"]`);
      if (ta && !ta.matches(":focus")) {
        const txt = JSON.stringify(btn.tap?.data || {}, null, 0);
        if (ta.value !== txt) ta.value = txt;
      }

      const ep = row.querySelector(`ha-entity-picker[data-btn="${idx}"][data-k="entity"]`);
      if (ep) {
        ep.hass = this._hass;
        ep.value = btn.entity || "";
      }

      const ip = row.querySelector(`ha-icon-picker[data-btn="${idx}"][data-k="icon"]`);
      if (ip) {
        ip.hass = this._hass;
        ip.value = btn.icon || "";
      } else {
        set(`input[data-btn="${idx}"][data-k="icon"]`, btn.icon ?? "");
      }
    });
  }
}

customElements.define("echo-show-5-room-card-editor", EchoShow5RoomCardEditor);
