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

---

# v0.2 · 착수분 (2026-08-23)

## 결정

- [x] **`exa` 확정.** 파라미터 이름은 `exa`. 논문의 `낙차`는 개념 대응이지 같은 이름이 아니다(PRD §14).
      cores.json의 v0.2 스코어 필드 `nakcha`는 논문 쪽 용어로 유지.

## 코어 3개 — 비어 있던 축을 여는 순서로

- [x] `core/types.ts` + `engine.ts` — **Camera 채널 추가.** space 레벨이 실제로 쓸 채널이 없었다.
      렌더러가 월드→화면 변환을 카메라 경유로 바꾸고, 선 굵기는 화면 기준으로 고정.
- [x] `cores/fractalZoom.ts` — math/**space**/**selfsim**. 두 개의 빈 축을 한 코어로 열었다.
      zoom = base^frac(t·rate), 한 옥타브마다 되돌아온다.
- [x] `cores/spring.ts` — physics/deform/event. ζ = min(damp/exa, 1) — 과장이 감쇠비를 낮춘다.
      exa 0이면 꼬리가 몸의 궤적을 그대로 따라간다 = 팔로우스루 없음.
- [x] `cores/dla.ts` — **chem**/entity/selfsim. 도메인 4/5. 점유 격자로 O(n), 700입자 0.03ms/step.
- [x] 데모 3개 등록 · cores.json 8건 · 스크린샷 06·07·08 · 테스트 12/12

## 커버리지

| | loop | steady | selfsim | event |
|---|---|---|---|---|
| **space** | – | – | FractalZoom | – |
| **flock** | – | Boids | – | – |
| **entity** | Lissajous | – | DLA | Bounce |
| **deform** | – | Elastic | – | Squash · Spring |

레벨 4/4 · 반복 4/4 · 도메인 4/5 (earth 공백). 16칸 중 7칸.

## 배포

- [x] GitHub `burnkim/kinesynth` 베이스화 (main)
- [x] `@sveltejs/adapter-vercel` + `prerender = true` → 서버리스 함수 없이 정적 배포
- [x] **https://kinesynth.vercel.app 라이브.** GitHub 연결 완료 — main 푸시 = 자동 배포.
      `pnpm smoke`로 배포본 검증(코어 스택 표기법 · URL 파라미터 · 실시간 fps · 콘솔 오류 0)

## 로그

- Spring이 처음에 발산했다. 머리가 빠를 때 스프링만으로는 마디가 한없이 늘어난다 —
  마디 길이에 상·하한(0.55~1.5×)을 걸어 해결. 물리를 지키면서 채찍이 끊기지도 겹치지도 않는다.
- 팔로우스루를 직선 왕복(a=b)으로 보이려 했더니 꼬리가 옆으로 뻗을 데가 없어 지그재그로 좌굴했다.
  곡선 경로로 되돌리고, 트레일(몸이 지나간 길)과 꼬리가 얼마나 벌어지는지로 읽게 했다.
- 강성이 높으면 꼬리가 궤적을 그대로 따라가 exa가 안 보이고, 낮으면 길이 제약에 걸려 밧줄이 된다.
  freq 3.4 / damp 0.45에서 exa 0(궤적에 밀착) → 1.8(벗어남) → 3(크게 휘둘림)이 눈으로 갈린다.
- 자기유사는 시간을 고정하고 배율만 바꿔서 보여야 한다. 같은 t·같은 결정에 `base`만 다르게 준
  두 장(×1.1 / ×2.3)이 그 증거다.

---

# v0.2 관문

원칙: **points(지오메트리)는 단독 소유** — 한 엔티티의 points에 set하는 코어는 하나만. 겹치면 엔진이 경고.
충돌은 라우팅으로 푼다. **수치 채널(pos·vel·scale·rot)은 write mode 합성** — set 하나 + add 여러 개
(deform의 scale은 mul).

## v0.2 관문 1 — 라우팅 + write mode

- [x] Entity에 id, tags: string[] 추가. addEntity/removeEntity/tagEntity가 `world.rev`를 올린다
- [x] `Patch { core, target?, anchor? }`. 코어만 적으면 '*' — 기존 6개 프리셋 전부 무수정 통과
- [x] 패치별 대상 캐시, `world.rev` 바뀔 때만 재검색. '*'는 필터 자체를 건너뛴다. ctx 객체도 재사용(스텝당 할당 0). 500개체 태그 대상 2.76ms/step (전체 대상 2.5ms)
- [x] `auditWrites()` — 스택 세울 때 한 번, 매 프레임 비용 0. 셀렉터 겹침·채널 접두사(vel↔vel.y)·세계 채널(camera.*)까지 본다. 경고는 `engine.warnings` + 콘솔 + 뷰어 패널.
      **scale은 엔진이 매 스텝 (1,1)로 초기화** → Squash·Elastic을 mul로 바꿔 순서에 덜 민감하게
- [x] 앵커는 패치에 둔다(`anchor: 'ball'`) — 태그는 문자열이라 숫자 Params에 못 들어간다.
      코어는 `meta.anchor`로 앵커를 받는다고 선언하고 `ctx.anchor`로 받는다.
      앵커가 있으면 Spring이 꼬리 전용 엔티티를 만들어 뿌리를 몸에 건다. 세로 오프셋은 몸의 scale.y를 따라간다
- [x] `코어@레벨[대상←앵커]`. exa 가진 코어가 둘 이상이면 코어마다 붙인다
- [x] `bounce-tail` 프리셋 + `shots/09`. 낙하(늘어남) → 접지(납작, 꼬리는 계속 내려감) → 되튐(꼬리 감김)

## v0.2 관문 2 — 메타 단일 소스

- [x] `cores/index.ts` 레지스트리 + `scripts/gen-meta.mjs`. `pnpm dev`·`pnpm build`가 먼저 돌린다.
      CoreMeta를 넓혀(nameKo·rule·refs·status·createdAt) json이 담던 걸 전부 코어 파일이 갖게 했다
- [x] json 첫 필드가 `$generated`. `pnpm check:meta`가 어긋나면 실패 — `pnpm test`에 물려 있다
- [x] `pnpm check:cores`. 필수 메타·level/repeat/domain 허용값·id 중복·notation에 @level·refs 유무·
      파라미터 범위(min<max, 기본값 범위 안, step>0)·deform의 exa 필수·순수성(DOM/Svelte)·
      **선언되지 않은 points 쓰기**까지 본다. 일부러 4종 위반을 심어 전부 잡히는 걸 확인

## v0.2 관문 3 — W3 코어 2종

- [x] `core/noise.ts` — 펄린 2D + fbm. 시드 고정 재현 확인, 이웃 표본 변화 0.029/0.01칸(매끄러움)
- [x] `NoiseField@space` — vel에 **add**. Boids(add) 위에 얹으면 평균 속력 46→107, 정렬도 0.86→0.50.
      Bounce·DLA(vel set)와 겹치면 엔진이 경고 — 그 장면을 `wind-bounce` 프리셋으로 남겼다(강의 W4용)
- [x] `Fourier@entity` — 프리셋 도형을 256점 샘플링해 DFT, 항을 크기 순으로 쌓아 **부분합을 points로** 그린다.
      화면의 선이 곧 에피사이클 팔, 그 끝(pos)이 트레일로 곡선을 그린다.
      프리셋 3종(사각·별·**글자 K**) — 임의 지오메트리도 같은 규칙이라는 증거
- [x] 코어 10건. 프리셋 `noise-flock` · `fourier` · `wind-bounce`. `shots/10·11`. 테스트 18/18

### 관문 1 로그

- `bounce`가 매 스텝 `points`를 다시 그리는데(r 슬라이더 실시간 반영) 선언에 없었다.
  그래서 감사기가 Bounce+Spring 충돌을 못 잡았다 — **선언되지 않은 쓰기는 감사기에 보이지 않는다.**
  소유 판정 기준을 "매 스텝 쓰는가"로 정하고 types.ts에 명시.
- 코어가 `w.entities`를 직접 만지면 라우팅이 성립하지 않는다. `ctx.spawn`/`ctx.despawn`으로
  바꾸니 대상 태그가 자동으로 붙고 캐시도 일관되게 유지된다 — 엔진의 후처리 태깅 로직이 통째로 사라졌다.
- Spring의 월드 이동량을 `vel*dt`로 잡았는데 접지에서 위치가 튈 때 어긋난다.
  직전 머리 위치를 상태에 넣고 **위치 차이**로 바꿔 정확해졌다.

### 관문 3 로그

- `boids`가 vel을 `set`으로 선언해 놨는데 실제로는 조향력을 **더한다**. 흐름장을 얹자마자
  가짜 경고가 떴다 — 선언이 사실과 어긋나면 감사기는 잡음이 된다. `add`로 고쳤다.
  선언 기준을 정했다: **다른 코어의 기여가 살아남으면 add, 지워지면 set.**
- 그 기준으로 보면 Bounce의 `vel set`은 맞는 선언이고, 흐름장과 겹칠 때 뜨는 경고도 참이다
  (드리프트가 매 프레임 vel.x를 덮어쓴다). 그래서 그 조합을 지우지 않고 **충돌 예시 프리셋**으로 남겼다.

## 커버리지 (코어 10)

| | loop | steady | selfsim | event |
|---|---|---|---|---|
| **space** | – | NoiseField | FractalZoom | – |
| **flock** | – | Boids | – | – |
| **entity** | Lissajous · Fourier | – | DLA | Bounce |
| **deform** | – | Elastic | – | Squash · Spring |

레벨 4/4 · 반복 4/4 · 도메인 4/5 (earth 공백). 16칸 중 8칸.

---

# v0.2 · earth 도메인

- [x] `cores/orbit.ts` — **earth**/entity/loop. `Orbit(spin:rev)@entity`.
      θ = 2π(rev·t + phase) → pos, rot = 2π(spin·rev·t + phase).
      `spin`은 **공전 1회당 자전수** — 1이면 조석 고정(같은 면이 늘 중심을 향한다).
      앵커를 주면 그 몸을 중심으로 돈다 → 세계에서 본 궤적은 원 위의 원.
- [x] **엔진: 파라미터를 패치 key로 가른다.** 같은 코어를 두 번 걸면 `values`가 공유돼
      행성과 달이 같은 파라미터를 쓰는 문제가 있었다. key = 유일하면 `id`, 겹치면 `id@대상`.
      `overrides`·URL `?p=`·슬라이더 testid가 전부 이 key를 쓴다 (`?p=orbit@moon.spin:1`).
- [x] 데모 `orbit` — 해·행성·달. **한 코어를 세 번 걸었다.** 경고 0.
      `Orbit@entity[sun] + Orbit@entity[planet] + Orbit@entity[moon←planet]`
- [x] `shots/12` — 달:행성 주기비 3:1 vs 8:1. 두 주기의 비가 고리 수를 정한다.
- [x] 조석 고정 수치 검증: 900스텝 동안 달의 코와 바깥 방향 어긋남 **최대 0.00°**
      (행성은 spin 7이라 180°까지 벌어진다)

## 커버리지 (코어 11) — 도메인 5/5 완성

| | loop | steady | selfsim | event |
|---|---|---|---|---|
| **space** | – | NoiseField | FractalZoom | – |
| **flock** | – | Boids | – | – |
| **entity** | Lissajous · Fourier · Orbit | – | DLA | Bounce |
| **deform** | – | Elastic | – | Squash · Spring |

physics 4 · math 4 · bio 1 · chem 1 · **earth 1** → 다섯 도메인이 다 열렸다.
레벨 4/4 · 반복 4/4 · 16칸 중 8칸.

---

# v0.2 마무리 — 8월 세이브 포인트 (2026-08-23)

- [x] **공유 버튼** — 표기법 + 링크를 함께 복사 (`⧉ 공유` · 단축키 `C`).
      링크만으로는 무엇을 보는지 알 수 없다. 표기법이 붙으면 공유물이 스스로를 설명한다 —
      아카이브 항목 · SNS 캡션 · 학생 제출이 같은 포맷을 쓴다.
      프리셋 기본값에서 벗어난 것만 실어 짧게, 일시정지 중이면 `t`까지 실어 **그 프레임**을 다시 연다.
      왕복 테스트로 확인: 만진 것만 실리고 → 그 링크가 같은 상태를 다시 연다.
- [x] **발견 노트 #1 조석 고정** — `notes/001-tidal-lock.md`.
      아카이브 한 항목 = 표기법 · 링크 · 그림 · 수치 네 가지. 포맷을 `notes/README.md`에 정의.
- [x] **백로그 카테고리 신설** — PRD §12-b «합성으로 해소 (새 코어 불필요)».
      '자전+공전 중첩'을 첫 항목으로. 새 코어를 만들기 전에 이 표를 먼저 본다.
- [x] **PRD §5 표기법 v0.2** — `[대상←앵커]`와 `id@target` 주소 체계 반영
- [x] v0.2 태그 + 커밋

## 남겨 둔 판단

- **16칸을 채우는 건 목표가 아니다.** 그 표는 지도이지 할당량이 아니고,
  구조적으로 비어 있는 게 자연스러운 칸도 있다. 축은 열렸으니 이제 칸이 아니라 **장면**을 센다.
- **L-system은 일부러 남긴다.** "성장을 어떻게 애니메이션으로 다룰 것인가"라는 설계 질문 자체가
  강의 재료다. 9월에 학생들과 함께 만드는 코어로 쓴다 — 토대를 만드는 과정을 공유한다는
  원래 계획(PRD §1)과 맞는다.

---

# 9월 재개 (강의와 함께)

## W2 전 · 라이프 게임 CA

- [ ] `cores/life.ts` — math/flock/steady. **flock 레벨의 두 번째 창발**: 이웃 조향(Boids)이 아니라 격자 규칙.
- [ ] **이웃 탐색은 그리드 인덱스로.** 보이드식 전수 비교(O(n²)) 금지 — CA는 격자가 곧 인덱스다.
      DLA의 점유 격자 패턴을 재사용할 수 있다 (스텝마다 `fill(0)` 후 살아있는 세포만 찍기, O(n)).
- [ ] **탄생·소멸의 트윈이 핵심.** CA는 본질적으로 깜빡이는 이산 시스템이라, 그대로 그리면
      '움직임'이 아니라 점멸이다. 생성 시 팝(scale 0→1 오버슈트), 소멸 시 수축(1→0)을 넣는 순간
      이산 시스템에 **낙차**가 들어온다. `ctx.spawn`/`despawn`이 이미 그걸 위해 있다.
      → 소멸은 즉시 지우지 말고 `sig.dying`을 세워 트윈이 끝난 뒤 despawn.
- [ ] **CA × deform 합성** — 살아있는 세포마다 숨쉬게 한다. W2 하이라이트.
      `Life@flock + Squash/Pulse@deform` 식으로. `sig.age`·`sig.born`을 deform이 읽는 구조.

## W2~3 · L-system

- [ ] 학생과 함께 만드는 코어. 설계 질문("성장을 어떻게 애니메이션으로 다룰 것인가")부터 같이 연다.

## 병행 트랙 · 장면 합성 프리셋 2~3 ← **9월의 진짜 깊이**

코어 12번째보다, 기존 11개가 합쳐져 **맥락이 읽히는 장면**을 만드는 게 원래 비전
("맥락을 유추해볼 수 있는 움직임")의 다음 단계다.

- [ ] 바람 속 군무 — `NoiseField@space + Boids@flock + Elastic@deform`의 튜닝된 장면
- [ ] 포식자 산개 — 군집에 회피 대상 하나. 라우팅으로 `[flock]`과 `[hunter]`를 갈라 건다
- [ ] 하나 더 — 사냥? 낙하? 장면이 정해지면 필요한 코어가 따라온다 (반대가 아니라)
