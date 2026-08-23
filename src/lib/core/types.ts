/**
 * Kinesynth · 코어 타입 정의
 *
 * 순수성 규칙 (PRD §8): 이 파일과 src/lib/core, src/lib/cores 아래 모든 파일은
 * **순수 TypeScript**다. DOM·Svelte·브라우저 API를 import 하지 않는다.
 * 외부 런타임 의존성 0. 추후 독립 패키지로 추출할 수 있어야 한다.
 *
 * 세계(World)는 엔티티의 집합, 엔티티는 채널을 가진다.
 * 코어는 채널을 읽고 쓰는 최소 규칙 — 신시사이저의 오실레이터·필터에 대응한다.
 */

export type Vec = { x: number; y: number };

/** 점·선·면을 하나의 구조로 표현한다. points 1개 = 점, closed=false = 선, closed=true = 면. */
export interface Entity {
	pos: Vec; // 월드 좌표
	vel: Vec; // 속도 (px/s)
	scale: Vec; // 로컬 지오메트리 배율
	rot: number; // 회전 (rad)
	points: Vec[]; // 로컬 지오메트리 (엔티티 좌표계)
	closed: boolean; // 열림 = 선, 닫힘 = 면
	/**
	 * 이벤트 신호 채널. `event` 반복 유형의 코어가 사건을 알리고 다른 코어가 읽는다.
	 * 신스의 트리거/엔벨로프에 대응. v0에서는 'impact'(접지 충격량) 하나를 쓴다.
	 * 신호를 쓴 코어가 감쇠까지 책임진다 (소유권).
	 */
	sig: Record<string, number>;
}

export interface Bounds {
	w: number;
	h: number;
}

/** 코어가 공유하는 상태 공간. 코어 스택은 이 World 하나를 순서대로 변형한다. */
export interface World {
	entities: Entity[];
	t: number; // 누적 시간 (s)
	bounds: Bounds; // 공간 크기 — 지면·랩어라운드 기준
	rand(): number; // 시드 고정 난수 [0,1)
}

/** 뷰어가 슬라이더를 자동 생성하는 근거. */
export interface ParamDef {
	key: string;
	label: string;
	min: number;
	max: number;
	value: number; // 기본값
	step?: number;
}

export type Level = 'space' | 'flock' | 'entity' | 'deform';
export type Repeat = 'loop' | 'steady' | 'selfsim' | 'event';
export type Domain = 'physics' | 'chem' | 'bio' | 'earth' | 'math';

/** 쓰기 모드 — 겹치기(레이어링)의 의미를 명시한다 (PRD §4). */
export type WriteMode = 'set' | 'add' | 'mul';
export interface ChannelWrite {
	channel: string; // 예: 'pos', 'vel.y', 'scale'
	mode: WriteMode;
}

export interface CoreMeta {
	id: string;
	name: string;
	domain: Domain;
	level: Level;
	repeat: Repeat;
	principle: string; // 비전공자도 이해하는 한 줄
	notation: string; // 표기법 조각 — 예: 'Squash(vel.y→scale)@deform'
	reads?: string[]; // 읽는 채널
	writes: ChannelWrite[]; // 쓰는 채널 + 모드
}

export type Params = Record<string, number>;

/** 코어 = 파라미터화된 최소 규칙. init은 리셋마다, step은 고정 dt마다 호출된다. */
export interface Core<P extends Params = Params> {
	meta: CoreMeta;
	params: ParamDef[];
	init?(w: World, p: P): void;
	step(w: World, p: P, dt: number): void;
}

/** 실행 순서: 공간 → 군집 → 개체 → 변형 (PRD §4) */
export const LEVEL_ORDER: readonly Level[] = ['space', 'flock', 'entity', 'deform'];
