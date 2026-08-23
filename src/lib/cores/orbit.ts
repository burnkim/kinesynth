/**
 * Orbit · 자전 + 공전 중첩
 *
 * 원리: 한 몸이 동시에 두 주기를 산다 — 제자리 돎(자전)과 큰 원 돎(공전).
 *       겹치는 방식이 모든 걸 바꾼다. 자전이 공전과 **정확히 1회** 맞으면 같은 면이 늘
 *       안쪽을 향한다(조석 고정, 달). 어긋나면 태양일과 항성일이 갈라진다.
 *       지구의 하루가 자전 주기보다 4분 긴 이유가 이 중첩이다.
 * 표기법: Orbit(spin:rev)@entity
 *
 * θ   = 2π·(rev·t + phase)              공전각
 * pos = 중심 + (cos θ, sin θ)·radius     궤도 위 위치
 * rot = 2π·(spin·rev·t + phase)          자전. spin은 **공전 1회당 회전수**
 *
 * 앵커를 주면 그 몸을 중심으로 돈다 — 행성을 도는 달. 세계 좌표에서 본 달의 궤적은
 * 원 위의 원, 곧 중첩 그 자체다. 궤도는 균일 각속도의 원이다:
 * 케플러의 면적속도(타원·근일점 가속)는 별도 코어의 몫이다.
 *
 * 순수 TS. DOM import 금지.
 */

import type { Core, ParamDef, Params, StepCtx, Vec, World } from '../core/types';

const TAU = Math.PI * 2;
const SIDES = 18;

/** 한쪽으로 뾰족한 몸 — 어느 면이 어디를 향하는지 보여야 자전이 보인다. */
function body(r: number): Vec[] {
	const pts: Vec[] = [];
	for (let i = 0; i < SIDES; i++) {
		const a = (i / SIDES) * TAU;
		const c = Math.cos(a);
		const nose = c > 0 ? c * c * c : 0; // 로컬 +x 쪽만 늘린다
		pts.push({ x: Math.cos(a) * r * (1 + 0.8 * nose), y: Math.sin(a) * r * (1 + 0.8 * nose) });
	}
	return pts;
}

const params: ParamDef[] = [
	{ key: 'radius', label: '궤도 반지름', min: 0, max: 1, value: 0.5, step: 0.01 },
	{ key: 'rev', label: '공전 (회/초)', min: 0, max: 0.5, value: 0.06, step: 0.005 },
	{ key: 'spin', label: '자전 (회/공전) · 1 = 조석 고정', min: -6, max: 12, value: 1, step: 0.25 },
	{ key: 'phase', label: '시작 위상', min: 0, max: 1, value: 0, step: 0.01 },
	{ key: 'r', label: '몸 반지름', min: 3, max: 60, value: 20, step: 1 }
];

export const orbit: Core = {
	meta: {
		id: 'orbit',
		name: 'Orbit',
		nameKo: '자전 + 공전',
		domain: 'earth',
		level: 'entity',
		repeat: 'loop',
		principle: '한 몸이 두 주기를 산다 — 제자리 돎과 큰 원 돎이 겹친다.',
		rule: 'θ = 2π(rev·t + phase) · pos = 중심 + (cos θ, sin θ)·radius · rot = 2π(spin·rev·t + phase) · spin은 공전 1회당 자전수: 1이면 조석 고정(같은 면이 늘 중심을 향함) · 앵커를 주면 그 몸이 중심 → 세계에서 본 궤적은 원 위의 원 · 균일 각속도(케플러 면적속도는 별도 코어)',
		notation: 'Orbit(spin:rev)@entity',
		refs: [
			'조석 고정 — 달의 자전 주기와 공전 주기가 27.32일로 같다',
			'태양일(24h)과 항성일(23h 56m 4s)의 차이 = 자전과 공전의 중첩',
			'주전원(epicycle) — 원 위의 원, 프톨레마이오스 2세기'
		],
		status: 'done',
		createdAt: '2026-08-23',
		reads: [],
		writes: [
			{ channel: 'pos', mode: 'set' },
			{ channel: 'vel', mode: 'set' },
			{ channel: 'rot', mode: 'set' },
			{ channel: 'points', mode: 'set' },
			{ channel: 'closed', mode: 'set' }
		],
		anchor: '공전의 중심이 될 엔티티. 없으면 화면 중심을 돈다.'
	},

	params,

	init(w: World, _p: Params, ctx: StepCtx) {
		if (ctx.targets.length === 0) ctx.spawn({ closed: true });
	},

	step(w: World, p: Params, _dt: number, ctx: StepCtx) {
		const R = 0.42 * Math.min(w.bounds.w, w.bounds.h);
		const a0 = ctx.anchor;
		const cx = a0 ? a0.pos.x : w.bounds.w / 2;
		const cy = a0 ? a0.pos.y : w.bounds.h / 2;
		const rad = p.radius * R;

		const th = TAU * (p.rev * w.t + p.phase);
		const cs = Math.cos(th);
		const sn = Math.sin(th);
		const om = TAU * p.rev; // dθ/dt

		for (const e of ctx.targets) {
			e.pos.x = cx + cs * rad;
			e.pos.y = cy + sn * rad;
			// 해석적 미분 + 중심이 움직이면 그 속도까지 얹는다 (달은 지구를 따라간다)
			e.vel.x = -sn * rad * om + (a0 ? a0.vel.x : 0);
			e.vel.y = cs * rad * om + (a0 ? a0.vel.y : 0);
			e.rot = TAU * (p.spin * p.rev * w.t + p.phase);
			e.points = body(p.r);
			e.closed = true;
		}
	}
};
