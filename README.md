# Kinesynth

**움직임 코어 시스템** · 2026-08-23 · **[kinesynth.vercel.app](https://kinesynth.vercel.app)**

> Kinesynth = kinesis(운동) × synthesizer. 원리를 코어로, 코어를 합성해 움직임을 만든다.

과학과 수학의 원리를 점·선·면의 반복 움직임(**코어**)으로 추상화하고, 서로 합성해
새로운 움직임을 탄생시킨다. 재현이 아니라 **원리의 추상화** — 유체를 나비에-스토크스로
풀지 않는다. 자세한 배경은 [PRD.md](PRD.md), 진행 상황은 [TODO.md](TODO.md).

## 실행

```bash
pnpm install
pnpm dev          # 뷰어
pnpm check        # 타입 검사
pnpm test:e2e     # Playwright (스크린샷 + 동작 검증)
pnpm shots        # 스크린샷만 → shots/
pnpm smoke        # 배포된 사이트 스모크 테스트
pnpm gen:meta     # 코어 → src/lib/meta/cores.json 생성
pnpm check:cores  # 코어 검증 (메타·파라미터 범위·순수성)
```

## v0.1에 있는 것

| 데모 | 스택 | 도메인 / 레벨 / 반복 |
|---|---|---|
| Lissajous | `Lissajous(a:b, δ)@entity` | math / entity / loop |
| Bounce + Squash | `Bounce(g, e)@entity + Squash(vel.y→scale)@deform ×exa` | physics / entity+deform / event |
| Boids + Elastic | `Boids(분리·정렬·응집)@flock + Elastic(vel→stretch)@deform ×exa` | bio+physics / flock+deform / steady |
| Lissajous + Spring | `Lissajous(a:b, δ)@entity + Spring(chain)@deform ×exa` | math+physics / entity+deform / event |
| DLA · 결정 성장 | `DLA(격자 성장)@entity` | chem / entity / selfsim |
| DLA + Fractal Zoom | `FractalZoom(base, rate)@space + DLA(격자 성장)@entity` | math+chem / space+entity / selfsim |
| Bounce + Squash + Spring | `Bounce@entity[ball] + Squash@deform[ball] + Spring@deform[tail←ball]` | physics / entity+deform / event |
| NoiseField + Boids | `NoiseField(flow)@space + Boids@flock + Elastic@deform` | math+bio / space+flock+deform / steady |
| Fourier Epicycles | `Fourier(N항)@entity` | math / entity / loop |
| Orbit · 자전 + 공전 | `Orbit@entity[sun] + Orbit@entity[planet] + Orbit@entity[moon←planet]` | earth / entity / loop |

**장면** — 코어들이 합쳐져 맥락이 읽히는 것. 뷰어 셀렉터에서 원리와 따로 묶여 있다.

| 장면 | 스택 |
|---|---|
| 바람 속 군무 | `NoiseField@space + Boids@flock + Elastic@deform` |
| 포식자 산개 | `Flee@flock[bird←hunter] + Boids@flock[bird] + Orbit@entity[hunter] + Elastic@deform[bird]` |
| 사냥 | `Flee@flock[bird←hunter] + Panic@flock[bird] + Boids@flock[bird] + Seek@entity[hunter←bird] + Elastic@deform[bird]` |

- **합성 = 코어 스택.** 패치 케이블 없이 채널 공유로 모듈레이션이 일어난다 —
  Bounce가 쓴 `vel`과 `sig.impact`를 Squash가 읽는다. 실행 순서는 레벨 순
  `space → flock → entity → deform`.
- **`exa` (과장 계수).** 1.0 = 물리적 사실. 슬라이더 하나로 사실↔만화를 넘나든다.
  스타일 = 법칙 × 과장.
- **결정론.** 고정 타임스텝 1/60 + 시드 고정 난수(mulberry32) → 같은 시드 = 같은 움직임.

코어 14개. 레벨 4종(space·flock·entity·deform), 반복 4종(loop·steady·selfsim·event),
도메인 5종(physics·math·bio·chem·earth)이 **모두 열려 있다**.
축이 다 열린 뒤의 깊이는 칸이 아니라 **장면**에서 온다 — 매트릭스는 지도이지 할당량이 아니다.

## URL로 상태 공유

뷰어는 URL 파라미터로 장면을 그대로 재현한다 (아카이브·강의 링크 겸 스크린샷 훅).

```
/?demo=bounce-squash&seed=1&t=0.767&p=squash.exa:2.5
/?demo=boids-elastic&seed=7&t=22&trail=1&p=boids.n:300
```

| 파라미터 | 뜻 |
|---|---|
| `demo` | 프리셋 id — 뷰어 셀렉터의 값 (`bounce-tail` · `orbit` · `fourier` · `noise-flock` · …) |
| `seed` | 숫자 또는 문자열 (문자열은 해시) |
| `trail` | `1`이면 궤적 |
| `t` | 그 시각까지 고정 스텝으로 감고 멈춘다 |
| `p` | `패치key.파라미터:값` 쉼표 구분 (`squash.exa:2.5`, `orbit@moon.spin:1`) |

## 구조

```
src/lib/core/    types rand engine noise space      ← 순수 TS. DOM·Svelte import 금지
src/lib/cores/   lissajous bounce squash boids elastic spring dla
                 fractalZoom noiseField fourier orbit flee seek panic
src/lib/cores/index.ts                          ← 레지스트리. 코어를 만들면 여기 등록
src/lib/meta/    cores.json                     ← **생성물**. 손으로 고치지 않는다 (pnpm gen:meta)
src/lib/         demos.ts  render.ts
src/routes/      +page.svelte                   ← 뷰어
tests/           shots.e2e.ts  viewer.e2e.ts  live.e2e.ts
scripts/         gen-meta.mjs  check-cores.mjs
shots/           스크린샷 기록
notes/           발견 노트 — 아카이브의 최소 단위
```

**코어 파일 = 강의 자료.** 파일당 ~100줄, 상단 주석에 원리 한 줄 + 표기법.
`core/`·`cores/`는 외부 런타임 의존성 0 — 추후 독립 패키지로 뽑을 수 있게.

## 합성 — 코어를 어디에 걸 것인가

`points`(지오메트리)는 **단독 소유** 채널이다. 한 엔티티의 모양을 매 스텝 고쳐 쓰는 코어는 하나뿐이어야 한다.
겹치면 엔진이 경고하고, 답은 **대상을 갈라 거는 것**이다.

```ts
patch: [
  { core: bounce, target: 'ball' },              // 몸: 12각 폐곡선
  { core: squash, target: 'ball' },              // 몸을 찌그러뜨린다
  { core: spring, target: 'tail', anchor: 'ball' } // 꼬리: 뿌리를 몸에 건다
]
```

→ `Bounce(g, e)@entity[ball] + Squash(vel.y→scale)@deform[ball]×exa1.8 + Spring(chain)@deform[tail←ball]×exa1.8`

**앵커는 하나일 수도 그룹일 수도 있다.** 코어는 `ctx.anchor`(첫 하나) 또는 `ctx.anchors`(전부)로 받는다 —
체인의 뿌리·공전의 중심은 하나면 되고, 무리를 쫓는 추격은 그룹 전체가 필요하다.
대상과 앵커 모두 `world.rev`가 바뀔 때만 다시 고른다 (매 프레임 재검색 없음).

**같은 코어를 여러 번** 걸 수도 있다. 그때 파라미터는 패치 key로 갈린다 — 유일하면 `id`,
겹치면 `id@대상`. `overrides`와 URL 파라미터가 같은 key를 쓴다:

```ts
patch: [
  { core: orbit, target: 'sun' },
  { core: orbit, target: 'planet' },
  { core: orbit, target: 'moon', anchor: 'planet' }   // 행성을 도는 달
],
overrides: { 'orbit@moon': { spin: 1 } }               // 조석 고정
```
```
/?demo=orbit&p=orbit@moon.rev:0.4
```

수치 채널은 write mode로 합성한다: **set 하나 + add 여럿**. `scale`은 엔진이 매 스텝 (1,1)로
되돌리므로 deform 코어들이 `mul`로 겹쳐 쌓인다. 대상을 안 적으면 `'*'`(전체)라서 기존 프리셋은 그대로 돈다.

선언 기준은 **다른 코어의 기여가 살아남는가**다 — 살아남으면 `add`, 지워지면 `set`.
그래서 `NoiseField`(vel add)는 `Boids`(vel add) 위에 얹히지만 `Bounce`(vel set)와 겹치면 경고가 뜬다.
그 장면을 `⚠ 충돌 예시` 프리셋으로 남겨 뒀다 — 경고가 어떻게 생기는지 눌러 볼 수 있다.

## 새 코어 추가하기

1. `src/lib/cores/<id>.ts` — 상단 주석에 **원리 한 줄 + 표기법**, `meta` + `params`(ParamDef) + `step`.
   코어는 `w.entities`가 아니라 **`ctx.targets`**를 순회하고, 엔티티는 `ctx.spawn()`으로 만든다.
2. `src/lib/cores/index.ts` 레지스트리에 등록.
3. `src/lib/demos.ts`에 프리셋 등록. 표기법 문자열은 엔진이 만든다.
4. `pnpm check:cores`로 게이트 통과 확인 → `pnpm gen:meta`로 아카이브 갱신 (dev/build가 자동으로 돌린다).

## 배포

**https://kinesynth.vercel.app** — `main`에 푸시하면 자동 배포된다.

`@sveltejs/adapter-vercel` + `+layout.ts`의 `prerender = true` → 서버리스 함수 없이
CDN에서 정적으로 나간다. `vercel.json`이 SvelteKit 프리셋을 고정한다.
배포 후 `pnpm smoke`로 실제 URL에서 코어 스택·URL 파라미터·프레임레이트를 확인한다.

## 신호 보기

코어들은 `sig` 채널로 서로에게 신호를 보낸다 — `sig.impact`(접지 충격), `sig.stuck`(굳음),
`sig.flee`(직접 본 위협), `sig.panic`(번진 겁). 뷰어의 **「신호 보기」**가 그 값(0~1)으로
엔티티를 물들인다. 차가움 0 → 뜨거움 1.

목록은 **코어의 `writes` 선언에서 나온다** — Lissajous를 열면 선택기가 없고,
Bounce를 열면 `sig.impact`만 나온다. 소유 규칙을 위해 적어 둔 선언이 또 한 번 일한다.

## 공유

뷰어의 `⧉ 공유` (단축키 `C`)는 **표기법과 링크를 함께** 복사한다.

```
Orbit(spin:rev)@entity[sun] + Orbit(spin:rev)@entity[planet] + Orbit(spin:rev)@entity[moon←planet]
https://kinesynth.vercel.app/?demo=orbit&trail=1&p=orbit@moon.rev:0.4
```

링크만으로는 무엇을 보는지 알 수 없다. 표기법이 붙으면 공유물이 스스로를 설명한다 —
그대로 아카이브 항목이 되고, SNS 캡션이 되고, 학생 제출 포맷이 된다.
프리셋 기본값에서 벗어난 것만 실어 링크는 짧게 유지되고, **일시정지 중이면 그 프레임까지** 담긴다.

발견한 것은 [`notes/`](notes/)에 한 건씩 남긴다 — 표기법·링크·그림·수치 네 가지로.

## 조작

`Space` 재생/일시정지 · `R` 리셋 · `C` 공유 복사 · 슬라이더는 ParamDef에서 자동 생성된다.
