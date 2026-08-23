/**
 * Kinesynth · 토러스 공간
 *
 * 세계에는 벽이 없다. 오른쪽으로 나가면 왼쪽으로 들어온다 —
 * 그래야 군집의 흐름이 경계에서 끊기지 않고 정상 상태(steady)로 유지된다.
 *
 * 그 세계에서 "가깝다"는 화면 위의 거리가 아니라 **이음매를 넘는 최단 거리**다.
 * 이걸 안 지키면 이음매 바로 건너편의 이웃이 남남이 되고, 거기에 가짜 경계가 생긴다.
 *
 * 순수 TS. DOM import 금지.
 */

/** 토러스 최단 변위 — 화면 반대편으로 도는 게 짧으면 그쪽을 준다. */
export function wrapDelta(d: number, size: number): number {
	if (d > size * 0.5) return d - size;
	if (d < -size * 0.5) return d + size;
	return d;
}

/** 좌표를 [0, size)로 되돌린다. 음수도 안전하다. */
export function wrapCoord(v: number, size: number): number {
	return ((v % size) + size) % size;
}
