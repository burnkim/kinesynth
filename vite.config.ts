import adapter from '@sveltejs/adapter-vercel';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			// Vercel 배포. +layout.ts의 prerender=true 때문에 서버리스 함수 없이 정적으로 나간다.
			// runtime은 명시해 둔다 — 로컬 Node 버전이 어댑터가 아는 목록 밖이어도 빌드가 통과하도록.
			adapter: adapter({ runtime: 'nodejs22.x' })
		})
	]
});
