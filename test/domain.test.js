import test from "node:test";
import assert from "node:assert/strict";
import {
  exportCsv,
  exportIcs,
  filteredEntries,
  hasAutomaticTitle,
  hasDuplicatePlannedEntry,
  lifetimeSummary,
  makePlannedEntry,
  makeReportEntry,
  MOBILITY_FIELDS,
  mobilityProgress,
  monthCells,
  nextAppointmentsByType,
  normalizeJournal,
  reportsToComplete,
  sevenDaySummary,
  upcomingEntries
} from "../js/domain.js";

const entries = [
  { id: "1", status: "completed", type: "kine", date: "2026-04-08", time: "09:00", title: "Kiné avril", details: "", achievement: "Plus souple", nextStep: "" },
  { id: "2", status: "planned", type: "kine", date: "2026-05-25", time: "", title: "Kiné mai", details: "", achievement: "", nextStep: "" },
  { id: "3", status: "completed", type: "auto", date: "2026-05-27", time: "", title: "Mobilité", details: "", achievement: "Mouvement fait", nextStep: "" },
  { id: "4", status: "planned", type: "medical", date: "2026-06-03", time: "14:30", title: "Contrôle", details: "", achievement: "", nextStep: "" }
];

test("filtre les séances de kiné pour un mois demandé", () => {
  const result = filteredEntries(entries, { type: "kine", month: "2026-04" });
  assert.equal(result.length, 1);
  assert.equal(result[0].title, "Kiné avril");
});

test("trie l'historique par date d'événement puis par type", () => {
  const result = filteredEntries([
    { id: "auto", status: "completed", type: "auto", date: "2026-05-27", time: "", title: "Auto" },
    { id: "medical", status: "completed", type: "medical", date: "2026-05-27", time: "", title: "Médical" },
    { id: "kine", status: "completed", type: "kine", date: "2026-05-27", time: "", title: "Kiné" },
    { id: "old", status: "completed", type: "medical", date: "2026-05-20", time: "", title: "Ancien" }
  ]);

  assert.deepEqual(result.map(entry => entry.id), ["medical", "kine", "auto", "old"]);
});

test("résume les sept derniers jours avec une réussite", () => {
  const result = sevenDaySummary(entries, "2026-05-27");
  assert.equal(result.recentCount, 1);
  assert.equal(result.practices, 1);
  assert.match(result.message, /Mouvement fait/);
});

test("liste seulement les rendez-vous futurs utiles au tableau de bord", () => {
  assert.deepEqual(upcomingEntries(entries, "2026-05-27").map(entry => entry.id), ["4"]);
});

test("liste le prochain rendez-vous médical et le prochain rendez-vous kiné", () => {
  const result = nextAppointmentsByType([
    ...entries,
    { id: "m1", status: "planned", type: "medical", date: "2026-06-04", time: "08:00", title: "Médical 1" },
    { id: "m2", status: "planned", type: "medical", date: "2026-06-05", time: "08:00", title: "Médical 2" },
    { id: "m3", status: "planned", type: "medical", date: "2026-06-06", time: "08:00", title: "Médical 3" },
    { id: "m4", status: "planned", type: "medical", date: "2026-06-07", time: "08:00", title: "Médical 4" },
    { id: "m5", status: "planned", type: "medical", date: "2026-06-08", time: "08:00", title: "Médical 5" },
    { id: "5", status: "planned", type: "auto", date: "2026-05-28", time: "08:00", title: "Auto" },
    { id: "6", status: "planned", type: "kine", date: "2026-06-29", time: "09:00", title: "Kiné proche" },
    { id: "7", status: "planned", type: "kine", date: "2026-06-29", time: "09:00", title: "Kiné loin" }
  ], "2026-05-27");

  assert.deepEqual(result.map(entry => entry.id), ["4", "6"]);
});

test("propose un bilan pour un rendez-vous planifié qui est passé", () => {
  assert.deepEqual(reportsToComplete(entries, "2026-05-27").map(entry => entry.id), ["2"]);
});

test("transforme un rendez-vous planifié en bilan renseigné", () => {
  const planned = makePlannedEntry({ type: "kine", date: "2026-05-27", time: "10:00", title: "Cabinet", planningNotes: "" }, "5");
  const completed = makeReportEntry({
    type: planned.type, date: planned.date, time: planned.time, title: planned.title,
    duration: "30", pain: "3", flexion: "120", extension: "-10", pronation: "75", supination: "80", details: "Mobilité", achievement: "Mieux", nextStep: ""
  }, planned);
  assert.equal(completed.id, planned.id);
  assert.equal(completed.status, "completed");
  assert.equal(completed.pain, 3);
  assert.equal(completed.pronation, 75);
  assert.equal(completed.supination, 80);
});

test("utilise le type comme titre lorsqu'il est laissé vide", () => {
  const planned = makePlannedEntry({ type: "medical", date: "2026-06-01", time: "", title: "", planningNotes: "" });
  const report = makeReportEntry({
    type: "auto", date: "2026-05-27", time: "", title: "",
    duration: "", pain: "", flexion: "", extension: "", pronation: "", supination: "", details: "", achievement: "", nextStep: ""
  });
  assert.equal(planned.title, "Rendez-vous médical");
  assert.equal(report.title, "Autorééducation / Impression du jour");
  assert.equal(hasAutomaticTitle(planned), true);
  assert.equal(hasAutomaticTitle({ ...report, title: "Ressenti du soir" }), false);
});

test("détecte un rendez-vous planifié en doublon", () => {
  const planned = makePlannedEntry({ type: "kine", date: "2026-06-12", time: "09:00", title: "Cabinet", planningNotes: "Carte vitale" }, "existing");
  const duplicate = makePlannedEntry({ type: "kine", date: "2026-06-12", time: "09:00", title: " Cabinet ", planningNotes: "Carte   vitale" }, "new");
  const editedSameEntry = makePlannedEntry({ type: "kine", date: "2026-06-12", time: "09:00", title: "Cabinet", planningNotes: "Carte vitale" }, "existing");
  const otherSlot = makePlannedEntry({ type: "kine", date: "2026-06-12", time: "10:00", title: "Cabinet", planningNotes: "Carte vitale" }, "new");

  assert.equal(hasDuplicatePlannedEntry([planned], duplicate), true);
  assert.equal(hasDuplicatePlannedEntry([planned], editedSameEntry), false);
  assert.equal(hasDuplicatePlannedEntry([planned], otherSlot), false);
});

test("calcule les cumuls depuis le début des saisies", () => {
  const result = lifetimeSummary(entries, "2026-05-27");

  assert.equal(result.reports, 2);
  assert.equal(result.practices, 2);
  assert.equal(result.appointments, 0);
  assert.deepEqual(result.series.map(series => series.total), [2, 2, 0]);
  assert.deepEqual(result.series.map(series => series.monthCount), [1, 1, 0]);
});

test("préserve les anciennes notes en leur attribuant un statut", () => {
  const migrated = normalizeJournal({ entries: [
    { id: "old-plan", type: "medical", date: "2026-06-01", title: "Contrôle", details: "" },
    { id: "old-report", type: "kine", date: "2026-05-01", title: "Séance", achievement: "Gain" }
  ] });
  assert.equal(migrated.entries[0].status, "planned");
  assert.equal(migrated.entries[1].status, "completed");
  assert.equal(migrated.entries[0].pronation, "");
  assert.equal(migrated.entries[1].supination, "");
});

test("prépare les séries de progression des angles", () => {
  const progress = mobilityProgress([
    { id: "a", status: "completed", type: "kine", date: "2026-05-01", title: "Début", flexion: 90, extension: 30 },
    { id: "b", status: "completed", type: "kine", date: "2026-05-20", title: "Suite", flexion: 120, extension: 15, pronation: 70, supination: 60 }
  ]);
  const flexion = progress.find(metric => metric.key === "flexion");
  const extension = progress.find(metric => metric.key === "extension");
  const pronation = progress.find(metric => metric.key === "pronation");

  assert.equal(flexion.latest.value, 120);
  assert.equal(flexion.firstDelta, 30);
  assert.equal(extension.latest.value, -15);
  assert.equal(extension.firstDelta, 15);
  assert.equal(pronation.latest.value, 70);
  assert.equal(pronation.firstDelta, 0);
});

test("documente les repères habituels de mobilité", () => {
  const extension = MOBILITY_FIELDS.find(field => field.key === "extension");
  const flexion = MOBILITY_FIELDS.find(field => field.key === "flexion");
  const supination = MOBILITY_FIELDS.find(field => field.key === "supination");

  assert.equal(extension.scaleMin, -90);
  assert.equal(extension.normalMin, 0);
  assert.equal(extension.normalMax, 10);
  assert.equal(extension.displayValue(25), -25);
  assert.equal(extension.displayValue(-5), -5);
  assert.equal(flexion.normalMin, 140);
  assert.equal(flexion.normalMax, 150);
  assert.equal(supination.normalMax, 90);
});

test("le calendrier place les entrées à leur date", () => {
  const cells = monthCells("2026-04", entries, "2026-05-27");
  assert.equal(cells.find(cell => cell.iso === "2026-04-08").entries.length, 1);
});

test("les exports incluent les données attendues", () => {
  assert.match(exportCsv(entries), /Kiné avril/);
  assert.match(exportCsv(entries), /Planifié/);
  assert.match(exportCsv(entries), /Pronation \(degrés\)/);
  assert.match(exportCsv(entries), /Supination \(degrés\)/);
  assert.match(exportCsv(entries), /Séance payée \(o\/n\)/);
  assert.match(exportCsv(entries), /Date paiement/);
  assert.match(exportIcs(entries), /Contrôle/);
  assert.doesNotMatch(exportIcs(entries), /Mobilité/);
});
