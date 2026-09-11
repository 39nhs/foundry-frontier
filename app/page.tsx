"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, Coins, Factory, Gauge, Hammer, HelpCircle, Map, Pickaxe, Power, RotateCw, ShoppingCart, Trash2, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ALL_ITEMS, BUFFER_LIMIT, BUILDINGS, BuildingType, CHUNK_SIZE, Direction, DIRECTIONS, MAP_RADIUS_CHUNKS, RECIPES, SELLABLE_IDS, TICK_MS, AnyItemId, chunkPrice, oresForChunk } from "./game-data";

type Inventory = Partial<Record<AnyItemId, number>>;
interface PlacedBuilding { id: string; type: BuildingType; x: number; y: number; recipeId?: string; selectedOutput?: AnyItemId; input: Inventory; output: Inventory; active: boolean }
interface Belt { x: number; y: number; direction: Direction; item?: AnyItemId }
interface SaleLine { item: AnyItemId; quantity: number }
interface GameState { gold: number; power: number; powerCapacity: number; tick: number; lastPowerProduced: number; lastPowerUsed: number; lastPowerDelta: number; unlockedChunks: string[]; buildings: PlacedBuilding[]; belts: Belt[]; core: Inventory; stagedSales: SaleLine[]; message: string }

const TILE = 40;
const SAVE_KEY = "foundry-frontier-save-v1";
const chunkKey = (x: number, y: number) => `${x},${y}`;
const tileKey = (x: number, y: number) => `${x},${y}`;
const coreBuilding = (): PlacedBuilding => ({ id: "core", type: "core", x: 3, y: 3, selectedOutput: 103, input: {}, output: {}, active: true });
const initialGame = (): GameState => ({ gold: 1000, power: 10000, powerCapacity: 10000, tick: 0, lastPowerProduced: 200, lastPowerUsed: 0, lastPowerDelta: 200, unlockedChunks: ["0,0"], buildings: [coreBuilding()], belts: [], core: {}, stagedSales: [], message: "최초 광구 중앙의 코어가 가동 준비를 마쳤습니다." });

function inventoryCount(inventory: Inventory, id: AnyItemId) { return inventory[id] ?? 0; }
function addItem(inventory: Inventory, id: AnyItemId, amount: number, limit = Infinity) { inventory[id] = Math.max(0, Math.min(limit, inventoryCount(inventory, id) + amount)); }
function buildingAt(buildings: PlacedBuilding[], x: number, y: number, ignoreId?: string) {
  return buildings.find((building) => { if (building.id === ignoreId) return false; const size = BUILDINGS[building.type].size; return x >= building.x && x < building.x + size && y >= building.y && y < building.y + size; });
}
function inputPortTiles(building: PlacedBuilding) {
  const size = BUILDINGS[building.type].size;
  const ports = Array.from({ length: size }, (_, index) => ({ x: building.x, y: building.y + index }));
  if (building.type === "core") ports.push({ x: building.x + 2, y: building.y });
  return ports;
}
function outputTargets(building: PlacedBuilding) {
  const size = BUILDINGS[building.type].size;
  const ports = Array.from({ length: size }, (_, index) => ({ x: building.x + size, y: building.y + index }));
  if (building.type === "core") ports.push({ x: building.x + 2, y: building.y + size });
  return ports;
}
function isInputPort(building: PlacedBuilding, x: number, y: number) { return inputPortTiles(building).some((port) => port.x === x && port.y === y); }
function oreAt(x: number, y: number) { const cx = Math.floor(x / CHUNK_SIZE); const cy = Math.floor(y / CHUNK_SIZE); return oresForChunk(cx, cy).find((ore) => x >= ore.x && x < ore.x + 3 && y >= ore.y && y < ore.y + 3); }
function oreAnchorAt(x: number, y: number) { const cx = Math.floor(x / CHUNK_SIZE); const cy = Math.floor(y / CHUNK_SIZE); return oresForChunk(cx, cy).find((ore) => ore.x === x && ore.y === y); }

function processTick(previous: GameState): GameState {
  const state: GameState = structuredClone(previous); state.tick += 1;
  let produced = 200;
  let used = 0;

  for (const building of state.buildings) {
    if (building.type !== "generator" || state.tick % 10 !== 0) continue;
    const battery = ([601, 602, 603] as AnyItemId[]).find((id) => inventoryCount(building.input, id) > 0);
    if (battery) { addItem(building.input, battery, -1); produced += ALL_ITEMS[battery].power ?? 0; }
  }
  let availablePower = state.power + produced;
  for (const building of state.buildings) {
    building.active = true; const definition = BUILDINGS[building.type];
    if (definition.power > 0) { if (availablePower < definition.power) { building.active = false; continue; } availablePower -= definition.power; used += definition.power; }
    if (building.type === "generator") continue;
    if (building.type === "miner" || building.type === "advancedMiner") {
      const size = definition.size; let vein: ReturnType<typeof oreAt>;
      for (let y = building.y; y < building.y + size && !vein; y += 1) for (let x = building.x; x < building.x + size && !vein; x += 1) vein = oreAt(x, y);
      if (vein && (building.type === "advancedMiner" || vein.tier !== 1)) addItem(building.output, (100 + vein.tier) as AnyItemId, 1, BUFFER_LIMIT);
      if (state.tick % 5 === 0) for (const [id, amount] of Object.entries(building.output)) { addItem(state.core, Number(id) as AnyItemId, amount ?? 0); delete building.output[Number(id) as AnyItemId]; }
      continue;
    }
    if (building.type === "outputter" && building.selectedOutput) { const id = building.selectedOutput; if (inventoryCount(state.core, id) > 0 && inventoryCount(building.output, id) < BUFFER_LIMIT) { addItem(state.core, id, -1); addItem(building.output, id, 1, BUFFER_LIMIT); } continue; }
    if (building.type === "inputter" && state.tick % 5 === 0) { for (const [id, amount] of Object.entries(building.input)) { addItem(state.core, Number(id) as AnyItemId, amount ?? 0); delete building.input[Number(id) as AnyItemId]; } continue; }
    const recipe = RECIPES[building.type].find((candidate) => candidate.id === building.recipeId);
    if (recipe && inventoryCount(building.output, recipe.output) < BUFFER_LIMIT) { const canCraft = Object.entries(recipe.inputs).every(([id, amount]) => inventoryCount(building.input, Number(id) as AnyItemId) >= (amount ?? 0)); if (canCraft) { for (const [id, amount] of Object.entries(recipe.inputs)) addItem(building.input, Number(id) as AnyItemId, -(amount ?? 0)); addItem(building.output, recipe.output, recipe.amount, BUFFER_LIMIT); } }
  }
  const occupiedBelts = new globalThis.Map(state.belts.map((belt) => [tileKey(belt.x, belt.y), belt])); const moves: { from: Belt; to?: Belt; receiver?: PlacedBuilding }[] = [];
  for (const belt of state.belts) { if (!belt.item) continue; const vector = DIRECTIONS[belt.direction]; const tx = belt.x + vector.x; const ty = belt.y + vector.y; const receiver = buildingAt(state.buildings, tx, ty); const nextBelt = occupiedBelts.get(tileKey(tx, ty)); if (receiver && isInputPort(receiver, tx, ty) && inventoryCount(receiver.input, belt.item) < BUFFER_LIMIT) moves.push({ from: belt, receiver }); else if (nextBelt && !nextBelt.item) moves.push({ from: belt, to: nextBelt }); }
  for (const move of moves) { if (!move.from.item) continue; if (move.receiver) addItem(move.receiver.type === "core" ? state.core : move.receiver.input, move.from.item, 1, move.receiver.type === "core" ? Infinity : BUFFER_LIMIT); if (move.to) move.to.item = move.from.item; move.from.item = undefined; }
  for (const building of state.buildings) {
    const outputEntry = Object.entries(building.output).find(([, amount]) => (amount ?? 0) > 0);
    const item = building.type === "core" ? building.selectedOutput : outputEntry ? Number(outputEntry[0]) as AnyItemId : undefined;
    if (!item || (building.type === "core" ? inventoryCount(state.core, item) < 1 : !outputEntry)) continue;
    const targets = outputTargets(building);
    const receiver = targets.map((target) => buildingAt(state.buildings, target.x, target.y)).find((candidate, index) => candidate && isInputPort(candidate, targets[index].x, targets[index].y) && inventoryCount(candidate.input, item) < BUFFER_LIMIT);
    if (receiver) { addItem(receiver.type === "core" ? state.core : receiver.input, item, 1, receiver.type === "core" ? Infinity : BUFFER_LIMIT); addItem(building.type === "core" ? state.core : building.output, item, -1); continue; }
    const belt = targets.map((target) => occupiedBelts.get(tileKey(target.x, target.y))).find((candidate) => candidate && !candidate.item);
    if (belt) { belt.item = item; addItem(building.type === "core" ? state.core : building.output, item, -1); }
  }
  state.power = Math.max(0, Math.min(state.powerCapacity, availablePower));
  state.lastPowerProduced = produced;
  state.lastPowerUsed = used;
  state.lastPowerDelta = produced - used;
  state.message = `생산 틱 ${state.tick} 완료 · 전력 ${state.lastPowerDelta >= 0 ? "+" : ""}${state.lastPowerDelta}`; return state;
}

function Stat({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail?: string }) { return <div className="stat"><span className="stat-icon">{icon}</span><span><small>{label}</small><strong>{value}</strong>{detail && <em>{detail}</em>}</span></div>; }

export default function Home() {
  const [game, setGame] = useState<GameState>(initialGame); const [ready, setReady] = useState(false); const [camera, setCamera] = useState({ x: 5 * TILE, y: 5 * TILE }); const [viewport, setViewport] = useState({ width: 1200, height: 800 }); const [zoom, setZoom] = useState(1);
  const [buildOpen, setBuildOpen] = useState(false); const [marketOpen, setMarketOpen] = useState(false); const [helpOpen, setHelpOpen] = useState(false); const [selectedBuilding, setSelectedBuilding] = useState<BuildingType | null>(null); const [selectedId, setSelectedId] = useState<string | null>(null); const [beltMode, setBeltMode] = useState(false); const [beltDirection, setBeltDirection] = useState<Direction>("right"); const [movingId, setMovingId] = useState<string | null>(null); const [hoverTile, setHoverTile] = useState<{ x: number; y: number } | null>(null); const [pendingChunk, setPendingChunk] = useState<{ x: number; y: number } | null>(null); const [saleItem, setSaleItem] = useState<AnyItemId>(603); const [saleQuantity, setSaleQuantity] = useState(1);
  const viewportRef = useRef<HTMLDivElement>(null); const keysRef = useRef(new Set<string>()); const lastFrameRef = useRef(0);

  useEffect(() => { const saved = localStorage.getItem(SAVE_KEY); if (saved) try { const parsed = JSON.parse(saved) as GameState; parsed.buildings = parsed.buildings.map((building) => building.type === "core" ? { ...building, x: 3, y: 3 } : building); parsed.lastPowerProduced ??= 200; parsed.lastPowerUsed ??= 0; parsed.lastPowerDelta ??= 200; setGame(parsed); } catch { localStorage.removeItem(SAVE_KEY); } setReady(true); }, []);
  useEffect(() => { if (ready) localStorage.setItem(SAVE_KEY, JSON.stringify(game)); }, [game, ready]);
  useEffect(() => { if (!ready) return; const timer = window.setInterval(() => setGame(processTick), TICK_MS); return () => window.clearInterval(timer); }, [ready]);
  useEffect(() => { if (!viewportRef.current) return; const observer = new ResizeObserver(([entry]) => setViewport({ width: entry.contentRect.width, height: entry.contentRect.height })); observer.observe(viewportRef.current); return () => observer.disconnect(); }, []);
  useEffect(() => {
    const down = (event: KeyboardEvent) => { if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return; const key = event.key.toLowerCase(); if (["w", "a", "s", "d"].includes(key)) keysRef.current.add(key); if (event.repeat) return; if (key === "q") { setBuildOpen((v) => !v); setMarketOpen(false); } if (key === "e") { setBeltMode((v) => !v); setSelectedBuilding(null); } if (key === " ") { event.preventDefault(); setMarketOpen((v) => !v); setBuildOpen(false); } if (key === "r" && beltMode) { const order: Direction[] = ["up", "right", "down", "left"]; setBeltDirection((d) => order[(order.indexOf(d) + 1) % order.length]); } if (key === "escape") { setBuildOpen(false); setMarketOpen(false); setHelpOpen(false); setSelectedId(null); setSelectedBuilding(null); setBeltMode(false); setMovingId(null); setPendingChunk(null); } };
    const up = (event: KeyboardEvent) => keysRef.current.delete(event.key.toLowerCase()); window.addEventListener("keydown", down); window.addEventListener("keyup", up); return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [beltMode]);
  useEffect(() => { let frame = 0; const animate = (time: number) => { const dt = Math.min(32, time - lastFrameRef.current || 16); lastFrameRef.current = time; const keys = keysRef.current; if (keys.size) { const speed = 0.5 * dt / zoom; setCamera((c) => ({ x: c.x + (keys.has("d") ? speed : 0) - (keys.has("a") ? speed : 0), y: c.y + (keys.has("s") ? speed : 0) - (keys.has("w") ? speed : 0) })); } frame = requestAnimationFrame(animate); }; frame = requestAnimationFrame(animate); return () => cancelAnimationFrame(frame); }, [zoom]);
  useEffect(() => { const modelContext = (document as Document & { modelContext?: { registerTool: (tool: unknown, options?: unknown) => unknown } }).modelContext; if (!modelContext?.registerTool) return; const lifecycle = new AbortController(); try { void Promise.resolve(modelContext.registerTool({ name: "read_factory_status", title: "공장 현황 읽기", description: "현재 골드, 전력, 해금 청크, 건물 수와 코어 재고를 읽습니다.", inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: false }, execute: () => ({ gold: game.gold, power: game.power, unlockedChunks: game.unlockedChunks.length, buildings: game.buildings.length, core: game.core }) }, { signal: lifecycle.signal })).catch(() => undefined); } catch {} return () => lifecycle.abort(); }, [game]);

  const unlocked = useMemo(() => new Set(game.unlockedChunks), [game.unlockedChunks]); const selected = game.buildings.find((b) => b.id === selectedId) ?? null; const scale = TILE * zoom;
  const visible = useMemo(() => { const halfCols = Math.ceil(viewport.width / scale / 2) + 2; const halfRows = Math.ceil(viewport.height / scale / 2) + 2; const centerX = Math.floor(camera.x / TILE); const centerY = Math.floor(camera.y / TILE); const tiles: { x: number; y: number }[] = []; for (let y = centerY - halfRows; y <= centerY + halfRows; y += 1) for (let x = centerX - halfCols; x <= centerX + halfCols; x += 1) if (Math.abs(x) <= (MAP_RADIUS_CHUNKS + 1) * CHUNK_SIZE && Math.abs(y) <= (MAP_RADIUS_CHUNKS + 1) * CHUNK_SIZE) tiles.push({ x, y }); return tiles; }, [camera, scale, viewport]);
  const tilePosition = useCallback((x: number, y: number) => ({ left: viewport.width / 2 + (x * TILE - camera.x) * zoom, top: viewport.height / 2 + (y * TILE - camera.y) * zoom, width: scale, height: scale }), [camera, scale, viewport, zoom]);
  const isAdjacentChunk = (cx: number, cy: number) => game.unlockedChunks.some((key) => { const [ux, uy] = key.split(",").map(Number); return Math.abs(ux - cx) + Math.abs(uy - cy) === 1; });
  const canPlace = (type: BuildingType, x: number, y: number, ignoreId?: string) => { const size = BUILDINGS[type].size; for (let ty = y; ty < y + size; ty += 1) for (let tx = x; tx < x + size; tx += 1) { const cx = Math.floor(tx / CHUNK_SIZE); const cy = Math.floor(ty / CHUNK_SIZE); if (!unlocked.has(chunkKey(cx, cy)) || buildingAt(game.buildings, tx, ty, ignoreId) || game.belts.some((b) => b.x === tx && b.y === ty)) return false; } if (type === "miner" || type === "advancedMiner") { let vein: ReturnType<typeof oreAt>; for (let ty = y; ty < y + size && !vein; ty += 1) for (let tx = x; tx < x + size && !vein; tx += 1) vein = oreAt(tx, ty); if (!vein || (type === "miner" && vein.tier === 1)) return false; } return true; };
  const placementTarget = (type: BuildingType, x: number, y: number) => {
    if (type === "miner" || type === "advancedMiner") {
      const vein = oreAt(x, y);
      if (vein) return { x: vein.x, y: vein.y, snapped: true };
    }
    return { x, y, snapped: false };
  };

  const handleTileClick = (rawX: number, rawY: number) => {
    const cx = Math.floor(rawX / CHUNK_SIZE); const cy = Math.floor(rawY / CHUNK_SIZE);
    if (!unlocked.has(chunkKey(cx, cy))) { if (Math.max(Math.abs(cx), Math.abs(cy)) <= MAP_RADIUS_CHUNKS && isAdjacentChunk(cx, cy)) setPendingChunk({ x: cx, y: cy }); return; }
    if (beltMode) { if (buildingAt(game.buildings, rawX, rawY)) return; setGame((state) => ({ ...state, belts: [...state.belts.filter((b) => b.x !== rawX || b.y !== rawY), { x: rawX, y: rawY, direction: beltDirection }], message: `벨트 ${DIRECTIONS[beltDirection].arrow} 설치` })); return; }
    const buildingType = movingId ? game.buildings.find((b) => b.id === movingId)?.type : selectedBuilding;
    if (!buildingType || buildingType === "core") return;
    const target = placementTarget(buildingType, rawX, rawY); const { x, y } = target;
    if (!canPlace(buildingType, x, y, movingId ?? undefined)) { setGame((s) => ({ ...s, message: buildingType.includes("Miner") || buildingType === "miner" ? "채굴기를 3×3 광맥 위에 놓아 주세요." : "이 위치에는 설치할 수 없습니다." })); return; }
    if (movingId) { setGame((s) => ({ ...s, buildings: s.buildings.map((b) => b.id === movingId ? { ...b, x, y } : b), message: `${BUILDINGS[buildingType].name} 이동 완료` })); setMovingId(null); setSelectedId(null); return; }
    const definition = BUILDINGS[buildingType]; if (game.gold < definition.cost) { setGame((s) => ({ ...s, message: "골드가 부족합니다." })); return; }
    const recipes = RECIPES[buildingType]; setGame((s) => ({ ...s, gold: s.gold - definition.cost, buildings: [...s.buildings, { id: `${buildingType}-${Date.now()}`, type: buildingType, x, y, input: {}, output: {}, active: true, recipeId: recipes[0]?.id, selectedOutput: buildingType === "outputter" ? 103 : undefined }], message: `${definition.name} 건설 완료${target.snapped ? " · 광맥 자동 정렬" : ""}` }));
  };
  const handleContext = (event: React.MouseEvent, x: number, y: number) => { event.preventDefault(); const building = buildingAt(game.buildings, x, y); if (building) { setSelectedId(building.id); return; } const ore = oreAt(x, y); const cx = Math.floor(x / CHUNK_SIZE); const cy = Math.floor(y / CHUNK_SIZE); if (ore && unlocked.has(chunkKey(cx, cy))) { const item = (100 + ore.tier) as AnyItemId; setGame((s) => ({ ...s, core: { ...s.core, [item]: inventoryCount(s.core, item) + 1 }, message: `${ALL_ITEMS[item].name} 1개를 직접 채굴했습니다.` })); } };
  const buyChunk = () => { if (!pendingChunk) return; const price = chunkPrice(game.unlockedChunks.length - 1); if (game.gold < price) { setGame((s) => ({ ...s, message: "청크를 해금할 골드가 부족합니다." })); return; } setGame((s) => ({ ...s, gold: s.gold - price, unlockedChunks: [...s.unlockedChunks, chunkKey(pendingChunk.x, pendingChunk.y)], message: `청크 [${pendingChunk.x}, ${pendingChunk.y}] 해금` })); setPendingChunk(null); };
  const rotateBelt = () => { const order: Direction[] = ["up", "right", "down", "left"]; setBeltDirection((d) => order[(order.indexOf(d) + 1) % order.length]); };
  const updateBuilding = (patch: Partial<PlacedBuilding>) => { if (selected) setGame((s) => ({ ...s, buildings: s.buildings.map((b) => b.id === selected.id ? { ...b, ...patch } : b) })); };
  const removeBuilding = () => { if (!selected || selected.type === "core") return; const refund = Math.floor(BUILDINGS[selected.type].cost / 2); setGame((s) => ({ ...s, gold: s.gold + refund, buildings: s.buildings.filter((b) => b.id !== selected.id), message: `${BUILDINGS[selected.type].name} 철거 · ${refund}골드 회수` })); setSelectedId(null); };
  const stageSale = () => { const quantity = Math.max(1, Math.floor(saleQuantity)); const available = inventoryCount(game.core, saleItem); const staged = game.stagedSales.filter((line) => line.item === saleItem).reduce((sum, line) => sum + line.quantity, 0); if (available - staged < quantity) { setGame((s) => ({ ...s, message: "코어 재고가 부족합니다." })); return; } setGame((s) => ({ ...s, stagedSales: [...s.stagedSales, { item: saleItem, quantity }], message: `${ALL_ITEMS[saleItem].name} ${quantity}개를 판매대에 올렸습니다.` })); };
  const selectAllCurrent = () => { const staged = game.stagedSales.filter((line) => line.item === saleItem).reduce((sum, line) => sum + line.quantity, 0); setSaleQuantity(Math.max(0, inventoryCount(game.core, saleItem) - staged)); };
  const stageAllSellable = () => { const lines = SELLABLE_IDS.map((item) => ({ item, quantity: inventoryCount(game.core, item) })).filter((line) => line.quantity > 0); setGame((s) => ({ ...s, stagedSales: lines, message: lines.length ? "판매 가능한 전체 재고를 스테이지에 올렸습니다." : "판매 가능한 재고가 없습니다." })); };
  const confirmSale = () => { let earnings = 0; const core = { ...game.core }; for (const line of game.stagedSales) { if (inventoryCount(core, line.item) < line.quantity) return; addItem(core, line.item, -line.quantity); earnings += (ALL_ITEMS[line.item].sellPrice ?? 0) * line.quantity; } setGame((s) => ({ ...s, core, gold: s.gold + earnings, stagedSales: [], message: `${earnings.toLocaleString()}골드 판매 완료` })); };
  const resetGame = () => { localStorage.removeItem(SAVE_KEY); setGame(initialGame()); setCamera({ x: 5 * TILE, y: 5 * TILE }); setSelectedId(null); };
  const totalStaged = game.stagedSales.reduce((sum, line) => sum + (ALL_ITEMS[line.item].sellPrice ?? 0) * line.quantity, 0);
  const previewType = movingId ? game.buildings.find((building) => building.id === movingId)?.type ?? null : selectedBuilding;
  const previewTarget = hoverTile && previewType ? placementTarget(previewType, hoverTile.x, hoverTile.y) : null;
  const previewValid = previewTarget && previewType ? canPlace(previewType, previewTarget.x, previewTarget.y, movingId ?? undefined) : false;

  if (!ready) return <main className="loading-screen">광구 데이터를 불러오는 중…</main>;
  return <main className="game-shell">
    <header className="topbar"><div className="brand"><span className="brand-mark"><Factory /></span><span><strong>FOUNDRY FRONTIER</strong><small>SECTOR 04 · OPERATIONS</small></span></div><div className="stats-row"><Stat icon={<Coins />} label="골드" value={game.gold.toLocaleString()} /><Stat icon={<Zap />} label="보관 전력" value={Math.floor(game.power).toLocaleString()} detail={`/ ${game.powerCapacity.toLocaleString()}`} /><Stat icon={<Gauge />} label="전력 변화 / 틱" value={`${game.lastPowerDelta >= 0 ? "+" : ""}${game.lastPowerDelta}`} detail={`${game.lastPowerProduced} 생산 - ${game.lastPowerUsed} 사용`} /><Stat icon={<Map />} label="해금 구역" value={`${game.unlockedChunks.length}`} detail="/ 961 청크" /></div><div className="top-actions"><Button variant="ghost" size="icon" aria-label="도움말" onClick={() => setHelpOpen(true)}><HelpCircle /></Button><Button variant="ghost" size="sm" onClick={resetGame}>새 게임</Button></div></header>
    <section className="workspace">
      <div ref={viewportRef} className={`world ${beltMode ? "mode-belt" : ""} ${selectedBuilding || movingId ? "mode-build" : ""}`} onMouseLeave={() => setHoverTile(null)} onWheel={(event) => setZoom((v) => Math.max(.55, Math.min(1.45, v - event.deltaY * .0008)))} aria-label="공장 건설 지도"><div className="terrain" />
        {visible.map(({ x, y }) => { const cx = Math.floor(x / CHUNK_SIZE); const cy = Math.floor(y / CHUNK_SIZE); const key = chunkKey(cx, cy); const insideMap = Math.max(Math.abs(cx), Math.abs(cy)) <= MAP_RADIUS_CHUNKS; const open = unlocked.has(key); const adjacent = insideMap && isAdjacentChunk(cx, cy); const ore = open ? oreAnchorAt(x, y) : undefined; const edge = x % CHUNK_SIZE === 0 || y % CHUNK_SIZE === 0; return <button type="button" tabIndex={-1} key={tileKey(x, y)} className={`tile ${open ? "open" : adjacent ? "adjacent" : "fog"} ${edge ? "chunk-edge" : ""}`} style={tilePosition(x, y)} onMouseEnter={() => setHoverTile({ x, y })} onClick={() => handleTileClick(x, y)} onContextMenu={(event) => handleContext(event, x, y)} aria-label={`타일 ${x}, ${y}`}>{ore && <span className={`ore ore-${ore.tier}`} style={{ width: scale * 3 - 8, height: scale * 3 - 8 }} title={`${ore.tier}티어 3×3 광맥`}><Pickaxe /></span>}{!open && adjacent && x % CHUNK_SIZE === 4 && y % CHUNK_SIZE === 4 && <span className="chunk-lock">₲</span>}</button>; })}
        {game.belts.map((belt) => <button key={tileKey(belt.x, belt.y)} type="button" className="belt" style={tilePosition(belt.x, belt.y)} onContextMenu={(event) => { event.preventDefault(); setGame((s) => ({ ...s, belts: s.belts.filter((b) => b.x !== belt.x || b.y !== belt.y), message: "벨트를 철거했습니다." })); }} aria-label={`컨베이어 벨트 ${DIRECTIONS[belt.direction].arrow}`}><span>{DIRECTIONS[belt.direction].arrow}</span>{belt.item && <i style={{ background: ALL_ITEMS[belt.item].color }} title={ALL_ITEMS[belt.item].name} />}</button>)}
        {game.buildings.map((building) => { const definition = BUILDINGS[building.type]; const position = tilePosition(building.x, building.y); return <button key={building.id} type="button" className={`building building-${building.type} ${!building.active ? "offline" : ""} ${selectedId === building.id ? "selected" : ""}`} style={{ ...position, width: scale * definition.size, height: scale * definition.size }} onContextMenu={(event) => { event.preventDefault(); setSelectedId(building.id); }} onClick={() => setSelectedId(building.id)}><BuildingPorts type={building.type} /><span className="building-glyph">{definition.glyph}</span><strong>{definition.name}</strong><small>{!building.active ? "전력 부족" : building.type === "core" ? "ONLINE" : `${definition.power}⚡/틱`}</small></button>; })}
        {previewTarget && previewType && <div className={`building building-preview ${previewValid ? "preview-valid" : "preview-invalid"}`} style={{ ...tilePosition(previewTarget.x, previewTarget.y), width: scale * BUILDINGS[previewType].size, height: scale * BUILDINGS[previewType].size }}><BuildingPorts type={previewType} /><span className="building-glyph">{BUILDINGS[previewType].glyph}</span><strong>{BUILDINGS[previewType].name}</strong><small>{previewTarget.snapped ? "광맥 자동 정렬" : previewValid ? "설치 가능" : "설치 불가"}</small></div>}
        <div className="crosshair" aria-hidden="true" /><div className="coordinates">X {Math.floor(camera.x / TILE)} · Y {Math.floor(camera.y / TILE)} · {Math.round(zoom * 100)}%</div>
      </div>
      <nav className="command-dock" aria-label="게임 명령"><Button className={buildOpen || selectedBuilding ? "active" : ""} variant="secondary" onClick={() => { setBuildOpen((v) => !v); setMarketOpen(false); }}><Hammer /> {selectedBuilding ? BUILDINGS[selectedBuilding].name : "건물"} <kbd>Q</kbd></Button><Button className={beltMode ? "active" : ""} variant="secondary" onClick={() => { setBeltMode((v) => !v); setSelectedBuilding(null); }}><Box /> 벨트 <kbd>E</kbd></Button>{beltMode && <Button variant="outline" onClick={rotateBelt}><RotateCw /> {DIRECTIONS[beltDirection].arrow} <kbd>R</kbd></Button>}<Button className={marketOpen ? "active" : ""} variant="secondary" onClick={() => { setMarketOpen((v) => !v); setBuildOpen(false); setSelectedBuilding(null); }}><ShoppingCart /> 판매소 <kbd>Space</kbd></Button></nav>
      <div className="status-line"><span className="pulse" />{game.message}<small>자동 저장됨</small></div>
      {buildOpen && <aside className="panel build-panel"><PanelHead eyebrow="건설 카탈로그" title="생산 설비" close={() => setBuildOpen(false)} />{(["채굴", "가공", "물류", "전력"] as const).map((category) => <div className="build-group" key={category}><h3>{category}</h3>{Object.values(BUILDINGS).filter((b) => b.category === category && b.type !== "core").map((b) => <button key={b.type} className={`build-card ${selectedBuilding === b.type ? "chosen" : ""}`} onClick={() => { setSelectedBuilding(b.type); setBeltMode(false); setBuildOpen(false); setGame((state) => ({ ...state, message: `${b.name} 배치 중 · 마우스를 움직여 위치를 선택하세요.` })); }}><span className="mini-glyph">{b.glyph}</span><span><strong>{b.name}</strong><small>{b.description}</small></span><em>{b.cost} G</em></button>)}</div>)}</aside>}
      {selected && <aside className="panel inspector"><PanelHead eyebrow="설비 관리" title={BUILDINGS[selected.type].name} close={() => setSelectedId(null)} /><div className="power-state"><Power /><span><strong>{selected.active ? "정상 가동" : "가동 중지"}</strong><small>틱당 {BUILDINGS[selected.type].power} 전력</small></span></div>{RECIPES[selected.type].length > 0 && <label className="field-label">제작법<select value={selected.recipeId} onChange={(e) => updateBuilding({ recipeId: e.target.value, input: {}, output: {} })}>{RECIPES[selected.type].map((r) => <option value={r.id} key={r.id}>{r.name}</option>)}</select></label>}{(selected.type === "outputter" || selected.type === "core") && <label className="field-label">출력 아이템<select value={selected.selectedOutput ?? 103} onChange={(e) => updateBuilding({ selectedOutput: Number(e.target.value) as AnyItemId })}>{Object.values(ALL_ITEMS).map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>}<div className="inventory-grid"><InventoryList title="입력 보관" inventory={selected.input} /><InventoryList title="출력 보관" inventory={selected.output} /></div>{selected.type === "core" && <InventoryList title="코어 통합 보관함" inventory={game.core} />}{selected.type !== "core" && <div className="inspector-actions"><Button variant="outline" onClick={() => { setMovingId(selected.id); setSelectedId(null); }}>이동</Button><Button variant="destructive" onClick={removeBuilding}><Trash2 /> 철거</Button></div>}</aside>}
      {marketOpen && <aside className="panel market-panel"><PanelHead eyebrow="광구 거래소" title="판매 스테이지" close={() => setMarketOpen(false)} /><label className="field-label">판매 아이템<select value={saleItem} onChange={(e) => setSaleItem(Number(e.target.value) as AnyItemId)}>{SELLABLE_IDS.map((id) => <option value={id} key={id}>{ALL_ITEMS[id].name} · 보유 {inventoryCount(game.core, id)}개 · {ALL_ITEMS[id].sellPrice} G</option>)}</select></label><div className="stock-line"><span>현재 보유량</span><strong>{inventoryCount(game.core, saleItem).toLocaleString()}개</strong></div><label className="field-label">수량<div className="quantity-row"><Input min={1} max={999} type="number" value={saleQuantity} onChange={(e) => setSaleQuantity(Number(e.target.value))} /><Button variant="outline" onClick={selectAllCurrent}>전량 선택</Button></div></label><div className="market-actions"><Button onClick={stageSale}>선택 수량 올리기</Button><Button variant="outline" onClick={stageAllSellable}>전체 재고 올리기</Button></div><div className="sale-stage">{game.stagedSales.length === 0 ? <p>판매할 아이템을 선택해 주세요.</p> : game.stagedSales.map((line, index) => <div key={`${line.item}-${index}`}><span>{ALL_ITEMS[line.item].name}</span><strong>{line.quantity}개</strong><em>{((ALL_ITEMS[line.item].sellPrice ?? 0) * line.quantity).toLocaleString()} G</em></div>)}</div><div className="sale-total"><span>예상 수익</span><strong>{totalStaged.toLocaleString()} G</strong></div><Button disabled={!game.stagedSales.length} onClick={confirmSale} className="w-full sell-button"><Coins /> 판매 확정</Button></aside>}
      {pendingChunk && <aside className="chunk-dialog"><small>미개척 구역</small><h2>청크 [{pendingChunk.x}, {pendingChunk.y}]</h2><p>새 광맥과 건설 공간을 조사합니다. 인접 청크만 해금할 수 있습니다.</p><strong>{chunkPrice(game.unlockedChunks.length - 1).toLocaleString()} GOLD</strong><div><Button variant="outline" onClick={() => setPendingChunk(null)}>취소</Button><Button onClick={buyChunk}>구역 해금</Button></div></aside>}
      {helpOpen && <aside className="help-dialog"><PanelHead eyebrow="운영 매뉴얼" title="조작 방법" close={() => setHelpOpen(false)} /><div className="help-grid"><kbd>W A S D</kbd><span>카메라 이동</span><kbd>좌클릭</kbd><span>설치 및 결정</span><kbd>우클릭</kbd><span>설비 관리 / 광맥 직접 채굴</span><kbd>Q / E / Space</kbd><span>건물 / 벨트 / 판매소</span><kbd>R</kbd><span>벨트 방향 회전</span><kbd>휠</kbd><span>지도 확대·축소</span></div><p>청록색 입력 포트와 주황색 출력 포트를 맞춰 생산 라인을 구성하세요. 채굴기는 3×3 광맥에 자동으로 정렬되며 2초마다 자원을 생산합니다.</p></aside>}
    </section>
  </main>;
}

function BuildingPorts({ type }: { type: BuildingType }) {
  const count = type === "core" ? BUILDINGS[type].inputPorts - 1 : BUILDINGS[type].inputPorts;
  return <span className="ports" aria-hidden="true">
    {Array.from({ length: count }, (_, index) => <i key={`in-${index}`} className="port port-input" style={{ top: `${((index + .5) / count) * 100}%` }} />)}
    {Array.from({ length: count }, (_, index) => <i key={`out-${index}`} className="port port-output" style={{ top: `${((index + .5) / count) * 100}%` }} />)}
    {type === "core" && <><i className="port port-input port-top" /><i className="port port-output port-bottom" /></>}
  </span>;
}
function PanelHead({ eyebrow, title, close }: { eyebrow: string; title: string; close: () => void }) { return <div className="panel-head"><span><small>{eyebrow}</small><h2>{title}</h2></span><Button size="icon-sm" variant="ghost" onClick={close} aria-label="닫기"><X /></Button></div>; }
function InventoryList({ title, inventory }: { title: string; inventory: Inventory }) { const entries = Object.entries(inventory).filter(([, amount]) => (amount ?? 0) > 0); return <section className="inventory-list"><h3>{title}</h3>{entries.length === 0 ? <p>비어 있음</p> : entries.map(([id, amount]) => { const item = ALL_ITEMS[Number(id) as AnyItemId]; return <div key={id}><i style={{ background: item.color }} /><span>{item.short}</span><strong>{amount}</strong><Progress value={Math.min(100, ((amount ?? 0) / BUFFER_LIMIT) * 100)} /></div>; })}</section>; }
