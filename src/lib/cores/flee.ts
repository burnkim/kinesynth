/**
 * Flee · 도피
 *
 * 원리: 위협이 반경 안에 들어오면 반대 방향으로 밀린다. 가까울수록 세게.
 *       무리 규칙(모이려는 힘)과 겨루면서 **구멍이 열렸다가 다시 메워진다** —
 *       사건이 지나가면 원래대로 돌아오는 서사 단위의 반복(event).
 *       찌르레기 군무에서 매가 지나갈 때 실제로 일어나는 일이다.
 * 표기법: Flee(거리→회피)@flock
 *
 * d = |pos − anchor|,  d < radius 일 때
 *   vel += (pos − anchor)/d · force · (1 − d/radius)²  (add)
 *
 * **vel을 add한다** — Boids(역시 add) 위에 얹혀서 도피와 응집이 같은 속도 위에서 겨룬다.
 * 속도 상한은 Boids가 쥐고 있으므로 도피는 방향을 바꿀 뿐 순항 속도를 넘지 않는다.
 *
 * 앵커(위협)의 위치는 entity 레벨에서 정해지는데 이 코어는 flock 레벨에서 먼저 돈다 —
 * 즉 한 프레임 전의 위치를 본다. 1/60초라 눈에 보이지 않는다.
 *
 * 순수 TS. DOM import 금지.
 */

import { wrapDelta } from '../core/space';
import type { Core, ParamDef, Params, StepCtx, World } from '../core/types';

const params: ParamDef[] = [
	{ key: 'radius', label: '반응 반경', min: 20, max: 500, value: 190, step: 5 },
	{ key: 'force', label: '도피 세기', min: 0, max: 4000, value: 1700, step: 50 },
	{ key: 'sharp', label: '감쇠 날카로움', min: 1, max: 4, value: 2, step: 0.5 }
];

export const flee: Core = {
	meta: {
		id: 'flee',
		name: 'Flee',
		nameKo: '도피',
		domain: 'bio',
		level: 'flock',
		repeat: 'event',
		principle: '위협이 다가오면 흩어진다 — 구멍이 열렸다가 다시 메워진다.',
		rule: 'd = 토러스최단거리(pos, anchor) · d < radius이면 vel += (pos−anchor)/d · force · (1−d/radius)^sharp (add) · 반경 밖은 0 · 속도 상한은 Boids가 쥔다 · 앵커는 한 프레임 전 위치(flock이 entity보다 먼저 돈다)',
		notation: 'Flee(거리→회피)@flock',
		refs: [
			'Craig Reynolds, Steering Behaviors for Autonomous Characters, GDC 1999 — flee / evade',
			'Procaccini et al., Propagating waves of avoidance in starling flocks under predation, Animal Behaviour 2011'
		],
		status: 'done',
		createdAt: '2026-08-24',
		reads: ['pos'],
		writes: [
			{ channel: 'vel', mode: 'add' },
			{ channel: 'sig.flee', mode: 'set' }
		],
		anchor: '피할 대상. 없으면 아무 일도 일어나지 않는다.'
	},

	params,

	step(w: World, p: Params, dt: number, ctx: StepCtx) {
		const a = ctx.anchor;
		if (!a) return;

		const r = p.radius;
		const push = p.force * dt;

		for (const e of ctx.targets) {
			// 토러스 최단 거리 — 무리와 같은 세계에 산다
			const dx = wrapDelta(e.pos.x - a.pos.x, w.bounds.w);
			const dy = wrapDelta(e.pos.y - a.pos.y, w.bounds.h);
			const d = Math.hypot(dx, dy);
			if (d >= r || d === 0) {
				e.sig.flee = 0;
				continue;
			}
			// 가까울수록 세게. sharp를 키우면 반경 가장자리에서 더 급히 잦아든다.
			const k = Math.pow(1 - d / r, p.sharp);
			e.vel.x += (dx / d) * push * k;
			e.vel.y += (dy / d) * push * k;
			e.sig.flee = k; // 0~1. deform 코어가 공포를 형태로 읽을 수 있게 남긴다
		}
	}
};
