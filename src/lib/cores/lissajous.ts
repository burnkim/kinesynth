/**
 * Lissajous · 리사주 곡선
 *
 * 원리: 서로 수직인 두 단진동을 겹치면 궤적이 닫힌 곡선이 된다.
 *       주파수 비 a:b가 정수비면 궤도는 완전히 닫힌다 — 주기 루프의 원형.
 * 표기법: Lissajous(a:b, δ)@entity
 *
 * pos = ( A·sin(a·θ + δ), B·sin(b·θ) ),  θ = 2π·speed·t
 * 선언형 코어 — 적분하지 않고 시각 t에서 위치를 직접 계산한다.
 * vel은 해석적 미분으로 함께 써 준다 → 하위 deform 코어가 속도를 읽을 수 있다.
 *
 * 순수 TS. DOM import 금지.
 */

import type { Core, ParamDef, Params, StepCtx, World } from '../core/types';

/** 진폭 1.0 = 화면 짧은 변의 42% — 캔버스 크기와 무관하게 같은 그림이 나오도록. */
const radius = (w: World) => 0.42 * Math.min(w.bounds.w, w.bounds.h);

const params: ParamDef[] = [
	{ key: 'a', label: 'a · x 주파수', min: 1, max: 9, value: 3, step: 1 },
	{ key: 'b', label: 'b · y 주파수', min: 1, max: 9, value: 2, step: 1 },
	{ key: 'delta', label: 'δ · 위상차', min: 0, max: Math.PI, value: Math.PI / 2, step: 0.01 },
	{ key: 'A', label: 'A · x 진폭', min: 0, max: 1, value: 0.92, step: 0.01 },
	{ key: 'B', label: 'B · y 진폭', min: 0, max: 1, value: 0.92, step: 0.01 },
	{ key: 'speed', label: '속도 (회/초)', min: 0.02, max: 0.6, value: 0.16, step: 0.01 }
];

export const lissajous: Core = {
	meta: {
		id: 'lissajous',
		name: 'Lissajous',
		domain: 'math',
		level: 'entity',
		repeat: 'loop',
		principle: '수직인 두 흔들림을 겹치면 하나의 닫힌 궤도가 그려진다.',
		notation: 'Lissajous(a:b, δ)@entity',
		reads: [],
		writes: [
			{ channel: 'pos', mode: 'set' },
			{ channel: 'vel', mode: 'set' }
		]
	},

	params,

	init(w: World, _p: Params, ctx: StepCtx) {
		// 점 하나짜리 엔티티 = 점. 뷰어의 트레일 옵션이 이 점을 선으로 만든다.
		ctx.spawn({ pos: { x: w.bounds.w / 2, y: w.bounds.h / 2 } });
	},

	step(w: World, p: Params, _dt: number, ctx: StepCtx) {
		const R = radius(w);
		const cx = w.bounds.w / 2;
		const cy = w.bounds.h / 2;
		const om = 2 * Math.PI * p.speed; // θ = om·t

		for (const e of ctx.targets) {
			const tx = p.a * om * w.t + p.delta;
			const ty = p.b * om * w.t;
			e.pos.x = cx + p.A * R * Math.sin(tx);
			e.pos.y = cy + p.B * R * Math.sin(ty);
			// 해석적 미분: d/dt sin(kt+δ) = k·cos(kt+δ)
			e.vel.x = p.A * R * p.a * om * Math.cos(tx);
			e.vel.y = p.B * R * p.b * om * Math.cos(ty);
		}
	}
};
