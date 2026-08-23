// 코어 모듈을 Vite의 SSR 로더로 읽는다 — 앱과 똑같은 모듈 해석을 쓰기 위해서.
// (Node의 타입 스트리핑만으로는 확장자 없는 상대 경로를 못 푼다.)
import { createServer } from 'vite';

export async function loadCores() {
	const server = await createServer({
		configFile: false,
		server: { middlewareMode: true },
		logLevel: 'error'
	});
	try {
		const mod = await server.ssrLoadModule(process.cwd() + '/src/lib/cores/index.ts');
		return mod.cores;
	} finally {
		await server.close();
	}
}
