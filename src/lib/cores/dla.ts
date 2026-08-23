/**
 * DLA · 확산 제한 응집 (결정 성장)
 *
 * 원리: 무작위로 떠돌던 입자가 닿는 자리에 그대로 붙는다. 바깥쪽 가지가 안쪽을 가려서
 *       (diffusion-limited) 안은 못 채우고 가지만 자란다 — 눈꽃·전기 방전·금속 수지상 결정이
 *       같은 규칙이다. 가지의 모양은 어느 배율에서 봐도 같다: 자기유사(selfsim).
 * 표기법: DLA(격자 성장)@entity
 *
 * 붙었는지는 격자 점유로 판정한다 — 붙은 입자 수에 비례하는 비용만 든다(O(n)).
 * 붙은 입자는 sig.stuck = 1, vel = 0. 떠도는 입자만 속도를 가지므로
 * Elastic 같은 deform 코어를 얹으면 '떠도는 것'과 '굳은 것'이 형태로 갈린다.
 *
 * 순수 TS. DOM import 금지.
 */

import { makeEntity } from '../core/engine';
import type { Core, Entity, ParamDef, Params, World } from '../core/types';

const TAU = Math.PI * 2;

// 점유 격자 — 스텝마다 붙은 입자로 다시 채운다. 스텝 사이에 상태를 남기지 않는다.
let grid = new Uint8Array(0);
let gCols = 0;
let gRows = 0;

function spawn(w: World, r: number): Entity {
	const a = w.rand() * TAU;
	return makeEntity({
		pos: { x: w.bounds.w / 2 + Math.cos(a) * r, y: w.bounds.h / 2 + Math.sin(a) * r },
		sig: { stuck: 0 }
	});
}

const params: ParamDef[] = [
	{ key: 'n', label: '목표 입자 수', min: 100, max: 1500, value: 700, step: 10 },
	{ key: 'walkers', label: '동시 보행자', min: 10, max: 300, value: 70, step: 5 },
	{ key: 'cell', label: '격자 · 붙는 거리', min: 2, max: 14, value: 5, step: 1 },
	{ key: 'step', label: '걸음 크기', min: 0.3, max: 3, value: 1.1, step: 0.1 },
	{ key: 'bias', label: '중심 끌림', min: 0, max: 1, value: 0.12, step: 0.01 }
];

export const dla: Core = {
	meta: {
		id: 'dla',
		name: 'DLA',
		domain: 'chem',
		level: 'entity',
		repeat: 'selfsim',
		principle: '떠돌던 것이 닿는 자리에 붙는다 — 바깥이 안을 가려서, 채워지지 않고 가지가 된다.',
		notation: 'DLA(격자 성장)@entity',
		reads: [],
		writes: [
			{ channel: 'pos', mode: 'set' },
			{ channel: 'vel', mode: 'set' },
			{ channel: 'sig.stuck', mode: 'set' }
		]
	},

	params,

	init(w: World, p: Params) {
		// 씨앗 하나. 여기서부터 전부 자란다.
		w.entities.push(
			makeEntity({ pos: { x: w.bounds.w / 2, y: w.bounds.h / 2 }, sig: { stuck: 1 } })
		);
		for (let i = 0; i < Math.round(p.walkers); i++) w.entities.push(spawn(w, p.cell * 8));
	},

	step(w: World, p: Params, dt: number) {
		const W = w.bounds.w;
		const H = w.bounds.h;
		const cx = W / 2;
		const cy = H / 2;
		const cell = Math.max(2, Math.round(p.cell));
		const cols = Math.ceil(W / cell);
		const rows = Math.ceil(H / cell);

		if (gCols !== cols || gRows !== rows) {
			grid = new Uint8Array(cols * rows);
			gCols = cols;
			gRows = rows;
		} else {
			grid.fill(0);
		}

		// 붙은 입자를 격자에 찍고, 동시에 결정 반지름을 잰다
		let clusterR = 0;
		let free = 0;
		for (const e of w.entities) {
			if (!e.sig.stuck) {
				free++;
				continue;
			}
			const ix = (e.pos.x / cell) | 0;
			const iy = (e.pos.y / cell) | 0;
			if (ix >= 0 && ix < cols && iy >= 0 && iy < rows) grid[iy * cols + ix] = 1;
			const d = Math.hypot(e.pos.x - cx, e.pos.y - cy);
			if (d > clusterR) clusterR = d;
		}

		const maxR = Math.min(W, H) * 0.47;
		const birthR = Math.min(clusterR + cell * 6, maxR * 0.92);
		const killR = maxR;
		const stepLen = cell * p.step;
		const target = Math.round(p.walkers);
		const total = Math.round(p.n);

		for (const e of w.entities) {
			if (e.sig.stuck) continue;

			// 무작위 걸음 + 중심 쪽 약한 끌림 (없으면 걸어 나가 영영 돌아오지 않는다)
			const a = w.rand() * TAU;
			let dx = Math.cos(a);
			let dy = Math.sin(a);
			const tx = cx - e.pos.x;
			const ty = cy - e.pos.y;
			const td = Math.hypot(tx, ty) || 1;
			dx += (tx / td) * p.bias;
			dy += (ty / td) * p.bias;
			const m = Math.hypot(dx, dy) || 1;

			e.vel.x = (dx / m) * stepLen * (1 / dt);
			e.vel.y = (dy / m) * stepLen * (1 / dt);
			e.pos.x += (dx / m) * stepLen;
			e.pos.y += (dy / m) * stepLen;

			// 너무 멀리 나간 보행자는 결정 가장자리로 되돌린다 (고전적인 DLA 최적화)
			if (Math.hypot(e.pos.x - cx, e.pos.y - cy) > killR) {
				const b = w.rand() * TAU;
				e.pos.x = cx + Math.cos(b) * birthR;
				e.pos.y = cy + Math.sin(b) * birthR;
				continue;
			}

			// 이웃 칸 하나라도 차 있으면 붙는다
			const ix = (e.pos.x / cell) | 0;
			const iy = (e.pos.y / cell) | 0;
			let hit = false;
			for (let oy = -1; oy <= 1 && !hit; oy++) {
				const jy = iy + oy;
				if (jy < 0 || jy >= rows) continue;
				for (let ox = -1; ox <= 1; ox++) {
					const jx = ix + ox;
					if (jx < 0 || jx >= cols) continue;
					if (grid[jy * cols + jx]) {
						hit = true;
						break;
					}
				}
			}
			if (hit) {
				e.sig.stuck = 1;
				e.vel.x = 0;
				e.vel.y = 0;
				free--;
			}
		}

		// 보행자 수를 목표에 맞춘다 — 붙은 만큼 새로 태어난다
		while (free < target && w.entities.length < total) {
			w.entities.push(spawn(w, birthR));
			free++;
		}
		while (free > target && w.entities.length > 1) {
			const last = w.entities[w.entities.length - 1];
			if (last.sig.stuck) break; // 결정은 건드리지 않는다
			w.entities.pop();
			free--;
		}
	}
};
