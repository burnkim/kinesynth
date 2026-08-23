/**
 * cores/index.ts → src/lib/meta/cores.json 생성.
 *
 *   node scripts/gen-meta.mjs          쓴다
 *   node scripts/gen-meta.mjs --check  최신인지만 확인하고 어긋나면 실패
 *
 * 코어 파일의 meta가 단일 소스다. json은 아카이브·외부 도구용 산출물일 뿐이다.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { loadCores } from './_load.mjs';

const OUT = 'src/lib/meta/cores.json';

function render(cores) {
	return {
		$generated: 'src/lib/cores/index.ts 에서 자동 생성됨 — 직접 고치지 말 것. `pnpm gen:meta`',
		schema: 'kinesynth.cores/v0.2',
		note: 'PRD §11 스키마. v0.2+에 nakcha/ital 스코어 필드가 추가된다 (ATLAS와 축 통일).',
		cores: cores.map((c) => {
			const m = c.meta;
			return {
				id: m.id,
				name_ko: m.nameKo,
				name_en: m.name,
				domain: m.domain,
				level: m.level,
				repeat: m.repeat,
				principle_ko: m.principle,
				rule: m.rule,
				params: c.params.map((p) => p.key),
				notation: m.notation,
				reads: m.reads ?? [],
				writes: m.writes.map((w) => `${w.channel}:${w.mode}`),
				...(m.anchor ? { anchor: m.anchor } : {}),
				refs: m.refs,
				status: m.status,
				createdAt: m.createdAt
			};
		})
	};
}

const cores = await loadCores();
const next = JSON.stringify(render(cores), null, '\t') + '\n';

if (process.argv.includes('--check')) {
	let cur = '';
	try {
		cur = readFileSync(OUT, 'utf8');
	} catch {
		/* 없으면 어긋난 것 */
	}
	if (cur !== next) {
		console.error(`✗ ${OUT}이 코어와 어긋납니다. \`pnpm gen:meta\`로 다시 만드세요.`);
		process.exit(1);
	}
	console.log(`✓ ${OUT} 최신 (코어 ${cores.length}건)`);
} else {
	writeFileSync(OUT, next);
	console.log(`✓ ${OUT} 생성 (코어 ${cores.length}건)`);
}
