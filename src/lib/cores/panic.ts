/**
 * Panic · 공포의 전파
 *
 * 원리: 무리는 위협을 **각자 보고** 반응하지 않는다. 옆이 튀면 따라 튄다.
 *       그래서 회피가 개체보다 훨씬 빠른 **파동**으로 번진다 — 실제 찌르레기 군무에서
 *       회피파는 새보다 10~20배 빠르게 무리를 가로지른다 (Procaccini et al. 2011).
 *       위협이 지나가면 파동도 잦아든다 — 사건 단위의 반복(event).
 * 표기법: Panic(이웃→전파)@flock
 *
 * 겁 = max(제가 본 위협 sig.flee, 가장 겁먹은 이웃의 겁 × gain)
 *   · 올라갈 때는 rise로 서서히 → 한 홉 건너는 데 시간이 걸린다 = 파동 속도
 *   · 내려갈 때는 tau로 잦아든다
 * 겁먹은 만큼 **가장 겁먹은 이웃의 속도로 급히 붙는다** (동조) — 방향이 함께 실려 간다.
 *
 * `sig.flee`는 Flee가 남긴 것을 읽고, `sig.panic`은 이 코어가 소유한다.
 * 뷰어의 「신호 보기」로 `panic`을 고르면 파동이 눈에 보인다.
 *
 * 순수 TS. DOM import 금지.
 */

import { wrapDelta } from '../core/space';
import type { Core, ParamDef, Params, StepCtx, World } from '../core/types';

// 동시 갱신용 스크래치 — 모두가 '한 스텝 전'의 겁을 본다. 그래야 한 홉씩 번진다.
let nextP = new Float64Array(0);
let accX = new Float64Array(0);
let accY = new Float64Array(0);

const params: ParamDef[] = [
	{ key: 'radius', label: '전파 반경', min: 20, max: 300, value: 95, step: 5 },
	{ key: 'gain', label: '한 홉당 전달률', min: 0, max: 1, value: 0.88, step: 0.01 },
	{ key: 'rise', label: '번지는 속도 (1/s)', min: 1, max: 60, value: 16, step: 1 },
	{ key: 'tau', label: '잦아듦 (s)', min: 0.1, max: 3, value: 0.9, step: 0.05 },
	{ key: 'urge', label: '동조 급함', min: 0, max: 14, value: 6, step: 0.25 }
];

export const panic: Core = {
	meta: {
		id: 'panic',
		name: 'Panic',
		nameKo: '공포의 전파',
		domain: 'bio',
		level: 'flock',
		repeat: 'event',
		principle: '옆이 튀면 따라 튄다 — 그래서 공포가 개체보다 빨리 번진다.',
		rule: '겁 = max(sig.flee, 가장 겁먹은 이웃의 겁 × gain) · 올라갈 땐 rise로 서서히(한 홉의 시간 = 파동 속도), 내려갈 땐 tau로 잦아듦 · vel += (가장 겁먹은 이웃의 vel − vel)·겁·urge·dt (add) · 모두가 한 스텝 전의 겁을 본다',
		notation: 'Panic(이웃→전파)@flock',
		refs: [
			'Procaccini et al., Propagating waves of avoidance in starling flocks under predation, Animal Behaviour 2011',
			'Potts, The chorus-line hypothesis of manoeuvre coordination in avian flocks, Nature 1984'
		],
		status: 'done',
		createdAt: '2026-08-24',
		reads: ['pos', 'vel', 'sig.flee'],
		writes: [
			{ channel: 'vel', mode: 'add' },
			{ channel: 'sig.panic', mode: 'set' }
		]
	},

	params,

	step(w: World, p: Params, dt: number, ctx: StepCtx) {
		const es = ctx.targets;
		const n = es.length;
		if (n === 0) return;
		if (nextP.length < n) {
			nextP = new Float64Array(n);
			accX = new Float64Array(n);
			accY = new Float64Array(n);
		}

		const W = w.bounds.w;
		const H = w.bounds.h;
		const r2 = p.radius * p.radius;
		const fade = Math.exp(-dt / p.tau);

		for (let i = 0; i < n; i++) {
			const e = es[i];
			let bestP = 0;
			let bvx = 0;
			let bvy = 0;

			for (let j = 0; j < n; j++) {
				if (i === j) continue;
				const q = es[j];
				const dx = wrapDelta(q.pos.x - e.pos.x, W);
				const dy = wrapDelta(q.pos.y - e.pos.y, H);
				if (dx * dx + dy * dy > r2) continue;
				const pj = q.sig.panic ?? 0;
				if (pj > bestP) {
					bestP = pj;
					bvx = q.vel.x;
					bvy = q.vel.y;
				}
			}

			const own = e.sig.flee ?? 0; // Flee가 남긴 '내가 직접 본 위협'
			const target = Math.max(own, bestP * p.gain);
			const cur = e.sig.panic ?? 0;
			// 번질 땐 서서히(한 홉에 걸리는 시간이 곧 파동 속도), 잦아들 땐 지수 감쇠
			const next = target > cur ? cur + (target - cur) * p.rise * dt : cur * fade;
			nextP[i] = next;

			// 동조: 겁먹은 만큼 가장 겁먹은 이웃의 속도로 급히 붙는다 → 방향이 함께 실린다
			accX[i] = bestP > 0 ? (bvx - e.vel.x) * next * p.urge : 0;
			accY[i] = bestP > 0 ? (bvy - e.vel.y) * next * p.urge : 0;
		}

		for (let i = 0; i < n; i++) {
			const e = es[i];
			e.sig.panic = nextP[i];
			e.vel.x += accX[i] * dt;
			e.vel.y += accY[i] * dt;
		}
	}
};
