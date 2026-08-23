# TODO — Kinesynth v0.1 · 오늘의 스프린트

규칙: 위에서 아래로. 항목 완료 시 체크 + 한 줄 로그. 막히면 **SIMPLIFY**(스코프 축소)가 우선, 우회 금지. PRD.md의 코딩 규칙 준수 (core 순수 TS, 파일당 ~100줄, 상단 주석에 원리+표기법).

## P0 스캐폴드

- [ ] SvelteKit(Svelte 5) + TS strict 프로젝트 생성, pnpm, dev 서버 실행 확인
- [ ] 디렉토리 구조 생성 (PRD §9), core 순수성 규칙을 types.ts 상단 주석에 명시

## P1 코어 시스템

- [ ] `core/types.ts` — Vec, Entity, World, ParamDef, Level, Repeat, CoreMeta, Core
- [ ] `core/rand.ts` — mulberry32 시드 랜덤
- [ ] `core/engine.ts` — createWorld(seed), 코어 스택 등록(레벨 순 정렬: space→flock→entity→deform), 고정 dt 1/60 + 어큐뮬레이터, reset

## P2 첫 코어들

- [ ] `cores/lissajous.ts` — math/entity/loop. pos = (A·sin(a·t+δ), B·sin(b·t)). 선언형, 완전 루프
- [ ] `cores/bounce.ts` — physics/entity/event. 중력, 지면 반발(반발계수), 좌우 드리프트 옵션
- [ ] `cores/squash.ts` — physics/deform/event. scale ← f(vel.y), 부피 보존(x·y≈1), **exa 파라미터**(1.0=사실)
- [ ] 합성 데모 등록: bounce+squash 스택 → 표기법 문자열 자동 생성 확인

## P3 뷰어

- [ ] Canvas2D 렌더 — 점(작은 원), 선(폴리라인), 면(닫힌 경로 + 옅은 채움). 어두운 배경, 밝은 스트로크
- [ ] 파라미터 패널 — ParamDef 배열 → 슬라이더 자동 생성
- [ ] 컨트롤 — 재생/일시정지/리셋, 시드 입력, 데모 프리셋 셀렉터, 트레일 토글
- [ ] 표기법 문자열 + principle 한 줄 상시 표시 (강의 화면 겸용)

## P4 데이터

- [ ] `meta/cores.json` — lissajous, bounce, squash 3건 (PRD §11 스키마)

## P5 1차 검증 (수직 슬라이스 체크포인트)

- [ ] Playwright 스크린샷: lissajous, bounce+squash 각 1장 + exa 1.0 vs 2.5 비교 1장 → /shots 저장
- [ ] 여기서 커밋 — 이 시점에 이미 v0 성립. P6은 그 위에 쌓는다

## P6 새떼 (P5 통과 후 진입)

- [ ] `cores/boids.ts` — bio/flock/steady. 분리·정렬·응집 3규칙. 이웃 반경, 최고 속도 클램프, 화면 랩어라운드(토러스 → steady 유지). 개체 ~150에서 60fps 확인
- [ ] `cores/elastic.ts` — deform. rot = atan2(vel)로 진행 방향 정렬 후 속도 크기에 비례해 scale.x 신장, exa 필수. 로컬 지오메트리는 아주 짧은 2점 선분 → 정지하면 점, 가속하면 선
- [ ] 데모 프리셋 `Boids@flock + Elastic(vel→stretch)@deform` 등록
- [ ] cores.json에 boids, elastic 추가 (총 5건)
- [ ] 새떼 스크린샷 + 최종 DoD 체크(PRD §15) 후 커밋
