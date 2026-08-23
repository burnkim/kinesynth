/**
 * Squash & Stretch · 찌그러짐과 늘어남
 *
 * 원리: 탄성체는 부피를 거의 지킨 채 모양만 바꾼다 (x·y ≈ 1).
 *       늘어남은 **속도**에 비례하고, 찌그러짐은 **속도의 변화(충격)**에 비례한다.
 * 표기법: Squash(vel.y→scale)@deform
 *
 * 애니메이션 12원칙의 첫 항목은 이 물리의 과장이다. 그래서 `exa`(과장 계수)를 둔다:
 *   exa 1.0 = 물리적 사실 · 1.8 = 애니메이션 · 2.5+ = 만화.
 *   스타일 = 법칙 × 과장 (PRD §4).
 *
 * 읽기: vel.y (늘어남), sig.impact (찌그러짐 — Bounce가 접지 순간 실어 보낸 충격량)
 * 순수 TS. DOM import 금지.
 */

import type { Core, ParamDef, Params, StepCtx, World } from '../core/types';

const K_STRETCH = 0.28; // exa=1일 때 최대 신장률
const K_SQUASH = 0.26; // exa=1일 때 최대 압축률
const IMPACT_REF = 2; // 충격 기준 = 기준 속도 × 2 (Δv=(1+e)|v| 이므로 속도보다 크다)
const SY_MIN = 0.12;
const SY_MAX = 3.2;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

const params: ParamDef[] = [
	{ key: 'exa', label: 'exa · 과장 계수', min: 0, max: 3, value: 1.8, step: 0.05 },
	{ key: 'vmax', label: '기준 속도', min: 200, max: 2500, value: 900, step: 10 }
];

export const squash: Core = {
	meta: {
		id: 'squash',
		name: 'Squash & Stretch',
		nameKo: '찌그러짐과 늘어남',
		domain: 'physics',
		level: 'deform',
		repeat: 'event',
		principle: '빠르면 늘어나고 부딪히면 납작해진다 — 부피는 그대로.',
		notation: 'Squash(vel.y→scale)@deform',
		rule: 'scale.y = 1 + K_s·exa·|vel.y|/vmax − K_q·exa·impact/vmax · scale.x = 1/scale.y (부피 보존) · exa 1.0 = 물리적 사실',
		refs: [
			'Thomas & Johnston, The Illusion of Life, 1981 — 12원칙 #1 Squash and Stretch',
			'탄성체의 근사 비압축성 (Poisson ratio → 0.5)'
		],
		status: 'done',
		createdAt: '2026-08-23',
		reads: ['vel.y', 'sig.impact'],
		writes: [{ channel: 'scale', mode: 'mul' }]
	},

	params,

	step(w: World, p: Params, _dt: number, ctx: StepCtx) {
		for (const e of ctx.targets) {
			const impactN = clamp01((e.sig.impact ?? 0) / (p.vmax * IMPACT_REF));
			const speedN = clamp01(Math.abs(e.vel.y) / p.vmax);

			// 접촉 중에는 늘어남이 물러난다 — 만화의 스쿼시 프레임에 스트레치는 없다.
			const stretch = speedN * (1 - impactN) * K_STRETCH * p.exa;
			const squashAmt = impactN * K_SQUASH * p.exa;

			let sy = 1 + stretch - squashAmt;
			sy = sy < SY_MIN ? SY_MIN : sy > SY_MAX ? SY_MAX : sy;

			// scale은 엔진이 매 스텝 1로 되돌린다 — deform은 그 위에 곱한다(mul).
			e.scale.y *= sy;
			e.scale.x *= 1 / sy; // 부피 보존
		}
	}
};
