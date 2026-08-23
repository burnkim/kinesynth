/**
 * Spring Chain · 스프링 체인 = 팔로우스루
 *
 * 원리: 몸에 매달린 것은 몸이 멈춰도 계속 간다. 스프링-감쇠로 이어진 마디들은
 *       목표를 **지나쳤다가 되돌아오며** 잦아든다. 애니메이션 12원칙의
 *       팔로우스루·오버래핑 액션은 이 감쇠 진동의 다른 이름이다.
 * 표기법: Spring(chain)@deform
 *
 * 과장(exa)은 진동수가 아니라 **감쇠비 ζ**를 낮춘다:
 *   ζ = damp / exa (최대 1). exa 0 → ζ 1, 지나침 없이 몸의 궤적을 그대로 따라간다 = 팔로우스루 없음.
 *   exa 1.8 → ζ=0.25, 궤적에서 벗어난다. exa 3 → ζ=0.15, 크게 휘둘렸다가 돌아온다.
 *
 * 마디는 엔티티의 로컬 지오메트리(points)에 그대로 산다 — 그래서 '선'으로 그려진다.
 * points를 쓰는 다른 코어(Bounce의 12각형)와는 같이 못 쓴다: 개체별 라우팅은 v0.2.
 *
 * 순수 TS. DOM import 금지.
 */

import type { Core, Entity, ParamDef, Params, World } from '../core/types';

const MAX_CDT = 1.9; // c·dt가 2를 넘으면 명시적 적분이 발산한다
const MAX_STRETCH = 1.5; // 마디 길이 상한 (배). 스프링만으로는 머리가 빠를 때 한없이 늘어난다.
const MIN_SQUEEZE = 0.55; // 마디 길이 하한 (배). 방향이 뒤집힐 때 마디가 서로 겹쳐 버리는 걸 막는다.

/**
 * 마디 속도는 프레임을 넘어 남아야 하는데 Entity 채널에는 배열이 없다.
 * 엔티티에 붙여 둔다 — 엔티티가 사라지면 같이 사라진다. (채널 모델 확장은 v0.2 과제)
 */
const nodeVel = new WeakMap<Entity, Float64Array>();

/** 마디를 뒤쪽으로 일자로 눕혀 초기화한다. */
function layout(e: Entity, n: number, len: number): Float64Array {
	e.points = [];
	for (let i = 0; i < n; i++) e.points.push({ x: -i * len, y: 0 });
	const v = new Float64Array(n * 2);
	nodeVel.set(e, v);
	return v;
}

const params: ParamDef[] = [
	{ key: 'n', label: '마디 수', min: 2, max: 24, value: 16, step: 1 },
	{ key: 'len', label: '마디 길이', min: 2, max: 40, value: 16, step: 1 },
	{ key: 'freq', label: '고유 진동수 (Hz)', min: 0.5, max: 8, value: 3.4, step: 0.1 },
	{ key: 'damp', label: '감쇠 기준', min: 0.1, max: 1.5, value: 0.45, step: 0.01 },
	{ key: 'exa', label: 'exa · 과장 계수', min: 0, max: 3, value: 1.8, step: 0.05 }
];

export const spring: Core = {
	meta: {
		id: 'spring',
		name: 'Spring Chain',
		domain: 'physics',
		level: 'deform',
		repeat: 'event',
		principle: '몸이 멈춰도 꼬리는 계속 간다 — 지나쳤다가 되돌아온다.',
		notation: 'Spring(chain)@deform',
		reads: ['vel'],
		writes: [
			{ channel: 'points', mode: 'set' },
			{ channel: 'closed', mode: 'set' }
		]
	},

	params,

	step(w: World, p: Params, dt: number) {
		const n = Math.max(2, Math.round(p.n));
		const om = 2 * Math.PI * p.freq; // 고유 각진동수
		const zeta = Math.min(p.damp / Math.max(p.exa, 1e-3), 1); // 과장이 클수록 덜 잦아든다
		const k = om * om;
		const c = Math.min(2 * om * zeta, MAX_CDT / dt);

		for (const e of w.entities) {
			let v = nodeVel.get(e);
			if (!v || e.points.length !== n || v.length !== n * 2) v = layout(e, n, p.len);
			e.closed = false;

			// 엔티티가 이번 스텝에 움직인 만큼을 로컬에서 빼 준다 → 마디는 월드에 남는다.
			const cs = Math.cos(-e.rot);
			const sn = Math.sin(-e.rot);
			const wx = e.vel.x * dt;
			const wy = e.vel.y * dt;
			const mx = (wx * cs - wy * sn) / (e.scale.x || 1);
			const my = (wx * sn + wy * cs) / (e.scale.y || 1);

			const pts = e.points;
			pts[0].x = 0; // 머리는 엔티티에 붙어 있다
			pts[0].y = 0;

			for (let i = 1; i < n; i++) {
				const a = pts[i];
				const b = pts[i - 1];
				a.x -= mx;
				a.y -= my;

				const dx = a.x - b.x;
				const dy = a.y - b.y;
				const d = Math.hypot(dx, dy) || 1e-6;
				const stretch = d - p.len;

				// 스프링: 늘어난 만큼 되돌린다 · 감쇠: 속도에 비례해 반대로
				const ax = (-k * stretch * dx) / d - c * v[i * 2];
				const ay = (-k * stretch * dy) / d - c * v[i * 2 + 1];

				v[i * 2] += ax * dt;
				v[i * 2 + 1] += ay * dt;
				a.x += v[i * 2] * dt;
				a.y += v[i * 2 + 1] * dt;

				// 길이 제약 — 채찍이 끊기지 않게 붙들어 둔다.
				// 잘라낸 만큼의 바깥 방향 속도는 버린다 (제약이 에너지를 주입하지 않도록).
				const ex = a.x - b.x;
				const ey = a.y - b.y;
				const ed = Math.hypot(ex, ey) || 1e-6;
				const hi = p.len * MAX_STRETCH;
				const lo = p.len * MIN_SQUEEZE;
				if (ed > hi || ed < lo) {
					const fix = ed > hi ? hi : lo;
					const ux = ex / ed;
					const uy = ey / ed;
					a.x = b.x + ux * fix;
					a.y = b.y + uy * fix;
					const vn = v[i * 2] * ux + v[i * 2 + 1] * uy;
					if (ed > hi ? vn > 0 : vn < 0) {
						v[i * 2] -= vn * ux;
						v[i * 2 + 1] -= vn * uy;
					}
				}
			}
		}
	}
};
