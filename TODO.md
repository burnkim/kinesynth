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

- [ ] `cores/boids.ts` — bio/flock/steady. 분리·정렬·응집 3규칙. 이웃 반경, 최고 속도 클램프, 화면 랩어라운드(토러스 → steady 유지). 개체 ~150에서 60fps 확인
- [ ] `cores/elastic.ts` — deform. rot = atan2(vel)로 진행 방향 정렬 후 속도 크기에 비례해 scale.x 신장, exa 필수. 로컬 지오메트리는 아주 짧은 2점 선분 → 정지하면 점, 가속하면 선
- [ ] 데모 프리셋 `Boids@flock + Elastic(vel→stretch)@deform` 등록
- [ ] cores.json에 boids, elastic 추가 (총 5건)
- [ ] 새떼 스크린샷 + 최종 DoD 체크(PRD §15) 후 커밋

## 로그

- `sig.impact` 미초기화 → `undefined * x = NaN`이 scale로 전파, `ctx.scale(NaN)`이 무시돼 공이 바닥을 통과했다. 소유 코어(Bounce)가 init에서 채널을 0으로 열도록 수정.
- 스쿼시 피벗을 도형 중심에 두니 납작해진 공이 지면 위로 떴다. 로컬 원점을 발밑으로 옮겨 해결 — 상태 없이 접지가 유지된다.
- 트레일을 프레임 페이드로 구현했더니 리프레시레이트에 좌우되고 8비트 정밀도에서 잔상이 갇혔다. 엔진이 궤적을 기록하는 방식으로 교체 → `seek`에서도 트레일이 남아 촬영이 결정론적.
- Svelte 5 `$state` 프록시는 원본 객체로 write-through 하지 않는다. 슬라이더가 표시용 사본과 엔진 레코드를 명시적으로 둘 다 쓴다.
