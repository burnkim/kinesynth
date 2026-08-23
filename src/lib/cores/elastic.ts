/**
 * Elastic · 진행 방향 신장
 *
 * 원리: 빠르게 움직이는 것은 진행 방향으로 늘어나 보인다 — 잔상(motion blur)과
 *       탄성 변형이 같은 방향으로 겹치는 현상. 속도가 형태를 만든다.
 *       변형량은 속도에 **제곱**으로 붙는다 (관성·항력이 v²에 비례) — 그래서
 *       느린 것은 점으로 남고 빠른 것만 선이 된다. 대비가 생기는 지점이 여기다.
 * 표기법: Elastic(vel→stretch)@deform
 *
 * rot을 속도 방향으로 돌린 뒤 scale.x를 속도 크기에 비례해 늘린다.
 * 아주 짧은 2점 선분에 걸면 — **정지하면 점, 가속하면 선.** 점이 선이 되는 순간.
 * exa는 필수 (PRD §4): 0이면 전부 점, 키우면 전부 선이 된다.
 *
 * 순수 TS. DOM import 금지.
 */

import type { Core, ParamDef, Params, StepCtx, World } from '../core/types';

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

const params: ParamDef[] = [
	{ key: 'exa', label: 'exa · 과장 계수', min: 0, max: 3, value: 1.8, step: 0.05 },
	{ key: 'kmax', label: '최대 신장 배율', min: 1, max: 20, value: 6, step: 0.5 },
	{ key: 'vmax', label: '기준 속도', min: 20, max: 600, value: 140, step: 5 }
];

export const elastic: Core = {
	meta: {
		id: 'elastic',
		name: 'Elastic',
		nameKo: '진행 방향 신장',
		domain: 'physics',
		level: 'deform',
		repeat: 'steady',
		principle: '빠를수록 진행 방향으로 늘어난다 — 속도가 형태가 된다.',
		notation: 'Elastic(vel→stretch)@deform',
		rule: 'rot = atan2(vel) · scale.x = 1 + kmax·exa·(|v|/vmax)² (관성·항력이 v²에 비례) · scale.y = 1/scale.x (부피 보존) · 아주 짧은 2점 선분에 걸면 정지=점, 가속=선',
		refs: [
			'Thomas & Johnston, The Illusion of Life, 1981 — Squash and Stretch / Exaggeration',
			'사진의 모션 블러: 노출 시간 × 속도 = 스트리크 길이'
		],
		status: 'done',
		createdAt: '2026-08-23',
		reads: ['vel'],
		writes: [
			{ channel: 'rot', mode: 'set' },
			{ channel: 'scale', mode: 'mul' }
		]
	},

	params,

	step(w: World, p: Params, _dt: number, ctx: StepCtx) {
		for (const e of ctx.targets) {
			const s = Math.hypot(e.vel.x, e.vel.y);
			if (s > 0) e.rot = Math.atan2(e.vel.y, e.vel.x); // 진행 방향 정렬

			const n = clamp01(s / p.vmax);
			const sx = 1 + p.kmax * p.exa * n * n;
			e.scale.x *= sx; // 엔진이 매 스텝 1로 되돌린다 — 그 위에 곱한다
			e.scale.y *= 1 / sx; // 부피 보존 — 선에서는 안 보이지만 원리는 Squash와 같다
		}
	}
};
