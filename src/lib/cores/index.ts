/**
 * Kinesynth · 코어 레지스트리
 *
 * 코어를 하나 만들면 여기에 등록한다. 이 배열이 **단일 소스**다:
 *   · `src/lib/meta/cores.json` — `pnpm gen:meta`가 여기서 생성한다 (손으로 고치지 않는다)
 *   · `pnpm check:cores` — 여기 있는 코어를 전부 검사한다 (W4 학생 기여 게이트)
 *
 * 순수 TS. DOM import 금지.
 */

import type { Core } from '../core/types';
import { lissajous } from './lissajous';
import { bounce } from './bounce';
import { squash } from './squash';
import { boids } from './boids';
import { elastic } from './elastic';
import { spring } from './spring';
import { dla } from './dla';
import { fractalZoom } from './fractalZoom';
import { noiseField } from './noiseField';
import { fourier } from './fourier';
import { orbit } from './orbit';
import { flee } from './flee';
import { seek } from './seek';
import { panic } from './panic';

export const cores: Core[] = [
	lissajous,
	bounce,
	squash,
	boids,
	elastic,
	spring,
	dla,
	fractalZoom,
	noiseField,
	fourier,
	orbit,
	flee,
	seek,
	panic
];

export const coreById = (id: string): Core | undefined => cores.find((c) => c.meta.id === id);

export { lissajous, bounce, squash, boids, elastic, spring, dla, fractalZoom, noiseField, fourier, orbit, flee, seek, panic };
