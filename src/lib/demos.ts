/**
 * Kinesynth · 데모 프리셋 — 코어 스택의 목록
 *
 * 합성 = 코어를 겹치는 것 + **어디에 걸지**. 프리셋은 그 선언일 뿐이고,
 * 실행 순서·표기법 문자열은 엔진이 레벨 순으로 알아서 만든다 (PRD §4, §5).
 * 대상을 안 적으면 '*' (전체) — v0.1 데모들이 그대로 도는 이유다.
 *
 * 순수 TS. DOM import 금지.
 */

import type { Core, Params, Patch } from './core/types';
import { lissajous } from './cores/lissajous';
import { bounce } from './cores/bounce';
import { squash } from './cores/squash';
import { boids } from './cores/boids';
import { elastic } from './cores/elastic';
import { spring } from './cores/spring';
import { dla } from './cores/dla';
import { fractalZoom } from './cores/fractalZoom';
import { noiseField } from './cores/noiseField';
import { fourier } from './cores/fourier';
import { orbit } from './cores/orbit';
import { flee } from './cores/flee';
import { seek } from './cores/seek';
import { panic } from './cores/panic';
import { life } from './cores/life';
import { pop } from './cores/pop';

export interface Demo {
	id: string;
	title: string;
	/** 점·선·면 중 무엇으로 읽히는가 — 강의 화면용 한 줄 */
	form: string;
	/** 코어만 적으면 대상은 '*'. 갈라 걸려면 { core, target, anchor }로 적는다. */
	patch: (Core | Patch)[];
	/** 패치 key → 이 프리셋에서만 바꿀 기본값. 같은 코어를 두 번 걸면 key가 `id@대상`이 된다. */
	overrides?: Record<string, Params>;
	trail: boolean;
	/** 일부러 소유 규칙을 어긴 예시 — 경고가 어떻게 생기는지 보여 주려고 둔다 (강의 W4). */
	conflict?: true;
	/**
	 * `demo` = 원리 하나를 보여 주는 최소 조합 (기본).
	 * `scene` = 코어들이 합쳐져 **맥락이 읽히는** 장면. 무엇이 왜 그러는지가 그림에서 유추된다.
	 */
	kind?: 'scene';
	/** 궤적 기록 길이(고정 스텝 수). 60 = 1초. */
	trailLen: number;
	/** 처음부터 켜 둘 「신호 보기」 채널 (sig. 접두사 없이). 없으면 끔. */
	signal?: string;
	seed: number;
}

export const demos: Demo[] = [
	{
		id: 'lissajous',
		title: 'Lissajous',
		form: '점 — 트레일을 켜면 선이 된다',
		patch: [lissajous],
		trail: true,
		trailLen: 420, // 7초 — speed 0.16의 한 바퀴(6.25s)가 다 남는다
		seed: 1
	},
	{
		id: 'bounce-squash',
		title: 'Bounce + Squash',
		form: '면 — 12각 폐곡선. exa로 사실↔만화를 넘나든다',
		patch: [bounce, squash],
		trail: false,
		trailLen: 90,
		seed: 1
	},
	{
		id: 'boids-elastic',
		title: 'Boids + Elastic',
		form: '점이 늘어나 선이 되는 새떼 — exa를 0으로 내리면 다시 점이 된다',
		patch: [boids, elastic],
		trail: false,
		trailLen: 24,
		seed: 7
	},
	{
		id: 'lissajous-spring',
		title: 'Lissajous + Spring',
		form: '선 — 꼬리가 몸의 궤적을 벗어났다가 돌아온다. exa 0이면 궤적을 그대로 따라간다',
		patch: [lissajous, spring],
		// 트레일이 몸이 지나간 길이고, 꼬리가 거기서 얼마나 벗어나는지가 팔로우스루다.
		overrides: { lissajous: { speed: 0.09 } },
		trail: true,
		trailLen: 100,
		seed: 1
	},
	{
		id: 'bounce-tail',
		title: 'Bounce + Squash + Spring',
		form: '면 + 선 — 공이 바닥을 치고 멈추는 순간 꼬리가 계속 간다 (팔로우스루 교과서)',
		// points는 단독 소유다. 공의 12각형과 꼬리의 체인을 한 엔티티에 겹칠 수 없어서
		// 라우팅으로 갈라 건다: 몸은 [ball], 꼬리는 [tail]이고 뿌리를 ball에 건다.
		patch: [
			{ core: bounce, target: 'ball' },
			{ core: squash, target: 'ball' },
			{ core: spring, target: 'tail', anchor: 'ball' }
		],
		overrides: {
			bounce: { r: 40, drift: 90, e: 0.78 },
			spring: { n: 14, len: 13, ay: -40, freq: 3.0 }
		},
		trail: false,
		trailLen: 90,
		seed: 1
	},
	{
		id: 'noise-flock',
		title: 'NoiseField + Boids',
		form: '흐름장 위의 새떼 — 바람이 vel에 더해지고(add) 무리 규칙이 그 위에 얹힌다',
		patch: [noiseField, boids, elastic],
		overrides: {
			boids: { n: 220, speed: 150, coh: 1.3, ali: 0.9 },
			noiseField: { force: 380, scale: 0.003 },
			elastic: { vmax: 130 }
		},
		trail: true,
		trailLen: 34,
		seed: 5
	},
	{
		id: 'fourier',
		title: 'Fourier Epicycles',
		form: '선 — 원 위의 원이 그리는 글자. 항 수를 줄이면 모서리부터 뭉개진다',
		patch: [fourier],
		trail: true,
		trailLen: 900,
		seed: 1
	},
	{
		id: 'orbit',
		title: 'Orbit · 자전 + 공전',
		form: '해 · 행성 · 달 — 한 코어를 세 번 걸었다. 달은 조석 고정(자전 1회/공전)',
		// 같은 코어를 세 번 건다. 파라미터는 패치 key(id@대상)로 갈린다.
		patch: [
			{ core: orbit, target: 'sun' },
			{ core: orbit, target: 'planet' },
			{ core: orbit, target: 'moon', anchor: 'planet' }
		],
		overrides: {
			'orbit@sun': { radius: 0, rev: 0.05, spin: 2.5, r: 34 },
			'orbit@planet': { radius: 0.62, rev: 0.05, spin: 7, r: 22, phase: 0.12 },
			'orbit@moon': { radius: 0.17, rev: 0.32, spin: 1, r: 11 }
		},
		trail: true,
		trailLen: 1300,
		seed: 1
	},
	{
		id: 'wind-bounce',
		title: '⚠ 충돌 예시 · NoiseField + Bounce',
		form: 'Bounce가 vel을 set해서 흐름장이 더해 준 속도를 매 프레임 지운다 — 공이 바람에 안 밀린다',
		patch: [noiseField, bounce],
		conflict: true,
		trail: true,
		trailLen: 120,
		seed: 1
	},
	{
		id: 'dla',
		title: 'DLA · 결정 성장',
		form: '점이 붙어 면이 되는 과정 — 채워지지 않고 가지가 된다',
		patch: [dla],
		trail: false,
		trailLen: 30,
		seed: 3
	},
	{
		id: 'panic-wave',
		form: '겁이 옆으로 번진다 — 색이 밝을수록 겁먹은 것. 위협을 본 새는 몇 마리뿐이다',
		title: 'Flee + Panic · 공포의 전파',
		// 포식자는 Seek으로 몬다 — 반드시 무리를 만나야 전파를 볼 수 있다.
		// 무리는 뭉쳐 있어야 파동이 가로지르는 게 보인다.
		patch: [
			{ core: flee, target: 'bird', anchor: 'hunter' },
			{ core: panic, target: 'bird' },
			{ core: boids, target: 'bird' },
			{ core: seek, target: 'hunter', anchor: 'bird' },
			{ core: elastic, target: 'bird' }
		],
		overrides: {
			boids: { n: 200, radius: 130, sep: 2.2, ali: 1.5, coh: 1.3, speed: 150 },
			flee: { radius: 110, force: 1500, sharp: 2 },
			panic: { radius: 95, gain: 0.9, rise: 16, tau: 1.1, urge: 6 },
			seek: { speed: 240, turn: 1.4, lead: 0.4, r: 13 },
			elastic: { vmax: 130, kmax: 7 }
		},
		signal: 'panic',
		trail: false,
		trailLen: 30,
		seed: 4
	},
	{
		id: 'life',
		title: 'Life + Pop · 라이프 게임',
		form: '격자의 창발 — 규칙은 넷뿐인데 활공체가 생긴다. exa를 0으로 내리면 그냥 깜빡인다',
		patch: [life, pop],
		overrides: {
			life: { cell: 24, period: 0.3, density: 0.33, grow: 0.2, fade: 0.26 },
			pop: { exa: 1.8, breath: 0.06, rate: 0.35 }
		},
		trail: false,
		trailLen: 20,
		seed: 12
	},
	{
		id: 'scene-murmuration',
		title: '바람 속 군무',
		kind: 'scene',
		form: '흐름장이 무리를 휘고, 무리는 제 규칙으로 다시 모인다 — 겨울 저녁의 찌르레기',
		patch: [noiseField, boids, elastic],
		overrides: {
			boids: { n: 380, radius: 96, sep: 2.1, ali: 1.35, coh: 1.5, speed: 138 },
			noiseField: { force: 300, scale: 0.0025, turns: 1.3, drift: 0.07, oct: 3 },
			elastic: { vmax: 120, kmax: 7 }
		},
		trail: true,
		trailLen: 46,
		seed: 5
	},
	{
		id: 'scene-hunt',
		title: '포식자 산개',
		kind: 'scene',
		form: '매가 지나간 자리에 구멍이 열리고, 지나가면 다시 메워진다',
		// 무리와 포식자를 라우팅으로 갈라 건다. Elastic을 [bird]에만 거는 것도 필요해서다 —
		// 전체에 걸면 Orbit(rot set)과 Elastic(rot set)이 포식자에서 부딪힌다.
		patch: [
			{ core: flee, target: 'bird', anchor: 'hunter' },
			{ core: boids, target: 'bird' },
			{ core: orbit, target: 'hunter' },
			{ core: elastic, target: 'bird' }
		],
		overrides: {
			boids: { n: 300, radius: 92, sep: 2.0, ali: 1.2, coh: 1.6, speed: 150 },
			// 포식자는 새보다 빨라야 한다 — 느리면 무리가 궤도 전체를 비워 버려서
			// '지나갔다 메워진다'가 아니라 '영역을 피한다'가 된다 (새 150px/s < 매 232px/s)
			flee: { radius: 150, force: 1700, sharp: 2 },
			orbit: { radius: 0.42, rev: 0.28, spin: 1, r: 26 },
			elastic: { vmax: 130, kmax: 7 }
		},
		trail: true,
		trailLen: 40,
		seed: 11
	},
	{
		id: 'scene-chase',
		title: '사냥',
		kind: 'scene',
		form: '매가 무리를 쫓는다 — 앞질러 가고, 급선회에 놓치고, 다시 붙는다',
		// Seek의 앵커는 **그룹**이다. 지금까지 앵커는 하나였는데(체인의 뿌리, 공전의 중심),
		// 무리를 쫓으려면 무리 전체를 봐야 해서 ctx.anchors가 생겼다.
		// 전파를 얹어도 사냥의 리듬은 그대로다 (시도 3회로 동일).
		// 달라지는 건 무리가 반응하는 방식이다 — 위협을 본 몇 마리가 전체를 움직인다.
		patch: [
			{ core: flee, target: 'bird', anchor: 'hunter' },
			{ core: panic, target: 'bird' },
			{ core: boids, target: 'bird' },
			{ core: seek, target: 'hunter', anchor: 'bird' },
			{ core: elastic, target: 'bird' }
		],
		overrides: {
			// 무리가 뭉쳐 있어야 '놓친다'가 성립한다 — 넓게 퍼져 있으면 늘 누군가가 가까워서
			// 포식자가 영영 붙어 있고, 시도의 리듬이 사라진다
			boids: { n: 150, radius: 110, sep: 2.3, ali: 1.15, coh: 2.2, speed: 155 },
			flee: { radius: 165, force: 1900, sharp: 2 },
			panic: { radius: 100, gain: 0.88, rise: 16, tau: 0.9, urge: 6 },
			seek: { speed: 245, turn: 1.5, lead: 0.45, r: 13 },
			elastic: { vmax: 135, kmax: 7 }
		},
		trail: true,
		trailLen: 44,
		seed: 3
	},
	{
		id: 'dla-zoom',
		title: 'DLA + Fractal Zoom',
		form: '자기유사 — 한 옥타브 들어가도 가지의 모양이 같다',
		patch: [dla, fractalZoom],
		overrides: {
			dla: { cell: 4, n: 1100, walkers: 110 },
			fractalZoom: { rate: 0.09, base: 2, fx: 0.5, fy: 0.5 }
		},
		trail: false,
		trailLen: 30,
		seed: 3
	}
];

export const demoById = (id: string): Demo => demos.find((d) => d.id === id) ?? demos[0];

export const principles = demos.filter((d) => d.kind !== 'scene');
export const scenes = demos.filter((d) => d.kind === 'scene');
