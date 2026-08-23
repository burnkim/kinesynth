# PRD — Kinesynth v0.1

움직임 코어 시스템 · 2026-08-23 · 김번

> Kinesynth = kinesis(운동) × synthesizer. 원리를 코어로, 코어를 합성해 움직임을 만든다.

## 0. 한 줄

모든 움직임의 출발은 이 세계로부터 — 과학과 수학의 원리를 점·선·면의 반복 움직임(코어)으로 추상화하고, 서로 합성해 새로운 움직임을 탄생시키는 시스템.

## 1. 목적과 우선순위

1. **작업 + 논문** — 개인 작업의 근본 출발점. 함축적 반복·모듈형 구조의 하위 층위(움직임 모듈) 연구.
2. **계정(아카이브)** — 코어와 합성 결과를 웹 아카이브·영상 콘텐츠로.
3. **강의** — 모션워크샵4 시그니처 블록(4주). 학생이 웹 뷰어를 직접 조작하고, 토대를 만드는 과정 자체에 참여.

대원칙: **재현이 아니라 원리의 추상화.** 유체를 나비에-스토크스로 풀지 않는다. 원리를 점·선·면으로 옮긴다.

## 2. 개념 구조 (6층)

| 층 | 정의 |
|---|---|
| 원리 Principle | 과학·수학적 출처. 비전공자도 이해하는 한 줄 설명 필수 |
| 코어 Core | 점·선·면의 상태를 시간에 따라 바꾸는, 파라미터화된 최소 규칙 |
| 레벨 Level | deform(내부 변형) / entity(개체) / flock(군집) / space(공간·카메라) |
| 물질 Material | 색·질감·형태 + (v0.2+) 움직임에 피드백하는 속성 |
| 합성 Composition | 코어들을 겹치고 잇고 서로 구동시키는 규칙 |
| 출력 Output | 웹 뷰어, 루프 영상, 툴셋 바인딩(URLD·STRKS·꾸물칠판), 임의 지오메트리(글자 등) |

## 3. 반복 4유형

모든 코어는 자신의 반복 유형을 메타에 선언한다.

- `loop` 주기 루프 — 닫힌 궤도 (리사주)
- `steady` 정상 흐름 — 계속 다르지만 통계적으로 같은 상태 (보이드, 노이즈)
- `selfsim` 자기유사 — 스케일의 반복 (프랙탈 줌)
- `event` 사건 재발 — 서사 단위의 반복 (점프, 사냥, 발사)

## 4. 핵심 설계: 움직임 신시사이저

- **세계(World)** = 엔티티들의 집합. 엔티티는 채널을 가진다: `pos, vel, scale, rot, points(로컬 지오메트리), closed(열림=선 / 닫힘=면)`. 점 하나짜리 엔티티 = 점.
- **코어** = 채널을 읽고 쓰는 모듈. 신스의 오실레이터·필터처럼.
- **합성 v0 = 코어 스택.** 명시적 패치 케이블 없이 채널 공유로 모듈레이션이 일어난다 (Bounce가 쓴 vel을 Squash가 읽는다). 실행 순서는 레벨 순: `space → flock → entity → deform`.
- **write mode**: 코어는 쓰는 채널마다 `set / add / mul`을 선언 → 겹치기(레이어링)의 의미가 명확해진다.
- **표준 파라미터 `exa`** (과장 계수, 1.0 = 물리적 사실): 모든 deform 코어의 필수 파라미터. "스타일 = 법칙 × 과장"의 시스템화. **표기 확정: `exa`** (2026-08-23). 논문의 `낙차`는 이 파라미터의 개념 대응이지 같은 이름이 아니다 — §14 참조. cores.json의 v0.2 스코어 필드 `nakcha`는 논문 쪽 용어로 그대로 둔다.
- **시드 고정 랜덤**(mulberry32): 같은 시드 = 같은 움직임 → 재현·아카이브·강의 시연 가능.
- 명시적 신호 라우팅(패치 UI)은 v0.2로 미룬다.

## 5. 표기법 v0 (기보법)

```
코어@레벨(핵심 파라미터) + 코어@레벨 ×exa값
```

- 점프: `Bounce@entity + Squash(vel.y→scale)@deform ×exa1.8`
- 늘어나는 새떼: `Boids@flock + Elastic(vel→stretch)@deform`

뷰어는 현재 패치의 표기법 문자열을 항상 표시한다 (강의 화면 겸용).

## 6. v0.1 스코프 — 오늘

데모 3종 (점·선·면에 각각 대응):

1. **Lissajous** — 점 (뷰어 트레일 옵션으로 선이 됨) · math / entity / loop
2. **Bounce + Squash** — 면 (12각 원형 폐곡선) · physics / event · **exa 슬라이더로 사실→만화 전환 시연** ← 시그니처 데모
3. **Boids + Elastic** — 점이 늘어나 선이 되는 새떼 · bio / flock+deform / steady

뷰어: Canvas2D. 어두운 배경 + 밝은 점·선·면(원리 뷰). ParamDef 기반 슬라이더 자동 생성. 재생/일시정지/리셋, 시드 입력, 데모 프리셋 전환, 표기법·원리 한 줄 표시, 트레일 토글.

데이터: `src/lib/meta/cores.json`에 코어 메타 5건 (lissajous, bounce, squash, boids, elastic).

검증: Playwright 스크린샷 (데모별 1장 + exa 1.0 vs 2.5 비교 1장).

## 7. 비스코프 (오늘 하지 않음)

WebGL/3D(테서랙트 등) · 물질 시스템 본격 · 명시적 패치 UI · 아카이브 사이트/배포 · 영상 익스포트 · TD 스펙 포팅 · 계정 운영 · 낙차/이탈 스코어링

## 8. 기술 스택과 코딩 규칙

- pnpm + SvelteKit(Svelte 5) + TypeScript strict, 단일 앱
- `src/lib/core`, `src/lib/cores`는 **순수 TS** — DOM·Svelte import 금지 (추후 패키지 추출 대비). 외부 런타임 의존성 0.
- 고정 타임스텝 1/60 + 어큐뮬레이터 (결정론 → 재현성)
- 성능 목표: 엔티티 500에서 60fps (v0)
- **코어 파일 = 강의 자료**: 파일당 ~100줄, 상단 주석에 원리 한 줄 + 표기법. 학생이 읽을 수 있는 코드.

## 9. 디렉토리

```
src/lib/core/    types.ts  engine.ts  rand.ts
src/lib/cores/   lissajous.ts  bounce.ts  squash.ts  (boids.ts  elastic.ts)
src/lib/meta/    cores.json
src/routes/      +page.svelte (뷰어)
```

## 10. 타입 스케치 (구현하며 다듬기)

```ts
type Vec = { x: number; y: number };

interface Entity {
  pos: Vec; vel: Vec; scale: Vec; rot: number;
  points: Vec[];      // 로컬 지오메트리
  closed: boolean;    // 열림 = 선, 닫힘 = 면
}

interface World { entities: Entity[]; t: number; rand(): number; }

interface ParamDef { key: string; label: string; min: number; max: number; value: number; step?: number; }

type Level  = 'space' | 'flock' | 'entity' | 'deform';
type Repeat = 'loop' | 'steady' | 'selfsim' | 'event';

interface CoreMeta {
  id: string; name: string;
  domain: 'physics' | 'chem' | 'bio' | 'earth' | 'math';
  level: Level; repeat: Repeat;
  principle: string;   // 비전공자용 한 줄
  notation: string;    // 표기법
}

interface Core<P = Record<string, number>> {
  meta: CoreMeta;
  params: ParamDef[];
  init?(w: World, p: P): void;
  step(w: World, p: P, dt: number): void;
}
```

## 11. cores.json 스키마

`id, name_ko, name_en, domain, level, repeat, principle_ko(비전공자 한 줄), rule(수식·규칙 요약), params, notation, refs[], status(idea|draft|done), createdAt`

v0.2+: `nakcha, ital` 스코어 필드 — ATLAS와 축 통일.

## 12. 시드 백로그 (v0.2+ 후보 30)

- **물리**: 진자·이중진자(loop/steady) · 스프링 체인=팔로우스루(event) · 케플러 궤도(loop) · 마찰 감쇠 정지(event) · 충돌 운동량 교환(event) · 부력 떠오름(steady)
- **화학**: 결정 성장 DLA(selfsim) · 반응확산 그레이-스콧(steady) · 브라운 운동(steady) · 동결=격자 스냅(event) · 연소 전파(event) · 결합=자석 도킹(event)
- **생물**: L-system 성장(selfsim) · 섬모 파동 이동(loop) · 주화성 끌림(steady) · 세포 분열(event) · 심장 박동=수축 펄스(loop) · 개미 페로몬 길(steady)
- **지구·우주**: 자전+공전 중첩(loop) · 조석=두 인력(loop) · 성운 소용돌이=컬 노이즈(steady) · 단층 스틱슬립(event) · 유성 낙하·소멸(event) · 침식 하강(steady)
- **수학**: 로렌츠 어트랙터(steady) · 푸리에 에피사이클(loop) · 라이프 게임 CA(steady) · 펄린 노이즈 필드(steady) · 프랙탈 줌(selfsim) · 파동 간섭(loop)

## 13. 강의 연동 초안 (모션워크샵4 · 4주 블록)

- **W1 법칙→추상**: 점·선·면 선언. 물리 코어. 12원칙의 물리 기원 재해석 — 스타일 = 법칙 × 과장.
- **W2 규칙→창발**: 군집·CA. 단순 규칙이 만드는 복잡한 움직임.
- **W3 수식→형태**: 파라메트릭·노이즈·프랙탈. 수학이 그리는 움직임.
- **W4 합성→이탈**: 코어 합성, 현실에 없는 물질 속성 결합, 학생 시그니처 움직임 발표(+코어 기여).

학생은 W1부터 뷰어 사이트에 접속해 직접 조작. 토대를 만드는 과정 자체를 공유한다.

## 14. 논문 연결점

반복 4유형 ↔ 함축적 반복 · 코어 스택 ↔ 모듈형 구조 · exa ↔ 낙차 · 비현실 물질 결합 ↔ 이탈

## 15. 오늘의 완료 정의 (DoD)

- [ ] 뷰어에서 Bounce+Squash가 돌고, exa 슬라이더로 사실↔만화 전환이 눈에 보인다
- [ ] Lissajous 데모 + 트레일
- [ ] cores.json 5건, 표기법 문자열 화면 표시
- [ ] 늘어나는 새떼 — 점이 선이 되는 순간이 보인다
- [ ] Playwright 스크린샷 기록 (새떼 포함)
