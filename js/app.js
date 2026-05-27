import {
  TYPES,
  dateLabel,
  exportCsv,
  exportIcs,
  filteredEntries,
  isoToday,
  makePlannedEntry,
  makeReportEntry,
  monthCells,
  monthLabel,
  monthNow,
  newJournal,
  normalizeJournal,
  sevenDaySummary,
  shiftMonth,
  reportsToComplete,
  upcomingEntries
} from "./domain.js";
import {
  STORAGE_KEY,
  createVault,
  encryptJournal,
  unlockVault,
  validateEnvelope
} from "./crypto-store.js";

const $ = id => document.getElementById(id);
let envelope = loadEnvelope();
let activeKey = null;
let journal = null;
let toastTimer = null;
let hiddenAt = null;

boot();

function boot() {
  showLockedHome();
  $("planning-date").value = isoToday();
  $("report-date").value = isoToday();
  $("calendar-month").value = monthNow();
  bindEvents();
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

function bindEvents() {
  $("create-vault-form").addEventListener("submit", createPrivateSpace);
  $("unlock-form").addEventListener("submit", unlock);
  $("restore-form").addEventListener("submit", restoreBackup);
  $("show-import-first").addEventListener("click", showRestore);
  $("show-import-locked").addEventListener("click", showRestore);
  $("show-reset").addEventListener("click", showReset);
  $("cancel-restore").addEventListener("click", showLockedHome);
  $("cancel-reset").addEventListener("click", showLockedHome);
  $("confirm-reset").addEventListener("click", resetLostPassphrase);
  $("lock-button").addEventListener("click", lock);
  $("planning-form").addEventListener("submit", savePlanning);
  $("report-form").addEventListener("submit", saveReport);
  $("cancel-planning-edit").addEventListener("click", resetPlanningForm);
  $("cancel-report").addEventListener("click", () => {
    resetReportForm();
    setView("today");
  });
  $("month-back").addEventListener("click", () => moveMonth(-1));
  $("month-forward").addEventListener("click", () => moveMonth(1));
  $("calendar-month").addEventListener("change", renderCalendar);
  $("filter-type").addEventListener("change", renderRecords);
  $("filter-status").addEventListener("change", renderRecords);
  $("filter-month").addEventListener("change", renderRecords);
  $("filter-search").addEventListener("input", renderRecords);
  $("export-backup").addEventListener("click", exportBackup);
  $("export-csv").addEventListener("click", downloadCsv);
  $("export-calendar").addEventListener("click", downloadCalendar);
  $("restore-from-app").addEventListener("click", () => {
    lock();
    showRestore();
  });
  document.querySelectorAll(".tab").forEach(button => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });
  document.querySelectorAll(".goto-plan").forEach(button => {
    button.addEventListener("click", () => setView("plan"));
  });
  $("new-free-report").addEventListener("click", () => openReport());
  $("records-list").addEventListener("click", handleEntryAction);
  $("month-list").addEventListener("click", handleEntryAction);
  $("upcoming-list").addEventListener("click", handleEntryAction);
  $("pending-list").addEventListener("click", handleEntryAction);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      hiddenAt = Date.now();
    } else if (activeKey && hiddenAt && Date.now() - hiddenAt > 5 * 60 * 1000) {
      lock();
      notify("Carnet reverrouillé après une période d'inactivité.");
    }
  });
}

function showLockedHome() {
  const hasData = Boolean(envelope);
  $("welcome").classList.remove("hidden");
  $("app").classList.add("hidden");
  $("lock-button").classList.add("hidden");
  $("create-vault-form").classList.toggle("hidden", hasData);
  $("unlock-form").classList.toggle("hidden", !hasData);
  $("restore-form").classList.add("hidden");
  $("reset-panel").classList.add("hidden");
  $("unlock-error").classList.add("hidden");
  $("open-error").classList.add("hidden");
}

function showRestore() {
  $("create-vault-form").classList.add("hidden");
  $("unlock-form").classList.add("hidden");
  $("restore-form").classList.remove("hidden");
  $("reset-panel").classList.add("hidden");
}

function showReset() {
  $("create-vault-form").classList.add("hidden");
  $("unlock-form").classList.add("hidden");
  $("restore-form").classList.add("hidden");
  $("reset-panel").classList.remove("hidden");
}

function resetLostPassphrase() {
  const confirmed = window.confirm(
    "Confirmer la suppression définitive du carnet chiffré de cet appareil ? Cette action est irréversible."
  );
  if (!confirmed) return;
  localStorage.removeItem(STORAGE_KEY);
  envelope = null;
  activeKey = null;
  journal = null;
  showLockedHome();
  notify("Ancien carnet effacé. Vous pouvez créer un nouvel espace privé.");
}

async function createPrivateSpace(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const passphrase = form.elements.passphrase.value;
  if (passphrase !== form.elements.confirmation.value) {
    notify("Les deux phrases secrètes ne correspondent pas.");
    return;
  }
  journal = newJournal();
  const created = await createVault(journal, passphrase);
  envelope = created.envelope;
  activeKey = created.key;
  storeEnvelope();
  form.reset();
  openApp();
  notify("Votre espace privé est prêt.");
}

async function unlock(event) {
  event.preventDefault();
  let result;
  try {
    result = await unlockVault(envelope, event.currentTarget.elements.passphrase.value);
    activeKey = result.key;
    journal = normalizeJournal(result.journal);
  } catch {
    $("unlock-error").classList.remove("hidden");
    return;
  }
  event.currentTarget.reset();
  try {
    openApp();
  } catch (error) {
    console.error("Impossible d'afficher le carnet déverrouillé.", error);
    $("welcome").classList.remove("hidden");
    $("app").classList.add("hidden");
    $("unlock-form").classList.remove("hidden");
    $("open-error").classList.remove("hidden");
  }
}

function openApp() {
  hiddenAt = null;
  $("welcome").classList.add("hidden");
  $("app").classList.remove("hidden");
  $("lock-button").classList.remove("hidden");
  setView("today");
  renderAll();
}

function lock() {
  activeKey = null;
  journal = null;
  resetPlanningForm();
  resetReportForm();
  showLockedHome();
}

async function persist() {
  envelope = await encryptJournal(journal, activeKey, envelope);
  storeEnvelope();
  renderAll();
}

function storeEnvelope() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
}

function loadEnvelope() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

async function savePlanning(event) {
  event.preventDefault();
  const entry = makePlannedEntry({
    type: $("planning-type").value,
    date: $("planning-date").value,
    time: $("planning-time").value,
    title: $("planning-title").value,
    planningNotes: $("planning-notes").value
  }, $("planning-id").value);
  const existingIndex = journal.entries.findIndex(item => item.id === entry.id);
  if (existingIndex >= 0) journal.entries[existingIndex] = entry;
  else journal.entries.push(entry);
  await persist();
  resetPlanningForm();
  setView("today");
  notify(existingIndex >= 0 ? "Rendez-vous modifié." : "Rendez-vous planifié.");
}

async function saveReport(event) {
  event.preventDefault();
  const existing = journal.entries.find(item => item.id === $("report-id").value) || {};
  const entry = makeReportEntry({
    type: $("report-type").value,
    date: $("report-date").value,
    time: $("report-time").value,
    title: $("report-title").value,
    duration: $("report-duration").value,
    pain: $("report-pain").value,
    flexion: $("report-flexion").value,
    extension: $("report-extension").value,
    details: $("report-details").value,
    achievement: $("report-achievement").value,
    nextStep: $("report-next").value
  }, existing);
  const existingIndex = journal.entries.findIndex(item => item.id === entry.id);
  if (existingIndex >= 0) journal.entries[existingIndex] = entry;
  else journal.entries.push(entry);
  await persist();
  resetReportForm();
  setView("today");
  notify(existingIndex >= 0 ? "Bilan enregistré." : "Séance consignée.");
}

function resetPlanningForm() {
  $("planning-form").reset();
  $("planning-id").value = "";
  $("planning-date").value = isoToday();
  $("planning-form-title").textContent = "Planifier un rendez-vous";
  $("cancel-planning-edit").classList.add("hidden");
}

function resetReportForm() {
  $("report-form").reset();
  $("report-id").value = "";
  $("report-date").value = isoToday();
  $("report-form-title").textContent = "Faire le bilan";
}

function editPlanning(id) {
  const entry = journal.entries.find(item => item.id === id);
  if (!entry) return;
  $("planning-id").value = entry.id;
  $("planning-type").value = entry.type;
  $("planning-date").value = entry.date;
  $("planning-time").value = entry.time;
  $("planning-title").value = entry.title;
  $("planning-notes").value = entry.planningNotes || "";
  $("planning-form-title").textContent = "Modifier le rendez-vous";
  $("cancel-planning-edit").classList.remove("hidden");
  setView("plan");
}

function openReport(id = "") {
  resetReportForm();
  const entry = journal.entries.find(item => item.id === id);
  if (entry) {
    $("report-id").value = entry.id;
    $("report-type").value = entry.type;
    $("report-date").value = entry.date;
    $("report-time").value = entry.time || "";
    $("report-title").value = entry.title;
    $("report-duration").value = entry.duration || "";
    $("report-pain").value = entry.pain ?? "";
    $("report-flexion").value = entry.flexion ?? "";
    $("report-extension").value = entry.extension ?? "";
    $("report-details").value = entry.details || "";
    $("report-achievement").value = entry.achievement || "";
    $("report-next").value = entry.nextStep || "";
    $("report-form-title").textContent = entry.status === "completed" ? "Modifier le bilan" : "Faire le bilan";
  } else {
    $("report-type").value = "auto";
    $("report-title").value = "Autorééducation";
  }
  setView("report");
}

async function removeEntry(id) {
  if (!window.confirm("Supprimer définitivement cette entrée ?")) return;
  journal.entries = journal.entries.filter(entry => entry.id !== id);
  await persist();
  notify("Entrée supprimée.");
}

function handleEntryAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  if (button.dataset.action === "plan-edit") editPlanning(button.dataset.id);
  if (button.dataset.action === "report") openReport(button.dataset.id);
  if (button.dataset.action === "delete") removeEntry(button.dataset.id);
}

function setView(name) {
  document.querySelectorAll(".view").forEach(view => {
    view.classList.toggle("hidden", view.id !== `view-${name}`);
  });
  document.querySelectorAll(".tab").forEach(tab => {
    tab.classList.toggle("active", tab.dataset.view === name);
  });
  if (name === "calendar") renderCalendar();
  if (name === "records") renderRecords();
}

function renderAll() {
  renderDashboard();
  renderCalendar();
  renderRecords();
}

function renderDashboard() {
  const summary = sevenDaySummary(journal.entries);
  $("encouragement-title").textContent = summary.title;
  $("encouragement-message").textContent = summary.message;
  $("dashboard-cards").innerHTML = [
    metric(summary.recentCount, "notes"),
    metric(summary.practices, "séances"),
    metric(summary.appointments, "rdv médicaux")
  ].join("");
  const upcoming = upcomingEntries(journal.entries);
  $("upcoming-list").innerHTML = upcoming.length
    ? upcoming.map(planningCard).join("")
    : '<div class="empty">Aucun rendez-vous à venir.</div>';
  const pending = reportsToComplete(journal.entries);
  $("pending-list").innerHTML = pending.length
    ? pending.map(planningCard).join("")
    : '<div class="empty">Aucun bilan en attente.</div>';
}

function metric(value, label) {
  return `<div class="metric"><strong>${value}</strong><span>${label}</span></div>`;
}

function renderCalendar() {
  if (!journal) return;
  const month = $("calendar-month").value || monthNow();
  $("calendar-grid").innerHTML = monthCells(month, journal.entries).map(cell => {
    const dots = cell.entries.slice(0, 4)
      .map(entry => `<span class="dot ${entry.type}"></span>`)
      .join("");
    return `<div class="day ${cell.currentMonth ? "" : "outside"} ${cell.today ? "today" : ""}">
      ${cell.day}<div class="dots">${dots}</div>
    </div>`;
  }).join("");
  const entries = filteredEntries(journal.entries, { month });
  $("month-summary").textContent = `${entries.length} entrée${entries.length > 1 ? "s" : ""} - ${monthLabel(month)}`;
  $("month-list").innerHTML = entries.length ? entries.map(entryCard).join("") : emptyMessage();
}

function moveMonth(amount) {
  $("calendar-month").value = shiftMonth($("calendar-month").value || monthNow(), amount);
  renderCalendar();
}

function renderRecords() {
  if (!journal) return;
  const options = {
    type: $("filter-type").value,
    status: $("filter-status").value,
    month: $("filter-month").value,
    search: $("filter-search").value
  };
  const entries = filteredEntries(journal.entries, options);
  const subject = options.type ? TYPES[options.type].toLocaleLowerCase("fr") : "entrée";
  const period = options.month ? ` en ${monthLabel(options.month)}` : "";
  $("filter-summary").textContent = `${entries.length} ${subject}${entries.length > 1 ? "s" : ""}${period}.`;
  $("records-list").innerHTML = entries.length ? entries.map(entryCard).join("") : `<article class="card">${emptyMessage()}</article>`;
}

function entryCard(entry) {
  const observations = entry.details ? `<p>${escapeHtml(entry.details)}</p>` : "";
  const win = entry.achievement ? `<p><strong>Réussite :</strong> ${escapeHtml(entry.achievement)}</p>` : "";
  const measures = [
    entry.duration !== "" ? `${entry.duration} min` : "",
    entry.pain !== "" ? `douleur ${entry.pain}/10` : "",
    entry.flexion !== "" ? `flexion ${entry.flexion}°` : "",
    entry.extension !== "" ? `extension ${entry.extension}°` : ""
  ].filter(Boolean).join(" · ");
  const status = entry.status === "planned" ? '<span class="tag planned">Planifié</span>' : '<span class="tag completed">Bilan</span>';
  const action = entry.status === "planned"
    ? `<button class="text-button" data-action="report" data-id="${entry.id}" type="button">Faire le bilan</button>
       <button class="text-button" data-action="plan-edit" data-id="${entry.id}" type="button">Modifier</button>`
    : `<button class="text-button" data-action="report" data-id="${entry.id}" type="button">Modifier le bilan</button>`;
  return `<article class="entry">
    <h3>${escapeHtml(entry.title)}</h3>
    <p class="entry-meta"><span class="tag">${TYPES[entry.type]}</span>${status}${dateLabel(entry.date)}${entry.time ? ` · ${entry.time}` : ""}</p>
    ${measures ? `<p class="entry-meta">${measures}</p>` : ""}
    ${observations}${win}
    <div class="entry-actions">
      ${action}
      <button class="text-button delete" data-action="delete" data-id="${entry.id}" type="button">Supprimer</button>
    </div>
  </article>`;
}

function planningCard(entry) {
  const notes = entry.planningNotes ? `<p>${escapeHtml(entry.planningNotes)}</p>` : "";
  const canReport = entry.date <= isoToday()
    ? `<button class="primary small" data-action="report" data-id="${entry.id}" type="button">Faire le bilan</button>`
    : "";
  return `<article class="entry">
    <h3>${escapeHtml(entry.title)}</h3>
    <p class="entry-meta"><span class="tag">${TYPES[entry.type]}</span>${dateLabel(entry.date)}${entry.time ? ` · ${entry.time}` : ""}</p>
    ${notes}
    <div class="entry-actions">
      ${canReport}
      <button class="text-button" data-action="plan-edit" data-id="${entry.id}" type="button">Modifier</button>
      <button class="text-button delete" data-action="delete" data-id="${entry.id}" type="button">Supprimer</button>
    </div>
  </article>`;
}

function emptyMessage() {
  return '<div class="empty">Aucune entrée pour cette sélection.</div>';
}

function exportBackup() {
  download(`coudeprogres-sauvegarde-${isoToday()}.json`, JSON.stringify(envelope, null, 2), "application/json");
  notify("Sauvegarde chiffrée téléchargée.");
}

function downloadCsv() {
  if (!confirmClearExport()) return;
  download(`coudeprogres-liste-${isoToday()}.csv`, exportCsv(journal.entries), "text/csv;charset=utf-8");
}

function downloadCalendar() {
  if (!confirmClearExport()) return;
  download(`coudeprogres-rendez-vous-${isoToday()}.ics`, exportIcs(journal.entries), "text/calendar;charset=utf-8");
}

function confirmClearExport() {
  return window.confirm("Cet export ne sera pas chiffré. Continuer seulement si vous pouvez le conserver en lieu sûr.");
}

async function restoreBackup(event) {
  event.preventDefault();
  const file = $("restore-file").files[0];
  try {
    const imported = JSON.parse(await file.text());
    validateEnvelope(imported);
    if (envelope && !window.confirm("Remplacer le carnet présent sur cet appareil par cette sauvegarde ?")) return;
    envelope = imported;
    storeEnvelope();
    $("restore-form").reset();
    showLockedHome();
    notify("Sauvegarde importée. Déverrouillez-la avec sa phrase secrète.");
  } catch (error) {
    notify(error.message || "Impossible d'importer ce fichier.");
  }
}

function download(filename, content, type) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([content], { type }));
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function notify(message) {
  clearTimeout(toastTimer);
  $("toast").textContent = message;
  $("toast").classList.remove("hidden");
  toastTimer = setTimeout(() => $("toast").classList.add("hidden"), 3500);
}

function escapeHtml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
