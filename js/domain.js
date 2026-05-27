export const TYPES = {
  kine: "Séance de kiné",
  auto: "Autorééducation",
  medical: "Rendez-vous médical",
  progress: "Progrès / ressenti"
};

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
    entries: value.entries.filter(entry => entry && TYPES[entry.type] && entry.date)
  };
}

export function makeEntry(values, existingId = "") {
  return {
    id: existingId || crypto.randomUUID(),
    type: values.type,
    date: values.date,
    time: values.time || "",
    title: values.title.trim(),
    duration: numberOrEmpty(values.duration),
    pain: numberOrEmpty(values.pain),
    flexion: numberOrEmpty(values.flexion),
    extension: numberOrEmpty(values.extension),
    details: values.details.trim(),
    achievement: values.achievement.trim(),
    nextStep: values.nextStep.trim(),
    updatedAt: new Date().toISOString()
  };
}

function numberOrEmpty(value) {
  return value === "" || value === null || value === undefined ? "" : Number(value);
}

export function filteredEntries(entries, { type = "", month = "", search = "" } = {}) {
  const needle = search.trim().toLocaleLowerCase("fr");
  return [...entries]
    .filter(entry => !type || entry.type === type)
    .filter(entry => !month || entry.date.startsWith(month))
    .filter(entry => {
      if (!needle) return true;
      return [entry.title, entry.details, entry.achievement, entry.nextStep]
        .join(" ")
        .toLocaleLowerCase("fr")
        .includes(needle);
    })
    .sort(compareRecentFirst);
}

export function upcomingEntries(entries, today = isoToday()) {
  return entries
    .filter(entry => (entry.type === "kine" || entry.type === "medical") && entry.date >= today)
    .sort((a, b) => `${a.date}T${a.time || "23:59"}`.localeCompare(`${b.date}T${b.time || "23:59"}`))
    .slice(0, 5);
}

export function sevenDaySummary(entries, today = isoToday()) {
  const end = midday(today);
  const recentStart = addDays(end, -6);
  const previousStart = addDays(end, -13);
  const previousEnd = addDays(end, -7);
  const recent = entries.filter(entry => inPeriod(entry.date, recentStart, end));
  const previous = entries.filter(entry => inPeriod(entry.date, previousStart, previousEnd));
  const practices = recent.filter(entry => entry.type === "kine" || entry.type === "auto").length;
  const latestWin = [...recent]
    .sort(compareRecentFirst)
    .find(entry => entry.achievement)?.achievement;

  let title = "Notez votre première étape";
  let message = "Votre historique permettra bientôt de revoir le chemin parcouru.";
  if (recent.length) {
    title = `${recent.length} étape${recent.length > 1 ? "s" : ""} consignée${recent.length > 1 ? "s" : ""} en 7 jours`;
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

export function exportCsv(entries) {
  const columns = [
    ["date", "Date"], ["time", "Heure"], ["type", "Sujet"], ["title", "Titre"],
    ["duration", "Durée (minutes)"], ["pain", "Douleur (0-10)"],
    ["flexion", "Flexion (degrés)"], ["extension", "Extension (degrés)"],
    ["details", "Observations"], ["achievement", "Réussite"], ["nextStep", "Prochaine étape"]
  ];
  const lines = [columns.map(([, label]) => csvCell(label)).join(";")];
  filteredEntries(entries).reverse().forEach(entry => {
    lines.push(columns.map(([key]) => csvCell(key === "type" ? TYPES[entry.type] : entry[key])).join(";"));
  });
  return "\uFEFF" + lines.join("\n");
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export function exportIcs(entries) {
  const events = entries.filter(entry => entry.type === "medical" || entry.type === "kine");
  const body = events.map(entry => {
    const day = entry.date.replaceAll("-", "");
    const when = entry.time
      ? `DTSTART:${day}T${entry.time.replace(":", "")}00`
      : `DTSTART;VALUE=DATE:${day}`;
    return [
      "BEGIN:VEVENT",
      `UID:${entry.id}@coudeprogres.local`,
      when,
      `SUMMARY:${icsText(`${TYPES[entry.type]} - ${entry.title}`)}`,
      `DESCRIPTION:${icsText(entry.details || "Entrée CoudeProgres")}`,
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

function icsText(value) {
  return value.replaceAll("\\", "\\\\").replaceAll(";", "\\;").replaceAll(",", "\\,").replaceAll("\n", "\\n");
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
