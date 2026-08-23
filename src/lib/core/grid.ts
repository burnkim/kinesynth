/**
 * Kinesynth · 이웃 격자
 *
 * 원리: "누가 가까운가"를 전부 대 보지 않고 **칸으로 나눠** 답한다.
 *       반경 r 안의 이웃은 자기 칸과 이웃 칸에만 있다. 개체가 n개면 전수 비교는 n²,
 *       격자는 n에 비례한다 — 무리가 커질수록 차이가 벌어진다.
 *
 * 격자는 **스텝이 시작할 때의 위치**를 담는다. flock 코어들은 관례상 읽기 단계와
 * 쓰기 단계가 갈려 있어서(가속도를 스크래치에 모았다가 나중에 적분) 안전하다 —
 * 위치를 옮긴 뒤 다시 질의하려면 그 코어가 직접 다시 만들어야 한다.
 *
 * 같은 배열·같은 스텝이면 이미 만든 격자를 그대로 준다. 라우팅 캐시가 셀렉터별로
 * 하나이므로 `[bird]`를 보는 패치들은 **같은 배열**을 받고, 따라서 Boids와 Panic이
 * 격자 하나를 나눠 쓴다.
 *
 * 세계는 토러스다 — 이음매 건너편 칸도 이웃이다.
 *
 * 순수 TS. DOM import 금지.
 */

import type { Entity, World } from './types';

export interface Grid {
	/** 칸 크기. 질의 반경이 이보다 크면 더 넓은 고리를 훑는다. */
	readonly cell: number;
	/**
	 * (x, y)에서 반경 r 안에 **있을 수 있는** 후보의 인덱스를 out에 채우고 개수를 돌려준다.
	 * 정확한 거리 검사는 호출자의 몫이다 — 격자는 후보를 줄여 줄 뿐이다.
	 *
	 * 후보는 **오름차순**으로 돌려준다. 전수 비교와 같은 순서로 더하기 위해서다 —
	 * 부동소수 덧셈은 결합법칙이 성립하지 않아 순서가 바뀌면 결과가 갈리고,
	 * 그러면 아카이브 링크(`?t=`)가 가리키던 그림이 달라진다.
	 * 격자는 빠르게 하는 장치지 결과를 바꾸는 장치가 아니다.
	 */
	near(x: number, y: number, r: number, out: Int32Array): number;
}

interface Store {
	t: number;
	cell: number;
	w: number;
	h: number;
	n: number;
	cols: number;
	rows: number;
	start: Int32Array; // 칸별 시작 위치 (누적합). 길이 cols*rows + 1
	items: Int32Array; // 칸 순으로 정렬된 엔티티 인덱스
	grid: Grid;
}

/** 목록(배열 정체성)마다 하나. rev가 바뀌면 배열도 새로 생기므로 캐시가 저절로 무효화된다. */
const stores = new WeakMap<Entity[], Store>();

// 질의용 스크래치 — 훑을 칸들의 구간 [lo, hi). 스텝마다 재할당하지 않는다.
let runLo = new Int32Array(64);
let runHi = new Int32Array(64);

function build(s: Store, list: Entity[], w: World, cell: number): void {
	const W = w.bounds.w;
	const H = w.bounds.h;
	const n = list.length;
	const cols = Math.max(1, Math.floor(W / cell));
	const rows = Math.max(1, Math.floor(H / cell));
	const cw = W / cols; // 칸을 세계에 딱 맞춰 나눈다 — 이음매에서 어긋나지 않게
	const ch = H / rows;
	const cells = cols * rows;

	if (s.start.length !== cells + 1) s.start = new Int32Array(cells + 1);
	else s.start.fill(0);
	if (s.items.length < n) s.items = new Int32Array(n);

	// 1) 칸마다 몇 개인지 센다 → 2) 누적합 → 3) 제자리에 뿌린다. 칸별 배열을 만들지 않는다.
	const at = (e: Entity) => {
		const cx = Math.min(cols - 1, Math.max(0, Math.floor(e.pos.x / cw)));
		const cy = Math.min(rows - 1, Math.max(0, Math.floor(e.pos.y / ch)));
		return cy * cols + cx;
	};
	for (let i = 0; i < n; i++) s.start[at(list[i]) + 1]++;
	for (let c = 0; c < cells; c++) s.start[c + 1] += s.start[c];
	const cursor = new Int32Array(cells);
	for (let i = 0; i < n; i++) {
		const c = at(list[i]);
		s.items[s.start[c] + cursor[c]++] = i;
	}

	s.t = w.t;
	s.cell = cell;
	s.w = W;
	s.h = H;
	s.n = n;
	s.cols = cols;
	s.rows = rows;
}

function makeGrid(s: Store): Grid {
	return {
		get cell() {
			return s.cell;
		},
		near(x, y, r, out) {
			const cw = s.w / s.cols;
			const ch = s.h / s.rows;
			const cx = Math.min(s.cols - 1, Math.max(0, Math.floor(x / cw)));
			const cy = Math.min(s.rows - 1, Math.max(0, Math.floor(y / ch)));
			const R = Math.max(1, Math.ceil(r / Math.min(cw, ch)));
			// 고리가 세계보다 넓으면 같은 칸을 두 번 세지 않도록 한 바퀴로 자른다
			const spanX = Math.min(2 * R + 1, s.cols);
			const spanY = Math.min(2 * R + 1, s.rows);

			// 훑을 칸들의 구간을 모은다. 빈 칸은 버린다.
			const need = spanX * spanY;
			if (runLo.length < need) {
				runLo = new Int32Array(need);
				runHi = new Int32Array(need);
			}
			let runs = 0;
			for (let oy = 0; oy < spanY; oy++) {
				const gy = (((cy - R + oy) % s.rows) + s.rows) % s.rows; // 토러스: 이음매를 넘는다
				const row = gy * s.cols;
				for (let ox = 0; ox < spanX; ox++) {
					const gx = (((cx - R + ox) % s.cols) + s.cols) % s.cols;
					const c = row + gx;
					const lo = s.start[c];
					const hi = s.start[c + 1];
					if (lo === hi) continue;
					runLo[runs] = lo;
					runHi[runs] = hi;
					runs++;
				}
			}

			// 칸 안은 이미 오름차순이다 → 구간들을 **병합**해 인덱스 순으로 뽑는다.
			// (모아서 정렬하면 후보가 수십 개일 때 그 비용이 아낀 것보다 커진다.)
			const items = s.items;
			const cap = out.length;
			let k = 0;
			while (runs > 1 && k < cap) {
				let pick = 0;
				let best = items[runLo[0]];
				for (let m = 1; m < runs; m++) {
					const v = items[runLo[m]];
					if (v < best) {
						best = v;
						pick = m;
					}
				}
				out[k++] = best;
				if (++runLo[pick] >= runHi[pick]) {
					runs--;
					runLo[pick] = runLo[runs]; // 다 쓴 구간을 마지막 것으로 덮는다
					runHi[pick] = runHi[runs];
				}
			}
			// 하나만 남으면 이미 오름차순이라 그대로 쏟는다
			if (runs === 1) {
				let p = runLo[0];
				const end = runHi[0];
				while (p < end && k < cap) out[k++] = items[p++];
			}
			return k;
		}
	};
}

/**
 * 목록의 이웃 격자. 같은 배열·같은 스텝이면 이미 만든 것을 그대로 준다.
 * 칸 크기는 그 목록에 요청된 **가장 큰 반경**으로 잡고 줄이지 않는다 —
 * 반경이 다른 코어 둘이 매 스텝 번갈아 다시 만드는 걸 막는다.
 */
export function neighborGrid(w: World, list: Entity[], radius: number): Grid {
	let s = stores.get(list);
	if (!s) {
		s = {
			t: -1,
			cell: 0,
			w: 0,
			h: 0,
			n: -1,
			cols: 0,
			rows: 0,
			start: new Int32Array(1),
			items: new Int32Array(0),
			grid: null as unknown as Grid
		};
		s.grid = makeGrid(s);
		stores.set(list, s);
	}
	const cell = Math.max(radius, s.cell);
	if (s.t !== w.t || s.cell !== cell || s.n !== list.length || s.w !== w.bounds.w || s.h !== w.bounds.h) {
		build(s, list, w, cell);
	}
	return s.grid;
}
