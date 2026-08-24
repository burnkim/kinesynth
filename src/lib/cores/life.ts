/**
 * Life · 라이프 게임 (Conway, 1970)
 *
 * 원리: 칸마다 규칙은 넷뿐이다 — 이웃이 둘이나 셋이면 살고, 셋이면 태어나고, 아니면 죽는다.
 *       그것만으로 정지물·진동자·활공체가 생긴다. **단순한 규칙이 복잡한 것을 만든다**의
 *       가장 순수한 표본. 보이드가 연속 공간의 창발이라면 이쪽은 격자의 창발이다.
 * 표기법: Life(B3/S23)@flock
 *
 * 이웃 탐색에 **탐색이 없다.** 칸이 곧 색인이라 8이웃은 O(1) 조회다 —
 * `core/grid.ts`는 "연속 좌표에서 반경 r 안에 누가 있나"를 답하는 물건이고,
 * 라이프가 묻는 건 "격자 자리 (i,j)에 무엇이 있나"다. 질문이 다르면 색인도 다르다.
 *
 * **논리는 이산, 움직임은 연속이다.** 세대는 `period`마다 한 번 넘어가지만
 * `sig.age`(태어난 뒤 0→1)와 `sig.fade`(사라지는 중 0→1)는 매 프레임 흐른다.
 * 죽은 칸을 즉시 지우지 않고 `fade`가 다 차야 지운다 — 그래야 수축을 그릴 프레임이 있다.
 * 그 신호를 deform 코어(Pop)가 읽어 낙차로 바꾼다. **이산 시스템에 낙차가 들어오는 문이다.**
 *
 * 공간은 토러스 — 활공체가 가장자리에서 사라지지 않는다.
 *
 * 순수 TS. DOM import 금지.
 */

import { wrapCoord } from '../core/space';
import type { Core, ParamDef, Params, StepCtx, Vec, World } from '../core/types';

interface Lattice {
	acc: number; // 세대 어큐뮬레이터
	cols: number;
	rows: number;
	occ: Uint8Array; // 살아 있는 칸 (사라지는 중인 칸은 뺀다)
	stamp: Int32Array; // 탄생 후보 중복 방지 — 세대 번호를 찍는다 (비우지 않아도 된다)
	gen: number;
}

/** 세계마다 하나. 리셋되면 세계가 새로 생기므로 같이 사라진다. */
const lattices = new WeakMap<World, Lattice>();

/** 칸 하나의 네모. scale이 먹으려면 점이 아니라 면이어야 한다. */
function square(r: number): Vec[] {
	return [
		{ x: -r, y: -r },
		{ x: r, y: -r },
		{ x: r, y: r },
		{ x: -r, y: r }
	];
}

const params: ParamDef[] = [
	{ key: 'cell', label: '격자 간격', min: 8, max: 48, value: 20, step: 1 },
	{ key: 'period', label: '세대 주기 (s)', min: 0.05, max: 1.5, value: 0.3, step: 0.01 },
	{ key: 'density', label: '초기 밀도', min: 0.05, max: 0.6, value: 0.33, step: 0.01 },
	{ key: 'grow', label: '태어남 트윈 (s)', min: 0.02, max: 1, value: 0.2, step: 0.01 },
	{ key: 'fade', label: '사라짐 트윈 (s)', min: 0.02, max: 1, value: 0.26, step: 0.01 }
];

export const life: Core = {
	meta: {
		id: 'life',
		name: 'Life',
		nameKo: '라이프 게임',
		domain: 'math',
		level: 'flock',
		repeat: 'steady',
		principle: '이웃이 둘이나 셋이면 살고, 셋이면 태어난다 — 그것뿐인데 활공체가 생긴다.',
		rule: 'B3/S23 · 이웃 3이면 탄생, 이웃 2~3이면 생존, 나머지는 사망 · 칸이 곧 색인이라 8이웃은 O(1) 조회 · 세대는 period마다, 트윈(sig.age·sig.fade)은 매 프레임 · 죽은 칸은 fade가 다 차야 지운다 · 공간은 토러스',
		notation: 'Life(B3/S23)@flock',
		refs: [
			'Martin Gardner, Mathematical Games, Scientific American 1970 — Conway의 Life 소개',
			'Conway, Berlekamp & Guy, Winning Ways for Your Mathematical Plays, 1982 — 활공체·정지물·진동자'
		],
		status: 'done',
		createdAt: '2026-08-24',
		reads: [],
		writes: [
			{ channel: 'pos', mode: 'set' },
			{ channel: 'points', mode: 'set' },
			{ channel: 'closed', mode: 'set' },
			{ channel: 'sig.age', mode: 'set' },
			{ channel: 'sig.fade', mode: 'set' }
		]
	},

	params,

	init(w: World, p: Params, ctx: StepCtx) {
		const L = fit(w, p);
		lattices.set(w, L);
		const r = halfCell(w, L);
		for (let i = 0; i < L.cols * L.rows; i++) {
			if (w.rand() < p.density) born(w, ctx, L, i, r);
		}
	},

	step(w: World, p: Params, dt: number, ctx: StepCtx) {
		let L = lattices.get(w);
		const want = fit(w, p);
		if (!L || L.cols !== want.cols || L.rows !== want.rows) {
			// 격자가 달라지면 옛 자리는 뜻을 잃는다 — 판을 새로 깐다
			for (const e of [...ctx.targets]) ctx.despawn(e);
			L = want;
			lattices.set(w, L);
			const h = halfCell(w, L);
			for (let i = 0; i < L.cols * L.rows; i++) if (w.rand() < p.density) born(w, ctx, L, i, h);
			return;
		}

		// ── 매 프레임: 트윈. 논리는 이산이어도 움직임은 연속이다.
		for (const e of [...ctx.targets]) {
			if (e.sig.fade > 0) {
				e.sig.fade += dt / p.fade;
				if (e.sig.fade >= 1) ctx.despawn(e); // 수축을 다 그린 뒤에야 지운다
			} else if (e.sig.age < 1) {
				e.sig.age = Math.min(1, e.sig.age + dt / p.grow);
			}
		}

		// ── period마다: 세대
		L.acc += dt;
		if (L.acc < p.period) return;
		// 한 프레임에 한 세대만 넘긴다 — 주기가 프레임보다 짧아도 보여 줄 수 없는 세대는 버린다.
		// (안 버리면 어큐뮬레이터가 한없이 자란다.)
		L.acc = Math.min(L.acc - p.period, p.period);
		tick(w, p, ctx, L);
	}
};

/** 지금 파라미터에 맞는 격자 얼개. */
function fit(w: World, p: Params): Lattice {
	const cell = Math.max(4, Math.round(p.cell));
	const cols = Math.max(3, Math.floor(w.bounds.w / cell));
	const rows = Math.max(3, Math.floor(w.bounds.h / cell));
	return {
		acc: 0,
		cols,
		rows,
		occ: new Uint8Array(cols * rows),
		stamp: new Int32Array(cols * rows),
		gen: 0
	};
}

const halfCell = (w: World, L: Lattice) =>
	Math.min(w.bounds.w / L.cols, w.bounds.h / L.rows) * 0.36;

/** 칸 i에 새 세포. 태어남 트윈이 0에서 시작한다. */
function born(w: World, ctx: StepCtx, L: Lattice, i: number, r: number): void {
	const cw = w.bounds.w / L.cols;
	const ch = w.bounds.h / L.rows;
	ctx.spawn({
		pos: { x: ((i % L.cols) + 0.5) * cw, y: (Math.floor(i / L.cols) + 0.5) * ch },
		points: square(r),
		closed: true,
		sig: { age: 0, fade: 0 }
	});
}

/** 한 세대. 생존 판정과 탄생 판정을 **같은 점유 상태**에서 함께 읽는다. */
function tick(w: World, p: Params, ctx: StepCtx, L: Lattice): void {
	const { cols, rows, occ, stamp } = L;
	const cw = w.bounds.w / cols;
	const ch = w.bounds.h / rows;
	const site = (e: { pos: { x: number; y: number } }) =>
		Math.min(rows - 1, Math.floor(wrapCoord(e.pos.y, w.bounds.h) / ch)) * cols +
		Math.min(cols - 1, Math.floor(wrapCoord(e.pos.x, w.bounds.w) / cw));

	occ.fill(0);
	const alive = ctx.targets.filter((e) => e.sig.fade === 0);
	for (const e of alive) occ[site(e)] = 1;

	// 이웃 수 — 토러스라 가장자리도 이웃이 여덟이다
	const count = (i: number): number => {
		const cx = i % cols;
		const cy = (i / cols) | 0;
		let n = 0;
		for (let oy = -1; oy <= 1; oy++) {
			const gy = (((cy + oy) % rows) + rows) % rows;
			const row = gy * cols;
			for (let ox = -1; ox <= 1; ox++) {
				if (ox === 0 && oy === 0) continue;
				n += occ[row + ((((cx + ox) % cols) + cols) % cols)];
			}
		}
		return n;
	};

	// 생존: 이웃 2~3이 아니면 사라지기 시작한다 (지우지는 않는다)
	for (const e of alive) {
		const n = count(site(e));
		if (n !== 2 && n !== 3) e.sig.fade = 1e-6;
	}

	// 탄생: 살아 있는 칸의 **빈 이웃 자리**만 후보다. 세대 도장으로 중복을 막는다.
	L.gen++;
	const r = halfCell(w, L);
	const babies: number[] = [];
	for (const e of alive) {
		const i = site(e);
		const cx = i % cols;
		const cy = (i / cols) | 0;
		for (let oy = -1; oy <= 1; oy++) {
			const gy = (((cy + oy) % rows) + rows) % rows;
			const row = gy * cols;
			for (let ox = -1; ox <= 1; ox++) {
				if (ox === 0 && oy === 0) continue;
				const j = row + ((((cx + ox) % cols) + cols) % cols);
				if (occ[j] || stamp[j] === L.gen) continue;
				stamp[j] = L.gen;
				if (count(j) === 3) babies.push(j);
			}
		}
	}
	for (const j of babies) born(w, ctx, L, j, r);
}
