<!--
  Kinesynth · 뷰어
  코어 스택을 돌리고, 표기법과 원리를 항상 화면에 띄운다 (강의 화면 겸용).
  파라미터 슬라이더는 각 코어의 ParamDef 배열에서 자동 생성된다.
-->
<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { browser } from '$app/environment';
	import { createEngine, type Engine } from '$lib/core/engine';
	import { toSeed } from '$lib/core/rand';
	import { demoById, demos, principles, scenes } from '$lib/demos';
	import { drawWorld, fitCanvas } from '$lib/render';
	import { groundY } from '$lib/cores/bounce';
	import type { Core, Params } from '$lib/core/types';

	let canvas: HTMLCanvasElement;
	let stage: HTMLDivElement;

	/**
	 * URL 파라미터 = 아카이브·강의용 공유 링크 겸 결정론적 스크린샷 훅.
	 *   ?demo=bounce-squash&seed=1&trail=1&t=0.75&p=squash.exa:2.5,bounce.e:0.9
	 *   t를 주면 그 시각까지 고정 스텝으로 감고 멈춘다 (같은 시드 → 항상 같은 그림).
	 */
	const q = new URLSearchParams(browser ? location.search : '');

	let demoId = $state(q.get('demo') ?? demos[1].id); // 시그니처 데모(Bounce+Squash)로 시작
	let seedText = $state(q.get('seed') ?? '1');
	let playing = $state(!q.has('t'));
	let trail = $state(q.get('trail') === '1');
	let notation = $state('');
	let fps = $state(0);
	let ui = $state<{ core: Core; key: string; target: string; anchor?: string; vals: Params }[]>([]);
	let warnings = $state<string[]>([]);

	// $state.raw — 재할당만 반응형. 월드를 깊은 프록시로 감싸면 60fps 변형이 다 추적돼 느려진다.
	let engine = $state.raw<Engine | null>(null);
	/** 프리셋이 주는 값 (코어 기본값 + overrides). 공유 URL은 여기서 벗어난 것만 싣는다. */
	let baseline: Record<string, Params> = {};
	let shared = $state<'idle' | 'ok' | 'fail'>('idle');
	let sharedAt = 0;

	const demo = $derived(demoById(demoId));

	let booted = false;
	let firstBuild = true;

	/** ?p=squash.exa:2.5,bounce.e:0.9 → 코어별 파라미터 덮어쓰기 */
	function applyUrlParams(e: Engine) {
		for (const pair of (q.get('p') ?? '').split(',')) {
			const [path, raw] = pair.split(':');
			if (!path || raw === undefined) continue;
			const [coreId, key] = path.split('.');
			const v = Number(raw);
			if (e.values[coreId] && key in e.values[coreId] && Number.isFinite(v)) {
				e.values[coreId][key] = v;
			}
		}
	}

	function build() {
		const d = demoById(untrack(() => demoId));
		const r = stage.getBoundingClientRect();
		engine = createEngine(d.patch, {
			seed: toSeed(untrack(() => seedText)),
			bounds: { w: r.width, h: r.height }
		});
		for (const [id, over] of Object.entries(d.overrides ?? {})) {
			Object.assign(engine.values[id], over);
		}
		engine.trailLen = d.trailLen;
		baseline = {};
		for (const pt of engine.stack) baseline[pt.key] = { ...engine.values[pt.key] };
		if (firstBuild) applyUrlParams(engine);
		engine.reset();
		if (firstBuild) {
			firstBuild = false;
			const t = Number(q.get('t'));
			if (Number.isFinite(t) && t > 0) engine.seek(t);
		}
		// vals는 표시용 반응형 사본. 엔진은 자기 레코드를 읽으므로 setParam이 양쪽 다 쓴다.
		ui = engine.stack.map((pt) => ({
			core: pt.core,
			key: pt.key,
			target: pt.target,
			anchor: pt.anchor,
			vals: { ...engine!.values[pt.key] }
		}));
		notation = engine.notation();
		warnings = engine.warnings;
	}

	/** 슬라이더 → 화면 표시(반응형 사본) + 시뮬레이션(엔진 레코드) 양쪽에 쓴다. */
	function setParam(item: { key: string; vals: Params }, key: string, v: number) {
		item.vals[key] = v;
		if (engine) engine.values[item.key][key] = v;
	}

	const round = (v: number) => Number(v.toFixed(6));

	/**
	 * 지금 화면 그대로를 여는 링크. 프리셋 기본값에서 벗어난 것만 실어 짧게 유지한다.
	 * 일시정지 중이면 `t`까지 실어서 **바로 그 프레임**이 다시 열린다.
	 */
	function shareUrl(): string {
		const d = demoById(demoId);
		const parts = [`demo=${demoId}`];
		if (seedText !== String(d.seed)) parts.push(`seed=${encodeURIComponent(seedText)}`);
		if (trail !== d.trail) parts.push(`trail=${trail ? 1 : 0}`);
		if (!playing && engine) parts.push(`t=${engine.world.t.toFixed(3)}`);

		const diffs: string[] = [];
		for (const item of ui) {
			const base = baseline[item.key] ?? {};
			for (const def of item.core.params) {
				const v = round(engine?.values[item.key][def.key] ?? def.value);
				if (v !== round(base[def.key] ?? def.value)) diffs.push(`${item.key}.${def.key}:${v}`);
			}
		}
		if (diffs.length) parts.push(`p=${diffs.join(',')}`);
		return `${location.origin}${location.pathname}?${parts.join('&')}`;
	}

	/**
	 * 표기법 + 링크를 함께 복사한다. 링크만으로는 무엇을 보는지 알 수 없다 —
	 * 표기법이 붙으면 공유물이 스스로를 설명한다 (아카이브 항목 · SNS 캡션 · 학생 제출 포맷).
	 */
	const shareText = () => `${notation}\n${shareUrl()}`;

	async function copyShare() {
		const text = shareText();
		try {
			await navigator.clipboard.writeText(text);
			shared = 'ok';
		} catch {
			shared = 'fail';
			console.log(text); // 클립보드가 막혔을 때의 마지막 수단
		}
		sharedAt = Date.now();
		const at = sharedAt;
		setTimeout(() => {
			if (sharedAt === at) shared = 'idle';
		}, 2200);
	}

	function reset() {
		if (!engine) return;
		engine.seed = toSeed(seedText);
		engine.reset();
	}

	// 프리셋을 바꾸면 스택을 다시 세운다. 시드 입력은 리셋 버튼으로만 반영.
	$effect(() => {
		const id = demoId;
		untrack(() => {
			const d = demoById(id);
			// 첫 실행에서는 URL이 지정한 값을 프리셋 기본값이 덮지 않게 한다.
			if (!booted) {
				booted = true;
				if (!q.has('trail')) trail = d.trail;
				if (!q.has('seed')) seedText = String(d.seed);
			} else {
				trail = d.trail;
				seedText = String(d.seed);
			}
			build();
		});
	});

	onMount(() => {
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		const ro = new ResizeObserver(() => {
			const r = stage.getBoundingClientRect();
			fitCanvas(canvas, r.width, r.height);
			engine?.setBounds({ w: r.width, h: r.height });
		});
		ro.observe(stage);

		let raf = 0;
		let last = performance.now();
		let acc = 0;
		let frames = 0;

		function frame(now: number) {
			raf = requestAnimationFrame(frame);
			const dt = Math.min((now - last) / 1000, 0.25);
			last = now;

			acc += dt;
			frames++;
			if (acc >= 0.5) {
				fps = Math.round(frames / acc);
				acc = 0;
				frames = 0;
			}

			if (!engine || !ctx) return;
			if (playing) engine.advance(dt);

			const r = stage.getBoundingClientRect();
			const hasGround = engine.stack.some((pt) => pt.core.meta.id === 'bounce');
			drawWorld(ctx, engine.world, r.width, r.height, {
				trails: trail ? engine.trails : undefined,
				groundY: hasGround ? groundY(engine.world) : undefined
			});

			const n = engine.notation();
			if (n !== notation) notation = n;
		}
		raf = requestAnimationFrame(frame);

		return () => {
			cancelAnimationFrame(raf);
			ro.disconnect();
		};
	});

	function onKey(ev: KeyboardEvent) {
		if (ev.target instanceof HTMLInputElement) return;
		if (ev.code === 'Space') {
			ev.preventDefault();
			playing = !playing;
		} else if (ev.key === 'r' || ev.key === 'R') {
			reset();
		} else if (ev.key === 'c' || ev.key === 'C') {
			copyShare();
		}
	}
</script>

<svelte:window onkeydown={onKey} />

<main>
	<header>
		<div class="brand">
			<h1>Kinesynth</h1>
			<span class="sub">움직임 코어 시스템 · v0.1</span>
		</div>
		<div class="notation" data-testid="notation">{notation}</div>
	</header>

	<div class="body">
		<div class="stage" bind:this={stage}>
			<canvas bind:this={canvas}></canvas>
			<div class="badge">{fps || '–'} fps · {engine?.world.entities.length ?? 0} entities</div>
		</div>

		<aside>
			<section class="block">
				<label class="lbl" for="demo">데모</label>
				<select id="demo" bind:value={demoId}>
					<optgroup label="원리 — 코어 하나가 보이는 최소 조합">
						{#each principles as d (d.id)}
							<option value={d.id}>{d.title}</option>
						{/each}
					</optgroup>
					<optgroup label="장면 — 합쳐져 맥락이 읽히는 것">
						{#each scenes as d (d.id)}
							<option value={d.id}>{d.title}</option>
						{/each}
					</optgroup>
				</select>
				<p class="form">{demo.form}</p>
			</section>

			<section class="block">
				<div class="row">
					<button class="primary" onclick={() => (playing = !playing)}>
						{playing ? '❙❙ 일시정지' : '▶ 재생'}
					</button>
					<button onclick={reset}>↺ 리셋</button>
					<button data-testid="share" onclick={copyShare}>
						{shared === 'ok' ? '✓ 복사됨' : shared === 'fail' ? '복사 실패' : '⧉ 공유'}
					</button>
				</div>
				<p class="form" class:ok={shared === 'ok'}>
					{shared === 'ok'
						? '표기법 + 링크를 복사했습니다. 일시정지 중이면 그 프레임까지 담깁니다.'
						: '공유는 표기법과 링크를 함께 복사합니다 (C)'}
				</p>
			</section>

			<section class="block row">
				<label class="lbl grow" for="seed">시드</label>
				<input
					id="seed"
					class="seed"
					bind:value={seedText}
					onkeydown={(e) => e.key === 'Enter' && reset()}
				/>
				<label class="chk"><input type="checkbox" bind:checked={trail} /> 트레일</label>
			</section>

			{#if warnings.length}
				<section class="block warn">
					<div class="warn-head">소유 규칙 위반 {warnings.length}건</div>
					{#each warnings as m (m)}<p>{m}</p>{/each}
				</section>
			{/if}

			{#each ui as item (item.key)}
				<section class="block core">
					<div class="core-head">
						<span class="core-name">{item.core.meta.name}</span>
						<span class="tag">{item.core.meta.level}</span>
						<span class="tag alt">{item.core.meta.repeat}</span>
						{#if item.target !== '*'}
							<span class="tag tgt">[{item.target}{item.anchor ? `←${item.anchor}` : ''}]</span>
						{/if}
					</div>
					<p class="principle">{item.core.meta.principle}</p>
					{#each item.core.params as def (def.key)}
						<div class="param" class:exa={def.key === 'exa'}>
							<div class="param-head">
								<span>{def.label}</span>
								<b>{item.vals[def.key].toFixed(def.step && def.step >= 1 ? 0 : 2)}</b>
							</div>
							<input
								type="range"
								min={def.min}
								max={def.max}
								step={def.step ?? 0.01}
								data-testid={`p-${item.key}-${def.key}`}
								value={item.vals[def.key]}
								oninput={(ev) => setParam(item, def.key, ev.currentTarget.valueAsNumber)}
							/>
						</div>
					{/each}
				</section>
			{/each}
		</aside>
	</div>
</main>

<style>
	main {
		display: flex;
		flex-direction: column;
		height: 100dvh;
	}
	header {
		display: flex;
		align-items: baseline;
		gap: 1.25rem;
		padding: 0.85rem 1.1rem;
		border-bottom: 1px solid #1a2030;
		flex-wrap: wrap;
	}
	.brand {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
	}
	h1 {
		font-size: 1.05rem;
		margin: 0;
		letter-spacing: 0.02em;
	}
	.sub {
		font-size: 0.72rem;
		color: #6e7d99;
	}
	.notation {
		font-family: ui-monospace, 'SF Mono', Menlo, monospace;
		font-size: 0.82rem;
		color: #8fb4ff;
		background: #101524;
		border: 1px solid #1e2942;
		border-radius: 6px;
		padding: 0.3rem 0.6rem;
	}
	.body {
		display: flex;
		flex: 1;
		min-height: 0;
	}
	.stage {
		position: relative;
		flex: 1;
		min-width: 0;
		background: #0a0c11;
	}
	canvas {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		display: block;
	}
	.badge {
		position: absolute;
		left: 0.75rem;
		bottom: 0.6rem;
		font-size: 0.68rem;
		color: #55637d;
		font-family: ui-monospace, Menlo, monospace;
	}
	aside {
		width: 300px;
		flex: none;
		border-left: 1px solid #1a2030;
		overflow-y: auto;
		padding: 0.85rem;
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
	}
	.block {
		background: #0e1220;
		border: 1px solid #1a2030;
		border-radius: 8px;
		padding: 0.65rem;
	}
	.row {
		display: flex;
		align-items: center;
		gap: 0.45rem;
	}
	.grow {
		flex: none;
	}
	.lbl {
		font-size: 0.7rem;
		color: #6e7d99;
		display: block;
		margin-bottom: 0.35rem;
	}
	.row .lbl {
		margin: 0;
	}
	select,
	input.seed {
		width: 100%;
		background: #131a2b;
		color: #dce7ff;
		border: 1px solid #24304a;
		border-radius: 6px;
		padding: 0.35rem 0.45rem;
		font: inherit;
		font-size: 0.8rem;
	}
	input.seed {
		width: 5.5rem;
	}
	.form {
		margin: 0.5rem 0 0;
		font-size: 0.72rem;
		color: #7d8cab;
		line-height: 1.45;
	}
	.form.ok {
		color: #8fb4ff;
	}
	button {
		background: #1a2338;
		color: #dce7ff;
		border: 1px solid #2a3a5c;
		border-radius: 6px;
		padding: 0.4rem 0.6rem;
		font: inherit;
		font-size: 0.78rem;
		cursor: pointer;
		flex: 1;
	}
	button:hover {
		background: #22304d;
	}
	button.primary {
		background: #24406f;
		border-color: #35598f;
	}
	.chk {
		font-size: 0.75rem;
		color: #9fb0cf;
		display: flex;
		align-items: center;
		gap: 0.3rem;
		white-space: nowrap;
	}
	.core-head {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		margin-bottom: 0.3rem;
	}
	.core-name {
		font-size: 0.82rem;
		font-weight: 600;
	}
	.tag {
		font-size: 0.6rem;
		color: #8fb4ff;
		border: 1px solid #26355a;
		border-radius: 999px;
		padding: 0.05rem 0.4rem;
	}
	.tag.alt {
		color: #b39cff;
		border-color: #37305e;
	}
	.tag.tgt {
		color: #ffd18f;
		border-color: #5a4526;
		font-family: ui-monospace, Menlo, monospace;
	}
	.block.warn {
		background: #241a12;
		border-color: #5a4526;
	}
	.warn-head {
		font-size: 0.75rem;
		font-weight: 600;
		color: #ffb44d;
		margin-bottom: 0.35rem;
	}
	.block.warn p {
		margin: 0.25rem 0 0;
		font-size: 0.7rem;
		line-height: 1.5;
		color: #d7c3a6;
	}
	.principle {
		margin: 0 0 0.55rem;
		font-size: 0.72rem;
		color: #7d8cab;
		line-height: 1.5;
	}
	.param {
		margin-top: 0.5rem;
	}
	.param-head {
		display: flex;
		justify-content: space-between;
		font-size: 0.7rem;
		color: #9fb0cf;
		margin-bottom: 0.15rem;
	}
	.param-head b {
		color: #dce7ff;
		font-family: ui-monospace, Menlo, monospace;
		font-weight: 500;
	}
	.param.exa .param-head b {
		color: #ffd18f;
	}
	.param.exa input[type='range'] {
		accent-color: #ffb44d;
	}
	input[type='range'] {
		width: 100%;
		accent-color: #4f7fd4;
		height: 1.1rem;
	}
</style>
