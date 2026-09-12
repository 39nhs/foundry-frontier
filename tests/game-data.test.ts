import assert from "node:assert/strict";
import test from "node:test";
// Node 22는 테스트 실행 시 TypeScript 확장자를 직접 제거해 처리합니다.
// @ts-expect-error 실행기에는 .ts 확장자가 필요하며 애플리케이션 빌드는 이를 번들링합니다.
import { ALL_ITEMS, POWER_SETTLEMENT_TICKS, RECIPES, SELLABLE_IDS, TOTAL_CHUNKS, chunkPrice, isMapComplete, oresForChunk, orthogonalTilePath, plantsForChunk, shouldSettlePower } from "../app/game-data.ts";

test("시작·인접·일반 청크의 광맥 생성 규칙", () => {
  for (let seed = 0; seed < 500; seed += 1) {
    assert.equal(oresForChunk(0, 0, seed).length, 0);
    for (const [x, y] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) assert.ok([1, 2].includes(oresForChunk(x, y, seed).length));
  }

  const counts = [0, 0, 0];
  for (let seed = 0; seed < 20_000; seed += 1) counts[oresForChunk(8, 8, seed).length] += 1;
  const ratios = counts.map((count) => count / 20_000);
  assert.ok(Math.abs(ratios[0] - 0.4) < 0.02);
  assert.ok(Math.abs(ratios[1] - 0.45) < 0.02);
  assert.ok(Math.abs(ratios[2] - 0.15) < 0.02);
});

test("야생 식물은 가치 구역별로 약 10% 생성", () => {
  const zones = [
    { x: 5, y: 0, item: 713 },
    { x: 6, y: 0, item: 712 },
    { x: 11, y: 0, item: 711 },
  ];
  for (const zone of zones) {
    let hits = 0;
    for (let seed = 0; seed < 20_000; seed += 1) {
      const plants = plantsForChunk(zone.x, zone.y, seed);
      assert.ok(plants.length <= 1);
      if (plants[0]) { assert.equal(plants[0].item, zone.item); hits += 1; }
    }
    assert.ok(Math.abs(hits / 20_000 - 0.1) < 0.02);
  }
});

test("등록 아이템은 획득 또는 생산 가능하고 막힌 중간재가 없음", () => {
  const recipes = Object.values(RECIPES).flat();
  const produced = new Set<number>(recipes.map((recipe) => recipe.output));
  const consumed = new Set(recipes.flatMap((recipe) => Object.keys(recipe.inputs).map(Number)));
  const naturalSources = new Set([101, 102, 103, 701, 702, 703, 711, 712, 713]);
  const sellable = new Set<number>(SELLABLE_IDS);
  const itemIds = Object.keys(ALL_ITEMS).map(Number);

  assert.deepEqual(itemIds.filter((id) => !naturalSources.has(id) && !produced.has(id)), []);
  assert.deepEqual(itemIds.filter((id) => produced.has(id) && !consumed.has(id) && !sellable.has(id)), []);
});

test("청크 가격은 구매 순서에 따라 증가", () => {
  assert.equal(chunkPrice(0), 500);
  for (let purchases = 1; purchases < 50; purchases += 1) assert.ok(chunkPrice(purchases) > chunkPrice(purchases - 1));
});

test("전력은 5틱마다 정산", () => {
  assert.equal(POWER_SETTLEMENT_TICKS, 5);
  for (let tick = 1; tick <= 20; tick += 1) assert.equal(shouldSettlePower(tick), tick % 5 === 0);
});

test("31×31 청크를 모두 열면 맵 개척 완료", () => {
  assert.equal(TOTAL_CHUNKS, 961);
  assert.equal(isMapComplete(960), false);
  assert.equal(isMapComplete(961), true);
});

test("벨트 드래그 경로는 모든 칸을 직교 방향으로 연결", () => {
  const path = orthogonalTilePath({ x: 1, y: 1 }, { x: 4, y: 3 });
  assert.deepEqual(path, [
    { x: 2, y: 1 }, { x: 3, y: 1 }, { x: 4, y: 1 },
    { x: 4, y: 2 }, { x: 4, y: 3 },
  ]);
  let previous = { x: 1, y: 1 };
  for (const tile of path) {
    assert.equal(Math.abs(tile.x - previous.x) + Math.abs(tile.y - previous.y), 1);
    previous = tile;
  }
});
