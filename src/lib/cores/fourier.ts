/**
 * Fourier · 푸리에 에피사이클
 *
 * 원리: 어떤 닫힌 곡선이든 **회전하는 원의 합**으로 쓸 수 있다.
 *       원 하나는 한 주파수, 원의 반지름은 그 주파수의 세기다. 원 끝에 원을 매달고
 *       각자 제 속도로 돌리면 펜 끝이 원래 곡선을 다시 그린다 — 수식이 형태가 되는 순간.
 * 표기법: Fourier(N항)@entity
 *
 * z(t) = Σ c_k·e^(i·2πk·t), c_k = (1/N)Σ p_n·e^(−i·2πkn/N)  (이산 푸리에 변환)
 * 항을 크기 순으로 쌓아 부분합을 그대로 로컬 지오메트리(points)로 쓴다 —
 * 그래서 화면에 보이는 선이 곧 에피사이클 팔이고, 그 끝(pos)이 트레일로 곡선을 그린다.
 * **항 수를 줄이면 곡선이 뭉개진다** — 얼마나 많은 주파수가 형태를 만드는지가 눈에 보인다.
 *
 * 순수 TS. DOM import 금지.
 */

import type { Core, ParamDef, Params, StepCtx, Vec, World } from '../core/types';

const TAU = Math.PI * 2;
const SAMPLES = 256; // 경로를 이만큼 균등 샘플링해 DFT를 돌린다

/** 프리셋 도형 — 닫힌 폴리라인, 대략 [-1, 1] 범위. */
const SHAPES: Vec[][] = [
	// 0 · 정사각형 — 모서리를 만들려면 높은 주파수가 필요하다
	[
		{ x: -0.8, y: -0.8 },
		{ x: 0.8, y: -0.8 },
		{ x: 0.8, y: 0.8 },
		{ x: -0.8, y: 0.8 }
	],
	// 1 · 오각별
	Array.from({ length: 10 }, (_, i) => {
		const r = i % 2 === 0 ? 0.95 : 0.38;
		const a = (i / 10) * TAU - Math.PI / 2;
		return { x: Math.cos(a) * r, y: Math.sin(a) * r };
	}),
	// 2 · 글자 K — 임의 지오메트리도 같은 규칙으로 그려진다 (PRD §2 출력)
	[
		{ x: -0.62, y: -0.95 },
		{ x: -0.26, y: -0.95 },
		{ x: -0.26, y: -0.16 },
		{ x: 0.34, y: -0.95 },
		{ x: 0.78, y: -0.95 },
		{ x: 0.12, y: -0.06 },
		{ x: 0.82, y: 0.95 },
		{ x: 0.36, y: 0.95 },
		{ x: -0.12, y: 0.24 },
		{ x: -0.26, y: 0.42 },
		{ x: -0.26, y: 0.95 },
		{ x: -0.62, y: 0.95 }
	]
];

interface Term {
	k: number;
	re: number;
	im: number;
}

// 계수는 preset·항수에만 달렸다 — 바뀔 때만 다시 푼다.
let cache: { preset: number; m: number; terms: Term[] } | null = null;

/** 닫힌 폴리라인을 호 길이로 균등 샘플링한다. */
function resample(pts: Vec[], n: number): Vec[] {
	const seg: number[] = [];
	let total = 0;
	for (let i = 0; i < pts.length; i++) {
		const a = pts[i];
		const b = pts[(i + 1) % pts.length];
		const d = Math.hypot(b.x - a.x, b.y - a.y);
		seg.push(d);
		total += d;
	}
	const out: Vec[] = [];
	let i = 0;
	let walked = 0;
	for (let s = 0; s < n; s++) {
		const want = (s / n) * total;
		while (walked + seg[i] < want && i < pts.length - 1) {
			walked += seg[i];
			i++;
		}
		const a = pts[i];
		const b = pts[(i + 1) % pts.length];
		const u = seg[i] > 0 ? (want - walked) / seg[i] : 0;
		out.push({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u });
	}
	return out;
}

/** 이산 푸리에 변환 → 주파수 −m..m의 복소 계수. 큰 것부터 쌓는다. */
function solve(preset: number, m: number): Term[] {
	if (cache && cache.preset === preset && cache.m === m) return cache.terms;
	const pts = resample(SHAPES[preset] ?? SHAPES[0], SAMPLES);
	const terms: Term[] = [];
	for (let k = -m; k <= m; k++) {
		let re = 0;
		let im = 0;
		for (let n = 0; n < SAMPLES; n++) {
			const a = (-TAU * k * n) / SAMPLES;
			const c = Math.cos(a);
			const s = Math.sin(a);
			re += pts[n].x * c - pts[n].y * s;
			im += pts[n].x * s + pts[n].y * c;
		}
		terms.push({ k, re: re / SAMPLES, im: im / SAMPLES });
	}
	terms.sort((a, b) => Math.hypot(b.re, b.im) - Math.hypot(a.re, a.im));
	cache = { preset, m, terms };
	return terms;
}

const params: ParamDef[] = [
	{ key: 'preset', label: '도형 (0 사각 · 1 별 · 2 K)', min: 0, max: 2, value: 2, step: 1 },
	{ key: 'terms', label: '항 수 N', min: 1, max: 40, value: 16, step: 1 },
	{ key: 'speed', label: '속도 (회/초)', min: 0.02, max: 0.5, value: 0.07, step: 0.01 },
	{ key: 'size', label: '크기', min: 0.2, max: 1.2, value: 0.8, step: 0.01 }
];

export const fourier: Core = {
	meta: {
		id: 'fourier',
		name: 'Fourier Epicycles',
		nameKo: '푸리에 에피사이클',
		domain: 'math',
		level: 'entity',
		repeat: 'loop',
		principle: '원 위에 원을 매달아 돌리면 어떤 곡선이든 다시 그려진다.',
		rule: 'z(t) = Σ c_k·e^(i2πkt), c_k = (1/N)Σ p_n·e^(−i2πkn/N) · 항을 크기 순으로 쌓고 부분합을 points로 그린다 · 항 수를 줄이면 높은 주파수가 빠져 모서리부터 뭉개진다',
		notation: 'Fourier(N항)@entity',
		refs: [
			'Joseph Fourier, Théorie analytique de la chaleur, 1822',
			'주전원(epicycle) — 프톨레마이오스의 행성 운동 모형, 2세기'
		],
		status: 'done',
		createdAt: '2026-08-23',
		reads: [],
		writes: [
			{ channel: 'pos', mode: 'set' },
			{ channel: 'points', mode: 'set' },
			{ channel: 'closed', mode: 'set' }
		]
	},

	params,

	init(w: World, _p: Params, ctx: StepCtx) {
		ctx.spawn({ pos: { x: w.bounds.w / 2, y: w.bounds.h / 2 } });
	},

	step(w: World, p: Params, _dt: number, ctx: StepCtx) {
		const m = Math.max(1, Math.round(p.terms));
		const terms = solve(Math.round(p.preset), m);
		const R = 0.42 * Math.min(w.bounds.w, w.bounds.h) * p.size;
		const cx = w.bounds.w / 2;
		const cy = w.bounds.h / 2;
		const th = TAU * p.speed * w.t;

		// 부분합을 모은다: arm[0] = 원점, arm[마지막] = 펜 끝
		const arm: Vec[] = [{ x: 0, y: 0 }];
		let sx = 0;
		let sy = 0;
		for (const t of terms) {
			const a = t.k * th;
			const c = Math.cos(a);
			const s = Math.sin(a);
			sx += t.re * c - t.im * s; // 복소수 곱 c_k · e^(i k θ)
			sy += t.re * s + t.im * c;
			arm.push({ x: sx, y: sy });
		}

		for (const e of ctx.targets) {
			e.pos.x = cx + sx * R;
			e.pos.y = cy + sy * R;
			e.closed = false;
			// 팔은 펜 끝을 원점으로 하는 로컬 좌표 — 선 하나로 에피사이클 사슬이 보인다
			e.points = arm.map((q) => ({ x: (q.x - sx) * R, y: (q.y - sy) * R }));
		}
	}
};
