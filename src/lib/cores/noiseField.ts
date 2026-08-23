/**
 * NoiseField · 흐름장
 *
 * 원리: 공간의 각 지점에 방향이 하나씩 정해져 있고, 그 안에 든 것은 그 방향으로 밀린다.
 *       바람·해류·연기가 그렇다. 방향은 펄린 노이즈에서 읽는다 — 무작위인데 매끄러워서
 *       이웃한 지점끼리 방향이 비슷하고, 그래서 흐름이 된다. 계속 다르되 통계는 같다(steady).
 * 표기법: NoiseField(flow)@space
 *
 * **write mode의 첫 실전**: 이 코어는 vel을 `add`한다 — 속도를 정하지 않고 보탠다.
 * 그래서 Boids(역시 vel에 더한다) 위에 얹으면 바람 부는 새떼가 되지만,
 * Bounce처럼 vel을 `set`하는 코어와 겹치면 밀어 준 만큼이 지워진다 — 엔진이 그때 경고한다.
 *
 * 레벨이 space인 이유: 세계가 가진 성질이지 개체의 성질이 아니고, 실행 순서 맨 앞에서
 * 밀어 놓아야 flock·entity 코어가 그 위에 얹힌다.
 *
 * 순수 TS. DOM import 금지.
 */

import { fbm2, perlin2, type Noise2 } from '../core/noise';
import type { Core, ParamDef, Params, StepCtx, World } from '../core/types';

const TAU = Math.PI * 2;

/** 필드는 세계마다 하나. 리셋되면 세계가 새로 생기므로 같이 사라진다. */
const fields = new WeakMap<World, Noise2>();

const fieldOf = (w: World): Noise2 => {
	let n = fields.get(w);
	if (!n) {
		n = perlin2(w.rand); // 세계의 시드 난수를 쓴다 → 같은 시드 = 같은 바람
		fields.set(w, n);
	}
	return n;
};

const params: ParamDef[] = [
	{ key: 'scale', label: '결의 크기', min: 0.0005, max: 0.02, value: 0.0035, step: 0.0005 },
	{ key: 'force', label: '세기', min: 0, max: 1200, value: 320, step: 10 },
	{ key: 'turns', label: '각도 회전수', min: 0.5, max: 4, value: 1.6, step: 0.1 },
	{ key: 'drift', label: '필드 흐름 속도', min: 0, max: 1, value: 0.12, step: 0.01 },
	{ key: 'oct', label: '옥타브', min: 1, max: 4, value: 2, step: 1 }
];

export const noiseField: Core = {
	meta: {
		id: 'noiseField',
		name: 'Noise Field',
		nameKo: '흐름장',
		domain: 'math',
		level: 'space',
		repeat: 'steady',
		principle: '공간마다 방향이 정해져 있고, 그 안에 든 것은 그 방향으로 밀린다.',
		rule: 'a = fbm(x·scale, y·scale + t·drift)·turns·2π · vel += (cos a, sin a)·force·dt (add) · 펄린은 격자 난수를 부드럽게 이어 붙여 이웃끼리 방향이 비슷하다',
		notation: 'NoiseField(flow)@space',
		refs: [
			'Ken Perlin, An Image Synthesizer, SIGGRAPH 1985',
			'Bridson et al., Curl-Noise for Procedural Fluid Flow, SIGGRAPH 2007'
		],
		status: 'done',
		createdAt: '2026-08-23',
		reads: ['pos'],
		writes: [{ channel: 'vel', mode: 'add' }]
	},

	params,

	step(w: World, p: Params, dt: number, ctx: StepCtx) {
		const n = fieldOf(w);
		const oct = Math.max(1, Math.round(p.oct));
		const push = p.force * dt;
		const ty = w.t * p.drift; // 필드 자체가 천천히 흘러간다

		for (const e of ctx.targets) {
			const a = fbm2(n, e.pos.x * p.scale, e.pos.y * p.scale + ty, oct) * p.turns * TAU;
			e.vel.x += Math.cos(a) * push; // set이 아니라 add — 다른 코어의 속도 위에 얹힌다
			e.vel.y += Math.sin(a) * push;
		}
	}
};
