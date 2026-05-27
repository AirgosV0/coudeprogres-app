import test from "node:test";
import assert from "node:assert/strict";
import {
  exportCsv,
  exportIcs,
  filteredEntries,
  monthCells,
  sevenDaySummary,
  upcomingEntries
} from "../js/domain.js";

const entries = [
  { id: "1", type: "kine", date: "2026-04-08", time: "09:00", title: "Kiné avril", details: "", achievement: "Plus souple", nextStep: "" },
  { id: "2", type: "kine", date: "2026-05-25", time: "", title: "Kiné mai", details: "", achievement: "", nextStep: "" },
  { id: "3", type: "auto", date: "2026-05-27", time: "", title: "Mobilité", details: "", achievement: "Mouvement fait", nextStep: "" },
  { id: "4", type: "medical", date: "2026-06-03", time: "14:30", title: "Contrôle", details: "", achievement: "", nextStep: "" }
];

test("filtre les séances de kiné pour un mois demandé", () => {
  const result = filteredEntries(entries, { type: "kine", month: "2026-04" });
  assert.equal(result.length, 1);
  assert.equal(result[0].title, "Kiné avril");
});

test("résume les sept derniers jours avec une réussite", () => {
  const result = sevenDaySummary(entries, "2026-05-27");
  assert.equal(result.recentCount, 2);
  assert.equal(result.practices, 2);
  assert.match(result.message, /Mouvement fait/);
});

test("liste seulement les rendez-vous futurs utiles au tableau de bord", () => {
  assert.deepEqual(upcomingEntries(entries, "2026-05-27").map(entry => entry.id), ["4"]);
});

test("le calendrier place les entrées à leur date", () => {
  const cells = monthCells("2026-04", entries, "2026-05-27");
  assert.equal(cells.find(cell => cell.iso === "2026-04-08").entries.length, 1);
});

test("les exports incluent les données attendues", () => {
  assert.match(exportCsv(entries), /Kiné avril/);
  assert.match(exportIcs(entries), /Contrôle/);
  assert.doesNotMatch(exportIcs(entries), /Mobilité/);
});
