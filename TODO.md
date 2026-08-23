# TODO — Kinesynth v0.1 · 오늘의 스프린트

규칙: 위에서 아래로. 항목 완료 시 체크 + 한 줄 로그. 막히면 **SIMPLIFY**(스코프 축소)가 우선, 우회 금지. PRD.md의 코딩 규칙 준수 (core 순수 TS, 파일당 ~100줄, 상단 주석에 원리+표기법).

## P0 스캐폴드

- [x] SvelteKit(Svelte 5.56) + TS strict + Playwright, pnpm. `pnpm check` 0 errors
- [x] PRD §9 구조 생성. 순수성 규칙(DOM·Svelte import 금지)을 types.ts 상단에 명시

## P1 코어 시스템

- [x] `core/types.ts` — 스케치 + `writes(set/add/mul)` 선언, `Bounds`, `sig`(이벤트 신호 채널) 추가
- [x] `core/rand.ts` — mulberry32 + 문자열 시드 해시(강의에서 이름을 시드로)
- [x] `core/engine.ts` — 레벨 순 정렬, 고정 dt 1/60 + 어큐뮬레이터, reset, `seek(t)`(결정론적 탐색), 궤적 기록

## P2 첫 코어들

- [x] `cores/lissajous.ts` — 선언형. vel은 해석적 미분으로 함께 써서 하위 deform이 읽게 함
- [x] `cores/bounce.ts` — 로컬 원점을 발밑에 둠 → pos=접지점. 충격량을 `sig.impact`로 방출
- [x] `cores/squash.ts` — 늘어남←속도, 찌그러짐←충격. exa 1.0/1.8/2.5 → sy 0.740/0.532/0.350
- [x] `demos.ts` 프리셋. 표기법 자동 생성 검증: `Bounce(g, e)@entity + Squash(vel.y→scale)@deform ×exa1.8`

## P3 뷰어

- [x] `render.ts` — 점·선·면 + 지면. DPR 대응, 엔티티 60 초과 시 글로우 off
- [x] ParamDef → 슬라이더 자동 생성. exa는 강조 색으로 구분
- [x] 재생/일시정지(Space)·리셋(R)·시드·프리셋·트레일. URL 훅(`?demo&seed&trail&t&p=`)으로 공유 링크 겸 결정론적 촬영
- [x] 헤더에 표기법 상시 표시, 코어별 principle 한 줄 + level/repeat 태그

## P4 데이터

- [x] `meta/cores.json` 3건 (rule·refs·status 포함)

## P5 1차 검증 (수직 슬라이스 체크포인트)

- [x] `shots/01·02·03`. 뷰어 동작 테스트 3건 추가(슬라이더→엔진 반영, 프리셋 교체, 시드 재현성). 6/6 통과
- [x] 커밋 완료

## P6 새떼 (P5 통과 후 진입)

- [x] `cores/boids.ts` — 세 규칙이 하나의 목표 속도를 만든다. 토러스 최단거리 이웃, 분리는 근거리(반경 40%)만. 500개체 2.5ms/step (예산 15%)
- [x] `cores/elastic.ts` — 신장은 속도의 **제곱**에 비례(관성·항력). 2.6px 점 → 최대 30px 선. exa 0이면 전부 점
- [x] 프리셋 등록. 표기법 `Boids(분리·정렬·응집)@flock + Elastic(vel→stretch)@deform ×exa1.8`
- [x] cores.json 5건
- [x] `shots/04·05`. DoD 5/5. Playwright 9/9 (500개체 실시간 fps 테스트 포함)

## DoD (PRD §15)

- [x] 뷰어에서 Bounce+Squash가 돌고, exa 슬라이더로 사실↔만화 전환이 눈에 보인다 — `shots/03`
- [x] Lissajous 데모 + 트레일 — `shots/01`
- [x] cores.json 5건, 표기법 문자열 화면 표시
- [x] 늘어나는 새떼 — 점이 선이 되는 순간이 보인다 — `shots/05` (같은 무리, exa만 0 → 1.8)
- [x] Playwright 스크린샷 기록 (새떼 포함) — `shots/01~05`

## 로그

- `sig.impact` 미초기화 → `undefined * x = NaN`이 scale로 전파, `ctx.scale(NaN)`이 무시돼 공이 바닥을 통과했다. 소유 코어(Bounce)가 init에서 채널을 0으로 열도록 수정.
- 스쿼시 피벗을 도형 중심에 두니 납작해진 공이 지면 위로 떴다. 로컬 원점을 발밑으로 옮겨 해결 — 상태 없이 접지가 유지된다.
- 트레일을 프레임 페이드로 구현했더니 리프레시레이트에 좌우되고 8비트 정밀도에서 잔상이 갇혔다. 엔진이 궤적을 기록하는 방식으로 교체 → `seek`에서도 트레일이 남아 촬영이 결정론적.
- Svelte 5 `$state` 프록시는 원본 객체로 write-through 하지 않는다. 슬라이더가 표시용 사본과 엔진 레코드를 명시적으로 둘 다 쓴다.
- 새떼: 규칙마다 `−v`를 더하니 세 번 감속돼 전 개체가 최저 속도에 붙었다. 세 방향을 먼저 합쳐 목표 속도 하나를 만들고 조향은 한 번만 하도록 수정. 속도 하한도 제거 — 급선회에서 속도가 죽어야 선이 점으로 돌아간다.
- 분리를 이웃 반경 전체에 걸면 무리가 아니라 균등 격자가 된다. 근거리(반경 40%)로 제한.
- 파라미터는 눈으로 고르지 않고 지표로 골랐다: 최근접이웃 거리(균등랜덤 기대 35px 대비)와 정렬도. 후보 5×3 스윕 후 최종 확인은 렌더 이미지로.
