/**
 * Boids · 새떼
 *
 * 원리: 지휘자 없이 세 가지 국소 규칙만으로 군집이 생긴다 (Reynolds, 1986).
 *       분리(너무 가까우면 벌어진다) · 정렬(이웃과 방향을 맞춘다) · 응집(무리 쪽으로 모인다).
 *       계속 다르지만 통계적으로 같은 상태 — 정상 흐름(steady)의 원형.
 * 표기법: Boids(분리·정렬·응집)@flock
 *
 * 세 규칙은 각각 '가고 싶은 방향'을 내고, 가중 합이 하나의 목표 속도가 된다.
 * 조향은 그 목표와 현재 속도의 차이 한 번뿐 — 규칙마다 감속시키면 무리 전체가 느려진다.
 * 속도 하한을 두지 않는다: 급선회하면 속도가 죽었다가 다시 붙는다 →
 * Elastic을 얹으면 그 순간이 **점 ↔ 선**으로 보인다.
 * 공간은 토러스(랩어라운드) — 벽이 없어야 흐름이 끊기지 않는다.
 *
 * 순수 TS. DOM import 금지.
 */

import type { Core, Entity, ParamDef, Params, StepCtx, World } from '../core/types';

const SEG = 1.3; // 로컬 지오메트리 = 아주 짧은 2점 선분. 정지하면 점, Elastic이 늘리면 선.
const RESPONSE = 2.6; // 선회 응답 (1/s) — 목표 속도를 얼마나 빨리 따라잡는가
const SEP_RATIO = 0.4; // 분리는 이웃 반경의 이 비율 안에서만 — 넓게 밀면 무리가 아니라 격자가 된다

/** 토러스 최단 변위 — 화면 반대편 이웃도 이웃이다. 랩어라운드 이음매를 없앤다. */
function wrapDelta(d: number, size: number): number {
	if (d > size * 0.5) return d - size;
	if (d < -size * 0.5) return d + size;
	return d;
}

// 동시 갱신용 스크래치 — 모든 개체가 '같은 순간'의 이웃을 본다. 스텝마다 재할당하지 않는다.
let accX = new Float64Array(0);
let accY = new Float64Array(0);

function newBoid(w: World, ctx: StepCtx, maxV: number): Entity {
	const a = w.rand() * Math.PI * 2;
	return ctx.spawn({
		pos: { x: w.rand() * w.bounds.w, y: w.rand() * w.bounds.h },
		vel: { x: Math.cos(a) * maxV, y: Math.sin(a) * maxV },
		points: [
			{ x: -SEG, y: 0 },
			{ x: SEG, y: 0 }
		]
	});
}

const params: ParamDef[] = [
	{ key: 'n', label: '개체 수', min: 10, max: 500, value: 150, step: 1 },
	{ key: 'radius', label: '이웃 반경', min: 10, max: 240, value: 110, step: 1 },
	{ key: 'sep', label: '분리', min: 0, max: 3, value: 2.3, step: 0.05 },
	{ key: 'ali', label: '정렬', min: 0, max: 3, value: 1.0, step: 0.05 },
	{ key: 'coh', label: '응집', min: 0, max: 3, value: 1.6, step: 0.05 },
	{ key: 'speed', label: '최고 속도', min: 20, max: 400, value: 170, step: 5 }
];

export const boids: Core = {
	meta: {
		id: 'boids',
		name: 'Boids',
		nameKo: '새떼',
		domain: 'bio',
		level: 'flock',
		repeat: 'steady',
		principle: '아무도 지휘하지 않는데 무리가 된다 — 옆을 보는 세 가지 규칙만으로.',
		notation: 'Boids(분리·정렬·응집)@flock',
		rule: '이웃 반경 안에서 분리(−Σd/|d|²)·정렬(Σv)·응집(Σd) 세 방향을 가중 합 → 목표 방향 · 목표속도 = 방향×최고속도 · a = (목표속도 − v)·응답 · 속도 상한만, 하한 없음 · 공간은 토러스',
		refs: [
			'Craig Reynolds, Flocks, Herds, and Schools: A Distributed Behavioral Model, SIGGRAPH 1987',
			'Ballerini et al., Interaction ruling animal collective behaviour, PNAS 2008 — 거리보다 위상적 이웃'
		],
		status: 'done',
		createdAt: '2026-08-23',
		reads: ['pos', 'vel'],
		// 조향력을 '더한다' — 앞선 코어가 실어 준 속도(예: 흐름장)가 살아남는다.
		// 상한 클램프와 토러스 랩어라운드는 그 위의 경계 조건일 뿐 결정이 아니다.
		writes: [
			{ channel: 'pos', mode: 'add' },
			{ channel: 'vel', mode: 'add' }
		]
	},

	params,

	init(w: World, p: Params, ctx: StepCtx) {
		for (let i = 0; i < Math.round(p.n); i++) newBoid(w, ctx, p.speed);
	},

	step(w: World, p: Params, dt: number, ctx: StepCtx) {
		const es = ctx.targets;
		const maxV = p.speed;
		const n = Math.round(p.n);
		while (es.length > n) ctx.despawn(es[es.length - 1]); // 개체 수 슬라이더를 실시간 반영
		while (es.length < n) newBoid(w, ctx, maxV);
		if (accX.length < n) {
			accX = new Float64Array(n);
			accY = new Float64Array(n);
		}

		const W = w.bounds.w;
		const H = w.bounds.h;
		const r2 = p.radius * p.radius;
		const sepR2 = r2 * SEP_RATIO * SEP_RATIO;

		for (let i = 0; i < n; i++) {
			const a = es[i];
			let sepX = 0, sepY = 0; // 분리: 이웃 반대 방향 (가까울수록 강하게)
			let aliX = 0, aliY = 0; // 정렬: 이웃 속도의 합
			let cohX = 0, cohY = 0; // 응집: 이웃까지의 변위 합
			let cnt = 0;

			for (let j = 0; j < n; j++) {
				if (i === j) continue;
				const b = es[j];
				const dx = wrapDelta(b.pos.x - a.pos.x, W);
				const dy = wrapDelta(b.pos.y - a.pos.y, H);
				const d2 = dx * dx + dy * dy;
				if (d2 > r2 || d2 === 0) continue;
				cnt++;
				cohX += dx;
				cohY += dy;
				aliX += b.vel.x;
				aliY += b.vel.y;
				if (d2 < sepR2) {
					sepX -= dx / d2; // 가까울수록 강하게
					sepY -= dy / d2;
				}
			}

			let ax = 0;
			let ay = 0;
			if (cnt > 0) {
				// 각 규칙의 방향만 취해 가중 합 → 하나의 목표 방향
				let wx = 0;
				let wy = 0;
				let m = Math.hypot(sepX, sepY);
				if (m > 0) {
					wx += (sepX / m) * p.sep;
					wy += (sepY / m) * p.sep;
				}
				m = Math.hypot(aliX, aliY);
				if (m > 0) {
					wx += (aliX / m) * p.ali;
					wy += (aliY / m) * p.ali;
				}
				m = Math.hypot(cohX, cohY);
				if (m > 0) {
					wx += (cohX / m) * p.coh;
					wy += (cohY / m) * p.coh;
				}
				m = Math.hypot(wx, wy);
				if (m > 0) {
					// 목표 속도 = 목표 방향 × 최고 속도. 조향은 여기서 한 번만.
					ax = ((wx / m) * maxV - a.vel.x) * RESPONSE;
					ay = ((wy / m) * maxV - a.vel.y) * RESPONSE;
				}
			}
			accX[i] = ax;
			accY[i] = ay;
		}

		for (let i = 0; i < n; i++) {
			const e = es[i];
			e.vel.x += accX[i] * dt;
			e.vel.y += accY[i] * dt;

			// 상한만 건다. 하한이 없어야 급선회에서 속도가 죽고 — 그 순간 선이 점으로 돌아간다.
			const s = Math.hypot(e.vel.x, e.vel.y);
			if (s > maxV) {
				const k = maxV / s;
				e.vel.x *= k;
				e.vel.y *= k;
			}

			e.pos.x += e.vel.x * dt;
			e.pos.y += e.vel.y * dt;
			// 토러스: 나간 쪽으로 다시 들어온다 → 경계가 없으니 흐름이 정상 상태로 유지된다
			e.pos.x = ((e.pos.x % W) + W) % W;
			e.pos.y = ((e.pos.y % H) + H) % H;
		}
	}
};
