/**
 * 결정론 회귀 검사.
 *
 *   node scripts/determinism.mjs          기준값을 다시 쓴다
 *   node scripts/determinism.mjs --check  어긋나면 실패
 *
 * 프리셋마다 고정 시드·고정 크기로 일정 시간 돌린 뒤 상태를 해시한다.
 * **같은 시드 = 같은 움직임**은 아카이브(`?t=` 링크)와 강의 시연의 전제다 —
 * 성능만 고치려던 변경이 결과를 바꿔 버리는 일을 여기서 잡는다.
 *
 * 모델을 일부러 바꿨다면(코어 수식·파라미터 기본값) 기준값을 다시 쓰는 게 맞다.
 * 그때는 그 프리셋을 가리키던 스크린샷과 노트의 수치도 같이 손봐야 한다.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'vite';

const OUT = 'tests/determinism.json';
const BOUNDS = { w: 960, h: 720 }; // 뷰포트와 무관하게 고정
const SECONDS = 12;

const server = await createServer({
	configFile: false,
	server: { middlewareMode: true },
	logLevel: 'error'
});

let result;
try {
	const { createEngine } = await server.ssrLoadModule(process.cwd() + '/src/lib/core/engine.ts');
	const { demos } = await server.ssrLoadModule(process.cwd() + '/src/lib/demos.ts');

	result = {};
	for (const d of demos) {
		const e = createEngine(d.patch, { seed: d.seed, bounds: BOUNDS });
		for (const [key, over] of Object.entries(d.overrides ?? {})) Object.assign(e.values[key], over);
		e.reset();
		e.seek(SECONDS);

		let h = 0;
		const bite = (v) => {
			h = (Math.imul(h, 31) + Math.round(v * 1e6)) | 0;
		};
		for (const q of e.world.entities) {
			bite(q.pos.x); bite(q.pos.y); bite(q.vel.x); bite(q.vel.y);
			bite(q.scale.x); bite(q.scale.y); bite(q.rot);
			bite(q.points.length); bite(q.closed ? 1 : 0);
			for (const k of Object.keys(q.sig).sort()) bite(q.sig[k]);
		}
		const c = e.world.camera;
		bite(c.x); bite(c.y); bite(c.zoom); bite(c.rot);
		result[d.id] = `${e.world.entities.length}:${h}`;
	}
} finally {
	await server.close();
}

const next = JSON.stringify({ seconds: SECONDS, bounds: BOUNDS, state: result }, null, '\t') + '\n';

if (process.argv.includes('--check')) {
	let cur = '';
	try {
		cur = readFileSync(OUT, 'utf8');
	} catch {
		/* 없으면 어긋난 것 */
	}
	if (cur === next) {
		console.log(`✓ 결정론 유지 (프리셋 ${Object.keys(result).length}건, ${SECONDS}초 시뮬레이션)`);
	} else {
		const old = cur ? JSON.parse(cur).state : {};
		const drift = Object.keys(result).filter((k) => old[k] !== result[k]);
		console.error(`✗ 결과가 달라졌습니다: ${drift.join(', ') || '(기준값 없음)'}`);
		console.error('  모델을 일부러 바꿨다면 `pnpm gen:determinism`으로 기준값을 다시 쓰고,');
		console.error('  그 프리셋을 가리키는 스크린샷·노트 수치도 같이 손보세요.');
		process.exit(1);
	}
} else {
	writeFileSync(OUT, next);
	console.log(`✓ ${OUT} 기록 (프리셋 ${Object.keys(result).length}건)`);
}
