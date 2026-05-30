import { createId } from "./platform.js";

export const TYPES = {
  kine: "Séance de kiné",
  auto: "Autorééducation",
  medical: "Rendez-vous médical",
  progress: "Progrès / ressenti"
};

export const STATUSES = {
  planned: "Planifié",
  completed: "Bilan renseigné"
};

export const MOBILITY_FIELDS = [
  { key: "flexion", label: "Flexion", unit: "°" },
  { key: "extension", label: "Extension", unit: "°" },
  { key: "pronation", label: "Pronation", unit: "°" },
  { key: "supination", label: "Supination", unit: "°" }
];

export function newJournal() {
  return { version: 1, entries: [], createdAt: new Date().toISOString() };
}

export function normalizeJournal(value) {
  if (!value || !Array.isArray(value.entries)) {
    throw new Error("Format de carnet invalide.");
  }
  return {
    version: 1,
    createdAt: value.createdAt || new Date().toISOString(),
    entries: value.entries
      .filter(entry => entry && TYPES[entry.type] && entry.date)
      .map(normalizeEntry)
  };
}

function normalizeEntry(entry) {
  const normalized = {
    planningNotes: "",
    duration: "",
    pain: "",
    flexion: "",
    extension: "",
    pronation: "",
    supination: "",
    details: "",
    achievement: "",
    nextStep: "",
    ...entry
  };
  if (normalized.status === "planned" || normalized.status === "completed") return normalized;
  const hasReport = entry.type === "auto" || entry.type === "progress" ||
    ["duration", "pain", "flexion", "extension", "pronation", "supination", "details", "achievement", "nextStep"]
      .some(key => entry[key] !== "" && entry[key] !== undefined && entry[key] !== null);
  return { ...normalized, status: hasReport ? "completed" : "planned" };
}

export function makePlannedEntry(values, existingId = "") {
  return {
    id: existingId || createId(),
    type: values.type,
    status: "planned",
    date: values.date,
    time: values.time || "",
    title: entryTitle(values),
    planningNotes: values.planningNotes.trim(),
    duration: "",
    pain: "",
    flexion: "",
    extension: "",
    pronation: "",
    supination: "",
    details: "",
    achievement: "",
    nextStep: "",
    updatedAt: new Date().toISOString()
  };
}

export function makeReportEntry(values, existing = {}) {
  return {
    ...existing,
    id: existing.id || createId(),
    type: values.type,
    status: "completed",
    date: values.date,
    time: values.time || existing.time || "",
    title: entryTitle(values),
    planningNotes: existing.planningNotes || "",
    duration: numberOrEmpty(values.duration),
    pain: numberOrEmpty(values.pain),
    flexion: numberOrEmpty(values.flexion),
    extension: numberOrEmpty(values.extension),
    pronation: numberOrEmpty(values.pronation),
    supination: numberOrEmpty(values.supination),
    details: values.details.trim(),
    achievement: values.achievement.trim(),
    nextStep: values.nextStep.trim(),
    updatedAt: new Date().toISOString()
  };
}

function numberOrEmpty(value) {
  return value === "" || value === null || value === undefined ? "" : Number(value);
}

function entryTitle(values) {
  return values.title.trim() || TYPES[values.type];
}

export function filteredEntries(entries, { type = "", status = "", month = "", search = "" } = {}) {
  const needle = search.trim().toLocaleLowerCase("fr");
  return [...entries]
    .filter(entry => !type || entry.type === type)
    .filter(entry => !status || entry.status === status)
    .filter(entry => !month || entry.date.startsWith(month))
    .filter(entry => {
      if (!needle) return true;
      return [entry.title, entry.planningNotes, entry.details, entry.achievement, entry.nextStep]
        .join(" ")
        .toLocaleLowerCase("fr")
        .includes(needle);
    })
    .sort(compareRecentFirst);
}

export function upcomingEntries(entries, today = isoToday()) {
  return entries
    .filter(entry => entry.status === "planned" && isAppointment(entry) && entry.date >= today)
    .sort((a, b) => `${a.date}T${a.time || "23:59"}`.localeCompare(`${b.date}T${b.time || "23:59"}`))
    .slice(0, 5);
}

export function reportsToComplete(entries, today = isoToday()) {
  return entries
    .filter(entry => entry.status === "planned" && isAppointment(entry) && entry.date < today)
    .sort(compareRecentFirst);
}

export function sevenDaySummary(entries, today = isoToday()) {
  const end = midday(today);
  const recentStart = addDays(end, -6);
  const previousStart = addDays(end, -13);
  const previousEnd = addDays(end, -7);
  const reports = entries.filter(entry => entry.status === "completed");
  const recent = reports.filter(entry => inPeriod(entry.date, recentStart, end));
  const previous = reports.filter(entry => inPeriod(entry.date, previousStart, previousEnd));
  const practices = recent.filter(entry => entry.type === "kine" || entry.type === "auto").length;
  const latestWin = [...recent]
    .sort(compareRecentFirst)
    .find(entry => entry.achievement)?.achievement;

  let title = "Notez votre première étape";
  let message = "Votre historique permettra bientôt de revoir le chemin parcouru.";
  if (recent.length) {
    title = `${recent.length} bilan${recent.length > 1 ? "s" : ""} renseigné${recent.length > 1 ? "s" : ""} en 7 jours`;
    message = practices
      ? `Vous avez noté ${practices} séance${practices > 1 ? "s" : ""} de kiné ou d'autorééducation cette semaine.`
      : "Vous entretenez la mémoire de votre parcours, une note à la fois.";
    if (recent.length > previous.length && previous.length) {
      message += ` C'était ${previous.length} la semaine précédente.`;
    }
    if (latestWin) {
      message += ` Dernière réussite notée : ${latestWin}`;
    }
  }

  return {
    title,
    message,
    recentCount: recent.length,
    practices,
    appointments: recent.filter(entry => entry.type === "medical").length
  };
}

export function monthCells(month, entries, today = isoToday()) {
  const first = midday(`${month}-01`);
  const start = addDays(first, -((first.getDay() + 6) % 7));
  return Array.from({ length: 42 }, (_, index) => {
    const date = addDays(start, index);
    const iso = localIso(date);
    return {
      iso,
      day: date.getDate(),
      currentMonth: iso.startsWith(month),
      today: iso === today,
      entries: entries.filter(entry => entry.date === iso)
    };
  });
}

export function mobilityProgress(entries) {
  return MOBILITY_FIELDS.map(field => {
    const points = entries
      .filter(entry => entry.status === "completed" && isMeasured(entry[field.key]))
      .map(entry => ({
        id: entry.id,
        date: entry.date,
        title: entry.title,
        value: Number(entry[field.key])
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
    const latest = points[points.length - 1] || null;
    const first = points[0] || null;
    const previous = points[points.length - 2] || null;
    const values = points.map(point => point.value);
    const min = values.length ? Math.min(...values) : 0;
    const max = values.length ? Math.max(...values) : 0;
    return {
      ...field,
      points,
      latest,
      firstDelta: latest && first ? latest.value - first.value : null,
      previousDelta: latest && previous ? latest.value - previous.value : null,
      min,
      max
    };
  });
}

export function exportCsv(entries) {
  const columns = [
    ["date", "Date"], ["time", "Heure"], ["type", "Sujet"], ["status", "Statut"], ["title", "Titre"],
    ["planningNotes", "Notes de planification"],
    ["duration", "Durée (minutes)"], ["pain", "Douleur (0-10)"],
    ["flexion", "Flexion (degrés)"], ["extension", "Extension (degrés)"],
    ["pronation", "Pronation (degrés)"], ["supination", "Supination (degrés)"],
    ["details", "Observations"], ["achievement", "Réussite"], ["nextStep", "Prochaine étape"]
  ];
  const lines = [columns.map(([, label]) => csvCell(label)).join(";")];
  filteredEntries(entries).reverse().forEach(entry => {
    lines.push(columns.map(([key]) => {
      if (key === "type") return csvCell(TYPES[entry.type]);
      if (key === "status") return csvCell(STATUSES[entry.status]);
      return csvCell(entry[key]);
    }).join(";"));
  });
  return "\uFEFF" + lines.join("\n");
}

function csvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export function exportIcs(entries) {
  const events = entries.filter(isAppointment);
  const body = events.map(entry => {
    const day = entry.date.replace(/-/g, "");
    const when = entry.time
      ? `DTSTART:${day}T${entry.time.replace(":", "")}00`
      : `DTSTART;VALUE=DATE:${day}`;
    return [
      "BEGIN:VEVENT",
      `UID:${entry.id}@coudeprogres.local`,
      when,
      `SUMMARY:${icsText(`${TYPES[entry.type]} - ${entry.title}`)}`,
      `DESCRIPTION:${icsText(entry.planningNotes || "Rendez-vous CoudeProgres")}`,
      "END:VEVENT"
    ].join("\r\n");
  }).join("\r\n");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CoudeProgres//FR",
    body,
    "END:VCALENDAR"
  ].filter(Boolean).join("\r\n");
}

function isAppointment(entry) {
  return entry.type === "medical" || entry.type === "kine";
}

function isMeasured(value) {
  return value !== "" && value !== null && value !== undefined && Number.isFinite(Number(value));
}

function icsText(value) {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export function isoToday() {
  return localIso(new Date());
}

export function monthNow() {
  return isoToday().slice(0, 7);
}

export function monthLabel(month) {
  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(midday(`${month}-01`));
}

export function dateLabel(date) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(midday(date));
}

export function shiftMonth(month, amount) {
  const date = midday(`${month}-01`);
  date.setMonth(date.getMonth() + amount);
  return localIso(date).slice(0, 7);
}

function compareRecentFirst(a, b) {
  return `${b.date}T${b.time || ""}`.localeCompare(`${a.date}T${a.time || ""}`);
}

function inPeriod(iso, start, end) {
  const date = midday(iso);
  return date >= start && date <= end;
}

function midday(iso) {
  return new Date(`${iso}T12:00:00`);
}

function addDays(date, amount) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + amount);
  return copy;
}

function localIso(date) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}
