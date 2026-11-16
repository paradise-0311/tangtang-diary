export const RECORD_TYPES = ["bottle", "diaper", "bilirubin", "temperature", "weight", "medication"];
export const BACKUP_LIMIT = 8 * 1024 * 1024;
export const RECORD_LIMIT = 50000;
const FORMAT = "tangtang-journal-backup";
const FORMATS = new Set([FORMAT, "xiaoman-journal-backup"]);
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const empty = value => value === undefined || value === null || value === "";
const text = value => typeof value === "string";
const filled = value => text(value) && value.trim() !== "";
const optionalText = value => empty(value) || text(value);
// Older records can contain numbers represented as strings. Keep the original value and unit.
const numeric = value => (typeof value === "number" || filled(value) &&
  /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim())) &&
  Number.isFinite(Number(value)) && Number(value) >= 0;
const optionalNumeric = value => empty(value) || numeric(value);

function timestamp(value) {
  if (!text(value) || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/i.test(value) ||
      !Number.isFinite(Date.parse(value))) return false;
  // Date.parse can silently roll an invalid date (e.g. February 30) into the next month.
  const day = value.slice(0, 10);
  return new Date(day + "T00:00:00Z").toISOString().slice(0, 10) === day;
}

const validatePayload = {
  bottle: p => ["expressed", "formula", "mixed"].includes(p.milk_type) && numeric(p.amount_ml) &&
    (p.has_fortifier === undefined || typeof p.has_fortifier === "boolean") &&
    optionalText(p.fortifier_product) && optionalNumeric(p.fortifier_amount) &&
    optionalText(p.fortifier_unit) && optionalText(p.fortifier_note),
  diaper: p => ["wet", "dirty", "both"].includes(p.kind) && optionalText(p.color),
  bilirubin: p => ["TcB", "TSB"].includes(p.method) && numeric(p.value) && filled(p.unit) && optionalText(p.site),
  temperature: p => numeric(p.value) && optionalText(p.site),
  weight: p => numeric(p.value) && filled(p.unit),
  medication: p => filled(p.name) && numeric(p.dose) && filled(p.unit) && optionalText(p.route)
};

export function makeBackup(snapshot, exportedAt = new Date().toISOString()) {
  return {format:FORMAT, schema_version:1, exported_at:exportedAt,
    profile:snapshot.profile, records:snapshot.records, settings:{dark:!!snapshot.settings.dark}};
}

export function validateBackup(input) {
  if (!object(input) || !FORMATS.has(input.format) || input.schema_version !== 1) {
    throw new Error("不是受支持的糖糖日记 JSON 备份");
  }
  if (!timestamp(input.exported_at)) throw new Error("备份的导出时间无效");
  const {profile, records, settings} = input;
  if (!object(profile) || !text(profile.nickname) ||
      (!empty(profile.born_at) && !timestamp(profile.born_at)) ||
      !optionalNumeric(profile.gestational_weeks) || !optionalNumeric(profile.gestational_days) ||
      !optionalNumeric(profile.birth_weight_g)) throw new Error("备份中的宝宝资料无效");
  if (!Array.isArray(records) || records.length > RECORD_LIMIT) throw new Error("备份的记录列表无效或记录过多");
  if (settings !== undefined && (!object(settings) ||
      (settings.dark !== undefined && typeof settings.dark !== "boolean"))) throw new Error("备份中的设置无效");

  const seen = new Set();
  for (const [index, record] of records.entries()) {
    const invalid = field => new Error(`备份第 ${index + 1} 条记录${field}`);
    if (!object(record) || !filled(record.record_id) || record.record_id.length > 150 ||
        !RECORD_TYPES.includes(record.type)) throw invalid("的编号或类型无效");
    if (seen.has(record.record_id)) throw invalid("的编号重复");
    seen.add(record.record_id);
    if (!timestamp(record.occurred_at) ||
        (record.created_at !== undefined && !timestamp(record.created_at)) ||
        (record.updated_at !== undefined && !timestamp(record.updated_at)) ||
        (record.deleted_at != null && !timestamp(record.deleted_at))) throw invalid("的时间无效");
    if (record.revision !== undefined && (!Number.isSafeInteger(record.revision) ||
        record.revision < 1)) throw invalid("的修订编号无效");
    if (!object(record.payload) || !optionalText(record.payload.note) ||
        !validatePayload[record.type](record.payload)) throw invalid("的记录内容无效");
  }
  return {version:1, profile, records, settings:{dark:settings?.dark ?? false, last_export_at:null}};
}

export function quoteCSV(value) {
  let cell = String(value ?? "");
  // Quote the value as text for Excel, before normal CSV escaping. Include whitespace and fullwidth operators.
  if (typeof value === "string" && (/^[\t\r\n]/.test(cell) || /^[\s\u0000-\u001f\u200b]*[=+\-@＝＋－＠]/.test(cell))) {
    cell = "'" + cell;
  }
  return `"${cell.replace(/"/g, '""')}"`;
}
