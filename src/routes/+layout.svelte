<script lang="ts">
	let { children } = $props();
</script>

<svelte:head>
	<title>Kinesynth — 움직임 코어 시스템</title>
	<meta name="description" content="과학·수학의 원리를 점·선·면의 반복 움직임으로 추상화하고 합성한다." />
</svelte:head>

{@render children()}

<style>
	:global(html) {
		color-scheme: dark;
	}
	:global(body) {
		margin: 0;
		background: #0a0c11;
		color: #dce7ff;
		font-family:
			'Pretendard', -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', system-ui,
			sans-serif;
		-webkit-font-smoothing: antialiased;
	}
	:global(*) {
		box-sizing: border-box;
	}
</style>
