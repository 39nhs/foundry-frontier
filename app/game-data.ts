export type ItemId =
  | 101 | 102 | 103
  | 201 | 202 | 203
  | 301 | 302 | 303
  | 401 | 402 | 403
  | 501 | 502 | 503
  | 601 | 602 | 603 | 604
  | 701 | 702 | 703
  | 711 | 712 | 713
  | 721 | 722 | 723
  | 801 | 802 | 803 | 804
  | 901 | 902 | 903 | 904 | 905;

export type BuildingType =
  | "core" | "miner" | "advancedMiner" | "outputter"
  | "refinery" | "crusher" | "parts" | "synthesizer"
  | "generator" | "inputter" | "seedExtractor" | "cultivator"
  | "bioprocessor";

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
  701: { id: 701, name: "태양포자 씨앗", short: "태양 씨앗", color: "#e7ba52" },
  702: { id: 702, name: "철갈대 씨앗", short: "갈대 씨앗", color: "#b86f45" },
  703: { id: 703, name: "서리이끼 씨앗", short: "서리 씨앗", color: "#77c8c2" },
  711: { id: 711, name: "태양포자", short: "태양포자", color: "#f0ce65" },
  712: { id: 712, name: "철갈대", short: "철갈대", color: "#c98559" },
  713: { id: 713, name: "서리이끼", short: "서리이끼", color: "#8fddd6" },
  721: { id: 721, name: "태양포자 추출물", short: "태양 추출", color: "#ffd978" },
  722: { id: 722, name: "철갈대 섬유", short: "갈대 섬유", color: "#d69667" },
  723: { id: 723, name: "서리이끼 효소", short: "서리 효소", color: "#a5eee8" },
  801: { id: 801, name: "바이오 탄소", short: "바이오 탄소", color: "#66736a" },
  802: { id: 802, name: "영양 젤", short: "영양 젤", color: "#b9d95f", sellPrice: 180 },
  803: { id: 803, name: "절연 수지", short: "절연 수지", color: "#63b9b0", sellPrice: 220 },
  804: { id: 804, name: "촉매 펄프", short: "촉매 펄프", color: "#d3a96a", sellPrice: 250 },
  901: { id: 901, name: "산업 폭약", short: "산업 폭약", color: "#e27c45", sellPrice: 320 },
  902: { id: 902, name: "회로 코팅제", short: "회로 코팅", color: "#4fcfc0", sellPrice: 380 },
  903: { id: 903, name: "복합 장갑판", short: "복합 장갑", color: "#aab2a5", sellPrice: 450 },
  904: { id: 904, name: "정밀 기어", short: "정밀 기어", color: "#d6a55f" },
  905: { id: 905, name: "열제어 모듈", short: "열제어 모듈", color: "#73d7cb", sellPrice: 650 },
};

// 배터리는 판매와 발전 양쪽에 쓰이므로 별도 번호 대역으로 관리합니다.
export const BATTERIES = {
  601: { id: 601, name: "1티어 배터리", short: "T1 전지", color: "#ffca47", sellPrice: 500, power: 2250 },
  602: { id: 602, name: "2티어 배터리", short: "T2 전지", color: "#39d8ca", sellPrice: 125, power: 1250 },
  603: { id: 603, name: "3티어 배터리", short: "T3 전지", color: "#aab7c3", sellPrice: 75, power: 500 },
  604: { id: 604, name: "바이오 하이브리드 전지", short: "바이오 전지", color: "#9edb64", sellPrice: 750, power: 3500 },
} as const;

export type AnyItemId = ItemId;
export const ALL_ITEMS = { ...ITEMS, ...BATTERIES } as Record<AnyItemId, ItemDefinition & { power?: number }>;

export interface Recipe {
  id: string;
  name: string;
  inputs: Partial<Record<AnyItemId, number>>;
  output: AnyItemId;
  amount: number;
  durationTicks?: number;
}

export const RECIPES: Record<BuildingType, Recipe[]> = {
  core: [], miner: [], advancedMiner: [], outputter: [], generator: [], inputter: [],
  seedExtractor: [
    { id: "seed-sunspore", name: "태양포자 채종", inputs: { 711: 1 }, output: 701, amount: 2 },
    { id: "seed-ironreed", name: "철갈대 채종", inputs: { 712: 1 }, output: 702, amount: 2 },
    { id: "seed-frostmoss", name: "서리이끼 채종", inputs: { 713: 1 }, output: 703, amount: 2 },
  ],
  cultivator: [
    { id: "grow-sunspore", name: "태양포자 재배", inputs: { 701: 1 }, output: 711, amount: 1, durationTicks: 3 },
    { id: "grow-ironreed", name: "철갈대 재배", inputs: { 702: 1 }, output: 712, amount: 1, durationTicks: 3 },
    { id: "grow-frostmoss", name: "서리이끼 재배", inputs: { 703: 1 }, output: 713, amount: 1, durationTicks: 3 },
  ],
  bioprocessor: [
    { id: "extract-sunspore", name: "태양포자 추출", inputs: { 711: 1 }, output: 721, amount: 2 },
    { id: "fiber-ironreed", name: "철갈대 섬유화", inputs: { 712: 1 }, output: 722, amount: 2 },
    { id: "enzyme-frostmoss", name: "서리이끼 효소화", inputs: { 713: 1 }, output: 723, amount: 2 },
    { id: "carbon-sunspore", name: "태양포자 탄화", inputs: { 711: 1 }, output: 801, amount: 1 },
    { id: "carbon-ironreed", name: "철갈대 탄화", inputs: { 712: 1 }, output: 801, amount: 1 },
    { id: "carbon-frostmoss", name: "서리이끼 탄화", inputs: { 713: 1 }, output: 801, amount: 1 },
    { id: "nutrient-gel", name: "영양 젤", inputs: { 721: 1, 722: 1 }, output: 802, amount: 1, durationTicks: 2 },
    { id: "insulation-resin", name: "절연 수지", inputs: { 722: 1, 723: 1 }, output: 803, amount: 1, durationTicks: 2 },
    { id: "catalyst-pulp", name: "촉매 펄프", inputs: { 721: 1, 723: 1 }, output: 804, amount: 1, durationTicks: 2 },
  ],
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
    { id: "industrial-explosive", name: "산업 폭약", inputs: { 721: 1, 301: 1 }, output: 901, amount: 1, durationTicks: 2 },
    { id: "circuit-coating", name: "회로 코팅제", inputs: { 803: 1, 502: 1 }, output: 902, amount: 1, durationTicks: 2 },
    { id: "composite-plating", name: "복합 장갑판", inputs: { 804: 1, 503: 1 }, output: 903, amount: 1, durationTicks: 2 },
    { id: "precision-gear", name: "정밀 기어", inputs: { 201: 1, 302: 1 }, output: 904, amount: 1, durationTicks: 2 },
  ],
  synthesizer: [
    { id: "battery-1", name: "1티어 배터리", inputs: { 401: 1, 501: 1 }, output: 601, amount: 1 },
    { id: "battery-2", name: "2티어 배터리", inputs: { 202: 1, 502: 1 }, output: 602, amount: 1 },
    { id: "battery-3", name: "3티어 배터리", inputs: { 403: 1, 503: 1 }, output: 603, amount: 1 },
    { id: "battery-bio", name: "바이오 하이브리드 전지", inputs: { 801: 1, 802: 1, 901: 1 }, output: 604, amount: 1, durationTicks: 3 },
    { id: "thermal-control-module", name: "열제어 모듈", inputs: { 904: 1, 402: 1, 803: 1 }, output: 905, amount: 1, durationTicks: 3 },
  ],
};

export interface BuildingDefinition {
  type: BuildingType;
  name: string;
  category: "채굴" | "재배" | "가공" | "물류" | "전력";
  cost: number;
  power: number;
  size: 3 | 5;
  inputPorts: 0 | 3 | 6;
  outputPorts: 0 | 3 | 6;
  description: string;
  glyph: string;
}

export const BUILDINGS: Record<BuildingType, BuildingDefinition> = {
  core: { type: "core", name: "코어", category: "물류", cost: 0, power: 0, size: 5, inputPorts: 6, outputPorts: 6, description: "모든 자원과 전력을 관리합니다.", glyph: "◆" },
  miner: { type: "miner", name: "채굴기", category: "채굴", cost: 20, power: 10, size: 3, inputPorts: 0, outputPorts: 0, description: "2·3티어 광맥을 2초마다 채굴하고 10초마다 코어로 자동 전송합니다.", glyph: "M" },
  advancedMiner: { type: "advancedMiner", name: "고급 채굴기", category: "채굴", cost: 75, power: 25, size: 3, inputPorts: 0, outputPorts: 0, description: "모든 티어 광맥을 2초마다 채굴하고 10초마다 코어로 자동 전송합니다.", glyph: "A" },
  outputter: { type: "outputter", name: "출력기", category: "물류", cost: 25, power: 25, size: 3, inputPorts: 3, outputPorts: 3, description: "코어의 지정 아이템을 벨트로 보냅니다.", glyph: "O" },
  refinery: { type: "refinery", name: "정제기", category: "가공", cost: 10, power: 15, size: 3, inputPorts: 3, outputPorts: 3, description: "광물을 정제합니다.", glyph: "R" },
  crusher: { type: "crusher", name: "분쇄기", category: "가공", cost: 10, power: 15, size: 3, inputPorts: 3, outputPorts: 3, description: "광물을 분쇄합니다.", glyph: "C" },
  parts: { type: "parts", name: "부품 가공기", category: "가공", cost: 25, power: 15, size: 3, inputPorts: 3, outputPorts: 3, description: "가공된 광물을 부품으로 만듭니다.", glyph: "P" },
  synthesizer: { type: "synthesizer", name: "합성기", category: "가공", cost: 100, power: 50, size: 3, inputPorts: 3, outputPorts: 3, description: "가공물과 부품으로 배터리를 만듭니다.", glyph: "S" },
  generator: { type: "generator", name: "전기 생성기", category: "전력", cost: 125, power: 0, size: 3, inputPorts: 3, outputPorts: 3, description: "10초마다 배터리를 전력으로 변환합니다.", glyph: "G" },
  inputter: { type: "inputter", name: "입력기", category: "물류", cost: 50, power: 50, size: 3, inputPorts: 3, outputPorts: 3, description: "10초마다 보관 아이템을 코어로 전송합니다.", glyph: "I" },
  seedExtractor: { type: "seedExtractor", name: "채종기", category: "재배", cost: 35, power: 10, size: 3, inputPorts: 3, outputPorts: 3, description: "식물 1개에서 씨앗 2개를 분리합니다.", glyph: "D" },
  cultivator: { type: "cultivator", name: "재배기", category: "재배", cost: 45, power: 20, size: 3, inputPorts: 3, outputPorts: 3, description: "씨앗을 6초 동안 길러 식물로 만듭니다.", glyph: "V" },
  bioprocessor: { type: "bioprocessor", name: "생물 가공기", category: "재배", cost: 70, power: 25, size: 3, inputPorts: 3, outputPorts: 3, description: "식물을 추출·탄화하고 복합 소재를 만듭니다.", glyph: "B" },
};

export const DIRECTIONS: Record<Direction, { x: number; y: number; arrow: string }> = {
  up: { x: 0, y: -1, arrow: "↑" }, right: { x: 1, y: 0, arrow: "→" },
  down: { x: 0, y: 1, arrow: "↓" }, left: { x: -1, y: 0, arrow: "←" },
};

export const SELLABLE_IDS = (Object.keys(ALL_ITEMS).map(Number) as AnyItemId[])
  .filter((id) => ALL_ITEMS[id].sellPrice !== undefined);

export const CHUNK_SIZE = 15;
export const MAP_RADIUS_CHUNKS = 15;
export const TOTAL_CHUNKS = (MAP_RADIUS_CHUNKS * 2 + 1) ** 2;
export const TICK_MS = 2000;
export const BUFFER_LIMIT = 50;
export const POWER_SETTLEMENT_TICKS = 5;
export const BASE_POWER_PRODUCTION = 200;
const ORE_SIZE = 3;
const ORE_ANCHOR_RANGE = CHUNK_SIZE - ORE_SIZE + 1;
const SECOND_ORE_OFFSET = Math.floor(ORE_ANCHOR_RANGE / 2);
const WILD_PLANT_BY_TIER = { 1: 711, 2: 712, 3: 713 } as const;

export function shouldSettlePower(tick: number) {
  return tick > 0 && tick % POWER_SETTLEMENT_TICKS === 0;
}

export function orthogonalTilePath(from: { x: number; y: number }, to: { x: number; y: number }) {
  const path: { x: number; y: number }[] = [];
  let { x, y } = from;
  const moveX = () => { while (x !== to.x) { x += Math.sign(to.x - x); path.push({ x, y }); } };
  const moveY = () => { while (y !== to.y) { y += Math.sign(to.y - y); path.push({ x, y }); } };
  if (Math.abs(to.x - x) >= Math.abs(to.y - y)) { moveX(); moveY(); }
  else { moveY(); moveX(); }
  return path;
}

export function isMapComplete(unlockedCount: number) {
  return unlockedCount >= TOTAL_CHUNKS;
}

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
  const countPercent = countRoll % 100;
  const count = besideStart ? 1 + (countRoll % 2) : countPercent < 40 ? 0 : countPercent < 85 ? 1 : 2;

  if (besideStart) {
    const alongEdge = hashNumber(cx, cy, 31 ^ worldSeed) % ORE_ANCHOR_RANGE;
    return Array.from({ length: count }, (_, index) => {
      const offset = index === 0 ? alongEdge : (alongEdge + SECOND_ORE_OFFSET) % ORE_ANCHOR_RANGE;
      if (cx === 1) return { x: cx * CHUNK_SIZE, y: offset, tier };
      if (cx === -1) return { x: cx * CHUNK_SIZE + CHUNK_SIZE - ORE_SIZE, y: offset, tier };
      if (cy === 1) return { x: offset, y: cy * CHUNK_SIZE, tier };
      return { x: offset, y: cy * CHUNK_SIZE + CHUNK_SIZE - ORE_SIZE, tier };
    });
  }

  const firstX = hashNumber(cx, cy, 31 ^ worldSeed) % ORE_ANCHOR_RANGE;
  return Array.from({ length: count }, (_, index) => ({
    x: cx * CHUNK_SIZE + (index === 0 ? firstX : (firstX + SECOND_ORE_OFFSET) % ORE_ANCHOR_RANGE),
    y: cy * CHUNK_SIZE + (hashNumber(cx, cy, (71 + index) ^ worldSeed) % ORE_ANCHOR_RANGE),
    tier,
  }));
}

export function plantsForChunk(cx: number, cy: number, worldSeed = 0) {
  const occupied = new Set<string>();
  for (const ore of oresForChunk(cx, cy, worldSeed)) {
    for (let y = ore.y; y < ore.y + ORE_SIZE; y += 1) for (let x = ore.x; x < ore.x + ORE_SIZE; x += 1) occupied.add(`${x},${y}`);
  }
  if (cx === 0 && cy === 0) {
    const coreStart = Math.floor((CHUNK_SIZE - BUILDINGS.core.size) / 2);
    for (let y = coreStart; y < coreStart + BUILDINGS.core.size; y += 1) for (let x = coreStart; x < coreStart + BUILDINGS.core.size; x += 1) occupied.add(`${x},${y}`);
  }

  const tier = oreTierForChunk(cx, cy);
  if (hashNumber(cx, cy, 151 ^ worldSeed) % 100 >= 10) return [];
  const item = WILD_PLANT_BY_TIER[tier];
  const firstCell = hashNumber(cx, cy, 211 ^ worldSeed) % (CHUNK_SIZE * CHUNK_SIZE);
  for (let offset = 0; offset < CHUNK_SIZE * CHUNK_SIZE; offset += 1) {
    const cell = (firstCell + offset) % (CHUNK_SIZE * CHUNK_SIZE);
    const x = cx * CHUNK_SIZE + cell % CHUNK_SIZE;
    const y = cy * CHUNK_SIZE + Math.floor(cell / CHUNK_SIZE);
    if (occupied.has(`${x},${y}`)) continue;
    return [{ x, y, item }];
  }
  return [];
}
