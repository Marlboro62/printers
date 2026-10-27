/*
 * Cartes Imprimantes pour Home Assistant : imprimantes 3D (custom:printers-card) et imprimantes
 * de bureau (custom:printers-office-card, plus bas dans ce fichier). Carte Imprimantes 3D, au style des cartes
 * MyElectricalData new et des Cartes Serveur HA.
 *
 * Une imprimante par onglet : état, impression en cours (aperçu, progression, temps restant,
 * fin prévue, couches), caméra, températures, commandes (pause, reprise, annulation, arrêt
 * d'urgence confirmés) et statistiques.
 *
 * Intégrations reconnues : Moonraker (Klipper, HACS), OctoPrint, PrusaLink, Bambu Lab (HACS).
 * Une imprimante déclarée deux fois (Ethernet et Wi-Fi) n'apparaît qu'une fois.
 *
 *   type: custom:printers-card
 */

(() => {
const CARD_VERSION = "0.3.4-beta.1";

/* ------------------------------------------------------------- affichage */

const fmt = (n, digits = 0) =>
  n === null || n === undefined || !Number.isFinite(Number(n))
    ? "—"
    : Number(n).toLocaleString("fr-FR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const themeClass = (theme, hass) => {
  const light = hass?.themes?.darkMode === false;
  if (theme === "ha") return `th-ha${light ? " light" : ""}`;
  if (theme === "auto") return `th-v2${light ? " light" : ""}`;
  return "th-v2";
};
/** Durée en secondes → « 2 h 05 min », « 12 min », « 3 j 4 h ». */
const dur = (s) => {
  if (s === null || !Number.isFinite(s) || s < 0) return null;
  const m = Math.round(s / 60), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mn = m % 60;
  return d ? `${d} j ${h} h` : h ? `${h} h ${String(mn).padStart(2, "0")} min` : `${mn} min`;
};
/** « 496h 34m 42s » (Moonraker) → secondes. */
const parseHms = (v) => {
  const m = /(?:(\d+)\s*d)?\s*(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?\s*(?:(\d+)\s*s)?/i.exec(String(v || "").trim());
  if (!m || !m[0].trim()) return null;
  return (Number(m[1] || 0) * 86400) + (Number(m[2] || 0) * 3600) + (Number(m[3] || 0) * 60) + Number(m[4] || 0);
};
const hm = (d) => d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
const when = (d) => (d.toDateString() === new Date().toDateString() ? hm(d)
  : `${d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" })} ${hm(d)}`);

/* --------------------------------------------------------- détection */

const PLATFORMS = { moonraker: "Moonraker", octoprint: "OctoPrint", prusalink: "PrusaLink", bambu_lab: "Bambu Lab" };
/** Rôle d'une entité : fin de son nom (identique en français et en anglais pour ces intégrations). */
const ROLES = [
  // les noms les plus précis d'abord (emergency_stop avant stop, totals_print_time avant print_time, target_bed_temperature avant bed_temperature)
  ["pstate", "sensor", /_(printer_state)$/],
  // avant « cancel » : emergency_stop se termine aussi par _stop
  ["estop", "button", /_(emergency_stop)$/],
  ["jobs", "sensor", /_(totals_jobs)$/],
  ["total_time", "sensor", /_(totals_print_time)$/],
  ["total_filament", "sensor", /_(totals_filament_used)$/],
  ["longest", "sensor", /_(longest_print)$/],
  ["ext_target_s", "sensor", /_(target_tool0_temp|target_nozzle_temperature|nozzle_target_temperature)$/],
  ["bed_target_s", "sensor", /_(target_bed_temp|target_bed_temperature|bed_target_temperature)$/],
  ["state", "sensor", /_(current_print_state|current_state|print_status|stage|state)$/],
  ["message", "sensor", /_(printer_message|current_display_message|print_error)$/],
  ["progress", "sensor", /_(progress|job_percentage|print_progress)$/],
  ["filename", "sensor", /_(filename|gcode_filename|task_name|job_name)$/],
  ["elapsed", "sensor", /_(print_duration|print_time|elapsed_time)$/],
  ["left", "sensor", /_(print_time_left|remaining_time|time_remaining)$/],
  ["eta", "sensor", /_(print_eta|estimated_finish_time|end_time|print_finish)$/],
  ["start", "sensor", /_(start_time|print_start)$/],
  ["layer", "sensor", /_(current_layer)$/],
  ["layers", "sensor", /_(total_layer|total_layer_count|total_layers)$/],
  ["filament", "sensor", /_(filament_used)$/],
  ["speed", "sensor", /_(print_speed)$/],
  ["height", "sensor", /_(object_height)$/],
  ["ext", "sensor", /_(extruder_temperature|actual_tool0_temp|nozzle_temperature|nozzle_temp)$/],
  ["ext_power", "sensor", /_(extruder_power)$/],
  ["bed", "sensor", /_(bed_temperature|actual_bed_temp|heatbed_temperature|bed_temp)$/],
  ["bed_power", "sensor", /_(bed_power)$/],
  ["chamber", "sensor", /_(chamber_temperature)$/],
  ["queue", "sensor", /_(jobs_in_queue)$/],
  ["ext_target", "number", /_(extruder_target|nozzle_target)$/],
  ["bed_target", "number", /_(bed_target)$/],
  ["fan", "number", /_(fan_speed)$/],
  ["speed_factor", "number", /_(speed_factor)$/],
  ["pause", "button", /_(pause_print|pause_job|pause)$/],
  ["resume", "button", /_(resume_print|resume_job|resume)$/],
  ["cancel", "button", /_(cancel_print|stop_job|cancel_job|stop)$/],
  ["home", "button", /_(home_all_axes)$/],
  ["filament_sensor", "binary_sensor", /_(filament_sensor|filament_runout)$/],
];
const roleOf = (id) => {
  const domain = id.split(".")[0];
  for (const [role, d, re] of ROLES) if (d === domain && re.test(id)) return role;
  if (domain === "camera") return /thumbnail|miniature|cover|preview|apercu/.test(id) ? "thumbnail" : "camera";
  if (domain === "switch" || domain === "light") return "output";
  if (domain === "sensor") return "other";
  return null;
};
/** État normalisé : printing, paused, complete, cancelled, error, idle, offline. */
const NORM = [
  [/^(printing|running|prepare|printing from sd|slicing|busy)$/i, "printing"], [/^(paused|pause|pausing)$/i, "paused"],
  [/^(complete|completed|finish|finished)$/i, "complete"], [/^(cancelled|canceled|cancelling)$/i, "cancelled"],
  [/^(error|failed|failure|shutdown|attention)$/i, "error"],
  [/^(standby|ready|operational|idle|startup|init|offline_ready)$/i, "idle"],
  [/^(offline|unavailable|unknown|closed|disconnected)$/i, "offline"],
];
const norm = (s) => (NORM.find(([re]) => re.test(String(s ?? "").trim())) || [, "idle"])[1];
const STATE = {
  printing: ["Impression en cours", "mdi:printer-3d-nozzle", "print"], paused: ["En pause", "mdi:pause-circle-outline", "warn"],
  complete: ["Impression terminée", "mdi:check-circle-outline", "ok"], cancelled: ["Impression annulée", "mdi:close-circle-outline", "warn"],
  error: ["Erreur", "mdi:alert-circle-outline", "bad"], idle: ["Prête", "mdi:printer-3d", "ok"], offline: ["Hors ligne", "mdi:lan-disconnect", "off"],
};
/** Suffixe de connexion à ignorer pour reconnaître une même imprimante déclarée deux fois. */
const LINK = /[\s_-]*\(?(ethernet|eth|wi-?fi|wlan|lan|wireless|filaire|sans fil)\)?$/i;

const DEFAULTS = {
  title: "",
  icon: "mdi:printer-3d",
  icon_color: "",
  show_job: true, show_camera: true, show_temps: true, show_controls: true, show_stats: true, show_device: true,
  camera_mode: "live", // live : vidéo en continu ; snapshot : une image toutes les camera_refresh secondes
  camera_refresh: 5, // secondes
  theme: "v2",
};

class PrintersCard extends HTMLElement {
  static getConfigElement() {
    return document.createElement("printers-card-editor");
  }

  static getStubConfig() {
    return {};
  }

  setConfig(config) {
    this._config = { ...DEFAULTS, ...(config || {}) };
    this._map = null;
    this._sig = null;
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    if (!this._clicks) {
      this.shadowRoot.addEventListener("click", (this._clicks = (ev) => {
        const tab = ev.target.closest?.("[data-tab]");
        if (tab) {
          this._tab = tab.dataset.tab;
          try { localStorage.setItem("printers-card:tab", JSON.stringify(this._tab)); } catch (e) { /* stockage indisponible */ }
          this._sig = null; this._render(); return;
        }
        const press = ev.target.closest?.("[data-press]");
        if (press) {
          const id = press.dataset.press;
          // commandes sensibles (annuler, arrêt d'urgence, origine) : premier clic arme, second dans les 5 s confirme
          if (press.dataset.confirm && this._armed !== id) {
            this._armed = id;
            clearTimeout(this._armTimer);
            this._armTimer = setTimeout(() => { this._armed = null; this._sig = null; this._render(); }, 5000);
          } else {
            this._armed = null;
            this._hass?.callService("button", "press", { entity_id: id });
          }
          this._sig = null; this._render(); return;
        }
        const tog = ev.target.closest?.("[data-toggle]");
        if (tog) {
          const id = tog.dataset.toggle;
          this._hass?.callService(id.split(".")[0], "toggle", { entity_id: id });
          return;
        }
        const el = ev.target.closest?.("[data-entity]");
        if (el?.dataset.entity) {
          const e = new Event("hass-more-info", { bubbles: true, composed: true });
          e.detail = { entityId: el.dataset.entity };
          this.dispatchEvent(e);
        }
      }));
    }
    this._render();
  }

  set hass(hass) {
    if (this._hass?.entities !== hass.entities || this._hass?.devices !== hass.devices) this._map = null;
    this._hass = hass;
    this._render();
  }

  connectedCallback() {
    clearInterval(this._tick);
    // mode image par image : nouvelle image sans redessiner la carte ; le reste toutes les 30 s (temps restant)
    this._tick = setInterval(() => {
      if (this._camEl && this._camMode === "snapshot") this._camLoad(true);
      this._n = (this._n || 0) + 1;
      if (this._n % Math.max(1, Math.round(30 / this._refresh())) === 0) { this._sig = null; this._render(); }
    }, this._refresh() * 1000);
    this._sig = null;
    this._render();
  }

  disconnectedCallback() {
    clearInterval(this._tick);
    this._camStop();
  }

  /** Coupe le flux de la caméra (carte masquée, changement d'onglet ou de caméra). */
  _camStop() {
    clearTimeout(this._camRetry);
    if (this._camEl) { this._camEl.onerror = null; this._camEl.src = "data:,"; this._camEl.remove(); }
    this._camEl = null;
    this._camKey = null;
  }

  /**
   * Charge l'image de la caméra. En direct : flux MJPEG de Home Assistant (/api/camera_proxy_stream),
   * ouvert une seule fois puis gardé tant que la caméra ne change pas. Image par image : nouvelle
   * image préchargée puis affichée d'un coup, sans écran noir.
   */
  _camLoad(next = false) {
    const el = this._camEl, pic = this._st(this._camId)?.attributes?.entity_picture;
    if (!el || !pic) return;
    if (this._camMode === "live") {
      el.src = pic.replace("/api/camera_proxy/", "/api/camera_proxy_stream/");
      return;
    }
    const url = `${pic}${pic.includes("?") ? "&" : "?"}_=${Date.now()}`;
    if (!next || !el.getAttribute("src")) { el.src = url; return; }
    if (this._camBusy) return;
    this._camBusy = true;
    const pre = new Image();
    pre.onload = () => { this._camBusy = false; if (this._camEl === el) el.src = url; };
    pre.onerror = () => { this._camBusy = false; };
    pre.src = url;
  }

  /** Place la caméra (élément gardé d'un rendu à l'autre) dans son emplacement. */
  _camMount(camId) {
    const slot = this.shadowRoot.querySelector(".pc-cam-slot");
    if (!slot || !this.isConnected) { this._camStop(); return; }
    const mode = this._config.camera_mode === "snapshot" ? "snapshot" : "live";
    const key = `${camId}|${mode}`;
    if (this._camKey !== key) {
      this._camStop();
      const img = document.createElement("img");
      img.className = "pc-cam";
      img.alt = "Caméra de l'imprimante";
      // flux coupé (redémarrage, réseau) : nouvel essai dans 5 s avec un jeton à jour
      img.onerror = () => { clearTimeout(this._camRetry); this._camRetry = setTimeout(() => this._camLoad(), 5000); };
      this._camEl = img; this._camKey = key; this._camId = camId; this._camMode = mode;
      this._camLoad();
    }
    slot.replaceWith(this._camEl);
  }

  _refresh() {
    return Math.max(2, Number(this._config?.camera_refresh) || 5);
  }

  getCardSize() {
    return 9;
  }

  _st(id) {
    return id ? this._hass?.states?.[id] : undefined;
  }

  _num(id) {
    const s = this._st(id);
    if (!s || s.state === "unavailable" || s.state === "unknown" || s.state === "") return null;
    const v = Number(s.state);
    return Number.isFinite(v) ? v : null;
  }

  _txt(id) {
    const s = this._st(id)?.state;
    return s === undefined || s === "unavailable" || s === "unknown" || s === "" ? null : s;
  }

  /** Durée d'un capteur, en secondes, selon son unité (s, min, h, d) ou au format « 1h 2m 3s ». */
  _secs(id) {
    const s = this._st(id);
    if (!s) return null;
    const v = this._num(id);
    if (v === null) return parseHms(s.state);
    const u = String(s.attributes?.unit_of_measurement || "s").toLowerCase();
    return v * ({ s: 1, sec: 1, min: 60, h: 3600, d: 86400 }[u] || 1);
  }

  /** Dernière impression d'une imprimante (mémoire, puis stockage du navigateur). */
  _lastJob(id) {
    this._last ||= {};
    if (!(id in this._last)) {
      try { this._last[id] = JSON.parse(localStorage.getItem(`printers-card:last:${id}`) || "null"); } catch (e) { this._last[id] = null; }
    }
    return this._last[id];
  }

  /** Garde l'impression en cours ; la miniature est copiée une fois par fichier (son lien expire). */
  _keep(id, j) {
    const prev = this._lastJob(id);
    // même impression : une valeur absente ou remise à 0 un instant ne remplace pas la précédente
    const same = prev && prev.file === j.file && !prev.result;
    const most = (k) => (same ? Math.max(Number(prev[k]) || 0, Number(j[k]) || 0) || null : j[k] ?? null);
    const next = { file: j.file, pct: j.pct ?? (same ? prev.pct : null), elapsed: most("elapsed"), layer: most("layer"),
      layers: j.layers ?? (same ? prev.layers : null), filament: most("filament"),
      result: j.result || null, ended: j.ended || null, thumbData: prev?.file === j.file ? prev.thumbData : null };
    if (prev && JSON.stringify({ ...prev, pct: Math.round(prev.pct || 0), elapsed: Math.round((prev.elapsed || 0) / 60) })
      === JSON.stringify({ ...next, pct: Math.round(next.pct || 0), elapsed: Math.round((next.elapsed || 0) / 60) })) return;
    this._last[id] = next;
    try { localStorage.setItem(`printers-card:last:${id}`, JSON.stringify(next)); } catch (e) { /* stockage indisponible */ }
    if (!next.thumbData && j.thumb && !this._thumbBusy) {
      this._thumbBusy = true;
      fetch(j.thumb).then((res) => (res.ok ? res.blob() : null)).then((b) => new Promise((ok) => {
        if (!b || b.size > 200000) return ok(null);
        const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.onerror = () => ok(null); fr.readAsDataURL(b);
      })).then((data) => {
        const cur = this._last[id];
        if (data && cur && cur.file === next.file) {
          cur.thumbData = data;
          try { localStorage.setItem(`printers-card:last:${id}`, JSON.stringify(cur)); } catch (e) { /* trop gros ou indisponible */ }
        }
      }).catch(() => {}).finally(() => { this._thumbBusy = false; });
    }
  }

  /**
   * Durée, filament et couche d'une impression terminée, lus dans l'historique de Home Assistant
   * (depuis le dernier passage en impression), quand la carte n'a pas vu l'impression.
   */
  _hist(p, endedAt) {
    const r = p.roles, key = `${p.id}|${endedAt}`;
    this._histC ||= {};
    if (key in this._histC) return this._histC[key];
    this._histC[key] = null;
    const ids = [r.state, r.elapsed, r.filament, r.layer].filter(Boolean);
    if (!r.state || ids.length < 2 || !this._hass?.callApi) return null;
    const from = new Date(endedAt - 2 * 86400e3).toISOString(), to = new Date(endedAt + 60e3).toISOString();
    this._hass.callApi("GET", `history/period/${from}?filter_entity_id=${ids.join(",")}&end_time=${encodeURIComponent(to)}&minimal_response&no_attributes`)
      .then((res) => {
        const series = {};
        for (const ser of res || []) if (ser?.[0]?.entity_id) series[ser[0].entity_id] = ser;
        // début de l'impression : dernier passage en « printing » avant la fin
        let begin = endedAt - 2 * 86400e3;
        for (const pt of series[r.state] || []) {
          const t = Date.parse(pt.last_changed);
          if (norm(pt.state) === "printing" && t < endedAt) begin = Math.max(begin, t);
        }
        const unit = { s: 1, sec: 1, min: 60, h: 3600, d: 86400 }[String(this._st(r.elapsed)?.attributes?.unit_of_measurement || "s").toLowerCase()] || 1;
        // durées en secondes : nombre dans l'unité du capteur, ou texte « 1h 2m 3s »
        const most = (id, u = 1, isDur = false) => {
          let m = null;
          for (const pt of series[id] || []) {
            if (Date.parse(pt.last_changed) < begin - 60e3) continue;
            const v = Number.isFinite(Number(pt.state)) ? Number(pt.state) * u : isDur ? parseHms(pt.state) : null;
            if (v !== null && Number.isFinite(v) && (m === null || v > m)) m = v;
          }
          return m;
        };
        this._histC[key] = { elapsed: most(r.elapsed, unit, true), filament: most(r.filament), layer: most(r.layer) };
        this._sig = null;
        this._render();
      })
      .catch(() => {});
    return null;
  }

  /** Imprimantes : une par appareil, Ethernet et Wi-Fi fusionnés (la connexion qui répond est gardée). */
  _resolve() {
    if (this._map) return this._map;
    const hass = this._hass, c = this._config;
    const devs = hass.devices || {};
    const byDev = {};
    for (const [id, e] of Object.entries(hass.entities || {})) {
      // une imprimante éteinte reste affichée (hors ligne), même si l'intégration n'a pas pu démarrer
      if (!PLATFORMS[e.platform] || e.hidden) continue;
      const role = roleOf(id);
      if (!role) continue;
      const key = e.device_id || `${e.platform}:${e.config_entry_id || "x"}`;
      const d = (byDev[key] ||= { id: key, platform: e.platform, roles: {}, outputs: [], others: [], cameras: [] });
      if (role === "output") d.outputs.push(id);
      else if (role === "other") d.others.push(id);
      else if (role === "camera") d.cameras.push(id);
      else d.roles[role] ||= id;
    }
    const all = Object.values(byDev);
    for (const d of all) {
      const dev = devs[d.id] || {};
      d.devName = dev.name_by_user || dev.name || PLATFORMS[d.platform];
      d.name = d.devName.replace(LINK, "").trim() || d.devName;
      // fabricant et modèle, sans répétition ni simple nom de l'intégration (« moonraker moonraker »)
      const parts = [dev.manufacturer, dev.model].filter(Boolean).filter((v, i, a) => a.findIndex((x) => x.toLowerCase() === v.toLowerCase()) === i);
      d.model = parts.filter((v) => !Object.keys(PLATFORMS).includes(v.toLowerCase().replace(/\s+/g, "_"))).join(" ");
    }
    // regroupe les doublons (même nom sans « Ethernet » / « WIFI »)
    const groups = {};
    for (const d of all) (groups[d.name.toLowerCase()] ||= []).push(d);
    let list = Object.values(groups).map((g) => {
      const alive = g.filter((d) => this._txt(d.roles.state || d.roles.pstate) !== null);
      const pick = alive.find((d) => norm(this._txt(d.roles.state)) === "printing") || alive.find((d) => /ethernet|lan|filaire/i.test(d.devName)) || alive[0]
        || g.find((d) => /ethernet|lan|filaire/i.test(d.devName)) || g[0];
      return { ...pick, links: g.map((d) => d.id) };
    });
    const want = (Array.isArray(c.printers) ? c.printers : c.printers ? [c.printers] : []).map((x) => (typeof x === "object" ? x : { device: x }));
    if (want.length) {
      list = want.map((w) => {
        const d = list.find((x) => x.links.includes(w.device) || x.name.toLowerCase() === String(w.device || "").toLowerCase());
        return d ? { ...d, name: w.name || d.name, camera: w.camera || null } : null;
      }).filter(Boolean);
    } else list.sort((a, b) => a.name.localeCompare(b.name, "fr"));
    this._map = list;
    return list;
  }

  _status(p) {
    const st = this._txt(p.roles.state), ps = this._txt(p.roles.pstate);
    if (st === null && ps === null) return "offline";
    if (ps && norm(ps) === "error") return "error";
    if (ps && norm(ps) === "offline") return "offline";
    return norm(st ?? ps);
  }

  _render() {
    if (!this._config || !this._hass || !this.shadowRoot) return;
    const c = this._config;
    const list = this._resolve();
    if (this._tab === undefined) { try { this._tab = JSON.parse(localStorage.getItem("printers-card:tab") || "null"); } catch (e) { this._tab = null; } }
    // onglet choisi, sinon la première imprimante en cours d'impression
    const p = list.find((x) => x.id === this._tab || x.links?.includes(this._tab))
      || list.find((x) => ["printing", "paused", "error"].includes(this._status(x))) || list[0];
    const ids = list.flatMap((x) => [...Object.values(x.roles), ...x.outputs, ...x.others]);
    const sig = `${c.theme}|${this._hass.themes?.darkMode}|${p?.id}|${this._armed}|${Math.floor(Date.now() / 30000)}|` + ids.map((id) => this._st(id)?.state ?? "-").join("|");
    if (sig === this._sig) return;
    this._sig = sig;

    const statuses = list.map((x) => this._status(x));
    const printing = statuses.filter((s) => s === "printing" || s === "paused").length;
    const title = c.title || (list.length === 1 ? list[0].name : "Imprimantes 3D");
    const sub = !list.length ? "" : list.length === 1 ? STATE[statuses[0]][0]
      : `${list.length} imprimantes · ${printing ? `${printing} en impression` : "au repos"}`;

    let body = "", camShown = null;
    if (!p) {
      body = `<div class="empty">Aucune imprimante trouvée<span>Ajoutez l'intégration Moonraker (Klipper, via HACS), OctoPrint, PrusaLink ou Bambu Lab, puis rechargez la page.</span></div>`;
    } else {
      const r = p.roles, status = this._status(p);
      const [stLabel, stIcon, stCls] = STATE[status];
      const tabs = list.length > 1 ? `<div class="pc-tabs" role="tablist">${list.map((x, i) => {
        const s = statuses[i], pr = this._num(x.roles.progress);
        return `<button class="pc-tab ${x.id === p.id ? "on" : ""}" role="tab" aria-selected="${x.id === p.id}" data-tab="${esc(x.id)}">
          <i class="pc-dot ${STATE[s][2]}"></i>${esc(x.name)}${(s === "printing" || s === "paused") && pr !== null ? `<small>${fmt(pr, 0)} %</small>` : ""}</button>`;
      }).join("")}</div>` : "";

      const msg = this._txt(r.message);
      // message de l'imprimante, sauf s'il répète l'état (« Printer is ready », « Impression en cours... »)
      const same = (a, b) => String(a || "").toLowerCase().replace(/[^a-zà-ÿ0-9]+/g, " ").trim() === String(b || "").toLowerCase().replace(/[^a-zà-ÿ0-9]+/g, " ").trim();
      const showMsg = msg && !/^printer is ready$/i.test(msg) && !same(msg, stLabel) && !same(msg, this._txt(r.pstate)) && !same(msg, this._txt(r.state));
      const state = `<div class="pc-state ${stCls}" data-entity="${esc(r.state || r.pstate || "")}"><ha-icon icon="${stIcon}"></ha-icon>
        <div><b>${stLabel}</b>${showMsg ? `<span>${esc(msg)}</span>` : p.model && p.model.toLowerCase() !== p.name.toLowerCase() ? `<span>${esc(p.model)}</span>` : ""}</div></div>`;

      // --- impression en cours, sinon dernière impression (gardée par la carte : Moonraker efface le fichier à la fin)
      let job = "";
      const file = this._txt(r.filename);
      const active = status === "printing" || status === "paused";
      const kv = (label, v) => (v === null || v === undefined ? "" : `<div class="pc-kv"><span>${label}</span><b>${esc(v)}</b></div>`);
      let j = null;
      if (active || (file && this._num(r.progress))) {
        let eta = this._txt(r.eta) ? new Date(this._txt(r.eta)) : null;
        if (eta && isNaN(eta)) eta = null;
        const left = this._secs(r.left);
        if (!eta && left && status === "printing") eta = new Date(Date.now() + left * 1000);
        j = { file, pct: this._num(r.progress), elapsed: this._secs(r.elapsed), left, eta, layer: this._num(r.layer), layers: this._num(r.layers),
          filament: this._num(r.filament), speed: this._num(r.speed), thumb: this._st(r.thumbnail)?.attributes?.entity_picture, cls: stCls };
        if (active) this._keep(p.id, j);
      }
      const done = ["complete", "cancelled", "error"].includes(status);
      // heure de fin : changement d'état vu par Home Assistant (la carte a pu être ouverte plus tard)
      const endedAt = done ? Date.parse(this._st(r.state)?.last_changed || "") : NaN;
      let last = !active ? this._lastJob(p.id) : null;
      if (last && j?.file && last.file && j.file !== last.file) last = null;
      if (last && done && !last.result) {
        this._keep(p.id, { ...last, result: status, ended: Number.isFinite(endedAt) ? endedAt : Date.now() });
        last = this._lastJob(p.id);
      }
      if (!active && (last || j)) {
        const l = last || {};
        // Moonraker remet durée et couche à 0 à la fin : valeurs gardées par la carte, sinon historique de Home Assistant
        const h = done && Number.isFinite(endedAt) ? this._hist(p, endedAt) : null;
        const val = (k) => [l[k], h?.[k], j?.[k]].find((v) => v !== null && v !== undefined && v !== 0) ?? null;
        const result = l.result || (done ? status : null);
        j = { ...l, file: l.file || j?.file, elapsed: val("elapsed"), layer: val("layer"), layers: val("layers"), filament: val("filament"),
          thumb: j?.thumb || l.thumbData || null, result, ended: l.ended || (Number.isFinite(endedAt) ? endedAt : null),
          pct: result === "complete" ? 100 : val("pct"), cls: { complete: "ok", cancelled: "warn", error: "bad" }[result] || "ok" };
        // impression réussie : dernière couche atteinte (le G-code de fin remonte la buse et fait monter la couche)
        if (result === "complete" && j.layers) j.layer = j.layers;
      }
      if (c.show_job !== false && j) {
        const pct = j.pct;
        job = `<div class="pc-sec"><div class="pc-h"><ha-icon icon="mdi:file-cad-box"></ha-icon>${active ? "Impression" : "Dernière impression"}</div>
          <div class="pc-job" data-entity="${esc(r.progress || r.filename || "")}">
            ${j.thumb ? `<img class="pc-thumb" src="${esc(j.thumb)}" alt="">` : `<div class="pc-thumb none"><ha-icon icon="mdi:cube-outline"></ha-icon></div>`}
            <div class="pc-jb">
              <div class="pc-file" title="${esc(j.file || "")}">${esc((j.file || "—").replace(/\.(gcode|bgcode|3mf|gco)$/i, ""))}</div>
              <div class="pc-prog"><div class="pc-bar ${j.cls}"><i style="width:${Math.max(0, Math.min(100, pct ?? 0))}%"></i></div><b>${pct === null || pct === undefined ? "—" : `${fmt(pct, pct < 10 && pct > 0 ? 1 : 0)} %`}</b></div>
              <div class="pc-kvs">
                ${kv(active ? "Écoulé" : "Durée", dur(j.elapsed))}
                ${active ? kv("Restant", j.left ? dur(j.left) : null) : ""}
                ${active ? kv("Fin prévue", j.eta ? when(j.eta) : null) : kv({ cancelled: "Annulée", error: "Arrêtée" }[j.result] || "Terminée", j.ended ? when(new Date(j.ended)) : null)}
                ${kv("Couche", j.layer !== null && j.layer !== undefined && j.layers ? `${fmt(Math.min(j.layer, j.layers))} / ${fmt(j.layers)}` : null)}
                ${kv("Filament", j.filament ? `${fmt(j.filament, 1)} m` : null)}
                ${active ? kv("Vitesse", j.speed ? `${fmt(j.speed)} mm/s` : null) : ""}
              </div>
            </div>
          </div></div>`;
      }

      // --- caméra
      const camId = p.camera || c.camera || p.cameras.find((id) => this._st(id)) || null;
      const camSt = this._st(camId);
      const camOn = c.show_camera !== false && camSt && camSt.attributes?.entity_picture && camSt.state !== "unavailable" && status !== "offline";
      camShown = camOn ? camId : null;
      const cam = camOn
        ? `<div class="pc-sec"><div class="pc-h"><ha-icon icon="mdi:webcam"></ha-icon>Caméra</div><div class="pc-camw" data-entity="${esc(camId)}">
            <div class="pc-cam-slot"></div></div></div>` : "";

      // --- températures
      const temp = (cur, tgtNum, tgtSensor, power, icon, label) => {
        const v = this._num(cur);
        if (v === null) return "";
        const t = this._num(tgtNum) ?? this._num(tgtSensor);
        const pw = this._num(power);
        const heating = t !== null && t > 0;
        const pct = heating ? Math.max(0, Math.min(100, (v / t) * 100)) : 0;
        return `<div class="pc-t ${heating ? "hot" : ""}" data-entity="${esc(cur)}">
          <div class="pc-tt"><span><ha-icon icon="${icon}"></ha-icon>${label}</span><b>${fmt(v, v < 100 ? 1 : 0)}<small> °C</small></b></div>
          <div class="pc-tbar"><i style="width:${pct}%"></i></div>
          <div class="pc-tn">${heating ? `Consigne ${fmt(t)} °C` : v >= 45 ? "Refroidissement" : "Arrêt"}${pw !== null && heating ? ` · chauffe ${fmt(pw)} %` : ""}</div></div>`;
      };
      const extra = p.others.filter((id) => this._st(id)?.attributes?.unit_of_measurement === "°C" && ![r.ext, r.bed, r.chamber].includes(id)).map((id) => {
        const v = this._num(id);
        if (v === null) return "";
        const raw = id.split(".")[1].replace(/^.*?_(?=[a-z0-9]+_temp(erature)?$)/, "").replace(/_temp(erature)?$/, "");
        const label = /rockchip|host|rpi|raspberry|cb\d/i.test(raw) ? "Hôte" : /mcu|stm32|board|carte/i.test(raw) ? "Carte" : raw.replace(/_/g, " ");
        return `<span class="pc-x" data-entity="${esc(id)}"><ha-icon icon="mdi:thermometer"></ha-icon>${esc(label)} <b>${fmt(v, 0)} °C</b></span>`;
      }).filter(Boolean);
      const fan = this._num(r.fan);
      const temps = c.show_temps !== false ? [
        temp(r.ext, r.ext_target, r.ext_target_s, r.ext_power, "mdi:printer-3d-nozzle-heat-outline", "Buse"),
        temp(r.bed, r.bed_target, r.bed_target_s, r.bed_power, "mdi:radiator", "Plateau"),
        temp(r.chamber, null, null, null, "mdi:home-thermometer-outline", "Caisson"),
      ].filter(Boolean) : [];
      const tempsHtml = temps.length ? `<div class="pc-sec"><div class="pc-h"><ha-icon icon="mdi:thermometer-lines"></ha-icon>Températures</div>
        <div class="pc-ts">${temps.join("")}</div>${extra.length || fan !== null ? `<div class="pc-xs">${extra.join("")}${fan !== null ? `<span class="pc-x" data-entity="${esc(r.fan)}"><ha-icon icon="mdi:fan"></ha-icon>Ventilateur <b>${fmt(fan)} %</b></span>` : ""}</div>` : ""}</div>` : "";

      // --- commandes
      const btn = (id, icon, label, cls = "", confirm = false) => {
        if (!id || !this._st(id)) return "";
        const armed = this._armed === id;
        return `<button class="pc-btn ${cls} ${armed ? "armed" : ""}" data-press="${esc(id)}" ${confirm ? 'data-confirm="1"' : ""} title="${esc(armed ? `${label} : cliquez encore pour confirmer` : label)}">
          <ha-icon icon="${armed ? "mdi:check-bold" : icon}"></ha-icon><span>${armed ? "Confirmer ?" : label}</span></button>`;
      };
      const ctl = c.show_controls === false || status === "offline" ? [] : [
        status === "printing" ? btn(r.pause, "mdi:pause", "Pause", "warn") : "",
        status === "paused" ? btn(r.resume, "mdi:play", "Reprendre", "go") : "",
        status === "printing" || status === "paused" ? btn(r.cancel, "mdi:stop", "Annuler", "bad", true) : "",
        status !== "printing" && status !== "paused" ? btn(r.home, "mdi:home-import-outline", "Origine", "", true) : "",
        btn(r.estop, "mdi:alert-octagon-outline", "Arrêt d'urgence", "bad", true),
      ].filter(Boolean);
      const outs = c.show_controls === false ? [] : p.outputs.map((id) => {
        const s = this._st(id);
        if (!s) return "";
        const raw = (s.attributes?.friendly_name || id).replace(new RegExp(`^${p.devName}\\s*`, "i"), "").replace(/^output[_ ]pin[_ ]/i, "");
        const label = /frame/i.test(raw) ? "Lumière cadre" : /part|nozzle|tool/i.test(raw) ? "Lumière buse" : /light|led|lumi/i.test(raw) ? "Lumière" : raw.replace(/_/g, " ");
        return `<button class="pc-btn tog ${s.state === "on" ? "on" : ""}" data-toggle="${esc(id)}" title="${esc(label)} : ${s.state === "on" ? "éteindre" : "allumer"}"><ha-icon icon="${s.state === "on" ? "mdi:lightbulb-on" : "mdi:lightbulb-outline"}"></ha-icon><span>${esc(label)}</span></button>`;
      }).filter(Boolean);
      const ctlHtml = ctl.length || outs.length ? `<div class="pc-sec"><div class="pc-h"><ha-icon icon="mdi:gesture-tap-button"></ha-icon>Commandes</div>${ctl.length ? `<div class="pc-btns">${ctl.join("")}</div>` : ""}${outs.length ? `<div class="pc-btns pc-outs">${outs.join("")}</div>` : ""}</div>` : "";

      // --- statistiques
      const tot = this._secs(r.total_time), lng = this._secs(r.longest), fil = this._num(r.total_filament), jobs = this._num(r.jobs);
      const stat = (id, icon, label, v) => (v === null ? "" : `<div class="pc-s" data-entity="${esc(id)}"><ha-icon icon="${icon}"></ha-icon><b>${esc(v)}</b><span>${label}</span></div>`);
      const stats = c.show_stats !== false ? [
        stat(r.jobs, "mdi:counter", "Impressions", jobs === null ? null : fmt(jobs)),
        stat(r.total_time, "mdi:timer-outline", "Temps total", tot === null ? null : `${fmt(Math.round(tot / 3600))} h`),
        stat(r.total_filament, "mdi:printer-3d-nozzle-outline", "Filament", fil === null ? null : fil >= 1000 ? `${fmt(fil / 1000, 2)} km` : `${fmt(fil)} m`),
        stat(r.longest, "mdi:trophy-outline", "Plus longue", dur(lng)),
      ].filter(Boolean) : [];
      const statsHtml = stats.length ? `<div class="pc-sec"><div class="pc-h"><ha-icon icon="mdi:chart-box-outline"></ha-icon>Statistiques</div><div class="pc-ss">${stats.join("")}</div></div>` : "";

      const devHtml = c.show_device !== false ? deviceBlock(this._hass, p.links || [p.id]) : "";
      body = tabs + `<div class="pc-sec">${state}</div>` + job + cam + tempsHtml + ctlHtml + statsHtml + devHtml;
    }

    const alert = statuses.includes("error");
    this.shadowRoot.innerHTML = `${STYLE}<ha-card class="${themeClass(c.theme, this._hass)} ${alert ? "pc-alert" : ""}">
      <header><div class="brand"><ha-icon class="pc-icon" icon="${esc(c.icon || "mdi:printer-3d")}" style="color:${esc(c.icon_color || "var(--med-blue)")}"></ha-icon>
        <div><div class="title">${esc(title)}</div><div class="sub">${esc(sub)}</div></div></div></header>
      ${body}
    </ha-card>`;
    if (camShown) this._camMount(camShown);
    else this._camStop();
  }
}

/* ------------------------------------------------- appareil (commun aux deux cartes) */

/** Adresse IP (ou nom) d'une imprimante : page de configuration de l'appareil, sinon adresse IPP. */
const hostOf = (url) => { const m = /^[a-z][a-z0-9+.-]*:\/\/(\[[^\]]+\]|[^/:?#]+)/i.exec(String(url || "").trim()); return m ? m[1] : null; };

/**
 * Bloc « Appareil » : adresse IP avec lien vers la page de l'imprimante, micrologiciel, et mises à
 * jour proposées par l'intégration (entités update de l'appareil).
 */
function deviceBlock(hass, devIds, extraUrls = []) {
  const devs = devIds.map((id) => hass.devices?.[id]).filter(Boolean);
  const dev = devs.find((d) => d.configuration_url) || devs[0];
  if (!dev) return "";
  const url = /^https?:\/\//i.test(dev.configuration_url || "") ? dev.configuration_url : null;
  const host = hostOf(dev.configuration_url) || extraUrls.map(hostOf).find(Boolean) || null;
  const sw = devs.map((d) => d.sw_version).find(Boolean);
  const pills = [];
  if (host) {
    const inner = `<ha-icon icon="mdi:ip-network-outline"></ha-icon>Adresse <b>${esc(host)}</b>${url ? `<ha-icon class="po-ext" icon="mdi:open-in-new"></ha-icon>` : ""}`;
    pills.push(url ? `<a class="pc-x po-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer" title="Ouvrir la page de l'imprimante">${inner}</a>` : `<span class="pc-x">${inner}</span>`);
  }
  const ups = Object.entries(hass.entities || {}).filter(([id, e]) => id.startsWith("update.") && devIds.includes(e.device_id) && !e.hidden && hass.states?.[id]).map(([id]) => id);
  // version installée seule quand aucune entité de mise à jour ne la donne déjà
  if (sw && !ups.length) pills.push(`<span class="pc-x"><ha-icon icon="mdi:chip"></ha-icon>Micrologiciel <b>${esc(sw)}</b></span>`);
  for (const id of ups) {
    const st = hass.states?.[id];
    if (!st) continue;
    const a = st.attributes || {}, name = String(a.title || a.friendly_name || "").replace(dev.name_by_user || dev.name || "", "").trim();
    const what = name || "Micrologiciel";
    pills.push(st.state === "on"
      ? `<span class="pc-x po-upd" data-entity="${esc(id)}" title="Ouvrir pour installer la mise à jour"><ha-icon icon="mdi:package-up"></ha-icon>${esc(what)} : mise à jour <b>${esc(a.installed_version || "?")} → ${esc(a.latest_version || "?")}</b></span>`
      : `<span class="pc-x" data-entity="${esc(id)}"><ha-icon icon="mdi:check-circle-outline"></ha-icon>${esc(what)} <b>${esc(a.installed_version || "")}</b> à jour</span>`);
  }
  return pills.length ? `<div class="pc-sec"><div class="pc-h"><ha-icon icon="mdi:information-outline"></ha-icon>Appareil</div><div class="pc-xs">${pills.join("")}</div></div>` : "";
}

/* ------------------------------------------------------------------ style */

const STYLE = `<style>
:host {
  --med-bg: #1a2434; --med-surface: #212d40; --med-line: #2f3d55;
  --med-text: #e7edf5; --med-muted: #8fa0b8;
  --med-green: #96d21f; --med-blue: #1d93e3; --t-red: #ee4a4a; --med-down: #5fcf8a; --pc-warn: #f0a33a; --pc-hot: #f08a4b; --pc-light: #f7c948;
}
ha-card { display: block; background: var(--med-bg); color: var(--med-text); border: 1px solid var(--med-line); border-radius: 18px; overflow: hidden;
  padding-bottom: 12px; font-variant-numeric: tabular-nums; container-type: inline-size; }
ha-card.pc-alert { border-color: var(--t-red); }
header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 16px 18px 8px; }
.brand { display: flex; align-items: center; gap: 10px; min-width: 0; }
.pc-icon { --mdc-icon-size: 34px; width: 34px; height: 34px; flex: none; }
.title { font-size: 1.15rem; font-weight: 700; }
.sub { font-size: .78rem; color: var(--med-muted); }
.pc-tabs { display: flex; gap: 6px; padding: 2px 12px 0; overflow-x: auto; scrollbar-width: none; }
.pc-tab { all: unset; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 999px; white-space: nowrap;
  border: 1px solid var(--med-line); background: var(--med-surface); font-size: .82rem; font-weight: 600; }
.pc-tab small { color: var(--med-muted); font-weight: 500; }
.pc-tab.on { border-color: var(--med-blue); box-shadow: inset 0 -2px 0 var(--med-blue); }
.pc-tab:focus-visible { outline: 2px solid var(--med-blue); }
.pc-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; background: var(--med-muted); flex: none; }
.pc-dot.ok { background: var(--med-down); } .pc-dot.print { background: var(--med-blue); } .pc-dot.warn { background: var(--pc-warn); } .pc-dot.bad { background: var(--t-red); }
.pc-sec { margin: 12px 12px 0; }
.pc-h { display: flex; align-items: center; gap: 6px; font-size: .86rem; font-weight: 600; margin: 0 2px 8px; }
.pc-h ha-icon { --mdc-icon-size: 18px; color: var(--med-blue); }
.pc-state { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--med-line); background: var(--med-surface); cursor: pointer; }
.pc-state ha-icon { --mdc-icon-size: 26px; color: var(--med-muted); flex: none; }
.pc-state div { display: grid; min-width: 0; }
.pc-state b { font-size: .95rem; }
.pc-state span { font-size: .76rem; color: var(--med-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pc-state.ok ha-icon, .pc-state.ok b { color: var(--med-down); }
.pc-state.print { border-color: color-mix(in srgb, var(--med-blue) 55%, transparent); background: color-mix(in srgb, var(--med-blue) 10%, var(--med-surface)); }
.pc-state.print ha-icon, .pc-state.print b { color: var(--med-blue); }
.pc-state.warn { border-color: var(--pc-warn); } .pc-state.warn ha-icon, .pc-state.warn b { color: var(--pc-warn); }
.pc-state.bad { border-color: var(--t-red); background: color-mix(in srgb, var(--t-red) 12%, var(--med-surface)); } .pc-state.bad ha-icon, .pc-state.bad b { color: var(--t-red); }
.pc-job { display: flex; gap: 12px; padding: 10px; border-radius: 12px; border: 1px solid var(--med-line); background: var(--med-surface); cursor: pointer; }
.pc-thumb { width: 92px; height: 92px; border-radius: 10px; object-fit: contain; background: color-mix(in srgb, var(--med-text) 6%, transparent); flex: none; }
.pc-thumb.none { display: flex; align-items: center; justify-content: center; } .pc-thumb.none ha-icon { --mdc-icon-size: 40px; color: var(--med-muted); }
.pc-jb { flex: 1; min-width: 0; display: grid; gap: 6px; align-content: start; }
.pc-file { font-weight: 700; font-size: .9rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pc-prog { display: flex; align-items: center; gap: 8px; }
.pc-prog b { font-size: 1.05rem; white-space: nowrap; }
.pc-bar { flex: 1; height: 9px; border-radius: 6px; background: var(--med-line); overflow: hidden; }
.pc-bar i { display: block; height: 100%; border-radius: 6px; background: linear-gradient(90deg, var(--med-blue), var(--med-green)); }
.pc-bar.warn i { background: var(--pc-warn); } .pc-bar.bad i { background: var(--t-red); } .pc-bar.ok i { background: var(--med-down); }
.pc-kvs { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 2px 12px; }
.pc-kv { display: flex; justify-content: space-between; gap: 6px; font-size: .76rem; color: var(--med-muted); }
.pc-kv b { color: var(--med-text); font-weight: 600; white-space: nowrap; }
.pc-camw { border-radius: 12px; overflow: hidden; border: 1px solid var(--med-line); background: #000; cursor: pointer; }
.pc-cam { display: block; width: 100%; aspect-ratio: 16 / 9; object-fit: cover; }
.pc-ts { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px; }
.pc-t { padding: 10px 12px; border-radius: 12px; border: 1px solid var(--med-line); background: var(--med-surface); cursor: pointer; }
.pc-tt { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; font-size: .82rem; }
.pc-tt span { display: inline-flex; align-items: center; gap: 6px; color: var(--med-muted); }
.pc-tt ha-icon { --mdc-icon-size: 18px; color: var(--med-muted); }
.pc-t.hot .pc-tt ha-icon { color: var(--pc-hot); }
.pc-tt b { font-size: 1.15rem; } .pc-tt small { font-size: .74rem; color: var(--med-muted); font-weight: 500; }
.pc-tbar { height: 6px; border-radius: 6px; background: var(--med-line); margin: 8px 0 4px; overflow: hidden; }
.pc-tbar i { display: block; height: 100%; background: linear-gradient(90deg, #f7c948, var(--pc-hot)); border-radius: 6px; }
.pc-tn { font-size: .72rem; color: var(--med-muted); }
.pc-xs { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.pc-x { display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 999px; border: 1px solid var(--med-line); font-size: .74rem; color: var(--med-muted); cursor: pointer; }
.pc-x ha-icon { --mdc-icon-size: 15px; } .pc-x b { color: var(--med-text); }
.pc-btns { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 6px; }
.pc-btn { all: unset; box-sizing: border-box; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; min-height: 40px; padding: 6px 10px;
  border-radius: 12px; border: 1px solid var(--med-line); background: var(--med-surface); font-size: .8rem; font-weight: 600; text-align: center; }
.pc-btn ha-icon { --mdc-icon-size: 18px; flex: none; }
.pc-btn span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pc-outs { margin-top: 6px; }
.pc-btn:hover { border-color: var(--med-blue); } .pc-btn:focus-visible { outline: 2px solid var(--med-blue); }
.pc-btn.go { color: var(--med-down); border-color: color-mix(in srgb, var(--med-down) 45%, transparent); }
.pc-btn.warn { color: var(--pc-warn); border-color: color-mix(in srgb, var(--pc-warn) 45%, transparent); }
.pc-btn.bad { color: var(--t-red); border-color: color-mix(in srgb, var(--t-red) 40%, transparent); }
.pc-btn.tog.on { color: var(--pc-light); border-color: color-mix(in srgb, var(--pc-light) 45%, transparent); background: color-mix(in srgb, var(--pc-light) 10%, var(--med-surface)); }
.pc-btn.armed { color: var(--pc-warn); border-color: var(--pc-warn); background: color-mix(in srgb, var(--pc-warn) 18%, transparent); animation: pc-pulse 1s ease-in-out infinite; }
@keyframes pc-pulse { 50% { box-shadow: 0 0 0 3px color-mix(in srgb, var(--pc-warn) 30%, transparent); } }
.pc-ss { display: grid; grid-template-columns: repeat(auto-fit, minmax(96px, 1fr)); gap: 6px; }
.pc-s { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 10px 6px; border-radius: 12px; border: 1px solid var(--med-line); cursor: pointer; text-align: center; }
.pc-s ha-icon { --mdc-icon-size: 18px; color: var(--med-blue); } .pc-s b { font-size: .95rem; } .pc-s span { font-size: .72rem; color: var(--med-muted); }
a.po-link { text-decoration: none; color: var(--med-muted); }
a.po-link:hover { border-color: var(--med-blue); } a.po-link:focus-visible { outline: 2px solid var(--med-blue); }
.po-ext { --mdc-icon-size: 13px !important; opacity: .7; }
.pc-x.po-upd { color: var(--pc-warn); border-color: color-mix(in srgb, var(--pc-warn) 50%, transparent); }
.pc-x.po-upd b { color: var(--pc-warn); }
.empty { padding: 18px; display: flex; flex-direction: column; gap: 6px; font-size: .9rem; } .empty span { color: var(--med-muted); }
ha-card.th-ha {
  --med-bg: var(--ha-card-background, var(--card-background-color, #fff));
  --med-surface: color-mix(in srgb, var(--primary-text-color, #000) 5%, transparent);
  --med-line: var(--divider-color, rgba(127, 127, 127, .25));
  --med-text: var(--primary-text-color, #1f2937); --med-muted: var(--secondary-text-color, #6b7280);
  border-radius: var(--ha-card-border-radius, 12px);
  border: var(--ha-card-border-width, 1px) solid var(--ha-card-border-color, var(--divider-color, #e0e0e0));
}
ha-card.th-ha.light, ha-card.th-v2.light { --med-down: #1d8a4b; --med-green: #4c8a0b; --pc-warn: #b0640a; --pc-light: #8a6500; --t-red: #c62f2f; }
ha-card.th-v2.light { --med-bg: #ffffff; --med-surface: #f2f5f9; --med-line: #dbe2ec; --med-text: #1a2434; --med-muted: #5b6b82; --med-blue: #1673b8;
  box-shadow: 0 1px 3px rgba(26, 36, 52, .08); }
@media (prefers-reduced-motion: reduce) { .pc-btn.armed { animation: none; } }
@container (max-width: 360px) { .pc-job { flex-direction: column; } .pc-thumb { width: 100%; height: 140px; } }
</style>`;

/* ----------------------------------------------------------------- éditeur */

const SCHEMA = [
  { name: "title", selector: { text: {} } },
  { name: "icon", selector: { icon: {} } },
  { name: "icon_color", selector: { text: {} } },
  { name: "printers", selector: { device: { multiple: true, filter: [{ integration: "moonraker" }, { integration: "octoprint" }, { integration: "prusalink" }, { integration: "bambu_lab" }] } } },
  { name: "camera", selector: { entity: { domain: "camera" } } },
  { name: "camera_mode", selector: { select: { mode: "dropdown", options: [
    { value: "live", label: "Vidéo en direct" },
    { value: "snapshot", label: "Image par image (moins de réseau)" }] } } },
  { name: "camera_refresh", selector: { number: { min: 2, max: 60, mode: "box", unit_of_measurement: "s" } } },
  { name: "show_job", selector: { boolean: {} } },
  { name: "show_camera", selector: { boolean: {} } },
  { name: "show_temps", selector: { boolean: {} } },
  { name: "show_controls", selector: { boolean: {} } },
  { name: "show_stats", selector: { boolean: {} } },
  { name: "show_device", selector: { boolean: {} } },
  { name: "theme", selector: { select: { mode: "dropdown", options: [
    { value: "v2", label: "Style MyElectricalData (bleu nuit)" },
    { value: "auto", label: "Style MyElectricalData, clair ou sombre selon Home Assistant" },
    { value: "ha", label: "Thème Home Assistant (clair ou sombre)" }] } } },
];
const LABELS = {
  title: "Titre (vide = nom de l'imprimante, ou Imprimantes 3D)",
  icon: "Icône",
  icon_color: "Couleur de l'icône",
  printers: "Imprimantes affichées, dans cet ordre (vide = toutes)",
  camera: "Caméra (vide = celle de l'imprimante)",
  camera_mode: "Affichage de la caméra",
  camera_refresh: "Rafraîchissement en mode image par image",
  show_job: "Impression en cours",
  show_camera: "Caméra",
  show_temps: "Températures",
  show_controls: "Commandes (pause, reprise, annulation, arrêt d'urgence, lumières)",
  show_stats: "Statistiques",
  show_device: "Appareil (adresse IP, micrologiciel, mises à jour)",
  theme: "Couleurs de la carte",
};
class PrintersCardEditor extends HTMLElement {
  setConfig(config) { this._config = { ...config }; this._draw(); }
  set hass(hass) { this._hass = hass; if (this._form) this._form.hass = hass; else this._draw(); }
  _draw() {
    if (!this._hass || !this._config) return;
    if (!this._form) {
      this._form = document.createElement("ha-form");
      this._form.computeLabel = (s) => LABELS[s.name] || s.name;
      this._form.addEventListener("value-changed", (ev) => {
        this._config = { ...ev.detail.value };
        this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: this._config }, bubbles: true, composed: true }));
      });
      this.appendChild(this._form);
    }
    this._form.hass = this._hass;
    this._form.schema = SCHEMA;
    this._form.data = { ...DEFAULTS, ...this._config };
  }
}

/* =================================================== imprimantes de bureau */

/*
 * Carte Imprimantes de bureau (custom:printers-office-card) : une imprimante par onglet, état et
 * message (bourrage, plus de papier, capot ouvert…), niveaux d'encre ou de toner, pièces d'usure
 * (tambour, unité de fixation, courroie…), compteurs de pages et durée depuis le dernier démarrage.
 *
 * Intégrations reconnues : IPP (HP, Epson, Canon, Brother, CUPS…), Brother, et les intégrations
 * HACS qui exposent des niveaux d'encre (Epson Workforce, HP Printer…).
 */
const OFFICE_PLATFORMS = { ipp: "IPP", brother: "Brother", epson_workforce: "Epson", epsonworkforce: "Epson", hpprinter: "HP", hp_printer: "HP" };
/** Rôle d'une entité : clé de traduction de l'intégration, sinon fin de son nom (anglais ou français). */
const OFFICE_KEYS = {
  printer: "status", status: "status", page_counter: "pages", bw_pages: "bw", color_pages: "color",
  duplex_unit_page_counter: "duplex", last_restart: "uptime", uptime: "uptime", marker: "supply",
};
const OFFICE_RE = [
  ["pages", /_(page_counter|pages_total|total_pages|compteur_de_pages|nombre_de_pages)$/],
  ["bw", /_(bw_pages|bw_counter|pages_noir_et_blanc|pages_n_b|black_and_white_pages)$/],
  ["color", /_(color_pages|color_counter|pages_couleur)$/],
  ["duplex", /_(duplex_unit_page_counter|duplex_unit_pages_counter|pages_recto_verso)$/],
  ["uptime", /_(last_restart|uptime|dernier_redemarrage|temps_de_fonctionnement)$/],
  ["status", /_(status|statut|etat|state)$/],
];
/** Consommables (encre, toner) et pièces d'usure (tambour, unité de fixation…). */
const SUPPLY_RE = /(toner|ink|encre|cartridge|cartouche|marker)/;
const PART_RE = /(drum|tambour|fuser|fixation|belt|courroie|laser|pf_kit|kit|maintenance|waste|recup|clean)/;
const officeRole = (id, e) => {
  const domain = id.split(".")[0];
  if (domain !== "sensor") return null;
  const tk = e?.translation_key || "";
  if (/_remaining_life$|_remaining_pages$|_page_counter$/.test(tk) && PART_RE.test(tk)) return /_life$/.test(tk) ? "part" : null;
  if (/(_toner|_ink)_remaining$/.test(tk)) return "supply";
  if (OFFICE_KEYS[tk]) return OFFICE_KEYS[tk];
  const name = id.split(".")[1];
  if (PART_RE.test(name) && /(remaining|life|restant|duree|vie|%)/.test(name)) return /pages/.test(name) ? null : "part";
  for (const [role, re] of OFFICE_RE) if (re.test(id)) return role;
  if (SUPPLY_RE.test(name)) return "supply";
  return null;
};
/** Couleur et libellé d'un consommable d'après son nom. */
const INKS = [
  [/photo[_ ]?(black|noir)/, "#3a3a3a", "Noir photo"], [/(black|noir|\bbk\b|_k$|_bk_)/, "#1b1b1b", "Noir"],
  [/(light[_ ]?cyan|cyan[_ ]?clair)/, "#7fd6f5", "Cyan clair"], [/cyan/, "#00a3e0", "Cyan"],
  [/(light[_ ]?magenta|magenta[_ ]?clair)/, "#f5a0d4", "Magenta clair"], [/magenta/, "#e5007e", "Magenta"],
  [/(yellow|jaune)/, "#ffd400", "Jaune"], [/(tri[_ -]?colou?r|colou?r|couleur|cmy)/, "linear-gradient(90deg, #00a3e0 0 33.3%, #e5007e 0 66.6%, #ffd400 0)", "Couleur"],
  [/(grey|gray|gris)/, "#8a8a8a", "Gris"], [/(red|rouge)/, "#d7263d", "Rouge"], [/(blue|bleu)/, "#2251cc", "Bleu"],
];
const inkOf = (s) => {
  const t = String(s || "").toLowerCase();
  const m = INKS.find(([re]) => re.test(t));
  return m ? { color: m[1], label: m[2] } : { color: "var(--med-muted)", label: null };
};
const PARTS = [
  [/drum|tambour/, "Tambour", "mdi:cylinder"], [/fuser|fixation/, "Unité de fixation", "mdi:fire"], [/belt|courroie/, "Courroie", "mdi:transit-connection-horizontal"],
  [/laser/, "Laser", "mdi:laser-pointer"], [/pf_kit|kit/, "Kit papier", "mdi:tray-full"], [/waste|recup|clean|maintenance/, "Réservoir de maintenance", "mdi:delete-variant"],
];
/** Raisons IPP (printer-state-reasons) et états Brother les plus courants, en français. */
const REASONS = [
  [/media[-_ ]?(empty|needed)|paper[-_ ]?(out|empty)|no[-_ ]?paper|plus de papier/i, "Plus de papier", "bad"],
  [/media[-_ ]?jam|paper[-_ ]?jam|jam|bourrage/i, "Bourrage papier", "bad"],
  [/(cover|door)[-_ ]?open|capot/i, "Capot ouvert", "bad"],
  [/(toner|marker[-_ ]?supply|ink)[-_ ]?(empty)|replace[-_ ]?(toner|ink)|remplacer/i, "Consommable vide : à remplacer", "bad"],
  [/(toner|marker[-_ ]?supply|ink)[-_ ]?low|low[-_ ]?(toner|ink)|bas/i, "Encre ou toner bas", "warn"],
  [/offline|hors[-_ ]?ligne|connecting/i, "Hors ligne", "off"],
  [/sleep|veille|power[-_ ]?sav/i, "En veille", "ok"],
];
const OFFICE_STATE = {
  idle: ["Prête", "mdi:printer-check", "ok"], printing: ["Impression en cours", "mdi:printer", "print"], sleep: ["En veille", "mdi:printer-pos-sleep-outline", "ok"],
  stopped: ["Arrêtée", "mdi:printer-off", "warn"], error: ["Erreur", "mdi:printer-alert", "bad"], offline: ["Hors ligne", "mdi:printer-off-outline", "off"],
};
const officeNorm = (s) => {
  const t = String(s ?? "").trim().toLowerCase();
  if (!t || t === "unavailable" || t === "unknown") return "offline";
  if (/^(idle|ready|prêt|prete|prête|en attente|waiting)/.test(t)) return "idle";
  if (/print|impression|copy|copie|scan|busy|warming|préchauffage|prechauffage|processing/.test(t)) return "printing";
  if (/sleep|veille|deep sleep|power save/.test(t)) return "sleep";
  if (/stopped|arrêt|arret|paused|pause/.test(t)) return "stopped";
  if (/error|erreur|jam|bourrage|no paper|cover|replace|attention/.test(t)) return "error";
  return "idle";
};

const OFFICE_DEFAULTS = {
  title: "", icon: "mdi:printer", icon_color: "",
  low_level: 15, // % : seuil d'alerte des consommables
  show_supplies: true, show_parts: true, show_counters: true, show_device: true,
  theme: "v2",
};

class PrintersOfficeCard extends HTMLElement {
  static getConfigElement() {
    return document.createElement("printers-office-card-editor");
  }

  static getStubConfig() {
    return {};
  }

  setConfig(config) {
    this._config = { ...OFFICE_DEFAULTS, ...(config || {}) };
    this._map = null;
    this._sig = null;
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    if (!this._clicks) {
      this.shadowRoot.addEventListener("click", (this._clicks = (ev) => {
        const tab = ev.target.closest?.("[data-tab]");
        if (tab) {
          this._tab = tab.dataset.tab;
          try { localStorage.setItem("printers-office-card:tab", JSON.stringify(this._tab)); } catch (e) { /* stockage indisponible */ }
          this._sig = null; this._render(); return;
        }
        const el = ev.target.closest?.("[data-entity]");
        if (el?.dataset.entity) {
          const e = new Event("hass-more-info", { bubbles: true, composed: true });
          e.detail = { entityId: el.dataset.entity };
          this.dispatchEvent(e);
        }
      }));
    }
    this._render();
  }

  set hass(hass) {
    if (this._hass?.entities !== hass.entities || this._hass?.devices !== hass.devices) this._map = null;
    this._hass = hass;
    this._render();
  }

  getCardSize() {
    return 6;
  }

  _st(id) {
    return id ? this._hass?.states?.[id] : undefined;
  }

  _num(id) {
    const s = this._st(id);
    if (!s || s.state === "unavailable" || s.state === "unknown" || s.state === "") return null;
    const v = Number(s.state);
    return Number.isFinite(v) ? v : null;
  }

  /** Imprimantes : une par appareil (une imprimante vue par IPP et par Brother reste deux appareils). */
  _resolve() {
    if (this._map) return this._map;
    const hass = this._hass, c = this._config, devs = hass.devices || {};
    const byDev = {};
    for (const [id, e] of Object.entries(hass.entities || {})) {
      if (e.hidden || !e.device_id) continue;
      const known = !!OFFICE_PLATFORMS[e.platform];
      const role = officeRole(id, e);
      if (!role || (!known && role !== "supply")) continue;
      const d = (byDev[e.device_id] ||= { id: e.device_id, platform: e.platform, roles: {}, supplies: [], parts: [] });
      if (known) d.known = true;
      if (role === "supply") d.supplies.push(id);
      else if (role === "part") d.parts.push(id);
      else d.roles[role] ||= id;
    }
    // un appareil inconnu n'est retenu que s'il a des niveaux d'encre en %
    let list = Object.values(byDev).filter((d) => d.known || d.supplies.some((id) => /%/.test(this._st(id)?.attributes?.unit_of_measurement || "")));
    for (const d of list) {
      const dev = devs[d.id] || {};
      d.name = dev.name_by_user || dev.name || OFFICE_PLATFORMS[d.platform] || "Imprimante";
      d.model = [dev.manufacturer, dev.model].filter(Boolean).filter((v, i, a) => a.findIndex((x) => x.toLowerCase() === v.toLowerCase()) === i).join(" ");
    }
    const want = (Array.isArray(c.printers) ? c.printers : c.printers ? [c.printers] : []).map((x) => (typeof x === "object" ? x : { device: x }));
    if (want.length) {
      list = want.map((w) => {
        const d = list.find((x) => x.id === w.device || x.name.toLowerCase() === String(w.device || "").toLowerCase());
        return d ? { ...d, name: w.name || d.name } : null;
      }).filter(Boolean);
    } else list.sort((a, b) => a.name.localeCompare(b.name, "fr"));
    this._map = list;
    return list;
  }

  /** État, message et sévérité d'une imprimante. */
  _status(p) {
    const s = this._st(p.roles.status);
    if (!s && !p.supplies.some((id) => this._num(id) !== null)) return { key: "offline", msg: null, cls: "off" };
    const a = s?.attributes || {};
    let key = s ? officeNorm(s.state) : "idle";
    // Raisons IPP (printer-state-reasons) : le suffixe donne la gravité. « -report » n'est qu'une information
    // (ex. bac photo vide alors que le bac principal a du papier) : ignorée. « -warning » : à surveiller.
    // « -error » ou sans suffixe : erreur seulement si l'imprimante est arrêtée, sinon à surveiller.
    const tokens = [a.state_reason, s && officeNorm(s.state) === "error" ? s.state : null]
      .flatMap((x) => (Array.isArray(x) ? x : String(x ?? "").split(/[\s,;]+/))).map((x) => String(x).trim()).filter((x) => x && x !== "none");
    let reason = null, sev = 0;
    for (const t of tokens) {
      const r = REASONS.find(([re]) => re.test(t));
      if (!r) continue;
      const level = /-report$/i.test(t) ? 0 : /-warning$/i.test(t) ? 1 : r[2] === "bad" ? 2 : r[2] === "warn" ? 1 : 0;
      if (level > sev || (!reason && level === 0 && r[2] === "ok")) { reason = [r[1], level === 2 ? "bad" : level === 1 ? "warn" : r[2]]; sev = level; }
    }
    // message libre de l'imprimante (state_message), sans gravité propre
    const freeMsg = a.state_message && a.state_message !== "none" ? String(a.state_message) : null;
    if (!reason && freeMsg) { const r = REASONS.find(([re]) => re.test(freeMsg)); if (r) reason = [r[1], r[2] === "bad" ? "warn" : r[2]]; }
    let msg = reason ? reason[0] : freeMsg;
    let cls = OFFICE_STATE[key][2];
    if (reason) {
      const stopped = key === "stopped" || key === "error";
      if (reason[1] === "bad" && key !== "offline" && (stopped || tokens.some((t) => /-error$/i.test(t)) && key !== "idle")) { key = key === "printing" ? key : "error"; cls = "bad"; }
      else if ((reason[1] === "bad" || reason[1] === "warn") && key !== "offline") cls = cls === "bad" ? cls : "warn";
      else if (reason[1] === "ok" && key === "idle") key = "sleep";
    }
    if (key === "offline") cls = "off";
    return { key, msg, cls };
  }

  _supplies(p) {
    const low = Number(this._config.low_level) || 15;
    return p.supplies.map((id) => {
      const s = this._st(id), v = this._num(id);
      if (!s || v === null) return null;
      const name = (s.attributes?.friendly_name || id).replace(new RegExp(`^${p.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*`, "i"), "");
      const ink = inkOf(`${id} ${name}`);
      const lowAt = Number(s.attributes?.marker_low_level) || low;
      const kind = /toner/i.test(`${id} ${name}`) ? "toner" : "encre";
      return { id, v: Math.max(0, Math.min(100, v)), color: ink.color, label: ink.label || name.replace(/_/g, " "), kind, low: v <= lowAt, empty: v <= 2 };
    }).filter(Boolean).sort((a, b) => INKS.findIndex(([, c]) => c === a.color) - INKS.findIndex(([, c]) => c === b.color));
  }

  _render() {
    if (!this._config || !this._hass || !this.shadowRoot) return;
    const c = this._config, list = this._resolve();
    if (this._tab === undefined) { try { this._tab = JSON.parse(localStorage.getItem("printers-office-card:tab") || "null"); } catch (e) { this._tab = null; } }
    const infos = list.map((x) => ({ st: this._status(x), sup: this._supplies(x) }));
    // onglet choisi, sinon la première imprimante en alerte
    const alertOf = (i) => infos[i].st.cls === "bad" || infos[i].sup.some((s) => s.low);
    let idx = list.findIndex((x) => x.id === this._tab);
    if (idx < 0) idx = Math.max(0, list.findIndex((x, i) => alertOf(i)));
    const p = list[idx];
    const ids = list.flatMap((x) => [...Object.values(x.roles), ...x.supplies, ...x.parts]);
    const sig = `${c.theme}|${this._hass.themes?.darkMode}|${p?.id}|` + ids.map((id) => { const s = this._st(id); return `${s?.state}${s?.attributes?.state_reason || ""}`; }).join("|");
    if (sig === this._sig) return;
    this._sig = sig;

    const nAlert = list.filter((x, i) => alertOf(i)).length;
    const title = c.title || (list.length === 1 ? list[0].name : "Imprimantes");
    // une seule imprimante : son modèle (l'état est juste en dessous)
    const sub = !list.length ? "" : list.length === 1 ? (list[0].model && list[0].model.toLowerCase() !== list[0].name.toLowerCase() ? list[0].model : "")
      : `${list.length} imprimantes · ${nAlert ? `${nAlert} à surveiller` : "tout va bien"}`;

    let body = "";
    if (!p) {
      body = `<div class="empty">Aucune imprimante trouvée<span>Ajoutez l'intégration Internet Printing Protocol (IPP) ou Brother, puis rechargez la page.</span></div>`;
    } else {
      const { st, sup } = infos[idx], r = p.roles;
      const tabs = list.length > 1 ? `<div class="pc-tabs" role="tablist">${list.map((x, i) => {
        const dot = alertOf(i) ? (infos[i].st.cls === "bad" ? "bad" : "warn") : infos[i].st.cls === "off" ? "" : infos[i].st.key === "printing" ? "print" : "ok";
        return `<button class="pc-tab ${i === idx ? "on" : ""}" role="tab" aria-selected="${i === idx}" data-tab="${esc(x.id)}"><i class="pc-dot ${dot}"></i>${esc(x.name)}</button>`;
      }).join("")}</div>` : "";

      const [label, icon] = OFFICE_STATE[st.key];
      const lowOnes = sup.filter((s) => s.low);
      const note = st.msg || (lowOnes.length ? `${lowOnes.map((s) => s.label).join(", ")} : ${lowOnes.some((s) => s.empty) ? "à remplacer" : "bientôt vide"}` : p.model && p.model.toLowerCase() !== p.name.toLowerCase() ? p.model : null);
      const stateCls = st.cls === "ok" && lowOnes.length ? "warn" : st.cls;
      const state = `<div class="pc-sec"><div class="pc-state ${stateCls === "off" ? "" : stateCls}" data-entity="${esc(r.status || sup[0]?.id || "")}">
        <ha-icon icon="${icon}"></ha-icon><div><b>${label}</b>${note ? `<span>${esc(note)}</span>` : ""}</div></div></div>`;

      // --- encre ou toner : une jauge verticale par couleur
      const kind = sup.every((s) => s.kind === "toner") ? "Toner" : sup.every((s) => s.kind === "encre") ? "Encre" : "Encre et toner";
      const supHtml = c.show_supplies !== false && sup.length ? `<div class="pc-sec"><div class="pc-h"><ha-icon icon="mdi:water-outline"></ha-icon>${kind}</div>
        <div class="po-inks">${sup.map((s) => `<div class="po-ink ${s.low ? "low" : ""}" data-entity="${esc(s.id)}" title="${esc(s.label)} : ${fmt(s.v)} %">
          <div class="po-tank"><i style="height:${s.v}%;background:${s.color}"></i></div>
          <b>${fmt(s.v)} %</b><span>${esc(s.label)}</span>${s.low ? `<em>${s.empty ? "À remplacer" : "Bas"}</em>` : ""}</div>`).join("")}</div></div>` : "";

      // --- pièces d'usure
      const parts = c.show_parts !== false ? p.parts.map((id) => {
        const v = this._num(id);
        if (v === null) return "";
        const name = `${id} ${this._st(id)?.attributes?.friendly_name || ""}`.toLowerCase();
        const [, plabel, picon] = PARTS.find(([re]) => re.test(name)) || [null, (this._st(id)?.attributes?.friendly_name || id).replace(p.name, "").trim(), "mdi:cog-outline"];
        const ink = inkOf(name);
        // tambour par couleur (imprimantes laser couleur) : « Tambour cyan »
        const label2 = ink.label && /drum|tambour/.test(name) && /(black|cyan|magenta|yellow|noir|jaune)/.test(name) ? `${plabel} ${ink.label.toLowerCase()}` : plabel;
        const lowp = v <= (Number(c.low_level) || 15);
        return `<div class="po-part ${lowp ? "low" : ""}" data-entity="${esc(id)}"><ha-icon icon="${picon}"></ha-icon><span>${esc(label2)}</span>
          <div class="pc-bar ${lowp ? "warn" : "ok"}"><i style="width:${Math.max(0, Math.min(100, v))}%"></i></div><b>${fmt(v)} %</b></div>`;
      }).filter(Boolean) : [];
      const partsHtml = parts.length ? `<div class="pc-sec"><div class="pc-h"><ha-icon icon="mdi:cogs"></ha-icon>Pièces d'usure</div><div class="po-parts">${parts.join("")}</div></div>` : "";

      // --- compteurs et durée de fonctionnement
      const stat = (id, ic, lab, v) => (v === null || v === undefined ? "" : `<div class="pc-s" data-entity="${esc(id)}"><ha-icon icon="${ic}"></ha-icon><b>${esc(v)}</b><span>${lab}</span></div>`);
      let up = null;
      const ups = this._st(r.uptime)?.state;
      if (ups && Number.isNaN(Number(ups)) && !Number.isNaN(Date.parse(ups))) up = dur((Date.now() - Date.parse(ups)) / 1000);
      else if (this._num(r.uptime) !== null) up = dur(this._num(r.uptime));
      const counters = c.show_counters !== false ? [
        stat(r.pages, "mdi:file-document-multiple-outline", "Pages", this._num(r.pages) === null ? null : fmt(this._num(r.pages))),
        stat(r.bw, "mdi:file-document-outline", "Noir et blanc", this._num(r.bw) === null ? null : fmt(this._num(r.bw))),
        stat(r.color, "mdi:palette-outline", "Couleur", this._num(r.color) === null ? null : fmt(this._num(r.color))),
        stat(r.duplex, "mdi:book-open-page-variant-outline", "Recto verso", this._num(r.duplex) === null ? null : fmt(this._num(r.duplex))),
        stat(r.uptime, "mdi:power", "Allumée depuis", up),
      ].filter(Boolean) : [];
      const countHtml = counters.length ? `<div class="pc-sec"><div class="pc-h"><ha-icon icon="mdi:counter"></ha-icon>Compteurs</div><div class="pc-ss">${counters.join("")}</div></div>` : "";

      const uri = this._st(r.status)?.attributes?.uri_supported;
      const devHtml = c.show_device !== false ? deviceBlock(this._hass, [p.id], Array.isArray(uri) ? uri : String(uri || "").split(/[,\s]+/)) : "";
      body = tabs + state + supHtml + partsHtml + countHtml + devHtml;
    }

    const alert = infos.some((x) => x.st.cls === "bad");
    this.shadowRoot.innerHTML = `${STYLE}${OFFICE_STYLE}<ha-card class="${themeClass(c.theme, this._hass)} ${alert ? "pc-alert" : ""}">
      <header><div class="brand"><ha-icon class="pc-icon" icon="${esc(c.icon || "mdi:printer")}" style="color:${esc(c.icon_color || "var(--med-blue)")}"></ha-icon>
        <div><div class="title">${esc(title)}</div><div class="sub">${esc(sub)}</div></div></div></header>
      ${body}
    </ha-card>`;
  }
}

const OFFICE_STYLE = `<style>
.po-inks { display: grid; grid-template-columns: repeat(auto-fit, minmax(64px, 1fr)); gap: 8px; }
.po-ink { display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 10px 4px 8px; border-radius: 12px; border: 1px solid var(--med-line);
  background: var(--med-surface); cursor: pointer; text-align: center; position: relative; }
.po-ink.low { border-color: var(--pc-warn); }
.po-tank { width: 26px; height: 64px; border-radius: 7px; background: var(--med-line); overflow: hidden; display: flex; align-items: flex-end;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--med-text) 12%, transparent); }
.po-tank i { display: block; width: 100%; border-radius: 0 0 6px 6px; }
.po-ink b { font-size: .95rem; margin-top: 4px; }
.po-ink span { font-size: .72rem; color: var(--med-muted); }
.po-ink em { font-style: normal; font-size: .66rem; font-weight: 700; color: var(--pc-warn); text-transform: uppercase; letter-spacing: .03em; }
.po-parts { display: grid; gap: 6px; }
.po-part { display: grid; grid-template-columns: 20px minmax(90px, 1fr) 2fr auto; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 12px;
  border: 1px solid var(--med-line); background: var(--med-surface); cursor: pointer; font-size: .8rem; }
.po-part ha-icon { --mdc-icon-size: 18px; color: var(--med-muted); }
.po-part.low { border-color: var(--pc-warn); } .po-part.low ha-icon { color: var(--pc-warn); }
.po-part .pc-bar { height: 7px; }
.po-part b { min-width: 42px; text-align: right; }
</style>`;

const OFFICE_SCHEMA = [
  { name: "title", selector: { text: {} } },
  { name: "icon", selector: { icon: {} } },
  { name: "icon_color", selector: { text: {} } },
  { name: "printers", selector: { device: { multiple: true, filter: [{ integration: "ipp" }, { integration: "brother" }] } } },
  { name: "low_level", selector: { number: { min: 1, max: 50, mode: "box", unit_of_measurement: "%" } } },
  { name: "show_supplies", selector: { boolean: {} } },
  { name: "show_parts", selector: { boolean: {} } },
  { name: "show_counters", selector: { boolean: {} } },
  { name: "show_device", selector: { boolean: {} } },
  SCHEMA.find((s) => s.name === "theme"),
];
const OFFICE_LABELS = {
  title: "Titre (vide = nom de l'imprimante, ou Imprimantes)",
  icon: "Icône",
  icon_color: "Couleur de l'icône",
  printers: "Imprimantes affichées, dans cet ordre (vide = toutes)",
  low_level: "Alerte quand l'encre ou le toner descend sous",
  show_supplies: "Encre et toner",
  show_parts: "Pièces d'usure (tambour, unité de fixation…)",
  show_counters: "Compteurs de pages",
  show_device: "Appareil (adresse IP, micrologiciel, mises à jour)",
  theme: "Couleurs de la carte",
};
class PrintersOfficeCardEditor extends PrintersCardEditor {
  _draw() {
    if (!this._hass || !this._config) return;
    if (!this._form) {
      this._form = document.createElement("ha-form");
      this._form.computeLabel = (s) => OFFICE_LABELS[s.name] || s.name;
      this._form.addEventListener("value-changed", (ev) => {
        this._config = { ...ev.detail.value };
        this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: this._config }, bubbles: true, composed: true }));
      });
      this.appendChild(this._form);
    }
    this._form.hass = this._hass;
    this._form.schema = OFFICE_SCHEMA;
    this._form.data = { ...OFFICE_DEFAULTS, ...this._config };
  }
}

if (typeof customElements !== "undefined") {
  if (!customElements.get("printers-card")) customElements.define("printers-card", PrintersCard);
  if (!customElements.get("printers-card-editor")) customElements.define("printers-card-editor", PrintersCardEditor);
  window.customCards = window.customCards || [];
  if (!window.customCards.some((c) => c.type === "printers-card")) {
    window.customCards.push({
      type: "printers-card",
      name: "Carte Imprimantes 3D",
      description: "État, impression en cours, caméra, températures, commandes et statistiques des imprimantes 3D (Moonraker, OctoPrint, PrusaLink, Bambu Lab).",
      preview: true,
    });
  }
  if (!customElements.get("printers-office-card")) customElements.define("printers-office-card", PrintersOfficeCard);
  if (!customElements.get("printers-office-card-editor")) customElements.define("printers-office-card-editor", PrintersOfficeCardEditor);
  if (!window.customCards.some((c) => c.type === "printers-office-card")) {
    window.customCards.push({
      type: "printers-office-card",
      name: "Carte Imprimantes de bureau",
      description: "État, encre ou toner, pièces d'usure et compteurs de pages des imprimantes de bureau (IPP, Brother).",
      preview: true,
    });
  }
  console.info(`%c PRINTERS-CARD %c ${CARD_VERSION} `, "background:#96d21f;color:#1a2434;font-weight:700", "background:#1d93e3;color:#fff");
}
})();
