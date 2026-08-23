/**
 * Kinesynth · 엔진 — 패치 스택 실행기
 *
 * 합성 = 코어 + **대상**. 어떤 코어를 세계의 어느 엔티티에 걸지가 패치다 (PRD §2).
 * v0에서는 대상이 늘 전체였고, 그래서 points를 쓰는 코어 둘을 겹칠 수 없었다.
 * 이제 `Bounce[ball] + Spring[tail←ball]`처럼 갈라 걸 수 있다.
 *
 * 실행 순서는 레벨 순 space → flock → entity → deform. 같은 레벨은 등록 순서.
 * 채널 공유로 모듈레이션이 일어난다: Bounce가 쓴 sig.impact를 Squash가 읽는다.
 *
 * 소유 규칙 (엔진이 검사하고 어기면 warnings에 남긴다):
 *   · points·closed — 한 대상당 **단독 소유**. 겹치면 라우팅으로 풀어야 한다.
 *   · 수치 채널 — set 하나 + add/mul 여럿. set이 둘이거나, 누적 뒤에 set이 오면 경고.
 *   · scale — 매 스텝 (1,1)로 초기화된다. deform은 그 위에 곱한다(mul) → 순서에 덜 민감.
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
	type Patch,
	type Selector,
	type StackItem,
	type StepCtx,
	type Vec,
	type World
} from './types';
import { mulberry32 } from './rand';

export const DT = 1 / 60;
const MAX_STEPS_PER_FRAME = 5; // 탭 복귀 등 큰 delta에서 스파이럴 방지
const ALL: Selector = '*';

export function createWorld(seed: number, bounds: Bounds): World {
	return {
		entities: [],
		t: 0,
		bounds,
		camera: { x: bounds.w / 2, y: bounds.h / 2, zoom: 1, rot: 0 },
		rev: 0,
		nextId: 0,
		rand: mulberry32(seed)
	};
}

/** 엔티티 기본값 — 점 하나짜리 엔티티가 곧 점이다. */
export function makeEntity(init: Partial<Entity> = {}): Entity {
	return {
		id: 0,
		tags: [],
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

/** 세계에 엔티티를 들인다. id를 매기고 라우팅 캐시에 변화를 알린다. */
export function addEntity(w: World, e: Entity): Entity {
	e.id = ++w.nextId;
	w.entities.push(e);
	w.rev++;
	return e;
}

/** 세계에서 엔티티를 지운다. */
export function removeEntity(w: World, e: Entity): void {
	const i = w.entities.indexOf(e);
	if (i < 0) return;
	w.entities.splice(i, 1);
	w.rev++;
}

/** 태그를 붙인다. 라우팅 대상이 바뀌므로 rev를 올린다. */
export function tagEntity(w: World, e: Entity, ...tags: string[]): void {
	for (const t of tags) if (!e.tags.includes(t)) e.tags.push(t);
	w.rev++;
}

const parseSelector = (sel: Selector): string[] =>
	sel
		.split(',')
		.map((t) => t.trim())
		.filter(Boolean);

const matches = (e: Entity, tags: string[]): boolean => tags.some((t) => e.tags.includes(t));

/** 두 셀렉터가 같은 엔티티를 가리킬 수 있는가 — 소유 충돌 검사에 쓴다. */
function selectorsOverlap(a: Selector, b: Selector): boolean {
	if (a === ALL || b === ALL) return true;
	const ta = parseSelector(a);
	return parseSelector(b).some((t) => ta.includes(t));
}

/** 'vel'과 'vel.y'는 같은 채널로 본다. 'camera.*'는 세계 채널이라 대상과 무관하게 겹친다. */
const channelsOverlap = (a: string, b: string): boolean =>
	a === b || a.startsWith(b + '.') || b.startsWith(a + '.');

const isWorldChannel = (c: string) => c.startsWith('camera.');
const isSoleOwner = (c: string) => c === 'points' || c === 'closed';

export interface Engine {
	readonly world: World;
	readonly stack: StackItem[];
	seed: number;
	/** 패치 key → 현재 파라미터 값. 뷰어 슬라이더가 직접 수정한다. */
	readonly values: Record<string, Params>;
	/** 소유 규칙 위반 목록. 비어 있어야 정상. */
	readonly warnings: string[];
	reset(seed?: number): void;
	setBounds(b: Bounds): void;
	advance(realDt: number): number;
	seek(seconds: number): void;
	trailLen: number;
	readonly trails: Vec[][];
	notation(): string;
}

/**
 * 입력을 스택 항목으로 정규화한다. 레벨 순 정렬(같은 레벨은 등록 순서 유지) +
 * 파라미터 key 부여 — 같은 코어가 두 번 이상 나오면 `id@대상`으로 갈라 준다.
 */
function normalize(input: (Core | Patch)[]): StackItem[] {
	const patches: Patch[] = input.map((x) => ('core' in x ? { ...x } : { core: x }));
	const count = new Map<string, number>();
	for (const p of patches) count.set(p.core.meta.id, (count.get(p.core.meta.id) ?? 0) + 1);

	return patches
		.map((p) => {
			const id = p.core.meta.id;
			const target = p.target ?? ALL;
			return {
				core: p.core,
				target,
				anchor: p.anchor,
				key: (count.get(id) ?? 1) > 1 ? `${id}@${target}` : id
			};
		})
		.sort((a, b) => LEVEL_ORDER.indexOf(a.core.meta.level) - LEVEL_ORDER.indexOf(b.core.meta.level));
}

function defaults(core: Core): Params {
	const p: Params = {};
	for (const d of core.params) p[d.key] = d.value;
	return p;
}

/**
 * 표기법 문자열: `코어@레벨[대상] + … ×exa값` (PRD §5)
 * exa를 가진 코어가 하나면 뒤에 한 번만 붙이고(PRD 예시 형태), 둘 이상이면 코어마다 붙인다.
 */
function buildNotation(stack: StackItem[], values: Record<string, Params>): string {
	const exas = stack.filter((p) => typeof values[p.key]?.exa === 'number');
	const perCore = exas.length > 1;

	const base = stack
		.map((p) => {
			const where = p.target === ALL && !p.anchor ? '' : `[${p.target}${p.anchor ? `←${p.anchor}` : ''}]`;
			const v = values[p.key]?.exa;
			const tail = perCore && typeof v === 'number' ? `×exa${v.toFixed(1)}` : '';
			return `${p.core.meta.notation}${where}${tail}`;
		})
		.join(' + ');

	if (perCore || exas.length === 0) return base;
	return `${base} ×exa${values[exas[0].key].exa.toFixed(1)}`;
}

/**
 * 소유 규칙 검사. 스택을 세울 때 한 번만 돈다 — 매 프레임 비용 0.
 * 고치라는 게 아니라 **무엇이 무엇을 덮어쓰는지 보이게** 하는 게 목적이다.
 */
function auditWrites(stack: StackItem[]): string[] {
	const out: string[] = [];
	for (let i = 0; i < stack.length; i++) {
		for (let j = i + 1; j < stack.length; j++) {
			const a = stack[i];
			const b = stack[j];
			const ta = a.target;
			const tb = b.target;
			for (const wa of a.core.meta.writes) {
				for (const wb of b.core.meta.writes) {
					if (!channelsOverlap(wa.channel, wb.channel)) continue;
					const worldScope = isWorldChannel(wa.channel);
					if (!worldScope && !selectorsOverlap(ta, tb)) continue;
					const where = worldScope ? '세계' : ta === tb ? `[${ta}]` : `[${ta}]∩[${tb}]`;
					const pair = `${a.core.meta.name} → ${b.core.meta.name}`;
					if (isSoleOwner(wa.channel) || isSoleOwner(wb.channel)) {
						out.push(
							`${wa.channel}은 단독 소유인데 ${pair}가 같은 대상 ${where}에 쓴다. 라우팅으로 나눠 걸어야 한다.`
						);
					} else if (wa.mode === 'set' && wb.mode === 'set') {
						out.push(`${pair}가 ${wa.channel}에 둘 다 set한다 ${where} — 뒤엣것만 남는다.`);
					} else if (wa.mode !== 'set' && wb.mode === 'set') {
						out.push(
							`${b.core.meta.name}의 ${wb.channel} set이 ${a.core.meta.name}의 ${wa.mode}를 지운다 ${where}.`
						);
					}
				}
			}
		}
	}
	return out;
}

export function createEngine(
	input: (Core | Patch)[],
	opts: { seed: number; bounds: Bounds }
): Engine {
	const stack = normalize(input);
	const values: Record<string, Params> = {};
	for (const p of stack) values[p.key] = defaults(p.core);

	const warnings = auditWrites(stack);
	for (const m of warnings) console.warn(`[kinesynth] ${m}`);

	let bounds: Bounds = { ...opts.bounds };
	let world = createWorld(opts.seed, bounds);
	let acc = 0;
	let trails: Vec[][] = [];

	// 라우팅 캐시: 패치마다 대상·앵커 목록을 들고 있다가 rev가 바뀔 때만 다시 고른다.
	// ctx 객체도 한 번만 만들고 필드만 갈아 끼운다 — 매 스텝 할당 0.
	const routes = stack.map(() => ({ list: [] as Entity[], rev: -1 }));
	const anchorRoutes = stack.map(() => ({ list: [] as Entity[], rev: -1 }));

	/** 셀렉터에 걸린 엔티티 목록. rev가 그대로면 지난 결과를 그대로 쓴다. */
	function resolve(cache: { list: Entity[]; rev: number }, sel: Selector): Entity[] {
		if (cache.rev !== world.rev) {
			const tags = parseSelector(sel);
			cache.list = world.entities.filter((e) => matches(e, tags));
			cache.rev = world.rev;
		}
		return cache.list;
	}
	const ctxs: StepCtx[] = stack.map((p) => {
		const sel = p.target;
		const tags = parseSelector(sel);
		const ctx: StepCtx = {
			targets: [],
			anchor: undefined,
			anchors: [],
			target: sel,
			spawn(init) {
				const e = addEntity(world, makeEntity(init));
				if (sel !== ALL) tagEntity(world, e, ...tags);
				if (ctx.targets !== world.entities) ctx.targets.push(e);
				return e;
			},
			despawn(e) {
				removeEntity(world, e);
				if (ctx.targets !== world.entities) {
					const i = ctx.targets.indexOf(e);
					if (i >= 0) ctx.targets.splice(i, 1);
				}
			}
		};
		return ctx;
	});

	function ctxOf(i: number): StepCtx {
		const p = stack[i];
		const sel = p.target;
		const ctx = ctxs[i];
		ctx.targets = sel === ALL ? world.entities : resolve(routes[i], sel);
		if (p.anchor) {
			// 앵커도 대상과 같은 캐시 규칙 — 매 스텝 전체 스캔하지 않는다
			ctx.anchors = p.anchor === ALL ? world.entities : resolve(anchorRoutes[i], p.anchor);
			ctx.anchor = ctx.anchors[0];
		}
		return ctx;
	}

	/** scale은 매 스텝 초기화된다 — deform 코어는 그 위에 곱한다. */
	function resetScale(): void {
		for (const e of world.entities) {
			e.scale.x = 1;
			e.scale.y = 1;
		}
	}

	function runStep(dt: number): void {
		resetScale();
		for (let i = 0; i < stack.length; i++) {
			const p = stack[i];
			p.core.step(world, values[p.key], dt, ctxOf(i));
		}
		world.t += dt;
		record();
	}

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
		warnings,
		reset(seed?: number) {
			if (seed !== undefined) engine.seed = seed;
			world = createWorld(engine.seed, bounds);
			acc = 0;
			trails = [];
			for (const r of routes) r.rev = -1;
			for (const r of anchorRoutes) r.rev = -1;
			// 코어는 ctx.spawn으로 엔티티를 들인다 — 대상 태그가 자동으로 붙는다.
			for (let i = 0; i < stack.length; i++) {
				const p = stack[i];
				p.core.init?.(world, values[p.key], ctxOf(i));
			}
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
				runStep(DT);
				acc -= DT;
				steps++;
			}
			return steps;
		},
		seek(seconds: number) {
			const n = Math.max(0, Math.round(seconds / DT));
			for (let i = 0; i < n; i++) runStep(DT);
			acc = 0;
		},
		trailLen: 0,
		get trails() {
			return trails;
		},
		notation: () => buildNotation(stack, values)
	};

	engine.reset(opts.seed);
	return engine;
}
