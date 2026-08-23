/**
 * Bounce · 튕김
 *
 * 원리: 등가속 낙하(중력)와 반발계수 e의 충돌. 충돌마다 속도의 e배만 되돌아오므로
 *       튕김 높이는 e²배씩 줄어든다 — 사건이 점점 잦아지며 잦아드는 반복(event).
 * 표기법: Bounce(g, e)@entity
 *
 * 접지 순간 충격량 |Δv|를 sig.impact에 실어 보낸다 → Squash가 이 신호를 읽는다.
 * (신스로 치면 트리거 → 엔벨로프. 신호의 감쇠는 쓴 쪽인 Bounce가 책임진다.)
 *
 * 순수 TS. DOM import 금지.
 */

import type { Core, ParamDef, Params, StepCtx, Vec, World } from '../core/types';

const GROUND_RATIO = 0.86; // 지면 높이 (화면 비율)
const IMPACT_TAU = 0.085; // 충격 신호 감쇠 시상수 (s)
const REST_SPEED = 40; // 이보다 느리면 정지로 간주 — 무한 미세 튕김 방지

/** 뷰어가 지면을 그릴 수 있도록 공개한다. */
export const groundY = (w: World): number => w.bounds.h * GROUND_RATIO;

/**
 * n각형 폐곡선 — v0의 '면'. 12각이면 원으로 보이면서 정점이 보인다.
 * 로컬 원점을 **발밑**(도형의 아랫변)에 둔다. 그래서 scale.y를 줄이면 위에서 눌리고
 * 접지면은 그대로 있는다 — 스쿼시가 공중에 뜨지 않는다. pos = 접지점.
 */
function polygon(n: number, r: number): Vec[] {
	const pts: Vec[] = [];
	for (let i = 0; i < n; i++) {
		const a = (i / n) * Math.PI * 2 - Math.PI / 2;
		pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r - r });
	}
	return pts;
}

const params: ParamDef[] = [
	{ key: 'g', label: 'g · 중력', min: 0, max: 4000, value: 2000, step: 10 },
	{ key: 'e', label: 'e · 반발계수', min: 0, max: 1, value: 0.74, step: 0.01 },
	{ key: 'drift', label: '좌우 드리프트 속도', min: 0, max: 400, value: 130, step: 5 },
	{ key: 'r', label: 'r · 반지름', min: 10, max: 120, value: 46, step: 1 },
	{ key: 'h0', label: '시작 높이', min: 0, max: 0.7, value: 0.08, step: 0.01 }
];

export const bounce: Core = {
	meta: {
		id: 'bounce',
		name: 'Bounce',
		domain: 'physics',
		level: 'entity',
		repeat: 'event',
		principle: '떨어진 만큼 튀어오르되, 부딪칠 때마다 조금씩 잃는다.',
		notation: 'Bounce(g, e)@entity',
		reads: [],
		writes: [
			{ channel: 'pos', mode: 'set' },
			{ channel: 'vel', mode: 'set' },
			{ channel: 'sig.impact', mode: 'set' },
			// r 슬라이더를 실시간 반영하느라 매 스텝 다시 그린다 → points의 단독 소유자다
			{ channel: 'points', mode: 'set' },
			{ channel: 'closed', mode: 'set' }
		]
	},

	params,

	init(w: World, p: Params, ctx: StepCtx) {
		ctx.spawn({
			pos: { x: w.bounds.w * 0.3, y: w.bounds.h * p.h0 },
			vel: { x: p.drift, y: 0 },
			points: polygon(12, p.r),
			closed: true, // 닫힘 = 면
			sig: { impact: 0 } // 이 채널의 소유자는 Bounce다
		});
	},

	step(w: World, p: Params, dt: number, ctx: StepCtx) {
		const gy = groundY(w);

		for (const e of ctx.targets) {
			e.points = polygon(12, p.r); // r 슬라이더를 실시간 반영
			e.sig.impact = (e.sig.impact ?? 0) * Math.exp(-dt / IMPACT_TAU); // 소유한 신호를 감쇠

			// 드리프트는 속도 그 자체 — 진행 방향(부호)만 벽에서 뒤집힌다. 슬라이더가 즉시 반영된다.
			e.vel.x = (e.vel.x < 0 ? -1 : 1) * p.drift;
			e.vel.y += p.g * dt;
			e.pos.x += e.vel.x * dt;
			e.pos.y += e.vel.y * dt;

			// pos가 곧 접지점 — 스쿼시로 납작해져도 판정이 흔들리지 않는다
			if (e.pos.y >= gy && e.vel.y > 0) {
				e.pos.y = gy;
				e.sig.impact = Math.abs(e.vel.y) * (1 + p.e); // Δv = (1+e)·|v|
				e.vel.y = e.vel.y * -p.e;
				if (Math.abs(e.vel.y) < REST_SPEED) e.vel.y = 0;
			}

			// 좌우 벽 — 드리프트가 화면을 벗어나지 않게
			const lo = p.r;
			const hi = w.bounds.w - p.r;
			if (e.pos.x < lo) {
				e.pos.x = lo;
				e.vel.x = p.drift;
			} else if (e.pos.x > hi) {
				e.pos.x = hi;
				e.vel.x = -p.drift;
			}
		}
	}
};
