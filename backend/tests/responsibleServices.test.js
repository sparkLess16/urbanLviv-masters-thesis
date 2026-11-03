import test from "node:test";
import assert from "node:assert/strict";
import Report from "../src/models/Report.js";
import {
  FALLBACK_SERVICE,
  RESPONSIBLE_SERVICES,
  resolveResponsibleService,
} from "../src/config/responsibleServices.js";

const reportTypes = Report.schema.path("type_id").enumValues;

test("every report type has a non-empty responsible service", () => {
  for (const type_id of reportTypes) {
    const entry = RESPONSIBLE_SERVICES[type_id];
    assert.ok(entry, `no service configured for type ${type_id}`);
    assert.ok(entry.default.name.trim(), `empty name for ${type_id}`);
    assert.ok(entry.default.name_uk.trim(), `empty name_uk for ${type_id}`);
    assert.ok(resolveResponsibleService({ type_id, district_id: "x" }));
  }
});

test("unknown type falls back to the city administration", () => {
  assert.equal(
    resolveResponsibleService({ type_id: "unknown" }),
    FALLBACK_SERVICE.name,
  );
  assert.equal(resolveResponsibleService(null), FALLBACK_SERVICE.name);
});

test("a district exception wins over the default", () => {
  const entry = RESPONSIBLE_SERVICES.garbage;
  entry.byDistrict.test_district = {
    name: "Local service",
    name_uk: "Локальна",
  };
  try {
    assert.equal(
      resolveResponsibleService({
        type_id: "garbage",
        district_id: "test_district",
      }),
      "Local service",
    );
    assert.equal(
      resolveResponsibleService({ type_id: "garbage", district_id: "other" }),
      entry.default.name,
    );
  } finally {
    delete entry.byDistrict.test_district;
  }
});
