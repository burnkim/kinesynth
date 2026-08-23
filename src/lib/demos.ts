/**
 * Kinesynth · 데모 프리셋 — 코어 스택의 목록
 *
 * 합성 = 코어를 겹치는 것. 프리셋은 "어떤 코어를 어떤 순서로 쌓았나"의 선언일 뿐이고,
 * 실행 순서·표기법 문자열은 엔진이 레벨 순으로 알아서 만든다 (PRD §4, §5).
 *
 * 순수 TS. DOM import 금지.
 */

import type { Core, Params } from './core/types';
import { lissajous } from './cores/lissajous';
import { bounce } from './cores/bounce';
import { squash } from './cores/squash';
import { boids } from './cores/boids';
import { elastic } from './cores/elastic';

export interface Demo {
	id: string;
	title: string;
	/** 점·선·면 중 무엇으로 읽히는가 — 강의 화면용 한 줄 */
	form: string;
	cores: Core[];
	/** coreId → 이 프리셋에서만 바꿀 기본값 */
	overrides?: Record<string, Params>;
	trail: boolean;
	/** 궤적 기록 길이(고정 스텝 수). 60 = 1초. */
	trailLen: number;
	seed: number;
}

export const demos: Demo[] = [
	{
		id: 'lissajous',
		title: 'Lissajous',
		form: '점 — 트레일을 켜면 선이 된다',
		cores: [lissajous],
		trail: true,
		trailLen: 420, // 7초 — speed 0.16의 한 바퀴(6.25s)가 다 남는다
		seed: 1
	},
	{
		id: 'bounce-squash',
		title: 'Bounce + Squash',
		form: '면 — 12각 폐곡선. exa로 사실↔만화를 넘나든다',
		cores: [bounce, squash],
		trail: false,
		trailLen: 90,
		seed: 1
	},
	{
		id: 'boids-elastic',
		title: 'Boids + Elastic',
		form: '점이 늘어나 선이 되는 새떼 — exa를 0으로 내리면 다시 점이 된다',
		cores: [boids, elastic],
		trail: false,
		trailLen: 24,
		seed: 7
	}
];

export const demoById = (id: string): Demo => demos.find((d) => d.id === id) ?? demos[0];
