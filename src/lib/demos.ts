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

export interface Demo {
	id: string;
	title: string;
	/** 점·선·면 중 무엇으로 읽히는가 — 강의 화면용 한 줄 */
	form: string;
	/** 코어만 적으면 대상은 '*'. 갈라 걸려면 { core, target, anchor }로 적는다. */
	patch: (Core | Patch)[];
	/** coreId → 이 프리셋에서만 바꿀 기본값 */
	overrides?: Record<string, Params>;
	trail: boolean;
	/** 일부러 소유 규칙을 어긴 예시 — 경고가 어떻게 생기는지 보여 주려고 둔다 (강의 W4). */
	conflict?: true;
	/** 궤적 기록 길이(고정 스텝 수). 60 = 1초. */
	trailLen: number;
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
