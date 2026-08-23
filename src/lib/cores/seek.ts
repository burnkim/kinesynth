/**
 * Seek · 추격
 *
 * 원리: 쫓는 것은 지금 자리가 아니라 **갈 자리**를 향한다. 먹이의 속도를 읽어
 *       앞질러 가면 길이 짧아진다 — 매가 새를 잡는 방식이고, 요격의 원리다.
 *       선회에는 한계가 있어서, 급히 꺾이는 먹이는 놓친다. 다시 붙고, 또 놓친다 —
 *       시도가 반복되는 서사 단위(event).
 * 표기법: Seek(가장 가까운 것→요격)@entity
 *
 * 목표 = 가장 가까운 앵커(토러스 최단거리)의 `pos + vel·lead`
 * a = (목표방향·speed − vel)·turn   ·   |vel| ≤ speed
 *
 * **앵커가 그룹이다.** 지금까지 앵커는 하나(체인의 뿌리, 공전의 중심)였는데,
 * 무리를 쫓으려면 무리 전체를 봐야 한다 — 그래서 `ctx.anchors`가 생겼다.
 * 비용은 포식자 하나당 먹이 수만큼(O(n)). 포식자가 여럿이면 O(p·n)이니
 * 무리가 아주 커지면 격자 인덱스가 필요해진다.
 *
 * 순수 TS. DOM import 금지.
 */

import { wrapCoord, wrapDelta } from '../core/space';
import type { Core, ParamDef, Params, StepCtx, Vec, World } from '../core/types';

/** 앞이 뾰족한 다트 — 새(짧은 선분)와 실루엣이 달라야 포식자로 읽힌다. */
function dart(r: number): Vec[] {
	return [
		{ x: r * 2.1, y: 0 },
		{ x: -r * 0.6, y: r * 0.85 },
		{ x: -r * 0.15, y: 0 },
		{ x: -r * 0.6, y: -r * 0.85 }
	];
}

const params: ParamDef[] = [
	{ key: 'speed', label: '최고 속도', min: 40, max: 600, value: 245, step: 5 },
	{ key: 'turn', label: '선회 응답 (1/s)', min: 0.2, max: 8, value: 1.5, step: 0.1 },
	{ key: 'lead', label: '예측 시간 (s)', min: 0, max: 1.5, value: 0.45, step: 0.05 },
	{ key: 'r', label: '몸 크기', min: 4, max: 40, value: 13, step: 1 }
];

export const seek: Core = {
	meta: {
		id: 'seek',
		name: 'Seek',
		nameKo: '추격',
		domain: 'bio',
		level: 'entity',
		repeat: 'event',
		principle: '지금 자리가 아니라 갈 자리를 향한다 — 그래서 길이 짧아진다.',
		rule: '목표 = 가장 가까운 앵커(토러스 최단거리)의 pos + vel·lead · a = (목표방향·speed − vel)·turn · |vel| ≤ speed · rot = atan2(vel) · 선회 한계가 있어 급선회하는 먹이는 놓친다 → 시도가 반복된다',
		notation: 'Seek(가장 가까운 것→요격)@entity',
		refs: [
			'Craig Reynolds, Steering Behaviors for Autonomous Characters, GDC 1999 — seek / pursue',
			'Kane et al., Falcons pursue prey using visual motion cues, PNAS 2014 — 매의 요격 항법'
		],
		status: 'done',
		createdAt: '2026-08-24',
		reads: ['pos', 'vel'],
		writes: [
			{ channel: 'pos', mode: 'add' },
			{ channel: 'vel', mode: 'add' },
			{ channel: 'rot', mode: 'set' },
			{ channel: 'points', mode: 'set' },
			{ channel: 'closed', mode: 'set' }
		],
		anchor: '쫓을 무리. **그룹으로 받는다** — 그중 가장 가까운 하나를 매 스텝 고른다.'
	},

	params,

	init(w: World, p: Params, ctx: StepCtx) {
		if (ctx.targets.length > 0) return;
		// 무리에서 떨어진 곳에서 시작한다 — 다가오는 과정이 보여야 한다
		ctx.spawn({
			pos: { x: w.bounds.w * 0.5, y: w.bounds.h * 0.1 },
			vel: { x: 0, y: p.speed },
			closed: true
		});
	},

	step(w: World, p: Params, dt: number, ctx: StepCtx) {
		const W = w.bounds.w;
		const H = w.bounds.h;
		const prey = ctx.anchors;

		for (const e of ctx.targets) {
			if (prey.length > 0) {
				// 가장 가까운 먹이 하나를 고른다
				let bx = 0;
				let by = 0;
				let best = Infinity;
				let target = prey[0];
				for (const q of prey) {
					const dx = wrapDelta(q.pos.x - e.pos.x, W);
					const dy = wrapDelta(q.pos.y - e.pos.y, H);
					const d2 = dx * dx + dy * dy;
					if (d2 < best) {
						best = d2;
						bx = dx;
						by = dy;
						target = q;
					}
				}
				// 요격: 지금 자리가 아니라 lead초 뒤의 자리를 향한다
				const tx = bx + target.vel.x * p.lead;
				const ty = by + target.vel.y * p.lead;
				const m = Math.hypot(tx, ty) || 1;
				e.vel.x += ((tx / m) * p.speed - e.vel.x) * p.turn * dt;
				e.vel.y += ((ty / m) * p.speed - e.vel.y) * p.turn * dt;
			}

			const s = Math.hypot(e.vel.x, e.vel.y);
			if (s > p.speed) {
				const k = p.speed / s;
				e.vel.x *= k;
				e.vel.y *= k;
			}

			e.pos.x = wrapCoord(e.pos.x + e.vel.x * dt, W); // 먹이와 같은 토러스에 산다
			e.pos.y = wrapCoord(e.pos.y + e.vel.y * dt, H);
			if (s > 0) e.rot = Math.atan2(e.vel.y, e.vel.x); // 코가 진행 방향 — Elastic 없이도
			e.points = dart(p.r);
			e.closed = true;
		}
	}
};
