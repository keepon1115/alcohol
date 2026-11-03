export const APP = "tankyu-alcohol";
export const types = [
  "ビール",
  "日本酒",
  "ワイン",
  "ウイスキー",
  "ブランデー",
  "焼酎",
  "その他",
];
export const presets = {
  ビール: [5, 350],
  クラフトビール: [7, 250],
  日本酒: [15, 115],
  ワイン: [12, 140],
  ウイスキー: [40, 40],
  ブランデー: [40, 40],
  焼酎: [25, 70],
};
export const observations = [
  "飲む前の香り",
  "口に含んだときの風味",
  "中盤の味・質感・刺激",
  "飲み込んだ直後の余韻",
  "最後まで残った風味・消え方",
  "連想した情景や物語",
];
export const uid = () => crypto.randomUUID();
export const today = (d = new Date()) =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
export function validDate(s) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    !isNaN(Date.parse(s)) &&
    new Date(s).toISOString().slice(0, 10) === s
  );
}
export function week(date = today()) {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
export function addDays(date, n) {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function alcohol(abv, ml) {
  if (
    !Number.isFinite(abv) ||
    !Number.isFinite(ml) ||
    abv < 0 ||
    abv > 100 ||
    ml <= 0 ||
    ml > 100000 ||
    Math.abs(abv * 100 - Math.round(abv * 100)) > 1e-7 ||
    Math.abs(ml * 10 - Math.round(ml * 10)) > 1e-7
  )
    throw Error(
      "度数は0〜100%（小数2桁まで）、容量は0より大きい値（小数1桁まで）で入力してください。",
    );
  return Math.round(abv * 100) * Math.round(ml * 10) * 8;
}
export const grams = (u) => u / 1000000;
export const fmt = (g) => (g > 0 && g < 0.1 ? "0.1未満" : g.toFixed(1));
export function emptyData() {
  return {
    products: [],
    records: [],
    impressions: [],
    articles: [],
    wishlist: [],
    settings: {
      targetHistory: [{ from: "1900-01-01", daily: 14, weekly: 28, days: 2 }],
      lastBackupExportAt: "",
    },
  };
}
export function target(data, date = today()) {
  return (
    [...data.settings.targetHistory]
      .sort((a, b) => b.from.localeCompare(a.from))
      .find((x) => x.from <= week(date)) || { daily: 14, weekly: 28, days: 2 }
  );
}
export function summary(data, date = today()) {
  const start = week(date),
    end = addDays(start, 7);
  const rs = data.records.filter((r) => r.drankOn >= start && r.drankOn < end);
  return {
    start,
    end: addDays(start, 6),
    weekly: rs.reduce((s, r) => s + alcohol(r.abvPercent, r.volumeMl), 0),
    daily: rs
      .filter((r) => r.drankOn === date)
      .reduce((s, r) => s + alcohol(r.abvPercent, r.volumeMl), 0),
    days: new Set(rs.filter((r) => r.abvPercent > 0).map((r) => r.drankOn))
      .size,
  };
}
export function validateBackup(o) {
  if (o?.app !== APP || o.schemaVersion !== 1)
    throw Error("この版の探究お酒のJSONバックアップを選んでください。");
  const d = o.data;
  for (const k of [
    "products",
    "records",
    "impressions",
    "articles",
    "wishlist",
  ]) {
    if (!Array.isArray(d?.[k])) throw Error("保存データの形式が不正です。");
    const ids = new Set();
    for (const x of d[k]) {
      if (!x || typeof x.id !== "string" || !x.id || ids.has(x.id))
        throw Error("IDが不正または重複しています。");
      ids.add(x.id);
    }
  }
  const ps = new Set(d.products.map((p) => p.id)),
    rs = new Set(d.records.map((r) => r.id));
  for (const p of d.products)
    if (typeof p.name !== "string" || typeof p.type !== "string")
      throw Error("商品情報が不正です。");
  for (const r of d.records) {
    if (
      !validDate(r.drankOn) ||
      typeof r.nameSnapshot !== "string" ||
      typeof r.typeSnapshot !== "string" ||
      typeof r.place !== "string" ||
      (r.productId !== null && !ps.has(r.productId))
    )
      throw Error("飲酒記録が不正です。");
    alcohol(r.abvPercent, r.volumeMl);
  }
  for (const i of d.impressions) {
    if (
      !rs.has(i.recordId) ||
      !["initial", "addition"].includes(i.kind) ||
      typeof i.originalText !== "string" ||
      typeof i.currentText !== "string" ||
      !Array.isArray(i.revisions) ||
      !Array.isArray(i.originalObservations) ||
      !Array.isArray(i.currentObservations) ||
      i.originalObservations.length !== 6 ||
      i.currentObservations.length !== 6 ||
      ![...i.originalObservations, ...i.currentObservations].every(
        (x) => typeof x === "string",
      ) ||
      !i.revisions.every(
        (x) =>
          typeof x.text === "string" &&
          Array.isArray(x.observations) &&
          x.observations.length === 6 &&
          x.observations.every((v) => typeof v === "string"),
      )
    )
      throw Error("感想または原文履歴が不正です。");
  }
  if (
    !Array.isArray(d.settings?.targetHistory) ||
    !d.settings.targetHistory.length
  )
    throw Error("設定が不正です。");
  for (const t of d.settings.targetHistory)
    if (
      !validDate(t.from) ||
      ![t.daily, t.weekly].every(
        (v) => Number.isFinite(v) && v >= 0 && v <= 100000,
      ) ||
      !Number.isInteger(t.days) ||
      t.days < 0 ||
      t.days > 7
    )
      throw Error("目標設定が不正です。");
  return d;
}
