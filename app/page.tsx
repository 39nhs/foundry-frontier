"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { Box, Check, Coins, Factory, Gauge, Hammer, HelpCircle, Map, Move, Power, RotateCw, ShoppingCart, Trash2, Volume2, VolumeX, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ALL_ITEMS, BASE_POWER_PRODUCTION, BUFFER_LIMIT, BUILDINGS, BuildingType, CHUNK_SIZE, Direction, DIRECTIONS, MAP_RADIUS_CHUNKS, POWER_SETTLEMENT_TICKS, RECIPES, SELLABLE_IDS, TICK_MS, TOTAL_CHUNKS, AnyItemId, Recipe, chunkPrice, isMapComplete, oresForChunk, orthogonalTilePath, plantsForChunk, shouldSettlePower } from "./game-data";

type Inventory = Partial<Record<AnyItemId, number>>;
type GamePhase = "READY" | "PLAYING" | "VICTORY" | "COMPLETED" | "GAME_OVER";
type SoundKind = "build" | "belt" | "remove" | "mine" | "sale" | "unlock" | "return" | "warning";
type BeltKind = "normal" | "cross" | "splitter" | "merger";
type GiveCommand = { kind: "gold"; amount: number } | { kind: "all" };
interface PlacedBuilding { id: string; type: BuildingType; x: number; y: number; recipeId?: string; selectedOutput?: AnyItemId; outputSelections?: Partial<Record<number, AnyItemId>>; input: Inventory; output: Inventory; active: boolean }
interface Belt { x: number; y: number; direction: Direction; kind?: BeltKind; item?: AnyItemId; secondaryItem?: AnyItemId; splitIndex?: 0 | 1 }
interface BeltPlanTile { x: number; y: number; direction: Direction }
interface SaleLine { item: AnyItemId; quantity: number }
interface GameState { dataVersion: number; phase: GamePhase; chunkSize: number; worldSeed: number; gold: number; power: number; powerCapacity: number; tick: number; pendingPowerUsed: number; lastPowerProduced: number; lastPowerUsed: number; lastPowerDelta: number; unlockedChunks: string[]; mapCompletionAcknowledged: boolean; harvestedPlants: string[]; buildings: PlacedBuilding[]; belts: Belt[]; core: Inventory; stagedSales: SaleLine[]; message: string }

const TILE = 40;
const SAVE_KEY = "foundry-frontier-save-v1";
const DATA_VERSION = 2;
const STARTER_SEEDS: Inventory = { 701: 2, 702: 2, 703: 2 };
const MAX_GOLD = 999_999_999;
const TICK_SECONDS = TICK_MS / 1000;
const COMMAND_TRIGGER_WINDOW_MS = 1_200;
const BELT_KINDS: BeltKind[] = ["normal", "cross", "splitter", "merger"];
const BELT_KIND_LABEL: Record<BeltKind, string> = { normal: "일반", cross: "교차", splitter: "분배", merger: "합류" };
const PUBLIC_BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const publicAsset = (path: string) => `${PUBLIC_BASE_PATH}${path}`;
const createWorldSeed = () => Math.floor(Math.random() * 0x7fffffff);
const chunkKey = (x: number, y: number) => `${x},${y}`;
const tileKey = (x: number, y: number) => `${x},${y}`;
const CORE_START_TILE = Math.floor((CHUNK_SIZE - BUILDINGS.core.size) / 2);
const CAMERA_START = CHUNK_SIZE * TILE / 2;
const defaultCoreOutputs = (): Partial<Record<number, AnyItemId>> => Object.fromEntries(Array.from({ length: 6 }, (_, index) => [index, 103])) as Partial<Record<number, AnyItemId>>;
const coreBuilding = (): PlacedBuilding => ({ id: "core", type: "core", x: CORE_START_TILE, y: CORE_START_TILE, outputSelections: defaultCoreOutputs(), input: {}, output: {}, active: true });
const initialGame = (phase: GamePhase = "READY"): GameState => ({ dataVersion: DATA_VERSION, phase, chunkSize: CHUNK_SIZE, worldSeed: createWorldSeed(), gold: 1000, power: 10000, powerCapacity: 10000, tick: 0, pendingPowerUsed: 0, lastPowerProduced: 200, lastPowerUsed: 0, lastPowerDelta: 200, unlockedChunks: ["0,0"], mapCompletionAcknowledged: false, harvestedPlants: [], buildings: [coreBuilding()], belts: [], core: { ...STARTER_SEEDS }, stagedSales: [], message: "광맥이 없는 시작 광구입니다. 야생 식물을 채집하거나 주변을 탐사하세요." });
const BUILDING_SPRITE: Record<BuildingType, [number, number]> = { core: [0, 0], miner: [25, 0], advancedMiner: [50, 0], outputter: [75, 0], refinery: [100, 0], crusher: [0, 100], parts: [25, 100], synthesizer: [50, 100], generator: [75, 100], inputter: [100, 100], seedExtractor: [0, 100], cultivator: [75, 0], bioprocessor: [50, 100] };
const BUILDING_IMAGE: Partial<Record<BuildingType, string>> = { seedExtractor: publicAsset("/assets/building-seed-extractor.png"), cultivator: publicAsset("/assets/building-cultivator.png"), bioprocessor: publicAsset("/assets/building-bioprocessor.png") };
const ITEM_SPRITES: AnyItemId[] = [101, 102, 103, 201, 202, 203, 301, 302, 303, 401, 402, 403, 501, 502, 503, 601, 602, 603];
const ITEM_SPRITE_SOURCE: Partial<Record<AnyItemId, AnyItemId>> = { 604: 601, 701: 101, 702: 102, 703: 103, 711: 201, 712: 202, 713: 203, 721: 301, 722: 302, 723: 303, 801: 403, 802: 401, 803: 402, 804: 403, 901: 501, 902: 502, 903: 503, 904: 501, 905: 602 };
const ITEM_IMAGE: Partial<Record<AnyItemId, string>> = { 711: publicAsset("/assets/plant-sunspore.png"), 712: publicAsset("/assets/plant-ironreed.png"), 713: publicAsset("/assets/plant-frostmoss.png") };
const buildingSpriteStyle = (type: BuildingType): CSSProperties => BUILDING_IMAGE[type]
  ? { backgroundImage: `url("${BUILDING_IMAGE[type]}")`, backgroundPosition: "center", backgroundSize: "contain" }
  : { backgroundPosition: `${BUILDING_SPRITE[type][0]}% ${BUILDING_SPRITE[type][1]}%` };
const itemSpriteStyle = (id: AnyItemId): CSSProperties => { const image = ITEM_IMAGE[id]; if (image) return { backgroundImage: `url("${image}")`, backgroundPosition: "center", backgroundSize: "contain" }; const index = ITEM_SPRITES.indexOf(ITEM_SPRITE_SOURCE[id] ?? id); return { backgroundPosition: `${(index % 6) * 20}% ${Math.floor(index / 6) * 50}%` }; };
const chunkLocal = (value: number) => ((value % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
const migrateTileCoordinate = (value: number, previousChunkSize: number) => {
  const chunk = Math.floor(value / previousChunkSize);
  const local = value - chunk * previousChunkSize;
  return chunk * CHUNK_SIZE + local;
};

function inventoryCount(inventory: Inventory, id: AnyItemId) { return inventory[id] ?? 0; }
function inventoryTotal(inventory: Inventory) { return Object.values(inventory).reduce((sum, amount) => sum + (amount ?? 0), 0); }
function addItem(inventory: Inventory, id: AnyItemId, amount: number, limit = Infinity) { inventory[id] = Math.max(0, Math.min(limit, inventoryCount(inventory, id) + amount)); }
function hasInventory(inventory: Inventory) { return Object.values(inventory).some((amount) => (amount ?? 0) > 0); }
function inventoryTypeCount(inventory: Inventory) { return Object.values(inventory).filter((amount) => (amount ?? 0) > 0).length; }
export function parseGiveCommand(value: string): GiveCommand | undefined {
  const command = value.trim().toLowerCase();
  if (command === "give all") return { kind: "all" };
  const match = command.match(/^give\s+(\d+)$/);
  if (!match) return undefined;
  const amount = Number(match[1]);
  return Number.isSafeInteger(amount) && amount > 0 ? { kind: "gold", amount } : undefined;
}
export function applyGiveCommand(state: GameState, command: GiveCommand): GameState {
  if (command.kind === "all") {
    const core = { ...state.core };
    for (const id of Object.keys(ALL_ITEMS)) addItem(core, Number(id) as AnyItemId, 999);
    return { ...state, core, message: `개발자 명령 적용 · 모든 재료 ${Object.keys(ALL_ITEMS).length}종을 999개씩 추가` };
  }
  const gold = Math.min(MAX_GOLD, state.gold + command.amount);
  return { ...state, gold, message: `개발자 명령 적용 · 골드 ${(gold - state.gold).toLocaleString()} G 추가` };
}
function inputSlotLimit(building: PlacedBuilding) {
  if (building.type === "core") return Infinity;
  if (BUILDINGS[building.type].inputPorts === 0) return 0;
  if (building.type === "inputter") return 6;
  const recipe = RECIPES[building.type].find((candidate) => candidate.id === building.recipeId);
  return Math.max(1, recipe ? Object.keys(recipe.inputs).length : 1);
}
function canAcceptInput(building: PlacedBuilding, item: AnyItemId) {
  if (BUILDINGS[building.type].inputPorts === 0) return false;
  const inventory = building.type === "core" ? undefined : building.input;
  if (!inventory) return true;
  if (inventoryCount(inventory, item) >= BUFFER_LIMIT) return false;
  return inventoryCount(inventory, item) > 0 || inventoryTypeCount(inventory) < inputSlotLimit(building);
}
function acceptedManualInputs(building: PlacedBuilding) {
  if (BUILDINGS[building.type].inputPorts === 0 || building.type === "core" || building.type === "outputter") return [];
  if (building.type === "inputter") return Object.keys(ALL_ITEMS).map(Number) as AnyItemId[];
  if (building.type === "generator") return [601, 602, 603, 604] as AnyItemId[];
  const recipe = RECIPES[building.type].find((candidate) => candidate.id === building.recipeId);
  return recipe ? Object.keys(recipe.inputs).map(Number) as AnyItemId[] : [];
}
function returnInventoriesToCore(core: Inventory, ...inventories: Inventory[]) {
  for (const inventory of inventories) for (const [id, amount] of Object.entries(inventory)) if ((amount ?? 0) > 0) addItem(core, Number(id) as AnyItemId, amount ?? 0);
}
function buildingAt(buildings: PlacedBuilding[], x: number, y: number, ignoreId?: string) {
  return buildings.find((building) => { if (building.id === ignoreId) return false; const size = BUILDINGS[building.type].size; return x >= building.x && x < building.x + size && y >= building.y && y < building.y + size; });
}
function inputPortTiles(building: PlacedBuilding) {
  const size = BUILDINGS[building.type].size;
  if (BUILDINGS[building.type].inputPorts === 0) return [];
  const ports = Array.from({ length: size }, (_, index) => ({ x: building.x, y: building.y + index }));
  if (building.type === "core") ports.push({ x: building.x + 2, y: building.y });
  return ports;
}
function outputTargets(building: PlacedBuilding) {
  const size = BUILDINGS[building.type].size;
  if (BUILDINGS[building.type].outputPorts === 0) return [];
  const ports = Array.from({ length: size }, (_, index) => ({ x: building.x + size, y: building.y + index }));
  if (building.type === "core") ports.push({ x: building.x + 2, y: building.y + size });
  return ports;
}
function isInputPort(building: PlacedBuilding, x: number, y: number) { return inputPortTiles(building).some((port) => port.x === x && port.y === y); }
function directionBetween(from: { x: number; y: number }, to: { x: number; y: number }): Direction | undefined {
  const dx = to.x - from.x; const dy = to.y - from.y;
  if (dx === 1 && dy === 0) return "right";
  if (dx === -1 && dy === 0) return "left";
  if (dx === 0 && dy === 1) return "down";
  if (dx === 0 && dy === -1) return "up";
  return undefined;
}
function rotateDirection(direction: Direction, steps: number): Direction {
  const order: Direction[] = ["up", "right", "down", "left"];
  return order[(order.indexOf(direction) + steps + order.length) % order.length];
}
function beltKindOf(belt: Belt): BeltKind { return belt.kind ?? "normal"; }
function secondaryBeltDirection(belt: Belt) { return rotateDirection(belt.direction, 1); }
function beltCanAccept(belt: Belt, incomingDirection: Direction) {
  if (beltKindOf(belt) !== "cross") return belt.item === undefined;
  if (incomingDirection === belt.direction) return belt.item === undefined;
  if (incomingDirection === secondaryBeltDirection(belt)) return belt.secondaryItem === undefined;
  return false;
}
function placeOnBelt(belt: Belt, item: AnyItemId, incomingDirection: Direction) {
  if (!beltCanAccept(belt, incomingDirection)) return false;
  if (beltKindOf(belt) === "cross" && incomingDirection === secondaryBeltDirection(belt)) belt.secondaryItem = item;
  else belt.item = item;
  return true;
}
function beltShapeClass(belt: Belt, belts: Belt[]) {
  if (beltKindOf(belt) !== "normal") return `belt-kind-${beltKindOf(belt)}`;
  const incoming = belts.find((candidate) => {
    if (candidate === belt) return false;
    const vector = DIRECTIONS[candidate.direction];
    return candidate.x + vector.x === belt.x && candidate.y + vector.y === belt.y;
  })?.direction;
  const incomingVertical = incoming === "up" || incoming === "down";
  const outgoingVertical = belt.direction === "up" || belt.direction === "down";
  return incoming && incomingVertical !== outgoingVertical ? `belt-corner-${incoming}-${belt.direction}` : "belt-straight";
}
function oreAt(x: number, y: number, worldSeed: number) { const cx = Math.floor(x / CHUNK_SIZE); const cy = Math.floor(y / CHUNK_SIZE); return oresForChunk(cx, cy, worldSeed).find((ore) => x >= ore.x && x < ore.x + 3 && y >= ore.y && y < ore.y + 3); }
function oreAnchorAt(x: number, y: number, worldSeed: number) { const cx = Math.floor(x / CHUNK_SIZE); const cy = Math.floor(y / CHUNK_SIZE); return oresForChunk(cx, cy, worldSeed).find((ore) => ore.x === x && ore.y === y); }
function wildPlantAt(x: number, y: number, worldSeed: number) { const cx = Math.floor(x / CHUNK_SIZE); const cy = Math.floor(y / CHUNK_SIZE); return plantsForChunk(cx, cy, worldSeed).find((plant) => plant.x === x && plant.y === y); }
const wildPlantKey = (plant: { x: number; y: number; item: AnyItemId }) => `${plant.x},${plant.y},${plant.item}`;
function removePlantsCoveredByBuildings(state: GameState) {
  const harvested = new Set(state.harvestedPlants);
  for (const building of state.buildings) {
    const size = BUILDINGS[building.type].size;
    for (let y = building.y; y < building.y + size; y += 1) for (let x = building.x; x < building.x + size; x += 1) {
      const plant = wildPlantAt(x, y, state.worldSeed);
      if (plant) harvested.add(wildPlantKey(plant));
    }
  }
  state.harvestedPlants = [...harvested];
}

function processTick(previous: GameState): GameState {
  if (previous.phase !== "PLAYING") return previous;
  const state: GameState = structuredClone(previous); state.tick += 1;
  const settlesPower = shouldSettlePower(state.tick);
  let produced = settlesPower ? BASE_POWER_PRODUCTION : 0;
  let pendingPowerUsed = state.pendingPowerUsed ?? 0;

  for (const building of state.buildings) {
    if (building.type !== "generator" || !settlesPower) continue;
    const battery = ([604, 601, 602, 603] as AnyItemId[]).find((id) => inventoryCount(building.input, id) > 0);
    if (battery) { addItem(building.input, battery, -1); produced += ALL_ITEMS[battery].power ?? 0; }
  }
  for (const building of state.buildings) {
    building.active = true;
    const definition = BUILDINGS[building.type];
    if (building.type === "core" || building.type === "generator") continue;
    let operate: (() => void) | undefined;
    if (building.type === "miner" || building.type === "advancedMiner") {
      const size = definition.size; let vein: ReturnType<typeof oreAt>;
      for (let y = building.y; y < building.y + size && !vein; y += 1) for (let x = building.x; x < building.x + size && !vein; x += 1) vein = oreAt(x, y, state.worldSeed);
      const ore = vein ? (100 + vein.tier) as AnyItemId : undefined;
      const canMine = Boolean(vein && (building.type === "advancedMiner" || vein.tier !== 1) && ore && inventoryCount(building.output, ore) < BUFFER_LIMIT);
      const shouldCollect = state.tick % 5 === 0 && hasInventory(building.output);
      if (canMine || shouldCollect) operate = () => {
        if (canMine && ore) addItem(building.output, ore, 1, BUFFER_LIMIT);
        if (state.tick % 5 === 0) for (const [id, amount] of Object.entries(building.output)) { addItem(state.core, Number(id) as AnyItemId, amount ?? 0); delete building.output[Number(id) as AnyItemId]; }
      };
    } else if (building.type === "outputter" && building.selectedOutput) {
      const id = building.selectedOutput;
      if (inventoryCount(state.core, id) > 0 && inventoryCount(building.output, id) < BUFFER_LIMIT) operate = () => { addItem(state.core, id, -1); addItem(building.output, id, 1, BUFFER_LIMIT); };
    } else if (building.type === "inputter") {
      if (state.tick % 5 === 0 && hasInventory(building.input)) operate = () => { for (const [id, amount] of Object.entries(building.input)) { addItem(state.core, Number(id) as AnyItemId, amount ?? 0); delete building.input[Number(id) as AnyItemId]; } };
    } else {
      const recipe = RECIPES[building.type].find((candidate) => candidate.id === building.recipeId);
      if (recipe && state.tick % (recipe.durationTicks ?? 1) === 0 && inventoryCount(building.output, recipe.output) < BUFFER_LIMIT) {
        const canCraft = Object.entries(recipe.inputs).every(([id, amount]) => inventoryCount(building.input, Number(id) as AnyItemId) >= (amount ?? 0));
        if (canCraft) operate = () => { for (const [id, amount] of Object.entries(recipe.inputs)) addItem(building.input, Number(id) as AnyItemId, -(amount ?? 0)); addItem(building.output, recipe.output, recipe.amount, BUFFER_LIMIT); };
      }
    }
    if (!operate) continue;
    if (state.power - pendingPowerUsed < definition.power) { building.active = false; continue; }
    pendingPowerUsed += definition.power;
    operate();
  }
  const occupiedBelts = new globalThis.Map(state.belts.map((belt) => [tileKey(belt.x, belt.y), belt]));
  const pendingBelts = new Set(state.belts.filter((belt) => belt.item || belt.secondaryItem));
  const moveToDirection = (belt: Belt, item: AnyItemId, direction: Direction) => {
    const vector = DIRECTIONS[direction];
    const tx = belt.x + vector.x; const ty = belt.y + vector.y;
    const receiver = buildingAt(state.buildings, tx, ty);
    const nextBelt = occupiedBelts.get(tileKey(tx, ty));
    if (receiver && isInputPort(receiver, tx, ty) && canAcceptInput(receiver, item)) {
      addItem(receiver.type === "core" ? state.core : receiver.input, item, 1, receiver.type === "core" ? Infinity : BUFFER_LIMIT);
      return true;
    }
    return Boolean(nextBelt && placeOnBelt(nextBelt, item, direction));
  };
  let beltMoved = true;
  while (pendingBelts.size > 0 && beltMoved) {
    beltMoved = false;
    for (const belt of [...pendingBelts]) {
      const kind = beltKindOf(belt);
      if (kind === "cross") {
        if (belt.item && moveToDirection(belt, belt.item, belt.direction)) { belt.item = undefined; beltMoved = true; }
        const secondaryDirection = secondaryBeltDirection(belt);
        if (belt.secondaryItem && moveToDirection(belt, belt.secondaryItem, secondaryDirection)) { belt.secondaryItem = undefined; beltMoved = true; }
      } else if (belt.item) {
        const outputs = kind === "splitter"
          ? (belt.splitIndex ?? 0) === 0 ? [belt.direction, secondaryBeltDirection(belt)] : [secondaryBeltDirection(belt), belt.direction]
          : [belt.direction];
        if (outputs.some((direction) => moveToDirection(belt, belt.item as AnyItemId, direction))) {
          belt.item = undefined;
          if (kind === "splitter") belt.splitIndex = (belt.splitIndex ?? 0) === 0 ? 1 : 0;
          beltMoved = true;
        }
      }
      if (!belt.item && !belt.secondaryItem) pendingBelts.delete(belt);
    }
  }
  for (const building of state.buildings) {
    const outputEntry = Object.entries(building.output).find(([, amount]) => (amount ?? 0) > 0);
    const targets = outputTargets(building);
    if (building.type === "core") {
      for (const [index, target] of targets.entries()) {
        const item = building.outputSelections?.[index];
        if (!item || inventoryCount(state.core, item) < 1) continue;
        const receiver = buildingAt(state.buildings, target.x, target.y);
        if (receiver && isInputPort(receiver, target.x, target.y) && canAcceptInput(receiver, item)) {
          addItem(receiver.type === "core" ? state.core : receiver.input, item, 1, receiver.type === "core" ? Infinity : BUFFER_LIMIT);
          addItem(state.core, item, -1);
          continue;
        }
        const belt = occupiedBelts.get(tileKey(target.x, target.y));
        const outputDirection: Direction = target.x === building.x + BUILDINGS[building.type].size ? "right" : "down";
        if (belt && placeOnBelt(belt, item, outputDirection)) addItem(state.core, item, -1);
      }
      continue;
    }
    const item = outputEntry ? Number(outputEntry[0]) as AnyItemId : undefined;
    if (!item) continue;
    const receiver = targets.map((target) => buildingAt(state.buildings, target.x, target.y)).find((candidate, index) => candidate && isInputPort(candidate, targets[index].x, targets[index].y) && canAcceptInput(candidate, item));
    if (receiver) { addItem(receiver.type === "core" ? state.core : receiver.input, item, 1, receiver.type === "core" ? Infinity : BUFFER_LIMIT); addItem(building.output, item, -1); continue; }
    const beltTarget = targets.map((target) => ({ target, belt: occupiedBelts.get(tileKey(target.x, target.y)) })).find(({ target, belt }) => belt && beltCanAccept(belt, target.x === building.x + BUILDINGS[building.type].size ? "right" : "down"));
    if (beltTarget?.belt) { const outputDirection: Direction = beltTarget.target.x === building.x + BUILDINGS[building.type].size ? "right" : "down"; placeOnBelt(beltTarget.belt, item, outputDirection); addItem(building.output, item, -1); }
  }
  state.pendingPowerUsed = pendingPowerUsed;
  if (settlesPower) {
    state.power = Math.max(0, Math.min(state.powerCapacity, state.power + produced - pendingPowerUsed));
    state.lastPowerProduced = produced;
    state.lastPowerUsed = pendingPowerUsed;
    state.lastPowerDelta = produced - pendingPowerUsed;
    state.pendingPowerUsed = 0;
    if (state.power <= 0) { state.phase = "GAME_OVER"; state.message = "보관 전력이 모두 소진되어 공장이 정지했습니다."; }
    else state.message = `전력 정산 완료 · ${state.lastPowerDelta >= 0 ? "+" : ""}${state.lastPowerDelta} · 누적 가동 ${state.tick * TICK_SECONDS}초`;
  } else state.message = `2초 생산 처리 완료 · 전력 정산까지 ${(POWER_SETTLEMENT_TICKS - state.tick % POWER_SETTLEMENT_TICKS) * TICK_SECONDS}초`;
  return state;
}

function Stat({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail?: string }) { return <div className="stat"><span className="stat-icon">{icon}</span><span><small>{label}</small><strong>{value}</strong>{detail && <em>{detail}</em>}</span></div>; }

export default function Home() {
  const [game, setGame] = useState<GameState>(initialGame); const [ready, setReady] = useState(false); const [camera, setCamera] = useState({ x: CAMERA_START, y: CAMERA_START }); const [viewport, setViewport] = useState({ width: 1200, height: 800 }); const [zoom, setZoom] = useState(1);
  const [hasSavedGame, setHasSavedGame] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [manualTransferItem, setManualTransferItem] = useState<AnyItemId>(101);
  const [commandOpen, setCommandOpen] = useState(false); const [commandInput, setCommandInput] = useState(""); const [commandFeedback, setCommandFeedback] = useState("");
  const [buildOpen, setBuildOpen] = useState(false); const [marketOpen, setMarketOpen] = useState(false); const [helpOpen, setHelpOpen] = useState(false); const [selectedBuilding, setSelectedBuilding] = useState<BuildingType | null>(null); const [selectedId, setSelectedId] = useState<string | null>(null); const [beltMode, setBeltMode] = useState(false); const [beltDirection, setBeltDirection] = useState<Direction>("right"); const [beltKind, setBeltKind] = useState<BeltKind>("normal"); const [beltEraseMode, setBeltEraseMode] = useState(false); const [beltPreview, setBeltPreview] = useState<BeltPlanTile[]>([]); const [beltRemovePreview, setBeltRemovePreview] = useState<BeltPlanTile[]>([]); const [pendingBeltPlan, setPendingBeltPlan] = useState<BeltPlanTile[] | null>(null); const [pendingBeltRemoval, setPendingBeltRemoval] = useState<BeltPlanTile[] | null>(null); const [movingId, setMovingId] = useState<string | null>(null); const [hoverTile, setHoverTile] = useState<{ x: number; y: number } | null>(null); const [pendingChunk, setPendingChunk] = useState<{ x: number; y: number } | null>(null); const [saleItem, setSaleItem] = useState<AnyItemId>(603); const [saleQuantity, setSaleQuantity] = useState<number | "">(1);
  const viewportRef = useRef<HTMLDivElement>(null); const keysRef = useRef(new Set<string>()); const lastFrameRef = useRef(0);
  const enterSequenceRef = useRef<number[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null); const musicRef = useRef<HTMLAudioElement | null>(null); const assetSoundsRef = useRef<{ place: HTMLAudioElement; remove: HTMLAudioElement } | null>(null);
  const pointerDragRef = useRef<{ pointerId: number; startX: number; startY: number; cameraX: number; cameraY: number; moved: boolean; timer: number | null; tileX?: number; tileY?: number } | null>(null);
  const beltPaintRef = useRef<{ pointerId: number; lastX: number; lastY: number; placed: Set<string>; tiles: BeltPlanTile[]; reverse: boolean; terminalDirection?: Direction } | null>(null);
  const beltRemoveRef = useRef<{ pointerId: number; lastX: number; lastY: number; selected: Set<string>; tiles: BeltPlanTile[] } | null>(null);
  const suppressClickUntilRef = useRef(0);

  const stopAmbientSound = useCallback(() => { musicRef.current?.pause(); }, []);
  const playSound = useCallback((kind: SoundKind) => { if (!soundEnabled) return; if (kind === "build" || kind === "belt" || kind === "remove") { const source = kind === "remove" ? assetSoundsRef.current?.remove : assetSoundsRef.current?.place; if (source) { const sound = source.cloneNode() as HTMLAudioElement; sound.volume = kind === "belt" ? .34 : .46; void sound.play().catch(() => undefined); } return; } const context = audioContextRef.current; if (!context) return; const settings: Partial<Record<SoundKind, [number, number, OscillatorType]>> = { mine: [105, .1, "sawtooth"], sale: [660, .22, "sine"], unlock: [360, .28, "triangle"], return: [420, .14, "triangle"], warning: [82, .55, "sawtooth"] }; const setting = settings[kind]; if (!setting) return; const [frequency, duration, type] = setting; const oscillator = context.createOscillator(); const gain = context.createGain(); oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, context.currentTime); if (kind === "sale" || kind === "unlock") oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.5, context.currentTime + duration); gain.gain.setValueAtTime(.045, context.currentTime); gain.gain.exponentialRampToValueAtTime(.0001, context.currentTime + duration); oscillator.connect(gain).connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + duration); }, [soundEnabled]);
  const toggleSound = () => { if (soundEnabled) { stopAmbientSound(); setSoundEnabled(false); return; } const context = audioContextRef.current ?? new AudioContext(); audioContextRef.current = context; void context.resume(); const existingMusic = musicRef.current; if (existingMusic) void existingMusic.play().catch(() => undefined); else { const music = new Audio(publicAsset("/audio/mechanical-pulse.mp3")); music.loop = true; music.preload = "auto"; music.volume = .16; musicRef.current = music; void music.play().catch(() => undefined); } setSoundEnabled(true); };

  useEffect(() => { const music = new Audio(publicAsset("/audio/mechanical-pulse.mp3")); music.loop = true; music.preload = "auto"; music.volume = .16; musicRef.current = music; const place = new Audio(publicAsset("/audio/sfx-place-device.wav")); const remove = new Audio(publicAsset("/audio/sfx-remove-device.wav")); place.preload = "auto"; remove.preload = "auto"; assetSoundsRef.current = { place, remove }; return () => { music.pause(); musicRef.current = null; assetSoundsRef.current = null; }; }, []);

  useEffect(() => { const timer = window.setTimeout(() => { const saved = localStorage.getItem(SAVE_KEY); if (saved) try { const parsed = JSON.parse(saved) as GameState; const previousChunkSize = parsed.chunkSize ?? 10; const migrateCoordinates = previousChunkSize !== CHUNK_SIZE; parsed.buildings = parsed.buildings.map((building) => { if (building.type !== "core") return migrateCoordinates ? { ...building, x: migrateTileCoordinate(building.x, previousChunkSize), y: migrateTileCoordinate(building.y, previousChunkSize) } : building; const legacyItem = building.selectedOutput ?? 103; return { ...building, x: CORE_START_TILE, y: CORE_START_TILE, selectedOutput: undefined, outputSelections: { ...Object.fromEntries(Array.from({ length: 6 }, (_, index) => [index, legacyItem])), ...building.outputSelections } }; }); if (migrateCoordinates) parsed.belts = parsed.belts.map((belt) => ({ ...belt, x: migrateTileCoordinate(belt.x, previousChunkSize), y: migrateTileCoordinate(belt.y, previousChunkSize) })); parsed.chunkSize = CHUNK_SIZE; parsed.worldSeed ??= createWorldSeed(); parsed.pendingPowerUsed ??= 0; parsed.lastPowerProduced ??= 200; parsed.lastPowerUsed ??= 0; parsed.lastPowerDelta ??= 200; parsed.mapCompletionAcknowledged ??= false; parsed.harvestedPlants ??= []; removePlantsCoveredByBuildings(parsed); parsed.core ??= {}; if ((parsed.dataVersion ?? 1) < DATA_VERSION) for (const [id, amount] of Object.entries(STARTER_SEEDS)) addItem(parsed.core, Number(id) as AnyItemId, amount ?? 0); parsed.dataVersion = DATA_VERSION; if (parsed.phase !== "GAME_OVER" && parsed.phase !== "COMPLETED") parsed.phase = isMapComplete(parsed.unlockedChunks.length) && !parsed.mapCompletionAcknowledged ? "VICTORY" : "READY"; setGame(parsed); setHasSavedGame(parsed.tick > 0 || parsed.buildings.length > 1 || parsed.unlockedChunks.length > 1); } catch { localStorage.removeItem(SAVE_KEY); } setReady(true); }, 0); return () => window.clearTimeout(timer); }, []);
  useEffect(() => { if (ready) localStorage.setItem(SAVE_KEY, JSON.stringify(game)); }, [game, ready]);
  useEffect(() => { if (!ready || game.phase !== "PLAYING") return; const timer = window.setInterval(() => setGame(processTick), TICK_MS); return () => window.clearInterval(timer); }, [ready, game.phase]);
  useEffect(() => { if (!viewportRef.current) return; const observer = new ResizeObserver(([entry]) => setViewport({ width: entry.contentRect.width, height: entry.contentRect.height })); observer.observe(viewportRef.current); return () => observer.disconnect(); }, []);
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (game.phase !== "PLAYING" || event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement) return;
      const key = event.key.toLowerCase();
      if (event.repeat) return;
      if (key === "enter") {
        event.preventDefault();
        const now = performance.now();
        const presses = [...enterSequenceRef.current.filter((pressedAt) => now - pressedAt <= COMMAND_TRIGGER_WINDOW_MS), now].slice(-3);
        enterSequenceRef.current = presses;
        if (presses.length === 3) {
          enterSequenceRef.current = [];
          keysRef.current.clear();
          setBuildOpen(false); setMarketOpen(false); setHelpOpen(false); setSelectedId(null); setSelectedBuilding(null); setBeltMode(false); setMovingId(null); setPendingChunk(null);
          setCommandInput(""); setCommandFeedback(""); setCommandOpen(true);
        }
        return;
      }
      if (["w", "a", "s", "d"].includes(key)) keysRef.current.add(key);
      if (key === "q") { setBuildOpen((v) => !v); setMarketOpen(false); }
      if (key === "e") { setBeltMode((v) => !v); setSelectedBuilding(null); }
      if (key === " ") { event.preventDefault(); setMarketOpen((v) => !v); setBuildOpen(false); }
      if (key === "r" && beltMode) { const order: Direction[] = ["up", "right", "down", "left"]; setBeltDirection((d) => order[(order.indexOf(d) + 1) % order.length]); }
      if (key === "f" && beltMode) setBeltKind((kind) => BELT_KINDS[(BELT_KINDS.indexOf(kind) + 1) % BELT_KINDS.length]);
      if (key === "escape") { setBuildOpen(false); setMarketOpen(false); setHelpOpen(false); setCommandOpen(false); setSelectedId(null); setSelectedBuilding(null); setBeltMode(false); setMovingId(null); setPendingChunk(null); }
    };
    const up = (event: KeyboardEvent) => keysRef.current.delete(event.key.toLowerCase()); window.addEventListener("keydown", down); window.addEventListener("keyup", up); return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [beltMode, game.phase]);
  useEffect(() => { if (game.phase !== "PLAYING") { keysRef.current.clear(); return; } let frame = 0; const animate = (time: number) => { const dt = Math.min(32, time - lastFrameRef.current || 16); lastFrameRef.current = time; const keys = keysRef.current; if (keys.size) { const speed = 0.5 * dt / zoom; setCamera((c) => ({ x: c.x + (keys.has("d") ? speed : 0) - (keys.has("a") ? speed : 0), y: c.y + (keys.has("s") ? speed : 0) - (keys.has("w") ? speed : 0) })); } frame = requestAnimationFrame(animate); }; frame = requestAnimationFrame(animate); return () => cancelAnimationFrame(frame); }, [zoom, game.phase]);
  useEffect(() => { const modelContext = (document as Document & { modelContext?: { registerTool: (tool: unknown, options?: unknown) => unknown } }).modelContext; if (!modelContext?.registerTool) return; const lifecycle = new AbortController(); try { void Promise.resolve(modelContext.registerTool({ name: "read_factory_status", title: "공장 현황 읽기", description: "현재 골드, 전력, 해금 청크, 건물 수와 코어 재고를 읽습니다.", inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: false }, execute: () => ({ phase: game.phase, gold: game.gold, power: game.power, unlockedChunks: game.unlockedChunks.length, buildings: game.buildings.length, core: game.core }) }, { signal: lifecycle.signal })).catch(() => undefined); } catch {} return () => lifecycle.abort(); }, [game]);
  useEffect(() => () => { stopAmbientSound(); void audioContextRef.current?.close(); }, [stopAmbientSound]);
  useEffect(() => { if (game.phase === "GAME_OVER") playSound("warning"); }, [game.phase, playSound]);

  const unlocked = useMemo(() => new Set(game.unlockedChunks), [game.unlockedChunks]); const harvestedPlants = useMemo(() => new Set(game.harvestedPlants), [game.harvestedPlants]); const selected = game.buildings.find((b) => b.id === selectedId) ?? null; const selectedRecipe = selected ? RECIPES[selected.type].find((recipe) => recipe.id === selected.recipeId) : undefined; const scale = TILE * zoom;
  const manualInputChoices = selected ? acceptedManualInputs(selected) : [];
  const manualInputItem = manualInputChoices.includes(manualTransferItem) ? manualTransferItem : manualInputChoices[0];
  const beltByTile = useMemo(() => new globalThis.Map(game.belts.map((belt) => [tileKey(belt.x, belt.y), belt])), [game.belts]);
  const beltRemovePreviewKeys = useMemo(() => new Set(beltRemovePreview.map((tile) => tileKey(tile.x, tile.y))), [beltRemovePreview]);
  const beltPreviewNetwork = useMemo<Belt[]>(() => [...game.belts, ...beltPreview.map((tile) => ({ ...tile, kind: beltKind }))], [beltKind, beltPreview, game.belts]);
  const visible = useMemo(() => { const halfCols = Math.ceil(viewport.width / scale / 2) + 2; const halfRows = Math.ceil(viewport.height / scale / 2) + 2; const centerX = Math.floor(camera.x / TILE); const centerY = Math.floor(camera.y / TILE); const tiles: { x: number; y: number }[] = []; for (let y = centerY - halfRows; y <= centerY + halfRows; y += 1) for (let x = centerX - halfCols; x <= centerX + halfCols; x += 1) if (Math.abs(x) <= (MAP_RADIUS_CHUNKS + 1) * CHUNK_SIZE && Math.abs(y) <= (MAP_RADIUS_CHUNKS + 1) * CHUNK_SIZE) tiles.push({ x, y }); return tiles; }, [camera, scale, viewport]);
  const tilePosition = useCallback((x: number, y: number) => ({ left: viewport.width / 2 + (x * TILE - camera.x) * zoom, top: viewport.height / 2 + (y * TILE - camera.y) * zoom, width: scale, height: scale }), [camera, scale, viewport, zoom]);
  const isAdjacentChunk = (cx: number, cy: number) => unlocked.has(chunkKey(cx - 1, cy)) || unlocked.has(chunkKey(cx + 1, cy)) || unlocked.has(chunkKey(cx, cy - 1)) || unlocked.has(chunkKey(cx, cy + 1));
  const isWithinSight = (x: number, y: number) => {
    const cx = Math.floor(x / CHUNK_SIZE); const cy = Math.floor(y / CHUNK_SIZE);
    for (let uy = cy - 1; uy <= cy + 1; uy += 1) for (let ux = cx - 1; ux <= cx + 1; ux += 1) if (unlocked.has(chunkKey(ux, uy))) {
      const left = ux * CHUNK_SIZE; const top = uy * CHUNK_SIZE; const right = left + CHUNK_SIZE - 1; const bottom = top + CHUNK_SIZE - 1;
      const dx = Math.max(left - x, 0, x - right); const dy = Math.max(top - y, 0, y - bottom);
      if (Math.max(dx, dy) <= 3) return true;
    }
    return false;
  };
  const isSurveyMarkerTile = (cx: number, cy: number, x: number, y: number) => {
    const left = cx * CHUNK_SIZE; const top = cy * CHUNK_SIZE;
    const center = Math.floor(CHUNK_SIZE / 2); const farEdge = CHUNK_SIZE - 2;
    if (unlocked.has(chunkKey(cx - 1, cy))) return x === left + 1 && y === top + center;
    if (unlocked.has(chunkKey(cx + 1, cy))) return x === left + farEdge && y === top + center;
    if (unlocked.has(chunkKey(cx, cy - 1))) return x === left + center && y === top + 1;
    if (unlocked.has(chunkKey(cx, cy + 1))) return x === left + center && y === top + farEdge;
    return false;
  };
  const availableWildPlantAt = (x: number, y: number) => { const plant = wildPlantAt(x, y, game.worldSeed); return plant && !harvestedPlants.has(wildPlantKey(plant)) ? plant : undefined; };
  const canPlace = (type: BuildingType, x: number, y: number, ignoreId?: string) => { const size = BUILDINGS[type].size; for (let ty = y; ty < y + size; ty += 1) for (let tx = x; tx < x + size; tx += 1) { const cx = Math.floor(tx / CHUNK_SIZE); const cy = Math.floor(ty / CHUNK_SIZE); if (!unlocked.has(chunkKey(cx, cy)) || buildingAt(game.buildings, tx, ty, ignoreId) || game.belts.some((b) => b.x === tx && b.y === ty) || availableWildPlantAt(tx, ty)) return false; } if (type === "miner" || type === "advancedMiner") { let vein: ReturnType<typeof oreAt>; for (let ty = y; ty < y + size && !vein; ty += 1) for (let tx = x; tx < x + size && !vein; tx += 1) vein = oreAt(tx, ty, game.worldSeed); if (!vein || (type === "miner" && vein.tier === 1)) return false; } return true; };
  const placementTarget = (type: BuildingType, x: number, y: number) => {
    if (type === "miner" || type === "advancedMiner") {
      const vein = oreAt(x, y, game.worldSeed);
      if (vein) return { x: vein.x, y: vein.y, snapped: true };
    }
    return { x, y, snapped: false };
  };

  const orientBeltDraft = (tiles: BeltPlanTile[], reverse = false, terminalDirection?: Direction) => {
    const oriented = (reverse ? [...tiles].reverse() : [...tiles]).map((tile) => ({ ...tile }));
    if (reverse) for (let index = 0; index < oriented.length; index += 1) oriented[index].direction = index + 1 < oriented.length ? directionBetween(oriented[index], oriented[index + 1]) ?? terminalDirection ?? beltDirection : terminalDirection ?? beltDirection;
    const last = oriented.at(-1);
    if (last) {
      const leftInput = game.buildings.some((building) => BUILDINGS[building.type].inputPorts > 0 && last.x === building.x - 1 && last.y >= building.y && last.y < building.y + BUILDINGS[building.type].size);
      const coreTopInput = game.buildings.some((building) => building.type === "core" && last.x === building.x + 2 && last.y === building.y - 1);
      if (leftInput) last.direction = "right";
      else if (coreTopInput) last.direction = "down";
    }
    return oriented;
  };
  const beltStartAtPort = (tile: { x: number; y: number }) => {
    const building = buildingAt(game.buildings, tile.x, tile.y);
    if (!building) return { tile, reverse: false, direction: beltDirection };
    const definition = BUILDINGS[building.type];
    if (building.type === "core" && tile.x === building.x + 2 && tile.y === building.y) return { tile: { x: tile.x, y: building.y - 1 }, reverse: true, direction: "down" as Direction };
    if (building.type === "core" && tile.x === building.x + 2 && tile.y === building.y + definition.size - 1) return { tile: { x: tile.x, y: building.y + definition.size }, reverse: false, direction: "down" as Direction };
    if (definition.outputPorts > 0 && tile.x === building.x + definition.size - 1) return { tile: { x: building.x + definition.size, y: tile.y }, reverse: false, direction: "right" as Direction };
    if (definition.inputPorts > 0 && tile.x === building.x) return { tile: { x: building.x - 1, y: tile.y }, reverse: true, direction: "right" as Direction };
    return undefined;
  };
  const canPaintBeltAt = (x: number, y: number) => {
    const cx = Math.floor(x / CHUNK_SIZE); const cy = Math.floor(y / CHUNK_SIZE);
    return unlocked.has(chunkKey(cx, cy)) && !buildingAt(game.buildings, x, y) && !availableWildPlantAt(x, y);
  };
  const commitBeltPlan = (plan: BeltPlanTile[]) => {
    if (!plan.length) return;
    playSound("belt");
    setGame((state) => {
      const core = { ...state.core };
      let belts = [...state.belts];
      let installed = 0;
      for (const tile of plan) {
        const cx = Math.floor(tile.x / CHUNK_SIZE); const cy = Math.floor(tile.y / CHUNK_SIZE);
        const plant = wildPlantAt(tile.x, tile.y, state.worldSeed);
        if (!state.unlockedChunks.includes(chunkKey(cx, cy)) || buildingAt(state.buildings, tile.x, tile.y) || (plant && !state.harvestedPlants.includes(wildPlantKey(plant)))) continue;
        const replaced = belts.find((belt) => belt.x === tile.x && belt.y === tile.y);
        belts = belts.filter((belt) => belt.x !== tile.x || belt.y !== tile.y);
        const previous = replaced ? undefined : [...belts].reverse().find((belt) => directionBetween(belt, tile));
        const connectionDirection = beltKind === "normal" && previous && beltKindOf(previous) === "normal" ? directionBetween(previous, tile) : undefined;
        if (connectionDirection && previous) belts = belts.map((belt) => belt === previous ? { ...belt, direction: connectionDirection } : belt);
        if (replaced?.item) addItem(core, replaced.item, 1);
        if (replaced?.secondaryItem) addItem(core, replaced.secondaryItem, 1);
        belts.push({ ...tile, direction: beltKind === "normal" ? tile.direction : beltDirection, kind: beltKind, splitIndex: 0 });
        installed += 1;
      }
      return installed ? { ...state, core, belts, message: `${BELT_KIND_LABEL[beltKind]} 벨트 ${installed}칸 설치 완료` } : state;
    });
  };
  const placeBeltAt = (rawX: number, rawY: number, outgoingDirection: Direction = beltDirection) => commitBeltPlan([{ x: rawX, y: rawY, direction: outgoingDirection }]);
  const confirmBeltPlan = () => { if (pendingBeltPlan) commitBeltPlan(pendingBeltPlan); setPendingBeltPlan(null); setBeltPreview([]); };
  const cancelBeltPlan = () => { setPendingBeltPlan(null); setBeltPreview([]); setGame((state) => ({ ...state, message: "벨트 설치를 취소했습니다." })); };
  const removeBeltPlan = (plan: BeltPlanTile[]) => {
    const selectedKeys = new Set(plan.map((tile) => tileKey(tile.x, tile.y)));
    if (!selectedKeys.size) return;
    playSound("remove");
    setGame((state) => {
      const removed = state.belts.filter((belt) => selectedKeys.has(tileKey(belt.x, belt.y)));
      if (!removed.length) return state;
      const core = { ...state.core };
      for (const belt of removed) {
        if (belt.item) addItem(core, belt.item, 1);
        if (belt.secondaryItem) addItem(core, belt.secondaryItem, 1);
      }
      return { ...state, core, belts: state.belts.filter((belt) => !selectedKeys.has(tileKey(belt.x, belt.y))), message: `벨트 ${removed.length}칸 철거 · 운송 아이템 코어 반환` };
    });
  };
  const confirmBeltRemoval = () => { if (pendingBeltRemoval) removeBeltPlan(pendingBeltRemoval); setPendingBeltRemoval(null); setBeltRemovePreview([]); };
  const cancelBeltRemoval = () => { setPendingBeltRemoval(null); setBeltRemovePreview([]); setGame((state) => ({ ...state, message: "벨트 철거 선택을 취소했습니다." })); };

  const handleTileClick = (rawX: number, rawY: number, eventTime: number) => {
    if (eventTime < suppressClickUntilRef.current || game.phase !== "PLAYING") return;
    const cx = Math.floor(rawX / CHUNK_SIZE); const cy = Math.floor(rawY / CHUNK_SIZE);
    if (!unlocked.has(chunkKey(cx, cy))) { if (Math.max(Math.abs(cx), Math.abs(cy)) <= MAP_RADIUS_CHUNKS && isAdjacentChunk(cx, cy)) setPendingChunk({ x: cx, y: cy }); return; }
    if (beltMode) { if (!canPaintBeltAt(rawX, rawY)) return; playSound("belt"); placeBeltAt(rawX, rawY); return; }
    const buildingType = movingId ? game.buildings.find((b) => b.id === movingId)?.type : selectedBuilding;
    if (!buildingType || buildingType === "core") return;
    const target = placementTarget(buildingType, rawX, rawY); const { x, y } = target;
    if (!canPlace(buildingType, x, y, movingId ?? undefined)) { setGame((s) => ({ ...s, message: buildingType.includes("Miner") || buildingType === "miner" ? "채굴기를 3×3 광맥 위에 놓아 주세요." : "이 위치에는 설치할 수 없습니다." })); return; }
    if (movingId) { setGame((s) => { const moving = s.buildings.find((building) => building.id === movingId); const retained = moving ? inventoryTotal(moving.input) + inventoryTotal(moving.output) : 0; return { ...s, buildings: s.buildings.map((building) => building.id === movingId ? { ...building, x, y } : building), message: `${BUILDINGS[buildingType].name} 이동 완료 · 내부 아이템 ${retained}개 유지` }; }); setMovingId(null); setSelectedId(null); return; }
    const definition = BUILDINGS[buildingType]; if (game.gold < definition.cost) { setGame((s) => ({ ...s, message: "골드가 부족합니다." })); return; }
    const recipes = RECIPES[buildingType]; playSound("build"); setGame((s) => ({ ...s, gold: s.gold - definition.cost, buildings: [...s.buildings, { id: `${buildingType}-${Date.now()}`, type: buildingType, x, y, input: {}, output: {}, active: true, recipeId: recipes[0]?.id, selectedOutput: buildingType === "outputter" ? 103 : undefined }], message: `${definition.name} 건설 완료${target.snapped ? " · 광맥 자동 정렬" : ""}` }));
  };
  const openContextAt = (x: number, y: number) => {
    if (game.phase !== "PLAYING") return;
    const building = buildingAt(game.buildings, x, y);
    if (building) { setSelectedId(building.id); return; }
    if (game.belts.some((belt) => belt.x === x && belt.y === y)) { playSound("remove"); setGame((s) => { const removed = s.belts.find((belt) => belt.x === x && belt.y === y); const core = { ...s.core }; if (removed?.item) addItem(core, removed.item, 1); if (removed?.secondaryItem) addItem(core, removed.secondaryItem, 1); return { ...s, core, belts: s.belts.filter((belt) => belt.x !== x || belt.y !== y), message: "벨트를 철거하고 운송 중이던 아이템을 코어로 반환했습니다." }; }); return; }
    const plant = availableWildPlantAt(x, y);
    if (plant) { playSound("return"); setGame((s) => { const core = { ...s.core }; addItem(core, plant.item, 1); return { ...s, core, harvestedPlants: [...s.harvestedPlants, wildPlantKey(plant)], message: `야생 ${ALL_ITEMS[plant.item].name} 1개를 채집해 코어로 보냈습니다.` }; }); return; }
    const ore = oreAt(x, y, game.worldSeed); const cx = Math.floor(x / CHUNK_SIZE); const cy = Math.floor(y / CHUNK_SIZE);
    if (ore && unlocked.has(chunkKey(cx, cy))) { const item = (100 + ore.tier) as AnyItemId; playSound("mine"); setGame((s) => ({ ...s, core: { ...s.core, [item]: inventoryCount(s.core, item) + 1 }, message: `${ALL_ITEMS[item].name} 1개를 직접 채굴했습니다.` })); }
  };
  const handleContext = (event: React.MouseEvent, x: number, y: number) => { event.preventDefault(); if (event.timeStamp >= suppressClickUntilRef.current) openContextAt(x, y); };
  const pointerTile = (target: EventTarget | null) => {
    const element = target instanceof HTMLElement ? target.closest<HTMLElement>("[data-tile-x][data-tile-y]") : null;
    if (!element) return undefined;
    return { x: Number(element.dataset.tileX), y: Number(element.dataset.tileY) };
  };
  const pointerTileAt = (clientX: number, clientY: number) => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;
    const rect = viewport.getBoundingClientRect();
    return {
      x: Math.floor((camera.x + (clientX - rect.left - rect.width / 2) / zoom) / TILE),
      y: Math.floor((camera.y + (clientY - rect.top - rect.height / 2) / zoom) / TILE),
    };
  };
  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const rightMouse = event.pointerType === "mouse" && event.button === 2;
    if (pendingBeltPlan || pendingBeltRemoval || game.phase !== "PLAYING" || !event.isPrimary || (event.pointerType === "mouse" && event.button !== 0 && !(beltMode && rightMouse))) return;
    const tile = pointerTileAt(event.clientX, event.clientY) ?? pointerTile(event.target);
    if (beltMode && tile && (beltEraseMode || rightMouse)) {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      const belt = beltByTile.get(tileKey(tile.x, tile.y));
      const tiles = belt ? [{ x: belt.x, y: belt.y, direction: belt.direction }] : [];
      beltRemoveRef.current = { pointerId: event.pointerId, lastX: tile.x, lastY: tile.y, selected: new Set(tiles.map((entry) => tileKey(entry.x, entry.y))), tiles };
      setBeltRemovePreview(tiles);
      suppressClickUntilRef.current = event.timeStamp + 500;
      return;
    }
    const beltStart = tile ? beltStartAtPort(tile) : undefined;
    if (!rightMouse && beltMode && beltStart && canPaintBeltAt(beltStart.tile.x, beltStart.tile.y)) {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      const tiles = [{ x: beltStart.tile.x, y: beltStart.tile.y, direction: beltStart.direction }];
      beltPaintRef.current = { pointerId: event.pointerId, lastX: beltStart.tile.x, lastY: beltStart.tile.y, placed: new Set([tileKey(beltStart.tile.x, beltStart.tile.y)]), tiles, reverse: beltStart.reverse, terminalDirection: beltStart.reverse ? beltStart.direction : undefined };
      setBeltPreview(tiles);
      suppressClickUntilRef.current = event.timeStamp + 500;
      return;
    }
    const drag = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, cameraX: camera.x, cameraY: camera.y, moved: false, timer: null as number | null, tileX: tile?.x, tileY: tile?.y };
    if (tile && event.pointerType !== "mouse") drag.timer = window.setTimeout(() => { suppressClickUntilRef.current = event.timeStamp + 1250; drag.moved = true; openContextAt(tile.x, tile.y); }, 550);
    pointerDragRef.current = drag;
  };
  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const beltRemove = beltRemoveRef.current;
    if (beltRemove?.pointerId === event.pointerId) {
      event.preventDefault();
      const tile = pointerTileAt(event.clientX, event.clientY);
      if (!tile || (tile.x === beltRemove.lastX && tile.y === beltRemove.lastY)) return;
      for (const next of orthogonalTilePath({ x: beltRemove.lastX, y: beltRemove.lastY }, tile)) {
        const key = tileKey(next.x, next.y);
        const belt = beltByTile.get(key);
        if (belt && !beltRemove.selected.has(key)) {
          beltRemove.selected.add(key);
          beltRemove.tiles.push({ x: belt.x, y: belt.y, direction: belt.direction });
        }
      }
      beltRemove.lastX = tile.x; beltRemove.lastY = tile.y;
      setBeltRemovePreview([...beltRemove.tiles]);
      suppressClickUntilRef.current = event.timeStamp + 350;
      return;
    }
    const beltPaint = beltPaintRef.current;
    if (beltPaint?.pointerId === event.pointerId) {
      event.preventDefault();
      const tile = pointerTileAt(event.clientX, event.clientY);
      if (!tile || (tile.x === beltPaint.lastX && tile.y === beltPaint.lastY)) return;
      let previous = { x: beltPaint.lastX, y: beltPaint.lastY };
      for (const next of orthogonalTilePath(previous, tile)) {
        const key = tileKey(next.x, next.y);
        const direction = directionBetween(previous, next) ?? beltDirection;
        if (!beltPaint.placed.has(key) && canPaintBeltAt(next.x, next.y)) {
          const lastIndex = beltPaint.tiles.length - 1;
          beltPaint.tiles[lastIndex] = { ...beltPaint.tiles[lastIndex], direction };
          beltPaint.tiles.push({ x: next.x, y: next.y, direction });
          beltPaint.placed.add(key);
        }
        previous = next;
      }
      beltPaint.lastX = tile.x; beltPaint.lastY = tile.y;
      setBeltPreview(orientBeltDraft(beltPaint.tiles, beltPaint.reverse, beltPaint.terminalDirection));
      suppressClickUntilRef.current = event.timeStamp + 350;
      return;
    }
    const drag = pointerDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX; const dy = event.clientY - drag.startY;
    if (Math.hypot(dx, dy) > 8 && !drag.moved) {
      drag.moved = true;
      if (drag.timer !== null) { window.clearTimeout(drag.timer); drag.timer = null; }
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    if (drag.moved) { event.preventDefault(); suppressClickUntilRef.current = event.timeStamp + 250; setCamera({ x: drag.cameraX - dx / zoom, y: drag.cameraY - dy / zoom }); }
  };
  const finishPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    const beltRemove = beltRemoveRef.current;
    if (beltRemove?.pointerId === event.pointerId) {
      suppressClickUntilRef.current = event.timeStamp + 350;
      beltRemoveRef.current = null;
      if (beltRemove.tiles.length >= 5) {
        setPendingBeltRemoval([...beltRemove.tiles]);
        setGame((state) => ({ ...state, message: `벨트 ${beltRemove.tiles.length}칸 철거를 확인해 주세요.` }));
      } else {
        removeBeltPlan(beltRemove.tiles);
        setBeltRemovePreview([]);
      }
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      return;
    }
    const beltPaint = beltPaintRef.current;
    if (beltPaint?.pointerId === event.pointerId) {
      suppressClickUntilRef.current = event.timeStamp + 350;
      beltPaintRef.current = null;
      const plan = orientBeltDraft(beltPaint.tiles, beltPaint.reverse, beltPaint.terminalDirection);
      if (plan.length >= 5) {
        setPendingBeltPlan(plan);
        setGame((state) => ({ ...state, message: `벨트 ${plan.length}칸 설치를 확인해 주세요.` }));
      } else {
        commitBeltPlan(plan);
        setBeltPreview([]);
      }
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      return;
    }
    const drag = pointerDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.timer !== null) window.clearTimeout(drag.timer);
    if (drag.moved) suppressClickUntilRef.current = event.timeStamp + 350;
    pointerDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const buyChunk = () => { if (!pendingChunk) return; const price = chunkPrice(game.unlockedChunks.length - 1); if (game.gold < price) { setGame((s) => ({ ...s, message: "청크를 해금할 골드가 부족합니다." })); return; } playSound("unlock"); setGame((s) => { const unlockedChunks = [...s.unlockedChunks, chunkKey(pendingChunk.x, pendingChunk.y)]; const complete = isMapComplete(unlockedChunks.length); return { ...s, phase: complete ? "VICTORY" : s.phase, gold: s.gold - price, unlockedChunks, message: complete ? "전체 광구 개척 완료" : `청크 [${pendingChunk.x}, ${pendingChunk.y}] 해금` }; }); setPendingChunk(null); };
  const rotateBelt = () => { const order: Direction[] = ["up", "right", "down", "left"]; setBeltDirection((d) => order[(order.indexOf(d) + 1) % order.length]); };
  const cycleBeltKind = () => setBeltKind((kind) => BELT_KINDS[(BELT_KINDS.indexOf(kind) + 1) % BELT_KINDS.length]);
  const updateBuilding = (patch: Partial<PlacedBuilding>) => { if (selected) setGame((s) => ({ ...s, buildings: s.buildings.map((b) => b.id === selected.id ? { ...b, ...patch } : b) })); };
  const updateCoreOutput = (portIndex: number, item: AnyItemId) => { if (!selected || selected.type !== "core") return; setGame((state) => ({ ...state, buildings: state.buildings.map((building) => building.id === selected.id ? { ...building, outputSelections: { ...building.outputSelections, [portIndex]: item } } : building), message: `코어 출력 포트 ${portIndex + 1}을 ${ALL_ITEMS[item].name}(으)로 설정했습니다.` })); };
  const addManualInput = (requested: number) => {
    if (!selected || !manualInputItem) return;
    setGame((state) => {
      const building = state.buildings.find((entry) => entry.id === selected.id);
      if (!building || !acceptedManualInputs(building).includes(manualInputItem) || !canAcceptInput(building, manualInputItem)) return state;
      const amount = Math.min(requested, inventoryCount(state.core, manualInputItem), BUFFER_LIMIT - inventoryCount(building.input, manualInputItem));
      if (amount <= 0) return { ...state, message: "코어 재고가 없거나 입력 보관함이 가득 찼습니다." };
      const core = { ...state.core }; const input = { ...building.input };
      addItem(core, manualInputItem, -amount); addItem(input, manualInputItem, amount, BUFFER_LIMIT);
      return { ...state, core, buildings: state.buildings.map((entry) => entry.id === building.id ? { ...entry, input } : entry), message: `${ALL_ITEMS[manualInputItem].name} ${amount}개를 입력 보관함에 넣었습니다.` };
    });
  };
  const returnInventoryItem = (kind: "input" | "output", item: AnyItemId, requested = Infinity) => { if (!selected || selected.type === "core") return; playSound("return"); setGame((state) => { const building = state.buildings.find((entry) => entry.id === selected.id); if (!building) return state; const amount = Math.min(requested, inventoryCount(building[kind], item)); if (amount <= 0) return state; const core = { ...state.core }; const inventory = { ...building[kind] }; addItem(core, item, amount); addItem(inventory, item, -amount); return { ...state, core, buildings: state.buildings.map((entry) => entry.id === building.id ? { ...entry, [kind]: inventory } : entry), message: `${ALL_ITEMS[item].name} ${amount}개를 코어로 회수했습니다.` }; }); };
  const beginMove = () => { if (!selected || selected.type === "core") return; setMovingId(selected.id); setSelectedBuilding(null); setBeltMode(false); setBuildOpen(false); setMarketOpen(false); setSelectedId(null); setGame((state) => ({ ...state, message: `${BUILDINGS[selected.type].name} 이동 중 · 내부 아이템은 그대로 유지됩니다.` })); };
  const cancelMove = () => { setMovingId(null); setGame((state) => ({ ...state, message: "장치 이동을 취소했습니다. 기존 위치와 내부 아이템을 유지합니다." })); };
  const changeRecipe = (recipeId: string) => { if (!selected) return; setGame((s) => { const building = s.buildings.find((entry) => entry.id === selected.id); if (!building) return s; const core = { ...s.core }; returnInventoriesToCore(core, building.input, building.output); return { ...s, core, buildings: s.buildings.map((entry) => entry.id === building.id ? { ...entry, recipeId, input: {}, output: {} } : entry), message: "기존 재고를 코어로 반환하고 제작법을 변경했습니다." }; }); };
  const removeBuilding = () => { if (!selected || selected.type === "core") return; const refund = Math.floor(BUILDINGS[selected.type].cost / 2); playSound("remove"); setGame((s) => { const building = s.buildings.find((entry) => entry.id === selected.id); if (!building) return s; const core = { ...s.core }; returnInventoriesToCore(core, building.input, building.output); return { ...s, core, gold: s.gold + refund, buildings: s.buildings.filter((entry) => entry.id !== selected.id), message: `${BUILDINGS[selected.type].name} 철거 · 내부 재고 반환 · ${refund}골드 회수` }; }); setSelectedId(null); };
  const stageSale = () => { const quantity = Number(saleQuantity); if (!Number.isInteger(quantity) || quantity < 1) { setGame((state) => ({ ...state, message: "판매 수량은 1 이상의 정수여야 합니다." })); return; } const available = inventoryCount(game.core, saleItem); const staged = game.stagedSales.filter((line) => line.item === saleItem).reduce((sum, line) => sum + line.quantity, 0); if (available - staged < quantity) { setGame((s) => ({ ...s, message: "코어 재고가 부족합니다." })); return; } setGame((s) => ({ ...s, stagedSales: [...s.stagedSales, { item: saleItem, quantity }], message: `${ALL_ITEMS[saleItem].name} ${quantity}개를 판매대에 올렸습니다.` })); };
  const selectAllCurrent = () => { const staged = game.stagedSales.filter((line) => line.item === saleItem).reduce((sum, line) => sum + line.quantity, 0); setSaleQuantity(Math.max(0, inventoryCount(game.core, saleItem) - staged)); };
  const stageAllSellable = () => { const lines = SELLABLE_IDS.map((item) => ({ item, quantity: inventoryCount(game.core, item) })).filter((line) => line.quantity > 0); setGame((s) => ({ ...s, stagedSales: lines, message: lines.length ? "판매 가능한 전체 재고를 스테이지에 올렸습니다." : "판매 가능한 재고가 없습니다." })); };
  const confirmSale = () => { let earnings = 0; const core = { ...game.core }; for (const line of game.stagedSales) { if (!Number.isInteger(line.quantity) || line.quantity < 1 || inventoryCount(core, line.item) < line.quantity) { setGame((state) => ({ ...state, message: "판매 목록이 올바르지 않거나 재고가 부족합니다." })); return; } addItem(core, line.item, -line.quantity); earnings += (ALL_ITEMS[line.item].sellPrice ?? 0) * line.quantity; } playSound("sale"); setGame((s) => ({ ...s, core, gold: s.gold + earnings, stagedSales: [], message: `${earnings.toLocaleString()}골드 판매 완료` })); };
  const executeCommand = () => {
    const command = parseGiveCommand(commandInput);
    if (!command) { setCommandFeedback("사용법: give 1000 또는 give all"); return; }
    playSound("sale");
    setGame((state) => applyGiveCommand(state, command));
    setCommandFeedback(""); setCommandInput(""); setCommandOpen(false);
  };
  const submitCommand = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); executeCommand(); };
  const closePanels = () => { setBuildOpen(false); setMarketOpen(false); setHelpOpen(false); setCommandOpen(false); setCommandInput(""); setCommandFeedback(""); setSelectedBuilding(null); setSelectedId(null); setBeltMode(false); setBeltEraseMode(false); setBeltPreview([]); setBeltRemovePreview([]); setPendingBeltPlan(null); setPendingBeltRemoval(null); setMovingId(null); setPendingChunk(null); };
  const startGame = () => { setGame((state) => state.power <= 0 ? { ...state, phase: "GAME_OVER" } : { ...state, phase: "PLAYING", message: state.tick > 0 ? "저장된 공장 운영을 계속합니다." : "공장 운영을 시작합니다." }); setHasSavedGame(true); };
  const resetGame = (startImmediately = false) => { localStorage.removeItem(SAVE_KEY); setGame(initialGame(startImmediately ? "PLAYING" : "READY")); setHasSavedGame(startImmediately); setCamera({ x: CAMERA_START, y: CAMERA_START }); closePanels(); };
  const totalStaged = game.stagedSales.reduce((sum, line) => sum + (ALL_ITEMS[line.item].sellPrice ?? 0) * line.quantity, 0);
  const movingBuilding = movingId ? game.buildings.find((building) => building.id === movingId) ?? null : null;
  const movingInventory = movingBuilding ? inventoryTotal(movingBuilding.input) + inventoryTotal(movingBuilding.output) : 0;
  const previewType = movingId ? game.buildings.find((building) => building.id === movingId)?.type ?? null : selectedBuilding;
  const previewTarget = hoverTile && previewType ? placementTarget(previewType, hoverTile.x, hoverTile.y) : null;
  const previewValid = previewTarget && previewType ? canPlace(previewType, previewTarget.x, previewTarget.y, movingId ?? undefined) : false;

  if (!ready) return <main className="loading-screen">광구 데이터를 불러오는 중…</main>;
  return <main className="game-shell">
    <header className="topbar"><div className="brand"><span className="brand-mark"><Factory /></span><span><strong>FOUNDRY FRONTIER</strong><small>SECTOR 04 · OPERATIONS</small></span></div><div className="stats-row"><Stat icon={<Coins />} label="골드" value={game.gold.toLocaleString()} /><Stat icon={<Zap />} label="보관 전력" value={Math.floor(game.power).toLocaleString()} detail={`/ ${game.powerCapacity.toLocaleString()}`} /><Stat icon={<Gauge />} label="최근 전력 정산" value={`${game.lastPowerDelta >= 0 ? "+" : ""}${game.lastPowerDelta}`} detail={`${game.lastPowerProduced} 생산 - ${game.lastPowerUsed} 사용`} /><Stat icon={<Map />} label="해금 구역" value={`${game.unlockedChunks.length}`} detail={`/ ${TOTAL_CHUNKS} 청크`} /></div><div className="top-actions"><Button variant="ghost" size="icon" aria-label={soundEnabled ? "소리 끄기" : "소리 켜기"} title={soundEnabled ? "소리 끄기" : "소리 켜기"} onClick={toggleSound}>{soundEnabled ? <Volume2 /> : <VolumeX />}</Button><Button variant="ghost" size="icon" aria-label="도움말" onClick={() => setHelpOpen(true)}><HelpCircle /></Button><Button variant="ghost" size="sm" onClick={() => resetGame(false)}>새 게임</Button></div></header>
    <section className="workspace">
      <div ref={viewportRef} className={`world ${beltMode ? "mode-belt" : ""} ${beltEraseMode ? "mode-belt-erase" : ""} ${selectedBuilding || movingId ? "mode-build" : ""}`} onMouseLeave={() => setHoverTile(null)} onWheel={(event) => setZoom((v) => Math.max(.55, Math.min(1.45, v - event.deltaY * .0008)))} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={finishPointer} onPointerCancel={finishPointer} onLostPointerCapture={finishPointer} onDragStart={(event) => event.preventDefault()} onContextMenu={(event) => event.preventDefault()} aria-label="공장 건설 지도"><div className="terrain" />
        {visible.map(({ x, y }) => { const cx = Math.floor(x / CHUNK_SIZE); const cy = Math.floor(y / CHUNK_SIZE); const key = chunkKey(cx, cy); const insideMap = Math.max(Math.abs(cx), Math.abs(cy)) <= MAP_RADIUS_CHUNKS; const open = unlocked.has(key); const inSight = isWithinSight(x, y); const adjacent = insideMap && !open && isAdjacentChunk(cx, cy) && inSight; const fringe = insideMap && !open && !adjacent && inSight; const ore = open || inSight ? oreAnchorAt(x, y, game.worldSeed) : undefined; const plant = open ? availableWildPlantAt(x, y) : undefined; const surveyedOres = adjacent && isSurveyMarkerTile(cx, cy, x, y) ? oresForChunk(cx, cy, game.worldSeed) : undefined; const edge = x % CHUNK_SIZE === 0 || y % CHUNK_SIZE === 0; const fogTexture = open ? {} : { backgroundSize: `${scale * CHUNK_SIZE}px ${scale * CHUNK_SIZE}px`, backgroundPosition: `${-chunkLocal(x) * scale}px ${-chunkLocal(y) * scale}px` }; return <button type="button" tabIndex={-1} key={tileKey(x, y)} data-tile-x={x} data-tile-y={y} className={`tile ${open ? "open" : adjacent ? "adjacent" : fringe ? "fringe" : "fog"} ${edge ? "chunk-edge" : ""} ${ore ? "has-ore" : ""} ${surveyedOres ? "has-survey" : ""}`} style={{ ...tilePosition(x, y), ...fogTexture }} onMouseEnter={() => setHoverTile({ x, y })} onClick={(event) => handleTileClick(x, y, event.timeStamp)} onContextMenu={(event) => handleContext(event, x, y)} aria-label={`타일 ${x}, ${y}`}>{ore && <span className={`ore ore-${ore.tier} ${open ? "" : "ore-surveyed"}`} style={{ width: scale * 3 - 8, height: scale * 3 - 8 }} title={`${open ? "" : "탐사됨 · "}${ore.tier}티어 3×3 광맥`}><b>T{ore.tier}</b></span>}{plant && <span className="wild-plant item-sprite" style={itemSpriteStyle(plant.item)} title={`야생 ${ALL_ITEMS[plant.item].name} · 우클릭하여 채집`} />}{surveyedOres && <span className={`chunk-survey ${surveyedOres.length ? `survey-tier-${surveyedOres[0].tier}` : "survey-empty"}`}><b>{surveyedOres.length ? `T${surveyedOres[0].tier} 광맥` : "광맥 없음"}</b><small>{surveyedOres.length ? `${surveyedOres.length}개 탐지` : "0개"}</small></span>}</button>; })}
        {game.belts.map((belt) => <button key={tileKey(belt.x, belt.y)} data-tile-x={belt.x} data-tile-y={belt.y} type="button" className={`belt belt-direction-${belt.direction} ${beltShapeClass(belt, game.belts)} ${beltRemovePreviewKeys.has(tileKey(belt.x, belt.y)) ? "belt-remove-preview" : ""}`} style={tilePosition(belt.x, belt.y)} onContextMenu={(event) => handleContext(event, belt.x, belt.y)} aria-label={`${BELT_KIND_LABEL[beltKindOf(belt)]} 컨베이어 벨트 ${DIRECTIONS[belt.direction].arrow}`}><span data-arrow={DIRECTIONS[belt.direction].arrow} aria-hidden="true" />{belt.item && <i className="item-sprite belt-item-primary" style={itemSpriteStyle(belt.item)} title={ALL_ITEMS[belt.item].name} />}{belt.secondaryItem && <i className="item-sprite belt-item-secondary" style={itemSpriteStyle(belt.secondaryItem)} title={ALL_ITEMS[belt.secondaryItem].name} />}</button>)}
        {beltPreview.map((tile) => { const previewBelt: Belt = { ...tile, kind: beltKind }; return <div key={`preview-${tileKey(tile.x, tile.y)}`} className={`belt belt-preview belt-direction-${tile.direction} ${beltShapeClass(previewBelt, beltPreviewNetwork)}`} style={tilePosition(tile.x, tile.y)}><span data-arrow={DIRECTIONS[tile.direction].arrow} aria-hidden="true" /></div>; })}
        {game.buildings.map((building) => { const definition = BUILDINGS[building.type]; const position = tilePosition(building.x, building.y); return <button key={building.id} data-tile-x={building.x} data-tile-y={building.y} type="button" className={`building building-${building.type} ${!building.active ? "offline" : ""} ${selectedId === building.id ? "selected" : ""}`} style={{ ...position, width: scale * definition.size, height: scale * definition.size }} onContextMenu={(event) => handleContext(event, building.x, building.y)} onClick={(event) => { if (event.timeStamp >= suppressClickUntilRef.current) setSelectedId(building.id); }}><BuildingPorts type={building.type} /><span className="building-glyph" style={buildingSpriteStyle(building.type)}>{definition.glyph}</span><strong>{definition.name}</strong><small>{!building.active ? "전력 부족" : building.type === "core" ? "ONLINE" : `${definition.power}⚡/2초`}</small></button>; })}
        {previewTarget && previewType && <div className={`building building-preview ${previewValid ? "preview-valid" : "preview-invalid"}`} style={{ ...tilePosition(previewTarget.x, previewTarget.y), width: scale * BUILDINGS[previewType].size, height: scale * BUILDINGS[previewType].size }}><BuildingPorts type={previewType} /><span className="building-glyph" style={buildingSpriteStyle(previewType)}>{BUILDINGS[previewType].glyph}</span><strong>{BUILDINGS[previewType].name}</strong><small>{previewTarget.snapped ? "광맥 자동 정렬" : previewValid ? "설치 가능" : "설치 불가"}</small></div>}
        <div className="crosshair" aria-hidden="true" /><div className="coordinates">X {Math.floor(camera.x / TILE)} · Y {Math.floor(camera.y / TILE)} · {Math.round(zoom * 100)}%</div>
      </div>
      <nav className="command-dock" aria-label="게임 명령"><Button className={buildOpen || selectedBuilding ? "active" : ""} variant="secondary" onClick={() => { setBuildOpen((v) => !v); setMarketOpen(false); }}><Hammer /> {selectedBuilding ? BUILDINGS[selectedBuilding].name : "건물"} <kbd>Q</kbd></Button><Button className={beltMode ? "active" : ""} variant="secondary" onClick={() => { setBeltMode((v) => !v); setBeltEraseMode(false); setSelectedBuilding(null); }}><Box /> 벨트 <kbd>E</kbd></Button>{beltMode && <><Button variant="outline" onClick={cycleBeltKind}>{BELT_KIND_LABEL[beltKind]} <kbd>F</kbd></Button><Button variant="outline" onClick={rotateBelt}><RotateCw /> {DIRECTIONS[beltDirection].arrow} <kbd>R</kbd></Button><Button className={beltEraseMode ? "active belt-erase-active" : ""} variant="outline" onClick={() => setBeltEraseMode((active) => !active)}><Trash2 /> 삭제 선택</Button></>}<Button className={marketOpen ? "active" : ""} variant="secondary" onClick={() => { setMarketOpen((v) => !v); setBuildOpen(false); setSelectedBuilding(null); }}><ShoppingCart /> 판매소 <kbd>Space</kbd></Button></nav>
      <div className="status-line"><span className="pulse" />{game.message}<small>자동 저장됨</small></div>
      {movingBuilding && <div className="relocation-banner" role="status"><Move /><span><strong>{BUILDINGS[movingBuilding.type].name} 이동 중</strong><small>새 위치를 클릭하거나 탭하세요 · 내부 아이템 {movingInventory}개 유지</small></span><Button size="sm" variant="outline" onClick={cancelMove}>취소</Button></div>}
      {game.phase === "READY" && <section className="state-overlay" role="dialog" aria-modal="true" aria-labelledby="ready-title"><div className="state-card"><small>FOUNDRY CONTROL</small><h1 id="ready-title">가동 준비 완료</h1><p>{hasSavedGame ? "저장된 공장 상태를 불러왔습니다. 준비가 되면 운영을 계속하세요." : "미개척 광구의 첫 생산 라인을 구축할 준비가 되었습니다."}</p><div className="state-summary"><span>시작 골드 <strong>{game.gold.toLocaleString()} G</strong></span><span>보관 전력 <strong>{game.power.toLocaleString()}</strong></span></div><Button size="lg" onClick={startGame}>{hasSavedGame ? "이어하기" : "게임 시작"}</Button>{hasSavedGame && <Button variant="outline" onClick={() => resetGame(true)}>새 게임으로 시작</Button>}</div></section>}
      {game.phase === "VICTORY" && <section className="state-overlay victory-overlay" role="dialog" aria-modal="true" aria-labelledby="victory-title"><div className="state-card"><small>SECTOR COMPLETE</small><h1 id="victory-title">전체 광구 개척 완료</h1><p>31×31 맵의 961개 청크를 모두 해금했습니다. 완성된 공장을 계속 운영하거나 여기서 종료할 수 있습니다.</p><div className="state-summary"><span>최종 골드 <strong>{game.gold.toLocaleString()} G</strong></span><span>설치 건물 <strong>{game.buildings.length}</strong></span></div><Button size="lg" onClick={() => setGame((state) => ({ ...state, phase: "PLAYING", mapCompletionAcknowledged: true, message: "전체 개척 이후 자유 운영을 계속합니다." }))}>계속 운영</Button><Button variant="outline" onClick={() => setGame((state) => ({ ...state, phase: "COMPLETED", mapCompletionAcknowledged: true, message: "전체 광구 개척을 완료하고 운영을 종료했습니다." }))}>운영 종료</Button></div></section>}
      {game.phase === "COMPLETED" && <section className="state-overlay victory-overlay" role="dialog" aria-modal="true" aria-labelledby="completed-title"><div className="state-card"><small>MISSION COMPLETE</small><h1 id="completed-title">운영 완료</h1><p>Foundry Frontier의 모든 구역을 개척했습니다.</p><div className="state-summary"><span>최종 골드 <strong>{game.gold.toLocaleString()} G</strong></span><span>설치 건물 <strong>{game.buildings.length}</strong></span></div><Button variant="outline" onClick={() => resetGame(true)}>새 게임</Button></div></section>}
      {game.phase === "GAME_OVER" && <section className="state-overlay game-over-overlay" role="dialog" aria-modal="true" aria-labelledby="game-over-title"><div className="state-card"><small>POWER FAILURE</small><h1 id="game-over-title">GAME OVER</h1><p>보관 전력이 0이 되어 공장 전체가 정지했습니다.</p><div className="state-summary"><span>최종 골드 <strong>{game.gold.toLocaleString()} G</strong></span><span>해금 구역 <strong>{game.unlockedChunks.length}</strong></span><span>설치 건물 <strong>{game.buildings.length}</strong></span></div><Button size="lg" onClick={() => resetGame(true)}>다시 하기</Button></div></section>}
      {buildOpen && <aside className="panel build-panel"><PanelHead eyebrow="건설 카탈로그" title="생산 설비" close={() => setBuildOpen(false)} />{(["채굴", "재배", "가공", "물류", "전력"] as const).map((category) => <div className="build-group" key={category}><h3>{category}</h3>{Object.values(BUILDINGS).filter((b) => b.category === category && b.type !== "core").map((b) => <div className="build-entry" key={b.type}><button className={`build-card ${selectedBuilding === b.type ? "chosen" : ""}`} onClick={() => { setSelectedBuilding(b.type); setBeltMode(false); setBuildOpen(false); setGame((state) => ({ ...state, message: `${b.name} 배치 중 · 마우스를 움직여 위치를 선택하세요.` })); }}><span className="mini-glyph" style={buildingSpriteStyle(b.type)}>{b.glyph}</span><span><strong>{b.name}</strong><small>{b.description}</small></span><span className="build-cost"><em>{b.cost} G</em><small>{b.power > 0 ? `${b.power} ⚡/2초` : "소모 0 ⚡"}</small></span></button>{RECIPES[b.type].length ? <details className="recipe-guide"><summary>조합법 {RECIPES[b.type].length}개 보기</summary><div>{RECIPES[b.type].map((recipe) => <RecipeFormula recipe={recipe} key={recipe.id} />)}</div></details> : <p className="recipe-none">고정 기능 · 조합법 없음</p>}</div>)}</div>)}</aside>}
      {selected && <aside className="panel inspector">
        <PanelHead eyebrow="설비 관리" title={BUILDINGS[selected.type].name} close={() => setSelectedId(null)} />
        <div className="power-state"><Power /><span><strong>{selected.active ? "정상 가동" : "가동 중지"}</strong><small>작동 시 2초당 {BUILDINGS[selected.type].power} 전력</small></span></div>
        {RECIPES[selected.type].length > 0 && <label className="field-label">제작법<select value={selected.recipeId} onChange={(e) => changeRecipe(e.target.value)}>{RECIPES[selected.type].map((r) => <option value={r.id} key={r.id}>{r.name}</option>)}</select></label>}
        {selectedRecipe && <section className="selected-recipe"><small>현재 조합법</small><RecipeFormula recipe={selectedRecipe} /></section>}
        {selected.type === "outputter" && <label className="field-label">출력 아이템<select value={selected.selectedOutput ?? 103} onChange={(e) => updateBuilding({ selectedOutput: Number(e.target.value) as AnyItemId })}>{Object.values(ALL_ITEMS).map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>}
        {selected.type === "core" && <section className="core-output-settings"><h3>출력 포트별 아이템</h3>{["우측 상단", "우측 위", "우측 중앙", "우측 아래", "우측 하단", "하단 중앙"].map((label, index) => <label key={label}><span>{index + 1}. {label}</span><select value={selected.outputSelections?.[index] ?? 103} onChange={(event) => updateCoreOutput(index, Number(event.target.value) as AnyItemId)}>{Object.values(ALL_ITEMS).map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>)}</section>}
        {manualInputItem && <section className="manual-transfer"><h3>입력 보관함에 직접 넣기</h3><label><select value={manualInputItem} onChange={(event) => setManualTransferItem(Number(event.target.value) as AnyItemId)}>{manualInputChoices.map((item) => <option value={item} key={item}>{ALL_ITEMS[item].name} · 코어 {inventoryCount(game.core, item)}개</option>)}</select></label><div><Button size="sm" variant="outline" onClick={() => addManualInput(1)}>1개 넣기</Button><Button size="sm" variant="outline" onClick={() => addManualInput(10)}>10개 넣기</Button><Button size="sm" onClick={() => addManualInput(Infinity)}>가능한 만큼</Button></div></section>}
        <div className="inventory-grid">
          {inputSlotLimit(selected) > 0 && <InventoryList title={`입력 보관 · ${inputSlotLimit(selected) === Infinity ? "무제한" : `${inputSlotLimit(selected)}종`}`} inventory={selected.input} onReturn={selected.type === "core" ? undefined : (item, amount) => returnInventoryItem("input", item, amount)} />}
          <InventoryList title={selected.type === "miner" || selected.type === "advancedMiner" ? "채굴물 임시 보관 · 10초마다 자동 전송" : "출력 보관 · 직접 빼기"} inventory={selected.output} onReturn={selected.type === "core" ? undefined : (item, amount) => returnInventoryItem("output", item, amount)} />
        </div>
        {selected.type === "core" && <InventoryList title="코어 통합 보관함" inventory={game.core} />}
        {selected.type !== "core" && <div className="inspector-actions"><Button variant="outline" onClick={beginMove}><Move /> 이동</Button><Button variant="destructive" onClick={removeBuilding}><Trash2 /> 철거</Button></div>}
      </aside>}
      {marketOpen && <aside className="panel market-panel"><PanelHead eyebrow="광구 거래소" title="판매 스테이지" close={() => setMarketOpen(false)} /><label className="field-label">판매 아이템<select value={saleItem} onChange={(e) => setSaleItem(Number(e.target.value) as AnyItemId)}>{SELLABLE_IDS.map((id) => <option value={id} key={id}>{ALL_ITEMS[id].name} · 보유 {inventoryCount(game.core, id)}개 · {ALL_ITEMS[id].sellPrice} G</option>)}</select></label><div className="stock-line"><span>현재 보유량</span><strong>{inventoryCount(game.core, saleItem).toLocaleString()}개</strong></div><label className="field-label">수량<div className="quantity-row"><Input min={1} step={1} type="number" value={saleQuantity} onChange={(e) => setSaleQuantity(e.target.value === "" ? "" : Number(e.target.value))} /><Button variant="outline" onClick={selectAllCurrent}>전량 선택</Button></div></label><div className="market-actions"><Button onClick={stageSale}>선택 수량 올리기</Button><Button variant="outline" onClick={stageAllSellable}>전체 재고 올리기</Button></div><div className="sale-stage">{game.stagedSales.length === 0 ? <p>판매할 아이템을 선택해 주세요.</p> : game.stagedSales.map((line, index) => <div key={`${line.item}-${index}`}><span>{ALL_ITEMS[line.item].name}</span><strong>{line.quantity}개</strong><em>{((ALL_ITEMS[line.item].sellPrice ?? 0) * line.quantity).toLocaleString()} G</em></div>)}</div><div className="sale-total"><span>예상 수익</span><strong>{totalStaged.toLocaleString()} G</strong></div><Button disabled={!game.stagedSales.length} onClick={confirmSale} className="w-full sell-button"><Coins /> 판매 확정</Button></aside>}
      {pendingBeltPlan && <aside className="belt-confirm" role="dialog" aria-modal="true" aria-label="벨트 설치 확인"><small>벨트 경로 확인</small><h2>{pendingBeltPlan.length}칸을 설치할까요?</h2><p>체크하면 미리 본 경로대로 설치하고, ×를 누르면 모두 취소합니다.</p><div><Button variant="outline" size="icon" aria-label="벨트 설치 취소" title="취소" onClick={cancelBeltPlan}><X /></Button><Button size="icon" aria-label="벨트 설치 확정" title="설치" onClick={confirmBeltPlan}><Check /></Button></div></aside>}
      {pendingBeltRemoval && <aside className="belt-confirm belt-remove-confirm" role="dialog" aria-modal="true" aria-label="벨트 철거 확인"><small>벨트 철거 확인</small><h2>{pendingBeltRemoval.length}칸을 삭제할까요?</h2><p>체크하면 붉게 선택한 벨트를 철거하고, ×를 누르면 모두 유지합니다.</p><div><Button variant="outline" size="icon" aria-label="벨트 철거 취소" title="취소" onClick={cancelBeltRemoval}><X /></Button><Button variant="destructive" size="icon" aria-label="벨트 철거 확정" title="철거" onClick={confirmBeltRemoval}><Check /></Button></div></aside>}
      {pendingChunk && <aside className="chunk-dialog"><small>미개척 구역</small><h2>청크 [{pendingChunk.x}, {pendingChunk.y}]</h2><p>새 광맥과 건설 공간을 조사합니다. 인접 청크만 해금할 수 있습니다.</p><strong>{chunkPrice(game.unlockedChunks.length - 1).toLocaleString()} GOLD</strong><div><Button variant="outline" onClick={() => setPendingChunk(null)}>취소</Button><Button onClick={buyChunk}>구역 해금</Button></div></aside>}
      {helpOpen && <aside className="help-dialog"><PanelHead eyebrow="운영 매뉴얼" title="조작 방법" close={() => setHelpOpen(false)} /><div className="help-grid"><kbd>W A S D</kbd><span>카메라 이동</span><kbd>마우스 드래그</kbd><span>왼쪽 버튼으로 지도 이동</span><kbd>좌클릭</kbd><span>설치 및 결정</span><kbd>우클릭</kbd><span>설비 관리 / 광맥 채굴 / 야생 식물 채집</span><kbd>Q / E / Space</kbd><span>건물 / 벨트 / 판매소</span><kbd>벨트 드래그</kbd><span>지나간 칸에 연속 설치 · 직선과 ㄱ자 자동 연결</span><kbd>F</kbd><span>일반 / 교차 / 분배 / 합류 벨트 변경</span><kbd>R</kbd><span>다음 벨트 출력 방향 회전</span><kbd>휠</kbd><span>지도 확대·축소</span><kbd>터치</kbd><span>한 손가락 드래그 이동 / 길게 눌러 관리·채굴·채집</span></div><p>벨트 모드에서는 드래그로 연속 설치합니다. 교차 벨트는 표시 방향과 시계 방향의 두 흐름을 독립 운송하며, 분배 벨트는 두 출구를 번갈아 사용하고 합류 벨트는 여러 입력을 한 방향으로 보냅니다.</p></aside>}
      {commandOpen && <aside className="command-console" role="dialog" aria-modal="true" aria-label="커맨드 입력"><form onSubmit={submitCommand}><PanelHead eyebrow="FOUNDRY SYSTEM" title="커맨드 입력" close={() => { setCommandOpen(false); setCommandInput(""); setCommandFeedback(""); }} /><p><code>give 숫자</code>는 골드를, <code>give all</code>은 모든 재료를 추가합니다.</p><label className="field-label" htmlFor="command-code">COMMAND CODE<Input id="command-code" autoFocus autoComplete="off" spellCheck={false} value={commandInput} onChange={(event) => { setCommandInput(event.target.value); setCommandFeedback(""); }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); executeCommand(); } else if (event.key === "Escape") { setCommandOpen(false); setCommandInput(""); setCommandFeedback(""); } }} placeholder="give 1000 / give all" /></label>{commandFeedback && <p className="command-feedback" role="alert">{commandFeedback}</p>}<div className="command-actions"><Button type="button" variant="outline" onClick={() => { setCommandOpen(false); setCommandInput(""); setCommandFeedback(""); }}>취소</Button><Button type="button" onClick={executeCommand}>실행</Button></div></form></aside>}
    </section>
  </main>;
}

function BuildingPorts({ type }: { type: BuildingType }) {
  const inputCount = type === "core" ? BUILDINGS[type].inputPorts - 1 : BUILDINGS[type].inputPorts;
  const outputCount = type === "core" ? BUILDINGS[type].outputPorts - 1 : BUILDINGS[type].outputPorts;
  if (inputCount === 0 && outputCount === 0) return null;
  return <span className="ports" aria-hidden="true">
    {Array.from({ length: inputCount }, (_, index) => <i key={`in-${index}`} className="port port-input" style={{ top: `${((index + .5) / inputCount) * 100}%` }} />)}
    {Array.from({ length: outputCount }, (_, index) => <i key={`out-${index}`} className="port port-output" style={{ top: `${((index + .5) / outputCount) * 100}%` }} />)}
    {type === "core" && <><i className="port port-input port-top" /><i className="port port-output port-bottom" /></>}
  </span>;
}
function PanelHead({ eyebrow, title, close }: { eyebrow: string; title: string; close: () => void }) { return <div className="panel-head"><span><small>{eyebrow}</small><h2>{title}</h2></span><Button size="icon-sm" variant="ghost" onClick={close} aria-label="닫기"><X /></Button></div>; }
function RecipeFormula({ recipe }: { recipe: Recipe }) { const inputText = Object.entries(recipe.inputs).map(([id, amount]) => `${ALL_ITEMS[Number(id) as AnyItemId].short} ${amount ?? 0}개`).join(" + "); const duration = (recipe.durationTicks ?? 1) * TICK_MS / 1000; const outputText = `${ALL_ITEMS[recipe.output].short} ${recipe.amount}개 · ${duration}초`; return <div className="recipe-formula" title={`${inputText} → ${outputText}`}><span>{inputText}</span><b>→</b><strong>{outputText}</strong></div>; }
function InventoryList({ title, inventory, onReturn }: { title: string; inventory: Inventory; onReturn?: (item: AnyItemId, amount: number) => void }) {
  const entries = Object.entries(inventory).filter(([, amount]) => (amount ?? 0) > 0);
  return <section className="inventory-list"><h3>{title}</h3>{entries.length === 0 ? <p>비어 있음</p> : entries.map(([id, amount]) => {
    const itemId = Number(id) as AnyItemId; const item = ALL_ITEMS[itemId];
    return <div key={id} className={onReturn ? "returnable" : undefined}><i className="item-sprite" style={itemSpriteStyle(itemId)} title={item.name} /><span title={item.name}>{item.short}</span><strong>{amount}</strong>{onReturn && <span className="return-actions"><Button size="sm" variant="ghost" onClick={() => onReturn(itemId, 1)}>1개</Button><Button size="sm" variant="ghost" onClick={() => onReturn(itemId, 10)}>10개</Button><Button size="sm" variant="ghost" onClick={() => onReturn(itemId, Infinity)}>전량</Button></span>}<Progress value={Math.min(100, ((amount ?? 0) / BUFFER_LIMIT) * 100)} /></div>;
  })}</section>;
}
