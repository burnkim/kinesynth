/**
 * Pop · 나고 짐
 *
 * 원리: 생기는 것은 제 크기를 **지나쳤다가** 자리 잡고, 사라지는 것은 한 번 부풀었다가
 *       오므라든다. 애니메이션이 등장·퇴장을 다루는 방식이고, 물리로는 감쇠 진동의
 *       첫 한 마디다. 이산 시스템(켜짐/꺼짐)에 이걸 얹는 순간 **깜빡임이 움직임이 된다.**
 * 표기법: Pop(생멸→scale)@deform
 *
 * 읽기: `sig.age`(태어난 뒤 0→1) · `sig.fade`(사라지는 중 0→1)
 *   나타남 = easeOutBack(age)  — 1을 지나쳤다가 돌아온다
 *   사라짐 = 1 − easeInBack(fade) — 먼저 부풀고(예비 동작) 오므라든다
 *   숨    = 살아 있는 동안 아주 느린 맥동. 위상은 엔티티 id에서 뽑아 서로 어긋나게.
 *
 * **exa가 되돌아옴의 크기를 정한다** (PRD §4). exa 0이면 지나침도 부풂도 없이
 * 그냥 커졌다 작아진다 — 이산 시스템 그대로다. 낙차는 여기서 들어온다.
 *
 * 신호만 읽으므로 라이프 게임 전용이 아니다. `sig.age`/`sig.fade`를 쓰는 어떤 코어에도 걸린다.
 *
 * 순수 TS. DOM import 금지.
 */

import type { Core, ParamDef, Params, StepCtx, World } from '../core/types';

const TAU = Math.PI * 2;
const BACK = 1.70158; // 표준 back 이징의 되돌아옴 세기. exa가 이걸 배로 늘린다.

/** 0에서 1로 가되 1을 지나쳤다가 돌아온다. */
const outBack = (t: number, k: number) => {
	const u = t - 1;
	return 1 + (k + 1) * u * u * u + k * u * u;
};
/** 0에서 1로 가되 처음에 뒤로 물러난다 (예비 동작). */
const inBack = (t: number, k: number) => (k + 1) * t * t * t - k * t * t;

const params: ParamDef[] = [
	{ key: 'exa', label: 'exa · 과장 계수', min: 0, max: 3, value: 1.8, step: 0.05 },
	{ key: 'breath', label: '숨 진폭', min: 0, max: 0.3, value: 0.06, step: 0.005 },
	{ key: 'rate', label: '숨 (회/초)', min: 0, max: 2, value: 0.35, step: 0.01 }
];

export const pop: Core = {
	meta: {
		id: 'pop',
		name: 'Pop',
		nameKo: '나고 짐',
		domain: 'physics',
		level: 'deform',
		repeat: 'event',
		principle: '생기는 것은 제 크기를 지나쳤다가 자리 잡고, 사라지는 것은 오므라든다.',
		rule: 'scale ×= outBack(sig.age, BACK·exa) · (1 − inBack(sig.fade, BACK·exa)) · (1 + breath·exa·sin(2π(rate·t + 위상))) · 위상은 엔티티 id에서 뽑아 서로 어긋나게 · exa 0이면 지나침도 부풂도 없다',
		notation: 'Pop(생멸→scale)@deform',
		refs: [
			'Thomas & Johnston, The Illusion of Life, 1981 — Anticipation · Exaggeration',
			'Robert Penner, Motion, Tween, and Easing, 2002 — back 이징의 되돌아옴'
		],
		status: 'done',
		createdAt: '2026-08-24',
		reads: ['sig.age', 'sig.fade'],
		writes: [{ channel: 'scale', mode: 'mul' }]
	},

	params,

	step(w: World, p: Params, _dt: number, ctx: StepCtx) {
		const k = BACK * p.exa;
		const th = TAU * p.rate * w.t;
		const amp = p.breath * p.exa;

		for (const e of ctx.targets) {
			const age = e.sig.age ?? 1;
			const fade = e.sig.fade ?? 0;

			let s = age < 1 ? outBack(age, k) : 1;
			if (fade > 0) s *= 1 - inBack(Math.min(1, fade), k);
			// 살아 있는 동안의 숨. 위상을 id에서 뽑아 세포마다 어긋나게 — 판 전체가 함께 뛰지 않도록.
			if (amp > 0 && fade === 0) s *= 1 + amp * Math.sin(th + e.id * 2.39996);

			if (s < 0) s = 0;
			e.scale.x *= s; // 엔진이 매 스텝 1로 되돌린다 — 그 위에 곱한다
			e.scale.y *= s;
		}
	}
};
