/**
 * Kinesynth · 엔진 — 코어 스택 실행기
 *
 * 합성 v0 = 코어 스택 (PRD §4). 명시적 패치 케이블 없이 채널 공유로 모듈레이션이
 * 일어난다: Bounce가 쓴 vel을 Squash가 읽는다. 실행 순서는 레벨 순
 * space → flock → entity → deform.
 *
 * 결정론: 고정 타임스텝 1/60 + 어큐뮬레이터 + 시드 고정 난수 → 같은 시드 = 같은 움직임.
 *
 * 순수 TS. DOM·Svelte import 금지.
 */

import {
	LEVEL_ORDER,
	type Bounds,
	type Core,
	type Entity,
	type Params,
	type Vec,
	type World
} from './types';
import { mulberry32 } from './rand';

export const DT = 1 / 60;
const MAX_STEPS_PER_FRAME = 5; // 탭 복귀 등 큰 delta에서 스파이럴 방지

export function createWorld(seed: number, bounds: Bounds): World {
	return {
		entities: [],
		t: 0,
		bounds,
		camera: { x: bounds.w / 2, y: bounds.h / 2, zoom: 1, rot: 0 },
		rand: mulberry32(seed)
	};
}

/** 엔티티 기본값 — 점 하나짜리 엔티티가 곧 점이다. */
export function makeEntity(init: Partial<Entity> = {}): Entity {
	return {
		pos: { x: 0, y: 0 },
		vel: { x: 0, y: 0 },
		scale: { x: 1, y: 1 },
		rot: 0,
		points: [{ x: 0, y: 0 }],
		closed: false,
		sig: {},
		...init
	};
}

export interface Engine {
	readonly world: World;
	readonly stack: Core[];
	seed: number;
	/** coreId → 현재 파라미터 값. 뷰어 슬라이더가 직접 수정한다. */
	readonly values: Record<string, Params>;
	reset(seed?: number): void;
	/** 캔버스 리사이즈 대응 — 지면·랩어라운드 기준이 즉시 따라간다. */
	setBounds(b: Bounds): void;
	/** 실시간 delta(s)를 받아 고정 dt로 나눠 실행. 실행한 스텝 수를 돌려준다. */
	advance(realDt: number): number;
	/** 정확히 seconds만큼 고정 스텝을 몰아서 실행 (프레임 상한 없음).
	 *  같은 시드 + 같은 t = 항상 같은 그림 → 스크린샷·썸네일·아카이브 링크. */
	seek(seconds: number): void;
	/** 궤적 길이(고정 스텝 수). 0이면 기록하지 않는다. */
	trailLen: number;
	/** entities와 같은 인덱스의 위치 기록. 점을 선으로 보이게 하는 재료. */
	readonly trails: Vec[][];
	notation(): string;
}

/** 레벨 순으로 정렬 — 같은 레벨끼리는 등록 순서 유지 (안정 정렬). */
function sortByLevel(cores: Core[]): Core[] {
	return [...cores].sort(
		(a, b) => LEVEL_ORDER.indexOf(a.meta.level) - LEVEL_ORDER.indexOf(b.meta.level)
	);
}

function defaults(core: Core): Params {
	const p: Params = {};
	for (const d of core.params) p[d.key] = d.value;
	return p;
}

/** 표기법 문자열: `코어@레벨 + 코어@레벨 ×exa값` (PRD §5) */
function buildNotation(stack: Core[], values: Record<string, Params>): string {
	const base = stack.map((c) => c.meta.notation).join(' + ');
	let exa: number | undefined;
	for (const c of stack) {
		const v = values[c.meta.id]?.exa;
		if (typeof v === 'number') exa = v;
	}
	return exa === undefined ? base : `${base} ×exa${exa.toFixed(1)}`;
}

export function createEngine(cores: Core[], opts: { seed: number; bounds: Bounds }): Engine {
	const stack = sortByLevel(cores);
	const values: Record<string, Params> = {};
	for (const c of stack) values[c.meta.id] = defaults(c);

	let bounds: Bounds = { ...opts.bounds };
	let world = createWorld(opts.seed, bounds);
	let acc = 0;
	let trails: Vec[][] = [];

	/** 고정 스텝마다 호출 — 실시간 재생이든 seek이든 같은 궤적이 남는다. */
	function record(): void {
		if (engine.trailLen <= 0) return;
		if (trails.length !== world.entities.length) trails = world.entities.map(() => []);
		for (let i = 0; i < world.entities.length; i++) {
			const h = trails[i];
			const { x, y } = world.entities[i].pos;
			h.push({ x, y });
			if (h.length > engine.trailLen) h.shift();
		}
	}

	const engine: Engine = {
		get world() {
			return world;
		},
		stack,
		seed: opts.seed,
		values,
		trailLen: 0,
		get trails() {
			return trails;
		},
		reset(seed?: number) {
			if (seed !== undefined) engine.seed = seed;
			world = createWorld(engine.seed, bounds);
			acc = 0;
			trails = [];
			for (const c of stack) c.init?.(world, values[c.meta.id]);
		},
		setBounds(b: Bounds) {
			bounds = { ...b };
			world.bounds = bounds;
			// space 코어가 없으면 카메라는 화면 중심에 머문다 (변환 없음).
			world.camera.x = bounds.w / 2;
			world.camera.y = bounds.h / 2;
		},
		advance(realDt: number): number {
			acc += Math.min(realDt, MAX_STEPS_PER_FRAME * DT);
			let steps = 0;
			while (acc >= DT && steps < MAX_STEPS_PER_FRAME) {
				for (const c of stack) c.step(world, values[c.meta.id], DT);
				world.t += DT;
				record();
				acc -= DT;
				steps++;
			}
			return steps;
		},
		seek(seconds: number) {
			const n = Math.max(0, Math.round(seconds / DT));
			for (let i = 0; i < n; i++) {
				for (const c of stack) c.step(world, values[c.meta.id], DT);
				world.t += DT;
				record();
			}
			acc = 0;
		},
		notation: () => buildNotation(stack, values)
	};

	engine.reset(opts.seed);
	return engine;
}
