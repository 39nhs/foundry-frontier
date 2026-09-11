export type ItemId =
  | 101 | 102 | 103
  | 201 | 202 | 203
  | 301 | 302 | 303
  | 401 | 402 | 403
  | 501 | 502 | 503
  | 601 | 602 | 603;

export type BuildingType =
  | "core" | "miner" | "advancedMiner" | "outputter"
  | "refinery" | "crusher" | "parts" | "synthesizer"
  | "generator" | "inputter";

export type Direction = "up" | "right" | "down" | "left";

export interface ItemDefinition {
  id: ItemId;
  name: string;
  short: string;
  color: string;
  sellPrice?: number;
}

export const ITEMS: Partial<Record<ItemId, ItemDefinition>> = {
  101: { id: 101, name: "1티어 광물", short: "T1 원광", color: "#ffd166", sellPrice: 3 },
  102: { id: 102, name: "2티어 광물", short: "T2 원광", color: "#58d6c7", sellPrice: 2 },
  103: { id: 103, name: "3티어 광물", short: "T3 원광", color: "#9aa8b8", sellPrice: 1 },
  201: { id: 201, name: "정제된 1티어 광물", short: "T1 정제", color: "#ffe29a" },
  202: { id: 202, name: "정제된 2티어 광물", short: "T2 정제", color: "#89eee2" },
  203: { id: 203, name: "정제된 3티어 광물", short: "T3 정제", color: "#c3ccd5" },
  301: { id: 301, name: "분쇄된 1티어 광물", short: "T1 분쇄", color: "#eabf63" },
  302: { id: 302, name: "분쇄된 2티어 광물", short: "T2 분쇄", color: "#3ab9ad" },
  303: { id: 303, name: "분쇄된 3티어 광물", short: "T3 분쇄", color: "#778594" },
  401: { id: 401, name: "곱게 정제된 1티어 광물", short: "T1 미세정제", color: "#fff0bd" },
  402: { id: 402, name: "곱게 분쇄된 2티어 광물", short: "T2 미세분쇄", color: "#b3fff7" },
  403: { id: 403, name: "곱게 정제된 3티어 광물", short: "T3 미세정제", color: "#e5ebf0" },
  501: { id: 501, name: "1티어 부품", short: "T1 부품", color: "#ffb938", sellPrice: 125 },
  502: { id: 502, name: "2티어 부품", short: "T2 부품", color: "#22c8b7", sellPrice: 65 },
  503: { id: 503, name: "3티어 부품", short: "T3 부품", color: "#91a0ae", sellPrice: 40 },
};

// 배터리는 판매와 발전 양쪽에 쓰이므로 별도 번호 대역으로 관리합니다.
export const BATTERIES = {
  601: { id: 601, name: "1티어 배터리", short: "T1 전지", color: "#ffca47", sellPrice: 500, power: 2250 },
  602: { id: 602, name: "2티어 배터리", short: "T2 전지", color: "#39d8ca", sellPrice: 125, power: 1250 },
  603: { id: 603, name: "3티어 배터리", short: "T3 전지", color: "#aab7c3", sellPrice: 75, power: 500 },
} as const;

export type AnyItemId = ItemId;
export const ALL_ITEMS = { ...ITEMS, ...BATTERIES } as Record<AnyItemId, ItemDefinition & { power?: number }>;

export interface Recipe {
  id: string;
  name: string;
  inputs: Partial<Record<AnyItemId, number>>;
  output: AnyItemId;
  amount: number;
}

export const RECIPES: Record<BuildingType, Recipe[]> = {
  core: [], miner: [], advancedMiner: [], outputter: [], generator: [], inputter: [],
  refinery: [
    { id: "refine-1", name: "1티어 정제", inputs: { 101: 1 }, output: 201, amount: 1 },
    { id: "refine-2", name: "2티어 정제", inputs: { 102: 1 }, output: 202, amount: 1 },
    { id: "refine-3", name: "3티어 정제", inputs: { 103: 1 }, output: 203, amount: 1 },
    { id: "fine-refine-1", name: "1티어 미세 정제", inputs: { 301: 1 }, output: 401, amount: 1 },
    { id: "fine-refine-3", name: "3티어 미세 정제", inputs: { 303: 1 }, output: 403, amount: 1 },
  ],
  crusher: [
    { id: "crush-1", name: "1티어 분쇄", inputs: { 101: 1 }, output: 301, amount: 1 },
    { id: "crush-2", name: "2티어 분쇄", inputs: { 102: 1 }, output: 302, amount: 1 },
    { id: "crush-3", name: "3티어 분쇄", inputs: { 103: 1 }, output: 303, amount: 1 },
    { id: "fine-crush-2", name: "2티어 미세 분쇄", inputs: { 202: 1 }, output: 402, amount: 1 },
  ],
  parts: [
    { id: "parts-1", name: "1티어 부품", inputs: { 401: 1 }, output: 501, amount: 1 },
    { id: "parts-2", name: "2티어 부품", inputs: { 202: 1 }, output: 502, amount: 1 },
    { id: "parts-3", name: "3티어 부품", inputs: { 203: 1 }, output: 503, amount: 1 },
  ],
  synthesizer: [
    { id: "battery-1", name: "1티어 배터리", inputs: { 401: 1, 501: 1 }, output: 601, amount: 1 },
    { id: "battery-2", name: "2티어 배터리", inputs: { 202: 1, 502: 1 }, output: 602, amount: 1 },
    { id: "battery-3", name: "3티어 배터리", inputs: { 403: 1, 503: 1 }, output: 603, amount: 1 },
  ],
};

export interface BuildingDefinition {
  type: BuildingType;
  name: string;
  category: "채굴" | "가공" | "물류" | "전력";
  cost: number;
  power: number;
  size: 3 | 5;
  inputPorts: 3 | 6;
  outputPorts: 3 | 6;
  description: string;
  glyph: string;
}

export const BUILDINGS: Record<BuildingType, BuildingDefinition> = {
  core: { type: "core", name: "코어", category: "물류", cost: 0, power: 0, size: 5, inputPorts: 6, outputPorts: 6, description: "모든 자원과 전력을 관리합니다.", glyph: "◆" },
  miner: { type: "miner", name: "채굴기", category: "채굴", cost: 20, power: 10, size: 3, inputPorts: 3, outputPorts: 3, description: "2·3티어 광맥을 1틱마다 채굴합니다.", glyph: "M" },
  advancedMiner: { type: "advancedMiner", name: "고급 채굴기", category: "채굴", cost: 75, power: 25, size: 3, inputPorts: 3, outputPorts: 3, description: "모든 티어 광맥을 1틱마다 채굴합니다.", glyph: "A" },
  outputter: { type: "outputter", name: "출력기", category: "물류", cost: 25, power: 25, size: 3, inputPorts: 3, outputPorts: 3, description: "코어의 지정 아이템을 벨트로 보냅니다.", glyph: "O" },
  refinery: { type: "refinery", name: "정제기", category: "가공", cost: 10, power: 15, size: 3, inputPorts: 3, outputPorts: 3, description: "광물을 정제합니다.", glyph: "R" },
  crusher: { type: "crusher", name: "분쇄기", category: "가공", cost: 10, power: 15, size: 3, inputPorts: 3, outputPorts: 3, description: "광물을 분쇄합니다.", glyph: "C" },
  parts: { type: "parts", name: "부품 가공기", category: "가공", cost: 25, power: 15, size: 3, inputPorts: 3, outputPorts: 3, description: "가공된 광물을 부품으로 만듭니다.", glyph: "P" },
  synthesizer: { type: "synthesizer", name: "합성기", category: "가공", cost: 100, power: 50, size: 3, inputPorts: 3, outputPorts: 3, description: "가공물과 부품으로 배터리를 만듭니다.", glyph: "S" },
  generator: { type: "generator", name: "전기 생성기", category: "전력", cost: 125, power: 0, size: 3, inputPorts: 3, outputPorts: 3, description: "10틱마다 배터리를 전력으로 변환합니다.", glyph: "G" },
  inputter: { type: "inputter", name: "입력기", category: "물류", cost: 50, power: 50, size: 3, inputPorts: 3, outputPorts: 3, description: "5틱마다 보관 아이템을 코어로 전송합니다.", glyph: "I" },
};

export const DIRECTIONS: Record<Direction, { x: number; y: number; arrow: string }> = {
  up: { x: 0, y: -1, arrow: "↑" }, right: { x: 1, y: 0, arrow: "→" },
  down: { x: 0, y: 1, arrow: "↓" }, left: { x: -1, y: 0, arrow: "←" },
};

export const SELLABLE_IDS = (Object.keys(ALL_ITEMS).map(Number) as AnyItemId[])
  .filter((id) => ALL_ITEMS[id].sellPrice !== undefined);

export const CHUNK_SIZE = 10;
export const MAP_RADIUS_CHUNKS = 15;
export const TICK_MS = 2000;
export const BUFFER_LIMIT = 50;

export function chunkPrice(purchases: number) {
  const n = purchases + 1;
  return Math.round(500 * n * Math.log2(n + 1));
}

export function oreTierForChunk(cx: number, cy: number): 1 | 2 | 3 {
  const distance = Math.max(Math.abs(cx), Math.abs(cy));
  if (distance <= 5) return 3;
  if (distance <= 10) return 2;
  return 1;
}

function hashNumber(x: number, y: number, salt = 0) {
  let value = Math.imul(x + 32768, 374761393) ^ Math.imul(y + 32768, 668265263) ^ salt;
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return (value ^ (value >>> 16)) >>> 0;
}

export function oresForChunk(cx: number, cy: number, worldSeed = 0) {
  const tier = oreTierForChunk(cx, cy);
  if (cx === 0 && cy === 0) return [];

  const besideStart = Math.abs(cx) + Math.abs(cy) === 1;
  const countRoll = hashNumber(cx, cy, 11 ^ worldSeed);
  const count = besideStart ? 1 + (countRoll % 2) : countRoll % 3;

  if (besideStart) {
    const alongEdge = hashNumber(cx, cy, 31 ^ worldSeed) % 8;
    return Array.from({ length: count }, (_, index) => {
      const offset = index === 0 ? alongEdge : (alongEdge + 4) % 8;
      if (cx === 1) return { x: cx * CHUNK_SIZE, y: offset, tier };
      if (cx === -1) return { x: cx * CHUNK_SIZE + 7, y: offset, tier };
      if (cy === 1) return { x: offset, y: cy * CHUNK_SIZE, tier };
      return { x: offset, y: cy * CHUNK_SIZE + 7, tier };
    });
  }

  const firstX = hashNumber(cx, cy, 31 ^ worldSeed) % 8;
  return Array.from({ length: count }, (_, index) => ({
    x: cx * CHUNK_SIZE + (index === 0 ? firstX : (firstX + 4) % 8),
    y: cy * CHUNK_SIZE + (hashNumber(cx, cy, (71 + index) ^ worldSeed) % 8),
    tier,
  }));
}
