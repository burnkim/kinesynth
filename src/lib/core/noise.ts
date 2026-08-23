/**
 * Kinesynth · 펄린 노이즈 2D
 *
 * 원리: 격자점마다 무작위 '경사'를 하나씩 두고, 그 사이를 부드러운 곡선(fade)으로 잇는다.
 *       난수는 격자에만 있고 그 사이는 보간이라, 결과는 **무작위인데 매끄럽다**.
 *       자연의 결(구름·연기·지형)이 대개 이 성질을 가진다.
 *
 * 시드 고정 — 같은 난수열이면 같은 필드. 외부 의존성 0.
 * 순수 TS. DOM import 금지.
 */

import type { Rng } from './rand';

/** (x, y) → 대략 [-1, 1] */
export type Noise2 = (x: number, y: number) => number;

const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** 8방향 경사와의 내적 — 곱셈 없이 부호만 뒤집어 계산한다. */
function grad(h: number, x: number, y: number): number {
	switch (h & 7) {
		case 0:
			return x + y;
		case 1:
			return -x + y;
		case 2:
			return x - y;
		case 3:
			return -x - y;
		case 4:
			return x;
		case 5:
			return -x;
		case 6:
			return y;
		default:
			return -y;
	}
}

/** 시드 난수로 순열표를 섞어 노이즈 함수를 만든다. */
export function perlin2(rng: Rng): Noise2 {
	const perm = new Uint8Array(256);
	for (let i = 0; i < 256; i++) perm[i] = i;
	for (let i = 255; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		const t = perm[i];
		perm[i] = perm[j];
		perm[j] = t;
	}
	const p = new Uint16Array(512);
	for (let i = 0; i < 512; i++) p[i] = perm[i & 255];

	return (x, y) => {
		const fx = Math.floor(x);
		const fy = Math.floor(y);
		const xi = fx & 255;
		const yi = fy & 255;
		const xf = x - fx;
		const yf = y - fy;
		const u = fade(xf);
		const v = fade(yf);
		const aa = p[p[xi] + yi];
		const ab = p[p[xi] + yi + 1];
		const ba = p[p[xi + 1] + yi];
		const bb = p[p[xi + 1] + yi + 1];
		return lerp(
			lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u),
			lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u),
			v
		);
	};
}

/** 옥타브를 겹친다 — 큰 결 위에 작은 결. 진폭 합으로 정규화해 대략 [-1, 1]을 지킨다. */
export function fbm2(n: Noise2, x: number, y: number, octaves: number): number {
	let sum = 0;
	let amp = 1;
	let freq = 1;
	let norm = 0;
	for (let i = 0; i < octaves; i++) {
		sum += n(x * freq, y * freq) * amp;
		norm += amp;
		amp *= 0.5;
		freq *= 2;
	}
	return norm > 0 ? sum / norm : 0;
}
