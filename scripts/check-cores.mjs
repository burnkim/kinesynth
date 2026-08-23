/**
 * 코어 검증 — W4 학생 기여 게이트.
 *
 * 통과해야 레지스트리에 들어갈 수 있다:
 *   · 필수 메타가 다 있고 값이 허용 범위인가
 *   · 반복 유형·레벨·도메인을 실제로 선언했는가
 *   · 파라미터 범위가 말이 되는가 (min < max, 기본값이 그 안, step > 0)
 *   · deform 코어에 exa가 있는가 (PRD §4: 모든 deform 코어의 필수 파라미터)
 *   · 매 스텝 points를 쓰면 선언했는가 (선언 안 된 쓰기는 소유 감사기에 안 보인다)
 *   · core/·cores/가 순수 TS인가 (DOM·Svelte import 금지)
 */
import { readFileSync, readdirSync } from 'node:fs';
import { loadCores } from './_load.mjs';

const LEVELS = ['space', 'flock', 'entity', 'deform'];
const REPEATS = ['loop', 'steady', 'selfsim', 'event'];
const DOMAINS = ['physics', 'chem', 'bio', 'earth', 'math'];
const MODES = ['set', 'add', 'mul'];
const STATUS = ['idea', 'draft', 'done'];

const errors = [];
const warns = [];
const fail = (m) => errors.push(m);
const warn = (m) => warns.push(m);

// ── 1. 메타·파라미터
const cores = await loadCores();
const seen = new Set();

for (const c of cores) {
	const m = c.meta;
	const at = `[${m?.id ?? '?'}]`;
	if (!m) {
		fail('meta 없는 코어');
		continue;
	}
	for (const k of [
		'id',
		'name',
		'nameKo',
		'domain',
		'level',
		'repeat',
		'principle',
		'rule',
		'notation',
		'createdAt'
	]) {
		if (typeof m[k] !== 'string' || !m[k].trim()) fail(`${at} meta.${k} 가 비었다`);
	}
	if (seen.has(m.id)) fail(`${at} id가 중복이다`);
	seen.add(m.id);

	if (!LEVELS.includes(m.level)) fail(`${at} level '${m.level}' — ${LEVELS.join('|')} 중 하나여야 한다`);
	if (!REPEATS.includes(m.repeat)) fail(`${at} repeat '${m.repeat}' — ${REPEATS.join('|')} 중 하나여야 한다`);
	if (!DOMAINS.includes(m.domain)) fail(`${at} domain '${m.domain}' — ${DOMAINS.join('|')} 중 하나여야 한다`);
	if (!STATUS.includes(m.status)) fail(`${at} status '${m.status}'`);
	if (!/^\d{4}-\d{2}-\d{2}$/.test(m.createdAt)) fail(`${at} createdAt은 YYYY-MM-DD`);
	if (!Array.isArray(m.refs) || m.refs.length === 0) fail(`${at} refs가 비었다 — 원리의 출처를 적어야 한다`);
	if (m.principle.includes('\n')) fail(`${at} principle은 한 줄이어야 한다`);
	if (m.principle.length > 70) warn(`${at} principle이 ${m.principle.length}자 — 한 줄로 줄이는 게 좋다`);
	if (!m.notation.includes(`@${m.level}`)) fail(`${at} notation에 @${m.level}이 없다: '${m.notation}'`);

	if (!Array.isArray(m.writes) || m.writes.length === 0) fail(`${at} writes가 비었다`);
	for (const w of m.writes ?? []) {
		if (!MODES.includes(w.mode)) fail(`${at} writes '${w.channel}' 모드 '${w.mode}'`);
	}

	// 파라미터
	const keys = new Set();
	for (const d of c.params) {
		const pa = `${at} param '${d.key}'`;
		if (keys.has(d.key)) fail(`${pa} 중복`);
		keys.add(d.key);
		if (!d.label?.trim()) fail(`${pa} label이 비었다`);
		if (!(d.min < d.max)) fail(`${pa} min(${d.min}) < max(${d.max}) 이어야 한다`);
		if (d.value < d.min || d.value > d.max) fail(`${pa} 기본값 ${d.value}가 [${d.min}, ${d.max}] 밖`);
		if (d.step !== undefined && !(d.step > 0)) fail(`${pa} step은 0보다 커야 한다`);
	}
	if (m.level === 'deform' && !keys.has('exa')) {
		fail(`${at} deform 코어에는 exa가 필수다 (PRD §4)`);
	}
}

// ── 2. 순수성 + 선언되지 않은 points 쓰기
const PURE_DIRS = ['src/lib/core', 'src/lib/cores'];
const BANNED = /from\s+['"](svelte|\$app\/|\$lib\/render|.*\.svelte)['"]|\bdocument\.|\bwindow\.|\bnavigator\./;

for (const dir of PURE_DIRS) {
	for (const f of readdirSync(dir).filter((x) => x.endsWith('.ts'))) {
		const path = `${dir}/${f}`;
		const src = readFileSync(path, 'utf8');
		const hit = src.match(BANNED);
		if (hit) fail(`${path} 순수성 위반: ${hit[0].trim()} — core/·cores/는 DOM·Svelte를 모른다`);

		if (dir !== 'src/lib/cores' || f === 'index.ts') continue;
		const id = /id:\s*'([^']+)'/.exec(src)?.[1];
		const core = cores.find((c) => c.meta.id === id);
		if (!core) continue;
		// step 안에서 points에 대입하는데 선언에 없으면 소유 감사기가 못 본다
		const stepAt = src.indexOf('\tstep(');
		const body = stepAt < 0 ? '' : src.slice(stepAt);
		const writesPoints = /\be\.points\s*=|\bpts\[\d+\]\.\w\s*=|\ba\.x\s*=\s*b\.x/.test(body);
		const declared = core.meta.writes.some((w) => w.channel === 'points');
		if (writesPoints && !declared) {
			fail(`[${id}] step에서 points를 쓰는데 meta.writes에 없다 — 소유 감사기가 충돌을 못 잡는다`);
		}
	}
}

for (const m of warns) console.warn(`⚠ ${m}`);
if (errors.length) {
	for (const m of errors) console.error(`✗ ${m}`);
	console.error(`\n${errors.length}건 실패`);
	process.exit(1);
}
console.log(`✓ 코어 ${cores.length}건 검증 통과${warns.length ? ` (경고 ${warns.length}건)` : ''}`);
