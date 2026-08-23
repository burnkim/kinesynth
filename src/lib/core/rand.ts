/**
 * Kinesynth · 시드 고정 난수 (mulberry32)
 *
 * 원리: 32비트 정수 상태를 곱셈·시프트로 섞어 균일 난수를 만드는 결정론적 PRNG.
 * 같은 시드 = 같은 움직임. 재현·아카이브·강의 시연의 전제 조건이다 (PRD §4).
 *
 * 순수 TS. DOM·Math.random 사용 금지.
 */

export type Rng = () => number;

/** 시드 하나에서 [0,1) 난수 스트림을 만든다. */
export function mulberry32(seed: number): Rng {
	let a = seed >>> 0;
	return function next(): number {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** 문자열 시드("bird" 같은 것)를 32비트 정수로 — 강의에서 학생이 이름을 넣을 수 있게. */
export function hashSeed(input: string): number {
	let h = 2166136261 >>> 0;
	for (let i = 0; i < input.length; i++) {
		h ^= input.charCodeAt(i);
		h = Math.imul(h, 16777619) >>> 0;
	}
	return h >>> 0;
}

/** 숫자면 그대로, 아니면 해시. 뷰어의 시드 입력창이 둘 다 받도록. */
export function toSeed(input: string | number): number {
	if (typeof input === 'number') return input >>> 0;
	const trimmed = input.trim();
	if (trimmed !== '' && /^\d+$/.test(trimmed)) return Number(trimmed) >>> 0;
	return hashSeed(trimmed);
}

/** [min,max) 균일 실수 */
export function range(rng: Rng, min: number, max: number): number {
	return min + rng() * (max - min);
}
