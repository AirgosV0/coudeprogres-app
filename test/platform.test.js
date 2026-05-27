import test from "node:test";
import assert from "node:assert/strict";
import { createId } from "../js/platform.js";

test("crée un identifiant compatible lorsque randomUUID n'est pas disponible", () => {
  const source = {
    getRandomValues: bytes => {
      bytes.fill(0xab);
      return bytes;
    }
  };

  assert.equal(createId(source), "abababab-abab-4bab-abab-abababababab");
});
