import { BACKUP_LIMIT, RECORD_LIMIT, RECORD_TYPES, bilirubinAverage, makeBackup, quoteCSV, validateBackup } from "./backup.js";

(() => {
  "use strict";

  // 保留旧数据库名，确保改名后已记录的数据无需迁移。
  const DB_NAME = "xiaoman-baby-journal-demo-v1";
  const STORE = "snapshots";
  const STORAGE_KEY = "primary";
  const TYPE_LABELS = {
    bottle: "喂奶", diaper: "尿布", bilirubin: "黄疸",
    temperature: "体温", weight: "体重", medication: "用药"
  };
  const ICONS = {
    home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v6l4 2"/>',
    heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/>',
    settings: '<path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="m19.4 15 .1.1 1.4 1.1-1.5 2.7-1.8-.5a8 8 0 0 1-2.2 1.3l-.3 1.9h-3.1l-.4-1.9a8 8 0 0 1-2.2-1.3l-1.8.5-1.5-2.7 1.4-1.1a8 8 0 0 1 0-2.6l-1.4-1.1 1.5-2.7 1.8.5a8 8 0 0 1 2.2-1.3L12 6h3.1l.3 1.9a8 8 0 0 1 2.2 1.3l1.8-.5 1.5 2.7-1.4 1.1a8 8 0 0 1-.1 2.5Z" transform="translate(-1.5 -1.6) scale(.98)"/>',
    bottle: '<path d="M9 3h6v4H9z"/><path d="M8.5 7h7l1 3.2v9A2 2 0 0 1 14.5 21h-5A2 2 0 0 1 7.5 19.2v-9z"/><path d="M10 3V2h4v1M8 14h8M11 17h2"/>',
    diaper: '<path d="M4 5c2.8-1.3 5.3-1.3 8 0 2.7-1.3 5.2-1.3 8 0v9c0 4-3.6 7-8 7s-8-3-8-7z"/><path d="M4 12h4l2 3h4l2-3h4"/><path d="M8 5v6M16 5v6"/>',
    bilirubin: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    temperature: '<path d="M10 14.4V5a3 3 0 0 1 6 0v9.4a5 5 0 1 1-6 0Z"/><path d="M13 8v10"/><circle cx="13" cy="18" r="1.5"/>',
    weight: '<rect x="3" y="5" width="18" height="15" rx="3"/><path d="M8.5 10.5a4 4 0 0 1 7 0M12 11l2-2"/><path d="M7 17h10"/>',
    medication: '<path d="M9.8 4.1a5 5 0 0 1 7.1 7.1l-5.7 5.7a5 5 0 1 1-7.1-7.1z"/><path d="m7 7 10 10"/>',
    moon: '<path d="M20.1 14A8.3 8.3 0 0 1 10 3.9 8.5 8.5 0 1 0 20.1 14Z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    arrow: '<path d="M5 12h14m-7-7 7 7-7 7"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>',
    close: '<path d="M18 6 6 18M6 6l12 12"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L9 17l-4 1 1-4Z"/>',
    trash: '<path d="M3 6h18m-2 0-.8 14H5.8L5 6m4 0V4h6v2M10 10v7m4-7v7"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8m-8 4h8"/>',
    download: '<path d="M12 3v12m-4-4 4 4 4-4M5 17v4h14v-4"/>',
    upload: '<path d="M12 20V8m-4 4 4-4 4 4M5 7V3h14v4"/>',
    baby: '<circle cx="12" cy="13" r="8"/><path d="M10 5c0-2 1-3 3-3a2 2 0 0 1 0 4M8.5 12h.01M15.5 12h.01M9.5 16a4 4 0 0 0 5 0"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 11v5M12 8h.01"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    check: '<path d="m4 12 5 5L20 6"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>'
  };
  const app = { data: null, db: null, tab: "today", filter: "all", milkDay: "", milkPeriod: 7, toastTimer: null, saving: false,
    storageUnavailable: false, picker: null, sheetTrigger: null };
  let renderedHomeDay = "", midnightTimer;

  function svg(name, extra = "") {
    return `<svg class="icon ${extra}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ICONS.info}</svg>`;
  }
  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[char]));
  }
  const id = () => typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID() : `r_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const nowISO = () => new Date().toISOString();
  const pad = (n) => String(n).padStart(2, "0");
  function localInput(iso = nowISO()) {
    if (!iso) return "";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
  function localToISO(value) {
    if (typeof value !== "string" || !value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime()) || localInput(date).slice(0, 16) !== value.slice(0, 16)) return null;
    return date.toISOString();
  }
  function formatTime(iso) {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "--:--" : `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function formatShortDate(iso) {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "暂无" : `${d.getMonth()+1}月${d.getDate()}日 ${formatTime(iso)}`;
  }
  function dayKey(iso) {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "" : `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  }
  function dayTitle(iso) {
    const d = new Date(iso);
    const today = dayKey(nowISO()), yesterday = dayKey(new Date(Date.now() - 864e5).toISOString());
    const key = dayKey(iso);
    if (key === today) return "今天";
    if (key === yesterday) return "昨天";
    return `${d.getMonth()+1}月${d.getDate()}日`;
  }
  function hoursSinceBirth(iso) {
    if (!iso) return null;
    const born = new Date(app.data?.profile?.born_at || "").getTime();
    const when = new Date(iso).getTime();
    if (!Number.isFinite(born) || !Number.isFinite(when)) return null;
    return when < born ? null : Math.floor((when - born) / 36e5);
  }
  function babyDay(today) {
    const birthday = dayKey(app.data.profile.born_at || "");
    if (!birthday) return "—";
    // Compare local calendar dates, regardless of birth time or daylight saving.
    const days = (Date.parse(today+"T00:00:00Z") - Date.parse(birthday+"T00:00:00Z")) / 864e5;
    return Math.max(1, days + 1);
  }
  function refreshHomeDate() {
    clearTimeout(midnightTimer);
    const now = new Date();
    if (app.tab === "today" && dayKey(now) !== renderedHomeDay) render();
    const nextMidnight = new Date(now);
    nextMidnight.setHours(24, 0, 0, 0);
    midnightTimer = setTimeout(refreshHomeDate, nextMidnight - now);
  }
  function hasProfile() {
    return typeof app.data.profile.nickname === "string" && !!app.data.profile.nickname.trim() &&
      !!app.data.profile.born_at && Number.isFinite(Date.parse(app.data.profile.born_at));
  }
  function emptyData() {
    return {
      version: 1,
      profile: { nickname: "", born_at: null, gestational_weeks: "", gestational_days: "", birth_weight_g: "" },
      settings: { dark: false, last_export_at: null },
      records: []
    };
  }

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  function readSnapshot() {
    return new Promise((resolve, reject) => {
      const req = app.db.transaction(STORE, "readonly").objectStore(STORE).get(STORAGE_KEY);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  function persist(snapshot) {
    return new Promise((resolve, reject) => {
      const tx = app.db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      const incoming = store.get(STORAGE_KEY);
      let conflict = false;
      incoming.onsuccess = () => {
        if (incoming.result?.storage_revision !== app.data.storage_revision) {
          conflict = true;
          tx.abort();
        } else {
          store.put(snapshot, STORAGE_KEY);
        }
      };
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(conflict
        ? new Error("该网页已在其他窗口更新，请重新打开后再试") : new Error("本机写入失败"));
    });
  }
  async function saveAndRender(next, message, {close = false, tab, resetHistory = false, failure = "未能保存，原有数据仍保留。"} = {}) {
    if (app.saving) return false;
    if (app.storageUnavailable || !app.db) {
      showToast("本机存储不可用，无法保存。请重新打开后再试。");
      return false;
    }
    app.saving = true;
    const snapshot = {...next, storage_revision:id()};
    try {
      await persist(snapshot);
    } catch (err) {
      showToast(failure + (err?.message || ""));
      return false;
    } finally {
      app.saving = false;
    }
    app.data = snapshot;
    if (close) closeSheet();
    if (tab) {
      app.tab = tab;
      app.filter = "all";
    }
    if (tab || resetHistory) {
      app.milkDay = "";
      document.getElementById("view").scrollTop = 0;
    }
    render();
    if (message) showToast(message);
    return true;
  }
  function liveRecords() {
    return (app.data?.records || []).filter((r) => !r.deleted_at)
      .sort((a,b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());
  }
  function displayRecords() {
    const records = liveRecords();
    const batches = new Map();
    for (const record of records) {
      if (record.type !== "bilirubin" || record.payload.readings) continue;
      const {method, unit, site, note, measurement_group} = record.payload;
      // Match the numbered readings in older text imports. Same-time readings alone are not evidence of a batch.
      const match = /^同次测量的第 ([1-4])\/4 个读数(?:，原记录未注明测量部位)?。(?:\n([\s\S]*))?$/.exec(note || "");
      if (!match) continue;
      const key = JSON.stringify([record.occurred_at,method,unit,site || "",measurement_group || ""]);
      if (!batches.has(key)) batches.set(key,[]);
      batches.get(key).push({record,position:Number(match[1]),note:match[2] || ""});
    }
    const grouped = new Map();
    const hidden = new Set();
    for (const batch of batches.values()) {
      if (batch.length !== 4 || new Set(batch.map(entry=>entry.position)).size !== 4) continue;
      batch.sort((a,b)=>a.position-b.position);
      const readings = batch.map(entry=>entry.record.payload.value);
      const value = bilirubinAverage(readings);
      if (value === null) continue;
      const first = batch[0].record;
      const groupIds = batch.map(entry=>entry.record.record_id);
      const note = [...new Set(batch.map(entry=>entry.note).filter(Boolean))].join("\n");
      grouped.set(first.record_id,{...first,groupIds,payload:{...first.payload,readings,value,note}});
      for (const recordId of groupIds.slice(1)) hidden.add(recordId);
    }
    return records.filter(record=>!hidden.has(record.record_id)).map(record=>grouped.get(record.record_id) || record);
  }
  function findRecord(recordId) {
    const record = app.data.records.find(r=>r.record_id===recordId && !r.deleted_at);
    return record?.type === "bilirubin" ? displayRecords().find(r=>r.record_id===recordId) : record;
  }
  function milkByDay(records) {
    const days = new Map();
    for (const {type,occurred_at,payload} of records) {
      if (type !== "bottle") continue;
      const date = dayKey(occurred_at);
      if (!days.has(date)) days.set(date,{total:0,count:0});
      const day = days.get(date);
      day.total += Number(payload.amount_ml) || 0;
      day.count += 1;
    }
    return days;
  }
  function formatMilk(total) {
    return Number(total.toFixed(2));
  }
  function bilirubinValue(payload) {
    return bilirubinAverage(payload.readings) ?? payload.value ?? "—";
  }
  function bilirubinAmount(payload) {
    return (payload.readings ? "平均 " : "") + bilirubinValue(payload) + (payload.unit ? " " + payload.unit : "");
  }
  function titleFor(r) {
    if (r.type === "bottle") return "喂奶";
    if (r.type === "diaper") return "更换尿布";
    if (r.type === "bilirubin") return "黄疸测量";
    if (r.type === "temperature") return "体温测量";
    if (r.type === "weight") return "体重测量";
    return "实际用药";
  }
  function detailFor(r) {
    const p = r.payload || {};
    if (r.type === "bottle") {
      const milk = { expressed:"瓶喂母乳", formula:"配方奶", mixed:"混合奶" }[p.milk_type] || "瓶喂";
      const hmf = p.has_fortifier ? " · 已添加增强剂" : "";
      return `${milk} · ${p.amount_ml ?? "—"} ml${hmf}`;
    }
    if (r.type === "diaper") return ({ wet:"小便", dirty:"大便", both:"小便＋大便" })[p.kind] || "尿布";
    if (r.type === "bilirubin") return `${p.method || "—"} · ${bilirubinAmount(p)}`;
    if (r.type === "temperature") return `${p.value ?? "—"} ℃${p.site ? " · "+p.site : ""}`;
    if (r.type === "weight") return `${p.value ?? "—"} ${p.unit || "g"}`;
    if (r.type === "medication") return `${p.name || "未命名"} · ${p.dose ?? "—"} ${p.unit || ""}`;
    return "";
  }
  function iconBlock(type) { return `<span class="record-icon ${type}">${svg(type)}</span>`; }
  function renderNav() {
    const tabs = [["today","home","今天"],["records","history","记录"],["health","heart","健康"],["settings","settings","设置"]];
    document.getElementById("bottom-nav").innerHTML = tabs.map(([value, iconName, label]) =>
      `<button type="button" class="nav-button ${app.tab === value ? "active" : ""}" data-tab="${value}" aria-current="${app.tab === value ? "page" : "false"}">${svg(iconName)}<span>${label}</span></button>`
    ).join("");
  }
  function homeRow(r) {
    return `<div class="activity-row">${iconBlock(r.type)}<div class="activity-main">
      <div class="activity-top"><span class="activity-label">${titleFor(r)}</span><span class="activity-time">${dayTitle(r.occurred_at)} ${formatTime(r.occurred_at)}</span></div>
      <div class="activity-details">${escapeHtml(detailFor(r))}</div>
    </div><button type="button" class="row-trailing" data-action="record-edit" data-id="${escapeHtml(r.record_id)}" aria-label="编辑${titleFor(r)}">${svg("chevron","icon-sm")}</button></div>`;
  }
  function renderToday(records) {
    const d = new Date();
    const today = renderedHomeDay = dayKey(d);
    const feed = milkByDay(records).get(today) || {total:0,count:0};
    const diapers = records.filter(r=>r.type === "diaper" && dayKey(r.occurred_at) === today).length;
    const recent = records.slice(0,4);
    const nickname = escapeHtml(app.data.profile.nickname || "宝宝");
    const ready = hasProfile();
    const weekday = ["星期日","星期一","星期二","星期三","星期四","星期五","星期六"][d.getDay()];
    return `<section class="screen-enter">
      <div class="screen-title"><div><div class="eyebrow">${d.getMonth()+1}月${d.getDate()}日 · ${weekday}</div><h1>早安，妈妈</h1></div><button class="subtle-action" data-action="profile">${svg("edit","icon-sm")}宝宝资料</button></div>
      <div class="hero-card"><div class="hero-top"><div><span class="eyebrow">今天是新的照护日</span>
        <div class="hero-title">${ready ? `${nickname} · 第 ${babyDay(today)} 天` : nickname}</div>
        <p class="hero-sub">${ready ? "记录好每一次喂养和测量" : "请填写宝宝昵称和准确出生时间；已有备份可到设置导入。"}</p></div><div class="avatar-baby">${svg("baby","icon-xl")}</div></div>
        <div class="metric-row">
          <div class="metric"><span class="metric-label">今日奶量</span><span class="metric-number">${formatMilk(feed.total)}<small>ml</small></span></div>
          <div class="metric"><span class="metric-label">喂奶次数</span><span class="metric-number">${feed.count}<small>次</small></span></div>
          <div class="metric"><span class="metric-label">尿布</span><span class="metric-number">${diapers}<small>次</small></span></div>
        </div>
        <button type="button" class="subtle-action milk-history-link" data-action="milk-history">历史奶量 ${svg("arrow","icon-sm")}</button>
      </div>
      <div class="section-heading"><h2>照护记录</h2><span class="hint">查看历史 · 添加记录</span></div>
      <div class="action-grid">
        ${[["bottle","blue"],["diaper","sage"],["bilirubin","apricot"],["temperature","lavender"]].map(([kind,color])=>{
          const latest = records.find(record=>record.type===kind);
          const p = latest?.payload || {};
          const summary = !latest ? "暂无记录" : kind==="bottle" ? `${p.amount_ml} ml${p.has_fortifier ? " · 已加增强剂" : ""}` :
            kind==="diaper" ? detailFor(latest)+(p.color ? " · "+p.color : "") :
            kind==="bilirubin" ? bilirubinAmount(p) : `${p.value} ℃`;
          return `<button type="button" class="action-tile tile-${color}" data-action="record-history" data-kind="${kind}"><span class="tile-icon">${svg(kind)}</span><strong>${TYPE_LABELS[kind]}</strong>${svg("chevron","tile-arrow icon-sm")}
            <small class="tile-value">${escapeHtml(summary)}</small>${latest ? `<small class="tile-time">${dayTitle(latest.occurred_at)} ${formatTime(latest.occurred_at)}</small>` : ""}</button>`;
        }).join("")}
      </div>
      <div class="section-heading"><h2>最近记录</h2><button type="button" class="subtle-action" data-tab="records">查看全部 ${svg("arrow","icon-sm")}</button></div>
      <div class="activity-list">${recent.length ? recent.map(homeRow).join("") : '<div class="empty-state"><strong>还没有记录</strong>从上面选择一个入口开始吧</div>'}</div>
    </section>`;
  }
  function recordLine(r) {
    return `<div class="record-line">${iconBlock(r.type)}<div class="record-copy"><div class="name">${titleFor(r)}</div>
      <div class="description">${escapeHtml(detailFor(r))}</div>
      <div class="clock">${formatTime(r.occurred_at)}${r.payload.note ? " · "+escapeHtml(r.payload.note) : ""}</div></div>
      <div class="line-menu"><button type="button" data-action="record-edit" data-id="${escapeHtml(r.record_id)}" aria-label="编辑">${svg("edit","icon-sm")}</button>
      <button type="button" data-action="record-delete" data-id="${escapeHtml(r.record_id)}" aria-label="删除">${svg("trash","icon-sm")}</button></div></div>`;
  }
  function milkTrendMarkup(totals, endDay, period) {
    const end = new Date(endDay+"T12:00:00");
    const days = Array.from({length:period},(_,index)=>{
      const date = new Date(end);
      date.setDate(end.getDate() + index - period + 1);
      const key = dayKey(date);
      return {key,label:`${date.getMonth()+1}/${date.getDate()}`,total:totals.get(key)?.total};
    });
    const available = days.filter(day=>day.total !== undefined);
    const first = days[0].label;
    const last = days.at(-1).label;
    return `<section class="trend-card milk-trend" aria-labelledby="milk-trend-title">
      <div class="milk-trend-head">
        <h2 id="milk-trend-title">每日总奶量</h2>
        <div class="milk-period" role="group" aria-label="折线图时间范围">
          ${[7,30].map(count=>`<button type="button" class="filter-chip" data-action="milk-period" data-days="${count}" aria-pressed="${period===count}">${count} 天</button>`).join("")}
        </div>
      </div>
      <p class="milk-trend-range">${first} 至 ${last} · ml</p>
      ${available.length ? milkTrendPlot(days,available) : "<p class='milk-trend-empty'>这段时间没有喂奶记录</p>"}
    </section>`;
  }
  function milkTrendPlot(days, available) {
    const left=35, right=296, top=11, bottom=109;
    const peak = Math.max(10,...available.map(day=>day.total));
    const step = 10 ** Math.floor(Math.log10(peak));
    const ceiling = Math.ceil(peak/step)*step;
    const plotY = total => bottom - (total/ceiling)*(bottom-top);
    const plotX = index => left + (index/(days.length-1))*(right-left);
    const path = days.map((day,index)=>{
      if (day.total === undefined) return "";
      // Start a new segment after an unrecorded day.
      const command = days[index-1]?.total === undefined ? "M" : "L";
      return `${command}${plotX(index).toFixed(2)} ${plotY(day.total).toFixed(2)}`;
    }).join(" ");
    const ticks = [ceiling,ceiling/2,0].map(total=>{
      const y = plotY(total);
      return `<line x1="${left}" x2="${right}" y1="${y}" y2="${y}"/>
        <text x="${left-6}" y="${y+4}" text-anchor="end">${formatMilk(total)}</text>`;
    });
    const dateLabels = [0,Math.floor(days.length/2),days.length-1].map((index,i)=>
      `<text x="${plotX(index)}" y="130" text-anchor="${["start","middle","end"][i]}">${days[index].label}</text>`);
    const marks = days.map((day,index)=>day.total === undefined ? "" :
      `<circle cx="${plotX(index)}" cy="${plotY(day.total)}" r="${days.length===7?4:3}">
        <title>${day.label} · ${formatMilk(day.total)} ml</title></circle>`).join("");
    const summary = available.map(day=>`${day.label} ${formatMilk(day.total)} 毫升`).join("，");
    const hasGaps = available.length < days.length;
    return `<figure class="milk-trend-plot">
      <svg viewBox="0 0 310 136" role="img" aria-label="每日总奶量折线" aria-describedby="milk-trend-values">
        <desc id="milk-trend-values">${summary}${hasGaps?"。无记录的日期留空。":""}</desc>
        ${ticks.join("")}
        ${dateLabels.join("")}
        <path d="${path}"/>
        ${marks}
      </svg>
      ${hasGaps ? "<figcaption>无记录的日期留空</figcaption>" : ""}
    </figure>`;
  }
  function renderRecords(records) {
    const chips = [["all","全部"],...RECORD_TYPES.map((t) => [t,TYPE_LABELS[t]])];
    const recordKind = RECORD_TYPES.includes(app.filter) ? app.filter : null;
    const showingMilk = app.filter === "bottle";
    const list = records.filter(r=>(app.filter === "all" || r.type === app.filter) &&
      (!showingMilk || !app.milkDay || dayKey(r.occurred_at) === app.milkDay));
    const dailyMilk = milkByDay(records);
    let html = "", last = null;
    for (const r of list) {
      const key = dayKey(r.occurred_at);
      if (key !== last) {
        if (last !== null) html += "</div>";
        const milk = (app.filter === "all" || showingMilk) && dailyMilk.get(key);
        html += `<div class="date-heading"><span>${dayTitle(r.occurred_at)} · ${key}</span>
          ${milk ? `<span class="daily-milk">奶量 ${formatMilk(milk.total)} ml · ${milk.count} 次</span>` : ""}</div><div class="list-card">`;
        last = key;
      }
      html += recordLine(r);
    }
    if (last !== null) html += "</div>";
    const missing = showingMilk && app.milkDay ? "这天没有喂奶记录" : recordKind ? `暂无${TYPE_LABELS[recordKind]}记录` : "暂无这类记录";
    const empty = showingMilk && !app.milkDay ? "" : `<div class="activity-list"><div class="empty-state">
      ${svg("history","icon-xl")}<strong>${missing}</strong>
      ${recordKind ? "" : "选择记录类型后可添加记录"}</div></div>`;
    const today = dayKey(nowISO());
    const chartEnd = app.milkDay || dailyMilk.keys().next().value || today;
    return `<section class="screen-enter"><div class="screen-title"><div><div class="eyebrow">可补记 · 可修改 · 可撤销</div><h1>${showingMilk ? "历史奶量" : recordKind ? TYPE_LABELS[recordKind]+"记录" : "记录时间线"}</h1></div></div>
      <div class="filter-chips">${chips.map(([k,l])=>`<button type="button" class="filter-chip ${app.filter===k?"active":""}" data-filter="${k}" aria-pressed="${app.filter===k}">${l}</button>`).join("")}</div>
      ${showingMilk ? `<div class="milk-date-filter"><label class="form-field"><span>按日期查看</span>
        <input type="date" class="field-input" id="milk-date" value="${escapeHtml(app.milkDay)}" max="${today}"/></label>
        ${app.milkDay ? '<button type="button" class="subtle-action" data-action="milk-date-clear">全部日期</button>' : ""}</div>` : ""}
      ${showingMilk ? milkTrendMarkup(dailyMilk,chartEnd,app.milkPeriod) : ""}
      ${html || empty}
      ${recordKind ? `<div class="history-add"><button type="button" class="form-submit" data-action="new-record" data-kind="${recordKind}">${svg("plus","icon-sm")}添加${TYPE_LABELS[recordKind]}记录</button></div>` : ""}
    </section>`;
  }
  function healthCard(type, label, value, note) {
    return `<div class="health-card">${iconBlock(type)}<span class="health-title">${label}</span>
      <span class="health-value">${value || "暂无记录"}</span>
      <span class="health-time">${note || "点击右上角添加"}</span>
      <button type="button" class="health-add" data-action="new-record" data-kind="${type}" aria-label="新增${label}">${svg("plus","icon-sm")}</button>
    </div>`;
  }
  function trendMarkup(type, records) {
    const values = records.filter((r) => r.type === type &&
      (type !== "weight" || ["g","kg"].includes(r.payload.unit))).reverse().map((r) => {
      const raw = Number(r.payload.value);
      return { v: type === "weight" && r.payload.unit === "kg" ? raw*1000 : raw, when:r.occurred_at };
    }).filter((o) => Number.isFinite(o.v));
    if (values.length < 2) return '<p>再记录几次后，这里会显示变化趋势。</p>';
    const arr = values.slice(-8), min = Math.min(...arr.map(o=>o.v)), max=Math.max(...arr.map(o=>o.v));
    const spread = max-min || 1;
    const points = arr.map((o,i) => ({ x: 15 + i*(280/(arr.length-1)), y: 65-((o.v-min)/spread)*42 }));
    const path = points.map((p,i)=>`${i===0?"M":"L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
    return `<div class="trend-box"><svg role="img" viewBox="0 0 310 86" aria-label="历史数值趋势"><path class="chart-grid" d="M10 64H300 M10 22H300"/><path d="${path}"/>${points.map(p=>`<circle cx="${p.x}" cy="${p.y}" r="4.7"/>`).join("")}</svg></div>`;
  }
  function renderHealth(records) {
    const newest = type => records.find(r=>r.type===type);
    const temp=newest("temperature"), bili=newest("bilirubin"), weight=newest("weight"), med=newest("medication");
    return `<section class="screen-enter">
      <div class="screen-title"><div><div class="eyebrow">记录实际情况 · 方便就诊核对</div><h1>宝宝健康</h1></div></div>
      <div class="health-grid">
        ${healthCard("bilirubin","最近黄疸",bili ? `${bili.payload.readings ? "<small>平均</small> " : ""}${escapeHtml(bilirubinValue(bili.payload))} <small>${escapeHtml(bili.payload.unit)}</small>` : "",bili ? `${escapeHtml(bili.payload.method)} · ${formatShortDate(bili.occurred_at)}` : "")}
        ${healthCard("temperature","最近体温",temp ? `${escapeHtml(temp.payload.value)} <small>℃</small>` : "",temp ? formatShortDate(temp.occurred_at) : "")}
        ${healthCard("weight","最近体重",weight ? `${escapeHtml(weight.payload.value)} <small>${escapeHtml(weight.payload.unit)}</small>` : "",weight ? formatShortDate(weight.occurred_at) : "")}
        ${healthCard("medication","最近用药",med ? `<small>${escapeHtml(med.payload.name)}</small>` : "",med ? formatShortDate(med.occurred_at) : "")}
      </div>
      <div class="trend-card"><h3>体重变化</h3>${trendMarkup("weight",records)}</div>
    </section>`;
  }
  function settingsRow(iconName,label,description,right,action) {
    return `<button type="button" class="settings-row" data-action="${action}"><span class="settings-icon">${svg(iconName,"icon-sm")}</span>
      <span class="settings-label">${label}<small>${description}</small></span>
      <span class="settings-right">${right || svg("chevron","icon-sm")}</span></button>`;
  }
  function renderSettings() {
    const p=app.data.profile, backup=app.data.settings.last_export_at;
    const subtitle = p.born_at ? `出生于 ${formatShortDate(p.born_at)}` : "填写宝宝资料";
    return `<section class="screen-enter"><div class="screen-title"><div><div class="eyebrow">单人使用 · 当前 iPhone</div><h1>设置与备份</h1></div></div>
      <div class="section-heading"><h2>宝宝资料</h2></div>
      <div class="settings-card">${settingsRow("baby",escapeHtml(p.nickname||"宝宝"),subtitle,"","profile")}</div>
      <div class="section-heading"><h2>使用偏好</h2></div>
      <div class="settings-card">${settingsRow("moon","夜间低眩光模式","适合夜间单手记录",`<span class="toggle ${app.data.settings.dark ? "on" : ""}"></span>`,"theme")}</div>
      <div class="section-heading"><h2>数据导入与导出</h2><span class="hint">单人本机记录</span></div>
      <div class="settings-card">
        ${settingsRow("download","导出完整数据（JSON）","宝宝资料和所有记录，换手机可恢复",svg("chevron","icon-sm"),"export-json")}
        ${settingsRow("upload","导入备份数据（JSON）","选择之前的备份文件，恢复完整数据",svg("chevron","icon-sm"),"import-json")}
        ${settingsRow("file","导出表格（CSV）","全部记录和明细，可用 Excel 查看",svg("chevron","icon-sm"),"export-csv")}
      </div>
      <div class="settings-card">${settingsRow("history","上次发起 JSON 导出",backup ? formatShortDate(backup) : "尚未发起过完整备份导出",'<span class="pill-note">'+(backup ? "请核对文件" : "建议备份")+'</span>',"export-json")}</div>
    </section>`;
  }
  function render() {
    if (!app.data) return;
    document.body.classList.toggle("dark",!!app.data.settings.dark);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content",app.data.settings.dark?"#17252b":"#f8f6f1");
    document.getElementById("theme-icon").innerHTML=svg(app.data.settings.dark?"sun":"moon","icon-sm");
    const sections={today:renderToday,records:renderRecords,health:renderHealth,settings:renderSettings};
    const warning = app.storageUnavailable ? '<div class="demo-banner" role="alert">本机存储不可用，已有记录可能暂时无法显示。请重新打开网页再试。</div>' : "";
    document.getElementById("view").innerHTML=warning+(sections[app.tab]||renderToday)(displayRecords());
    renderNav();
  }
  function switchTab(tab) {
    if (!["today","records","health","settings"].includes(tab)) return;
    app.tab=tab;
    document.getElementById("view").scrollTop=0;
    render();
  }
  function showToast(message,actionLabel="",actionFn=null) {
    clearTimeout(app.toastTimer);
    const root=document.getElementById("toast-root");
    root.innerHTML=`<div class="toast"><span>${escapeHtml(message)}</span>${actionFn?`<button type="button" id="toast-undo">${escapeHtml(actionLabel)}</button>`:""}</div>`;
    if (actionFn) document.getElementById("toast-undo").addEventListener("click",()=>{ root.innerHTML=""; actionFn(); });
    app.toastTimer=setTimeout(()=>{root.innerHTML="";},4200);
  }

  function field(label,name,value="",type="text",opts={}) {
    const required=opts.required?"required":"", placeholder=opts.placeholder ? `placeholder="${escapeHtml(opts.placeholder)}"` : "";
    const min=opts.min!==undefined?`min="${opts.min}"`:"",step=opts.step!==undefined?`step="${opts.step}"`:"";
    const input=type==="textarea"
      ? `<textarea class="field-input" name="${name}" ${placeholder} ${required} rows="2">${escapeHtml(value)}</textarea>`
      : `<input class="field-input" type="${type}" name="${name}" value="${escapeHtml(value)}" ${placeholder} ${min} ${step} ${required} ${type==="number"?"inputmode=decimal":""}/>`;
    return `<label class="form-field"><span>${label}${opts.help ? `<small>${opts.help}</small>`:""}</span>${input}</label>`;
  }
  function choice(name,selected,options,cols=3) {
    return `<div class="choice-group ${cols===2?"choice-two":""}" data-choice-group="${name}">${options.map(([value,label])=>`<label class="choice-pill ${selected===value?"selected":""}"><input type="radio" name="${name}" value="${escapeHtml(value)}" ${selected===value?"checked":""}/>${escapeHtml(label)}</label>`).join("")}</div>`;
  }
  function optionsFor(choices, selected) {
    const list = selected && !choices.some(([value])=>value===selected) ? [...choices,[selected,selected]] : choices;
    return list.map(([value,label])=>`<option value="${escapeHtml(value)}" ${value===selected?"selected":""}>${escapeHtml(label)}</option>`).join("");
  }
  function timeField(when) { return field("发生时间","occurred_at",localInput(when),"datetime-local",{required:true}); }
  function bilirubinReadingRow(value, index) {
    return `<div class="bilirubin-reading">${field(`第 ${index+1} 次`,"reading",value,"number",{min:0,step:"any"})}
      <button type="button" class="reading-remove" data-action="reading-remove" aria-label="移除第 ${index+1} 次测量">${svg("close","icon-sm")}</button></div>`;
  }
  function updateBilirubinReadings() {
    const rows = [...document.querySelectorAll(".bilirubin-reading")];
    rows.forEach((row,index)=>{
      row.querySelector(".form-field > span").textContent = `第 ${index+1} 次`;
      const remove = row.querySelector(".reading-remove");
      remove.setAttribute("aria-label",`移除第 ${index+1} 次测量`);
      remove.disabled = rows.length === 1;
    });
    const inputs = rows.map(row=>row.querySelector("input"));
    const readings = inputs.map(input=>input.value).filter(value=>value.trim() !== "");
    const average = inputs.every(input=>input.validity.valid) ? bilirubinAverage(readings) : null;
    document.getElementById("bilirubin-average").textContent = average ?? "—";
    document.getElementById("bilirubin-count").textContent = `（已填 ${readings.length} 次）`;
  }
  function sheetHeader(title,sub) {
    return `<div class="sheet-handle"></div><div class="sheet-head"><div><h2>${title}</h2><p>${sub}</p></div><button type="button" class="close-button" data-action="close-sheet" aria-label="关闭">${svg("close","icon-sm")}</button></div>`;
  }
  function sheetMarkup(kind,record) {
    const p=record?.payload||{}, when=record?.occurred_at||nowISO(), edit=!!record;
    const editId=escapeHtml(record?.record_id || "");
    if (kind==="bottle") {
      const amount=edit?p.amount_ml:"";
      return `${sheetHeader(edit?"编辑喂奶记录":"记录一次喂奶","填入实际喝入量 · 母乳增强剂每次单独确认")}
        <form id="record-form" data-kind="bottle" data-edit="${editId}">
          <div class="form-field"><span>奶的类型</span>${choice("milk_type",p.milk_type||"expressed",[["expressed","瓶喂母乳"],["formula","配方奶"],["mixed","混合奶"]])}</div>
          <label class="form-field"><span>实际喝入量 <small>毫升 ml</small></span><div class="input-suffix"><input class="field-input" id="milk-amount" type="number" name="amount_ml" value="${escapeHtml(amount)}" min="0" max="1500" step="1" required inputmode="numeric" placeholder="例如 45"/><span>ml</span></div></label>
          <div class="quick-amounts">${[30,45,60,75,90,120].map(n=>`<button type="button" class="amount-btn ${Number(amount)===n?"selected":""}" data-amount="${n}">${n} ml</button>`).join("")}</div>
          <label class="switch-row"><span><strong>本次是否添加母乳增强剂</strong><small>默认不添加，按实际情况记录</small></span><input type="checkbox" name="has_fortifier" id="fortifier-check" ${p.has_fortifier?"checked":""}/><span class="switch-ui" aria-hidden="true"></span></label>
          ${timeField(when)}
          ${field("本次备注","note",p.note||"","textarea",{placeholder:"如吐奶、特殊情况（可选）"})}
          <button class="form-submit" type="submit">${svg("check","icon-sm")}保存喂奶记录</button>
        </form>`;
    }
    if (kind==="diaper") {
      return `${sheetHeader(edit?"编辑尿布记录":"记录一次尿布","一键选小便 / 大便 / 都有")}
        ${edit?"":`<div class="diaper-options">${[["wet","小便"],["dirty","大便"],["both","都有"]].map(([v,l])=>`<button type="button" class="diaper-option" data-diaper-quick="${v}">${svg("diaper")}${l}</button>`).join("")}</div>
        <button class="secondary-button" type="button" data-action="diaper-detail">补记时间或填写更多信息</button>`}
        <form id="record-form" data-kind="diaper" data-edit="${editId}" ${edit?"":"hidden"} class="${edit?"":"diaper-detail-form"}">
          <div class="form-field"><span>尿布类型</span>${choice("kind",p.kind||"wet",[["wet","小便"],["dirty","大便"],["both","都有"]])}</div>
          ${timeField(when)}
          ${field("颜色/状态（可选）","color",p.color||"","text",{placeholder:"例如 黄绿色"})}
          ${field("备注","note",p.note||"","textarea",{placeholder:"不需要可以留空"})}
          <button class="form-submit" type="submit">${svg("check","icon-sm")}保存尿布记录</button>
        </form>`;
    }
    if (kind==="bilirubin") {
      const readings = p.readings || [p.value ?? ""];
      return `${sheetHeader(edit?"编辑黄疸记录":"记录黄疸检测","保留检测方式、原始单位和测量时间")}
        <form id="record-form" data-kind="bilirubin" data-edit="${editId}">
          <div class="form-field"><span>检测方式</span>${choice("method",p.method||"TcB",[["TcB","经皮 TcB"],["TSB","血清 TSB"]],2)}</div>
          <fieldset class="bilirubin-values" id="bilirubin-values">
            <legend>测量读数</legend>
            <div id="bilirubin-readings">${readings.map(bilirubinReadingRow).join("")}</div>
            <button type="button" class="secondary-button reading-add" data-action="reading-add">${svg("plus","icon-sm")}添加一次测量</button>
            <div class="age-help">平均值 <output id="bilirubin-average" aria-live="polite">${bilirubinAverage(readings) ?? "—"}</output><span id="bilirubin-count"></span></div>
          </fieldset>
          <label class="form-field"><span>原始单位</span><select class="field-input" name="unit">${optionsFor([["μmol/L","μmol/L"],["mg/dL","mg/dL"]],p.unit)}</select></label>
          ${timeField(when)}
          <div class="age-help">根据宝宝出生时间推算，当前选择的测量时间约为生后 <strong id="age-hours">${hoursSinceBirth(when)??"—"}</strong> 小时</div>
          ${field("检测部位 / 机构（可选）","site",p.site||"","text",{placeholder:"例如 额头、医院"})}
          ${field("备注","note",p.note||"","textarea",{placeholder:"可记录报告说明"})}
          <button class="form-submit" type="submit">${svg("check","icon-sm")}保存黄疸记录</button>
        </form>`;
    }
    if (kind==="temperature") {
      return `${sheetHeader(edit?"编辑体温记录":"记录一次体温","填写温度、测量部位和时间")}
        <form id="record-form" data-kind="temperature" data-edit="${editId}">
          <label class="form-field"><span>测量温度 <small>摄氏度 ℃</small></span><div class="input-suffix"><input class="field-input" type="number" name="value" value="${escapeHtml(p.value??"")}" min="25" max="45" step="0.1" required inputmode="decimal" placeholder="输入温度"/><span>℃</span></div></label>
          ${timeField(when)}
          <label class="form-field"><span>测量部位</span><select class="field-input" name="site">${optionsFor(["腋下","额头","耳部","其他"].map(s=>[s,s]),p.site)}</select></label>
          ${field("备注","note",p.note||"","textarea",{placeholder:"测量方式或其他信息"})}
          <button class="form-submit" type="submit">${svg("check","icon-sm")}保存体温记录</button>
        </form>`;
    }
    if (kind==="weight") {
      return `${sheetHeader(edit?"编辑体重记录":"记录一次体重","查看随日龄变化的趋势")}
        <form id="record-form" data-kind="weight" data-edit="${editId}">
          <div class="field-row">${field("实际体重","value",p.value??"","number",{required:true,min:0,step:"any",placeholder:"按秤填写"})}
            <label class="form-field"><span>单位</span><select class="field-input" name="unit">${optionsFor([["g","g 克"],["kg","kg 千克"]],p.unit)}</select></label></div>
          ${timeField(when)}
          ${field("备注","note",p.note||"","textarea",{placeholder:"例如 测量地点、着衣情况"})}
          <button class="form-submit" type="submit">${svg("check","icon-sm")}保存体重记录</button>
        </form>`;
    }
    if (kind==="medication") {
      return `${sheetHeader(edit?"编辑实际用药":"记录实际用药","填写药物名称、剂量和给药时间")}
        <form id="record-form" data-kind="medication" data-edit="${editId}">
          ${field("药物名称","name",p.name||"","text",{required:true,placeholder:"按医嘱或实际药品填写"})}
          <div class="field-row">${field("实际剂量","dose",p.dose??"","number",{required:true,min:0,step:"any",placeholder:"实际数值"})}
            ${field("剂量单位","unit",p.unit||"","text",{required:true,placeholder:"例如 ml / mg / 滴"})}</div>
          ${timeField(when)}
          ${field("给药方式（可选）","route",p.route||"","text",{placeholder:"例如 口服"})}
          ${field("备注 / 医嘱信息","note",p.note||"","textarea")}
          <button class="form-submit" type="submit">${svg("check","icon-sm")}保存实际给药记录</button>
        </form>`;
    }
    return "";
  }

  function showSheet(title, content) {
    app.sheetTrigger = document.activeElement;
    document.getElementById("sheet-root").innerHTML=`<div class="sheet-layer" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
      <div class="sheet-backdrop" data-action="close-sheet"></div><div class="sheet-panel" tabindex="-1">${content}</div></div>`;
    document.getElementById("app-shell").inert = true;
    syncSheetViewport();
    document.querySelector(".sheet-panel").focus({preventScroll:true});
  }
  function syncSheetViewport() {
    const viewport = window.visualViewport;
    const layer = document.querySelector(".sheet-layer");
    if (!layer || !viewport || viewport.scale !== 1) return;
    layer.style.setProperty("--sheet-top", viewport.offsetTop + "px");
    layer.style.setProperty("--sheet-height", viewport.height + "px");
  }
  function openSheet(kind,recordId="") {
    const record=recordId ? findRecord(recordId) : null;
    if (recordId && !record) return;
    const isProfile=kind==="profile";
    const content=isProfile ? profileForm() : sheetMarkup(kind,record);
    if (!content) return;
    showSheet(isProfile?"宝宝资料":TYPE_LABELS[kind]||"记录", content);
    const form=document.getElementById("record-form")||document.getElementById("profile-form");
    if (form) form.addEventListener("submit", isProfile ? submitProfile : submitRecord);
    if (kind === "bilirubin") {
      document.getElementById("bilirubin-readings").addEventListener("input",updateBilirubinReadings);
      updateBilirubinReadings();
    }
    const timeInput=document.querySelector('#record-form input[name="occurred_at"]');
    const updateAge=e=>{
      const d=document.getElementById("age-hours"); if(d) d.textContent=String(hoursSinceBirth(localToISO(e.target.value))??"—");
    };
    timeInput?.addEventListener("input",updateAge);
    timeInput?.addEventListener("change",updateAge);
  }
  function closeSheet() {
    document.getElementById("sheet-root").innerHTML="";
    document.getElementById("app-shell").inert = false;
    app.sheetTrigger?.focus({preventScroll:true});
    app.sheetTrigger = null;
  }
  function profileForm() {
    const p=app.data.profile;
    return `${sheetHeader("宝宝资料","用于自动计算日龄和黄疸测量时的生后小时数")}
      <form id="profile-form">
        ${field("宝宝昵称","nickname",p.nickname||"","text",{required:true,placeholder:"宝宝的小名"})}
        ${field("准确出生日期和时间","born_at",localInput(p.born_at),"datetime-local",{required:true})}
        <div class="field-row">${field("胎龄 · 周（可选）","gestational_weeks",p.gestational_weeks||"","number",{min:20,step:1})}
          ${field("胎龄 · 天（可选）","gestational_days",p.gestational_days||"","number",{min:0,step:1})}</div>
        ${field("出生体重 · g（可选）","birth_weight_g",p.birth_weight_g||"","number",{min:0,step:1})}
        <button type="submit" class="form-submit">${svg("check","icon-sm")}保存资料</button>
      </form>`;
  }
  async function submitProfile(event) {
    event.preventDefault();
    const f=new FormData(event.currentTarget);
    const previous = app.data.profile;
    const nickname = String(f.get("nickname") || "").trim().slice(0,35);
    const entered = f.get("born_at");
    const born = previous.born_at && entered === localInput(previous.born_at) ? previous.born_at : localToISO(entered);
    if (!nickname || !born) return showToast("请填写宝宝昵称和有效的出生日期时间");
    if (new Date(born).getTime()>Date.now()) return showToast("出生时间不能晚于现在");
    const profile={
      ...previous, nickname,
      born_at:born,
      gestational_weeks:f.get("gestational_weeks")?Number(f.get("gestational_weeks")):"",
      gestational_days:f.get("gestational_days")?Number(f.get("gestational_days")):"",
      birth_weight_g:f.get("birth_weight_g")?Number(f.get("birth_weight_g")):""
    };
    await saveAndRender({...app.data, profile}, "宝宝资料已保存", {close:true});
  }
  async function submitRecord(event) {
    event.preventDefault();
    const form=event.currentTarget, f=new FormData(form), kind=form.dataset.kind, recordId=form.dataset.edit;
    const old=recordId ? findRecord(recordId) : null;
    const entered=f.get("occurred_at");
    const when=old && entered===localInput(old.occurred_at) ? old.occurred_at : localToISO(entered);
    if (!when) return showToast("请填写有效的记录日期和时间");
    if (new Date(when).getTime()>Date.now()+60e3) return showToast("记录时间不能晚于现在");
    let p;
    const v=(name)=>String(f.get(name)||"").trim();
    if (kind==="bottle") {
      p={ milk_type:v("milk_type"), amount_ml:Number(f.get("amount_ml")),
        has_fortifier: !!f.get("has_fortifier"),
        note:v("note") };
    } else if (kind==="diaper") p={kind:v("kind"),color:v("color"),note:v("note")};
    else if (kind==="bilirubin") {
      const readings = f.getAll("reading").filter(value=>value.trim() !== "");
      const average = bilirubinAverage(readings);
      if (average === null) {
        showToast("请填写至少一个有效的读数");
        form.querySelector('input[name="reading"]').focus();
        return;
      }
      p={method:v("method"),value:average,readings:readings.map(Number),unit:v("unit"),site:v("site"),note:v("note")};
    }
    else if (kind==="temperature") p={value:Number(f.get("value")),site:v("site"),note:v("note")};
    else if (kind==="weight") p={value:Number(f.get("value")),unit:v("unit"),note:v("note")};
    else if (kind==="medication") {
      p={name:v("name"),dose:Number(f.get("dose")),unit:v("unit"),route:v("route"),note:v("note")};
      if (!p.name || !p.unit) return showToast("请填写药物名称和剂量单位");
    }
    else return;
    if (recordId && !old) return showToast("这笔记录已变更，请关闭后重新打开");
    if (!old && app.data.records.length >= RECORD_LIMIT) return showToast("已达到记录条数上限，请先备份");
    const time=nowISO();
    const ids = old?.groupIds || (old ? [old.record_id] : []);
    const records=old ? app.data.records.map(r=>{
      const position = ids.indexOf(r.record_id);
      if (position < 0) return r;
      const payload = {...r.payload,...p};
      if (old.groupIds && p.readings.length !== ids.length) {
        // Keep old source rows in the backup when a legacy four-reading batch changes size.
        if (position > 0) return {...r,deleted_at:time,updated_at:time,revision:(r.revision||1)+1};
      } else if (old.groupIds) {
        payload.value = p.readings[position];
        delete payload.readings;
        payload.measurement_group = ids[0];
        payload.note = `同次测量的第 ${position + 1}/4 个读数。${p.note ? "\n" + p.note : ""}`;
      }
      return {...r,payload,occurred_at:when,updated_at:time,revision:(r.revision||1)+1};
    }) :
      [...app.data.records,{record_id:id(),type:kind,payload:p,occurred_at:when,created_at:time,updated_at:time,revision:1,deleted_at:null}];
    await saveAndRender({...app.data,records},old?"记录已更新":"已保存记录",
      {close:true,resetHistory:!old && app.tab==="records" && app.filter===kind});
  }
  function changeDeleted(recordIds, deletedAt, message) {
    const records=app.data.records.map(r=>recordIds.includes(r.record_id) ? {...r,deleted_at:deletedAt,
      updated_at:nowISO(),revision:(r.revision||1)+1} : r);
    return saveAndRender({...app.data,records},message);
  }
  async function quickDiaper(kind) {
    if (app.data.records.length >= RECORD_LIMIT) return showToast("已达到记录条数上限，请先备份");
    const time=nowISO();
    const rec={record_id:id(),type:"diaper",payload:{kind,color:"",note:""},occurred_at:time,created_at:time,updated_at:time,revision:1,deleted_at:null};
    if (await saveAndRender({...app.data,records:[...app.data.records,rec]},null,{close:true,resetHistory:app.tab==="records"})) {
      showToast("尿布已记录","撤销",()=>changeDeleted([rec.record_id],nowISO(),"已撤销"));
    }
  }
  async function removeRecord(recordId) {
    const r=findRecord(recordId);
    if (!r) return;
    const ids = r.groupIds || [recordId];
    if (await changeDeleted(ids,nowISO())) {
      showToast("记录已移入回收","撤销",()=>changeDeleted(ids,null,"已恢复记录"));
    }
  }
  async function toggleTheme() {
    await saveAndRender({...app.data,settings:{...app.data.settings,dark:!app.data.settings.dark}});
  }

  function saveBlob(blob,filename) {
    const href=URL.createObjectURL(blob), a=document.createElement("a");
    a.href=href; a.download=filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(href),120000);
  }
  async function shareOrDownload(blob,filename) {
    const file=new File([blob],filename,{type:blob.type||"application/octet-stream"});
    if (navigator.canShare?.({files:[file]}) && navigator.share) {
      try {
        await navigator.share({files:[file],title:"糖糖日记"});
        return "请在“文件”中确认已保存";
      } catch(e) {
        if(e?.name==="AbortError") return null;
      }
    }
    saveBlob(blob,filename);
    return "已发起下载，请确认文件保存位置";
  }
  async function exportJSON() {
    if (app.storageUnavailable) return showToast("暂时读不到本机数据，请重新打开再导出");
    const backup=makeBackup(app.data);
    const blob=new Blob([JSON.stringify(backup)],{type:"application/json"});
    const filename=`糖糖日记_完整备份_${dayKey(nowISO())}.json`;
    try {
      const result=await shareOrDownload(blob,filename);
      if (!result) return showToast("已取消分享");
      await saveAndRender({...app.data,settings:{...app.data.settings,last_export_at:backup.exported_at}});
      showToast(result);
    } catch(e) { console.error(e);showToast("导出失败，请稍后重试"); }
  }
  async function exportCSV() {
    if (app.storageUnavailable) return showToast("暂时读不到本机数据，请重新打开再导出");
    const rows=[["记录时间","记录类型","内容摘要","喂奶类型","奶量(ml)","添加母乳增强剂","增强剂产品","增强剂用量","增强剂单位","增强剂备注","尿布类型","尿布颜色状态","黄疸检测方法","黄疸数值","黄疸单位","测量部位/机构","体温(℃)","体重数值","体重单位","药品名称","实际剂量","剂量单位","给药方式","备注","原始记录时间"]];
    for (const r of displayRecords()) {
      const p=r.payload||{};
      rows.push([
        localInput(r.occurred_at).replace("T"," "),TYPE_LABELS[r.type]||r.type,detailFor(r),
        r.type==="bottle" ? ({expressed:"瓶喂母乳",formula:"配方奶",mixed:"混合奶"}[p.milk_type]||p.milk_type) : "",
        r.type==="bottle" ? p.amount_ml : "",
        r.type==="bottle" ? (p.has_fortifier?"是":"否") : "",
        r.type==="bottle" ? p.fortifier_product||"" : "",
        r.type==="bottle" ? p.fortifier_amount??"" : "",
        r.type==="bottle" ? p.fortifier_unit||"" : "",
        r.type==="bottle" ? p.fortifier_note||"" : "",
        r.type==="diaper" ? ({wet:"小便",dirty:"大便",both:"都有"}[p.kind]||p.kind) : "",
        r.type==="diaper" ? p.color||"" : "",
        r.type==="bilirubin" ? p.method||"" : "",
        r.type==="bilirubin" ? bilirubinValue(p) : "",
        r.type==="bilirubin" ? p.unit||"" : "",
        ["bilirubin","temperature"].includes(r.type) ? p.site||"" : "",
        r.type==="temperature" ? p.value??"" : "",
        r.type==="weight" ? p.value??"" : "",
        r.type==="weight" ? p.unit||"" : "",
        r.type==="medication" ? p.name||"" : "",
        r.type==="medication" ? p.dose??"" : "",
        r.type==="medication" ? p.unit||"" : "",
        r.type==="medication" ? p.route||"" : "",
        p.note||"",r.occurred_at
      ]);
    }
    const csv="\uFEFF"+rows.map(row=>row.map(quoteCSV).join(",")).join("\r\n");
    try { showToast(await shareOrDownload(new Blob([csv],{type:"text/csv;charset=utf-8"}),`糖糖日记_记录明细_${dayKey(nowISO())}.csv`) || "已取消分享"); }
    catch(e){console.error(e);showToast("CSV 导出失败");}
  }
  function reviewImport(restored) {
    if (document.querySelector(".sheet-layer")) return showToast("请先关闭当前表单，再重新选择备份");
    const current = liveRecords().length;
    const target = restored.records.filter(r => !r.deleted_at).length;
    showSheet("核对备份", `${sheetHeader("核对备份","恢复将替换本机宝宝资料和全部记录")}
      <p>本机：${current} 条有效记录（含已删除共 ${app.data.records.length} 条）</p>
      <p>备份：${target} 条有效记录（含已删除共 ${restored.records.length} 条）</p>
      <p class="form-note">建议先取消并导出一份本机 JSON 备份，以便需要时恢复原记录。</p>
      <button type="button" class="form-submit" id="restore-backup">继续恢复</button>
      <button type="button" class="secondary-button" data-action="close-sheet">取消</button>`);
    document.getElementById("restore-backup").addEventListener("click", async () => {
      if (app.saving) return;
      if (!window.confirm("确定用这份 JSON 备份替换本机资料和记录吗？")) {
        closeSheet();
        return showToast("已取消恢复");
      }
      await saveAndRender(restored, "备份已恢复，请核对记录", {close:true,tab:"records",
        failure:"恢复失败，原有数据仍保留。请保留备份文件，重新打开网页后再试。"});
    });
  }
  function importJSON() {
    if (app.storageUnavailable) return showToast("本机存储不可用，暂时无法恢复");
    app.picker?.remove();
    const picker=document.createElement("input");
    picker.type="file";picker.accept=".json,application/json";picker.className="import-input";
    picker.tabIndex=-1;
    app.picker=picker;
    document.body.appendChild(picker);
    const cleanup=()=>{picker.remove(); if (app.picker===picker) app.picker=null;};
    picker.addEventListener("cancel",cleanup,{once:true});
    picker.addEventListener("change",async()=>{
      const file=picker.files?.[0];cleanup();
      if (!file) return;
      if (file.size>BACKUP_LIMIT) return showToast("备份文件超过 8 MB，未修改本机记录");
      try {
        let input;
        try { input=JSON.parse((await file.text()).replace(/^\uFEFF/,"")); }
        catch { throw new Error("无法读取这份 JSON 备份，请确认文件完整"); }
        reviewImport(validateBackup(input));
      } catch(e) { showToast(e.message||"文件无法识别"); }
    },{once:true});
    picker.click();
  }
  document.addEventListener("click",async(event)=>{
    if (!app.data || app.saving) return;
    const nav=event.target.closest("[data-tab]");
    if (nav) {switchTab(nav.dataset.tab);return;}
    const filter=event.target.closest("[data-filter]");
    if (filter) {
      const scroll=filter.parentElement.scrollLeft;
      app.filter=filter.dataset.filter;
      render();
      document.querySelector(".filter-chips").scrollLeft=scroll;
      document.querySelector(".filter-chip.active").focus({preventScroll:true});
      return;
    }
    const quick=event.target.closest("[data-diaper-quick]");
    if (quick) {await quickDiaper(quick.dataset.diaperQuick);return;}
    const amount=event.target.closest("[data-amount]");
    if (amount) {
      const input=document.getElementById("milk-amount");
      if (input) {input.value=amount.dataset.amount;document.querySelectorAll(".amount-btn").forEach(x=>x.classList.toggle("selected",x===amount));}
      return;
    }
    const action=event.target.closest("[data-action]");if(!action)return;
    const name=action.dataset.action;
    if (name==="close-sheet") return closeSheet();
    if (name==="reading-add") {
      const list = document.getElementById("bilirubin-readings");
      list.insertAdjacentHTML("beforeend",bilirubinReadingRow("",list.children.length));
      updateBilirubinReadings();
      list.lastElementChild.querySelector("input").focus();
      return;
    }
    if (name==="reading-remove") {
      const row = action.closest(".bilirubin-reading");
      if (row.parentElement.children.length <= 1) return;
      const next = row.nextElementSibling || row.previousElementSibling;
      row.remove();
      updateBilirubinReadings();
      next.querySelector("input").focus();
      return;
    }
    if (name==="home") return switchTab("today");
    if (name==="record-history") {
      if (!RECORD_TYPES.includes(action.dataset.kind)) return;
      app.filter = action.dataset.kind;
      app.milkDay = "";
      return switchTab("records");
    }
    if (name==="milk-history") {
      app.filter = "bottle";
      app.milkDay = "";
      return switchTab("records");
    }
    if (name==="milk-date-clear") {
      app.milkDay = "";
      render();
      document.getElementById("milk-date").focus({preventScroll:true});
      return;
    }
    if (name==="milk-period") {
      app.milkPeriod = Number(action.dataset.days);
      render();
      document.querySelector('.milk-period [aria-pressed="true"]').focus({preventScroll:true});
      return;
    }
    if (name==="new-record") return openSheet(action.dataset.kind);
    if (name==="record-edit") {
      const rec=app.data.records.find(r=>r.record_id===action.dataset.id);
      if(rec)return openSheet(rec.type,rec.record_id);
    }
    if (name==="record-delete") return removeRecord(action.dataset.id);
    if (name==="diaper-detail") {
      document.getElementById("record-form").hidden=false;action.hidden=true;
      return;
    }
    if (name==="profile") return openSheet("profile");
    if (name==="theme") return toggleTheme();
    if (name==="export-json") return exportJSON();
    if (name==="export-csv") return exportCSV();
    if (name==="import-json") return importJSON();
  });
  document.addEventListener("change",(event)=>{
    const radio=event.target;
    if (radio.id === "milk-date") {
      if (!radio.validity.valid) return;
      app.milkDay = radio.value;
      render();
      return;
    }
    if (!radio.matches('input[type="radio"][name]')) return;
    const group=radio.closest("[data-choice-group]");
    if (group) group.querySelectorAll(".choice-pill").forEach(l=>l.classList.toggle("selected",!!l.querySelector("input:checked")));
  });
  document.addEventListener("keydown",(event)=>{
    if(!app.saving && event.key==="Escape" && document.querySelector(".sheet-layer")) closeSheet();
  });
  window.visualViewport?.addEventListener("resize",syncSheetViewport);
  window.visualViewport?.addEventListener("scroll",syncSheetViewport);
  window.addEventListener("focus",refreshHomeDate);
  window.addEventListener("pageshow",refreshHomeDate);
  document.addEventListener("visibilitychange",()=>{
    if (document.visibilityState === "visible") refreshHomeDate();
  });
  async function init() {
    try {
      if (!("indexedDB" in window)) throw new Error("IndexedDB unavailable");
      app.db=await openDatabase();
      const stored=await readSnapshot();
      if (stored === undefined) app.data=emptyData();
      else {
        if (!stored?.profile || !Array.isArray(stored.records)) throw new Error("Unrecognized local database snapshot");
        app.data={...stored,settings:{...emptyData().settings,...stored.settings}};
      }
    } catch(err) {
      console.error("Local database initialization failed:",err);
      app.data=emptyData(); app.storageUnavailable=true;
    }
    render();
    refreshHomeDate();
    if ("serviceWorker" in navigator && window.isSecureContext) {
      navigator.serviceWorker.register(new URL("./sw.js",import.meta.url), {
        scope:new URL("./",import.meta.url).href,
        updateViaCache:"none"
      }).catch(err=>console.warn("Offline cache unavailable:",err));
    }
    if (navigator.storage?.persist) navigator.storage.persist().catch(()=>{});
  }
  init();
})();
