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
	id: number; // 세계 안에서 유일. addEntity()가 매긴다
	tags: string[]; // 라우팅 이름표. 패치의 target 셀렉터가 이걸 본다
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

/**
 * 뷰 변환. `space` 레벨 코어가 쓰는 채널 — 세계가 아니라 세계를 보는 방식을 바꾼다.
 * zoom 1 · rot 0 · (x,y)=화면 중심이면 아무 일도 일어나지 않는다.
 */
export interface Camera {
	x: number; // 카메라가 바라보는 월드 좌표
	y: number;
	zoom: number;
	rot: number; // rad
}

/** 코어가 공유하는 상태 공간. 코어 스택은 이 World 하나를 순서대로 변형한다. */
export interface World {
	entities: Entity[];
	t: number; // 누적 시간 (s)
	bounds: Bounds; // 공간 크기 — 지면·랩어라운드 기준
	camera: Camera; // 보는 방식 — space 레벨이 쓴다
	/** 엔티티 집합이나 태그가 바뀔 때마다 증가 — 라우팅 캐시 무효화 신호. addEntity/removeEntity가 올린다. */
	rev: number;
	nextId: number;
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

/**
 * `points`·`closed`는 **단독 소유** 채널이다 — 한 엔티티의 지오메트리를 매 스텝 고쳐 쓰는 코어는
 * 하나뿐이어야 한다. 겹치면 엔진이 경고하고, 답은 라우팅으로 대상을 갈라 거는 것이다.
 * 태어날 때 한 번만 모양을 정해 주는 코어(Boids의 2점 선분 등)는 여기 선언하지 않는다 —
 * 소유는 '매 스텝 쓰는가'로 가른다.
 */

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
	/** 앵커를 받는 코어면 그 뜻을 한 줄로. 없으면 앵커를 쓰지 않는 코어. */
	anchor?: string;
}

export type Params = Record<string, number>;

/**
 * 대상 셀렉터. `'*'`이면 세계의 모든 엔티티, 아니면 쉼표로 나열한 태그 중 하나라도 가진 엔티티.
 * 예: `'*'` · `'ball'` · `'ball,tail'`
 */
export type Selector = string;

/**
 * 패치 = 코어 하나를 어디에 걸지까지 포함한 합성 단위 (PRD §2 '합성').
 * v0에서는 코어만 쌓았고 대상은 늘 전체였다 — 그래서 points를 쓰는 코어 둘을 못 겹쳤다.
 */
export interface Patch {
	core: Core;
	/** 이 코어가 작용할 엔티티. 기본 '*' (전체) */
	target?: Selector;
	/** 참조할 다른 엔티티의 태그. 코어가 ctx.anchor로 받는다 (예: 체인 뿌리) */
	anchor?: Selector;
}

/** 엔진이 코어에게 건네는 실행 맥락 — 라우팅의 결과. */
export interface StepCtx {
	/** 이 패치가 작용할 엔티티들. 코어는 w.entities가 아니라 이걸 순회한다. */
	targets: Entity[];
	/** anchor 셀렉터로 찾은 첫 엔티티 (없으면 undefined) */
	anchor?: Entity;
	/** 이 패치의 대상 셀렉터. */
	target: Selector;
	/** 대상 태그를 붙여 세계에 들인다. targets에도 즉시 반영된다. */
	spawn(init?: Partial<Entity>): Entity;
	/** 세계에서 지운다. targets에서도 빠진다. */
	despawn(e: Entity): void;
}

/**
 * 코어 = 파라미터화된 최소 규칙. init은 리셋마다, step은 고정 dt마다 호출된다.
 * 코어는 `w.entities`가 아니라 **`ctx.targets`를 순회한다** — 어디에 걸릴지는 패치가 정한다.
 */
export interface Core<P extends Params = Params> {
	meta: CoreMeta;
	params: ParamDef[];
	init?(w: World, p: P, ctx: StepCtx): void;
	step(w: World, p: P, dt: number, ctx: StepCtx): void;
}

/** 실행 순서: 공간 → 군집 → 개체 → 변형 (PRD §4) */
export const LEVEL_ORDER: readonly Level[] = ['space', 'flock', 'entity', 'deform'];
