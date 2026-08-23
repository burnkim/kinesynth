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

- **합성 = 코어 스택.** 패치 케이블 없이 채널 공유로 모듈레이션이 일어난다 —
  Bounce가 쓴 `vel`과 `sig.impact`를 Squash가 읽는다. 실행 순서는 레벨 순
  `space → flock → entity → deform`.
- **`exa` (과장 계수).** 1.0 = 물리적 사실. 슬라이더 하나로 사실↔만화를 넘나든다.
  스타일 = 법칙 × 과장.
- **결정론.** 고정 타임스텝 1/60 + 시드 고정 난수(mulberry32) → 같은 시드 = 같은 움직임.

레벨 4종(space·flock·entity·deform)과 반복 4종(loop·steady·selfsim·event)이 모두 열려 있다.
도메인은 physics·math·bio·chem 4종 — earth만 비어 있다.

## URL로 상태 공유

뷰어는 URL 파라미터로 장면을 그대로 재현한다 (아카이브·강의 링크 겸 스크린샷 훅).

```
/?demo=bounce-squash&seed=1&t=0.767&p=squash.exa:2.5
/?demo=boids-elastic&seed=7&t=22&trail=1&p=boids.n:300
```

| 파라미터 | 뜻 |
|---|---|
| `demo` | 프리셋 id (`lissajous` · `bounce-squash` · `boids-elastic` · `lissajous-spring` · `dla` · `dla-zoom`) |
| `seed` | 숫자 또는 문자열 (문자열은 해시) |
| `trail` | `1`이면 궤적 |
| `t` | 그 시각까지 고정 스텝으로 감고 멈춘다 |
| `p` | `코어.파라미터:값` 쉼표 구분 |

## 구조

```
src/lib/core/    types.ts  rand.ts  engine.ts   ← 순수 TS. DOM·Svelte import 금지
src/lib/cores/   lissajous  bounce  squash  boids  elastic  spring  dla  fractalZoom
src/lib/meta/    cores.json                     ← 코어 아카이브 (PRD §11 스키마)
src/lib/         demos.ts  render.ts
src/routes/      +page.svelte                   ← 뷰어
tests/           shots.e2e.ts  viewer.e2e.ts
shots/           스크린샷 기록
```

**코어 파일 = 강의 자료.** 파일당 ~100줄, 상단 주석에 원리 한 줄 + 표기법.
`core/`·`cores/`는 외부 런타임 의존성 0 — 추후 독립 패키지로 뽑을 수 있게.

## 새 코어 추가하기

1. `src/lib/cores/<id>.ts` — 상단 주석에 **원리 한 줄 + 표기법**, `meta`(domain/level/repeat/writes) + `params`(ParamDef) + `step`.
2. `src/lib/demos.ts`에 프리셋 등록. 표기법 문자열은 엔진이 만든다.
3. `src/lib/meta/cores.json`에 메타 추가 (rule·refs·status).

## 배포

**https://kinesynth.vercel.app** — `main`에 푸시하면 자동 배포된다.

`@sveltejs/adapter-vercel` + `+layout.ts`의 `prerender = true` → 서버리스 함수 없이
CDN에서 정적으로 나간다. `vercel.json`이 SvelteKit 프리셋을 고정한다.
배포 후 `pnpm smoke`로 실제 URL에서 코어 스택·URL 파라미터·프레임레이트를 확인한다.

## 조작

`Space` 재생/일시정지 · `R` 리셋 · 슬라이더는 ParamDef에서 자동 생성된다.
