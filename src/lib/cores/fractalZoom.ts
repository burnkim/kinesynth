/**
 * FractalZoom · 프랙탈 줌
 *
 * 원리: 스케일을 지수로 키우면, 자기유사한 구조는 한 옥타브 뒤에 같은 그림으로 되돌아온다.
 *       ×2가 된 순간과 시작을 구분할 수 없다 — 시간이 아니라 **스케일이 반복**한다(selfsim).
 * 표기법: FractalZoom(base, rate)@space
 *
 * zoom = base^frac(t · rate) — 한 옥타브를 지나면 1로 되돌아온다.
 * 세계를 바꾸지 않고 세계를 보는 방식만 바꾼다. 실행 순서의 첫 칸(space)에서 돈다.
 *
 * 순수 TS. DOM import 금지.
 */

import type { Core, ParamDef, Params, World } from '../core/types';

const frac = (v: number) => v - Math.floor(v);

const params: ParamDef[] = [
	{ key: 'base', label: 'base · 옥타브 배율', min: 1.2, max: 4, value: 2, step: 0.1 },
	{ key: 'rate', label: 'rate · 초당 옥타브', min: -0.6, max: 0.6, value: 0.14, step: 0.01 },
	{ key: 'spin', label: 'spin · 옥타브당 회전', min: -1, max: 1, value: 0, step: 0.05 },
	{ key: 'fx', label: '줌 중심 x', min: 0, max: 1, value: 0.5, step: 0.01 },
	{ key: 'fy', label: '줌 중심 y', min: 0, max: 1, value: 0.5, step: 0.01 }
];

export const fractalZoom: Core = {
	meta: {
		id: 'fractalZoom',
		name: 'Fractal Zoom',
		nameKo: '프랙탈 줌',
		domain: 'math',
		level: 'space',
		repeat: 'selfsim',
		principle: '한 배율만큼 들어가면 처음과 같은 그림이 나온다 — 반복하는 것은 시간이 아니라 크기다.',
		notation: 'FractalZoom(base, rate)@space',
		rule: 'zoom = base^frac(t·rate) — 한 옥타브를 지나면 1로 되돌아온다 · rot = 위상×spin×2π · 카메라 위치는 (fx, fy)×bounds · 세계를 바꾸지 않고 보는 방식만 바꾼다',
		refs: [
			'Mandelbrot, The Fractal Geometry of Nature, 1982 — 스케일 불변',
			'Droste 효과 — 자기 안에 자기를 담는 재귀 이미지'
		],
		status: 'done',
		createdAt: '2026-08-23',
		reads: [],
		writes: [
			{ channel: 'camera.zoom', mode: 'set' },
			{ channel: 'camera.rot', mode: 'set' },
			{ channel: 'camera.pos', mode: 'set' }
		]
	},

	params,

	step(w: World, p: Params) {
		// 옥타브 위상 0→1. rate가 음수면 물러나는 방향으로 같은 주기를 돈다.
		const phase = frac(w.t * p.rate);
		w.camera.zoom = Math.pow(p.base, phase);
		w.camera.rot = phase * p.spin * Math.PI * 2;
		w.camera.x = w.bounds.w * p.fx;
		w.camera.y = w.bounds.h * p.fy;
	}
};
