/**
 * Kinesynth · 스크린샷 기록 (PRD §6 검증)
 *
 * 결정론적 촬영은 뷰어의 URL 훅(?t=)을 쓴다 — 같은 시드 + 같은 t = 항상 같은 그림.
 * 트레일 데모만 실제 시간을 흘려보낸다 (잔상은 프레임 누적의 결과라서).
 */
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const SHOTS = 'shots';
mkdirSync(SHOTS, { recursive: true });

/** 캔버스가 최소 한 프레임 그려질 때까지 기다린다. */
async function ready(page: Page) {
	await page.locator('canvas').waitFor();
	await page.waitForFunction(() => {
		const c = document.querySelector('canvas');
		return !!c && c.width > 0;
	});
	await page.evaluate(
		() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
	);
}

/** 여러 장을 브라우저 캔버스에서 나란히 합성 — 외부 이미지 라이브러리 없이. */
async function strip(
	page: Page,
	shots: string[],
	labels: string[],
	out: string,
	cropBottom = 1
): Promise<void> {
	const composed = await page.evaluate(
		async ({ shots, labels, cropBottom }) => {
			const load = (src: string) =>
				new Promise<HTMLImageElement>((res) => {
					const img = new Image();
					img.onload = () => res(img);
					img.src = src;
				});
			const imgs = await Promise.all(shots.map(load));
			const gap = 16;
			const bar = 56;
			const w = imgs[0].width;
			const h = Math.round(imgs[0].height * cropBottom);
			const cv = document.createElement('canvas');
			cv.width = w * imgs.length + gap * (imgs.length - 1);
			cv.height = h + bar;
			const ctx = cv.getContext('2d')!;
			ctx.fillStyle = '#0a0c11';
			ctx.fillRect(0, 0, cv.width, cv.height);
			ctx.font = '600 30px system-ui, sans-serif';
			imgs.forEach((im, i) => {
				const x = i * (w + gap);
				ctx.drawImage(im, 0, im.height - h, w, h, x, bar, w, h);
				ctx.fillStyle = i === imgs.length - 1 ? '#ffb44d' : '#dce7ff';
				ctx.fillText(labels[i], x + 24, 38);
				if (i > 0) {
					ctx.strokeStyle = '#1e2942';
					ctx.beginPath();
					ctx.moveTo(x - gap / 2, bar);
					ctx.lineTo(x - gap / 2, cv.height);
					ctx.stroke();
				}
			});
			return cv.toDataURL('image/png');
		},
		{ shots, labels, cropBottom }
	);
	writeFileSync(out, Buffer.from(composed.split(',')[1], 'base64'));
}

const pair = (page: Page, shots: string[], labels: [string, string], out: string) =>
	strip(page, shots, labels, out);

/** stage 스크린샷을 data URL로. */
async function shot(page: Page, url: string): Promise<string> {
	await page.goto(url);
	await ready(page);
	const buf = await page.locator('.stage').screenshot();
	return `data:image/png;base64,${buf.toString('base64')}`;
}

test('lissajous — 점이 트레일로 선이 된다', async ({ page }) => {
	// t=7 → 한 바퀴(6.25s)를 다 감은 상태. 궤적은 엔진이 기록하므로 seek에서도 남는다.
	await page.goto('/?demo=lissajous&trail=1&seed=1&t=7');
	await ready(page);
	await expect(page.getByTestId('notation')).toHaveText('Lissajous(a:b, δ)@entity');
	await page.locator('.stage').screenshot({ path: `${SHOTS}/01-lissajous.png` });
});

// 1280×800 뷰포트 기준 stage 높이 746px → 첫 접지가 step 45 (t=0.7667).
// 낙하 거리가 뷰포트에 따라 달라지므로 t는 이 뷰포트에 묶여 있다.
const T_IMPACT = 0.767;

test('bounce + squash — 코어 스택 합성', async ({ page }) => {
	await page.goto(`/?demo=bounce-squash&seed=1&trail=1&t=${T_IMPACT}`);
	await ready(page);
	await expect(page.getByTestId('notation')).toHaveText(
		'Bounce(g, e)@entity + Squash(vel.y→scale)@deform ×exa1.8'
	);
	await page.locator('.stage').screenshot({ path: `${SHOTS}/02-bounce-squash.png` });
});

test('exa 1.0 vs 2.5 — 사실에서 만화로', async ({ page }) => {
	const shots: string[] = [];
	for (const exa of [1.0, 2.5]) {
		shots.push(await shot(page, `/?demo=bounce-squash&seed=1&t=${T_IMPACT}&p=squash.exa:${exa}`));
	}
	await pair(page, shots, ['exa 1.0 — 물리적 사실', 'exa 2.5 — 만화'], `${SHOTS}/03-exa-compare.png`);
});

test('boids + elastic — 점이 늘어나 선이 되는 새떼', async ({ page }) => {
	await page.goto('/?demo=boids-elastic&seed=7&t=22');
	await ready(page);
	await expect(page.getByTestId('notation')).toHaveText(
		'Boids(분리·정렬·응집)@flock + Elastic(vel→stretch)@deform ×exa1.8'
	);
	await page.locator('.stage').screenshot({ path: `${SHOTS}/04-boids-elastic.png` });
});

test('exa 0 vs 1.8 — 점이 선이 되는 순간', async ({ page }) => {
	const shots: string[] = [];
	for (const exa of [0, 1.8]) {
		shots.push(await shot(page, `/?demo=boids-elastic&seed=7&t=22&p=elastic.exa:${exa}`));
	}
	await pair(page, shots, ['exa 0 — 점', 'exa 1.8 — 선'], `${SHOTS}/05-boids-exa.png`);
});

test('spring — 꼬리가 궤적을 벗어난다 (팔로우스루)', async ({ page }) => {
	await page.goto('/?demo=lissajous-spring&seed=1&trail=1&t=7.4');
	await ready(page);
	await expect(page.getByTestId('notation')).toHaveText(
		'Lissajous(a:b, δ)@entity + Spring(chain)@deform ×exa1.8'
	);
	const shots: string[] = [];
	for (const exa of [0, 1.8]) {
		shots.push(await shot(page, `/?demo=lissajous-spring&seed=1&trail=1&t=7.4&p=spring.exa:${exa}`));
	}
	// 옅은 선이 몸이 지나간 길, 밝은 선이 꼬리. exa 0이면 둘이 겹친다.
	await pair(page, shots, ['exa 0 — 궤적을 그대로', 'exa 1.8 — 벗어났다 돌아온다'], `${SHOTS}/06-spring.png`);
});

test('dla — 점이 붙어 가지가 된다', async ({ page }) => {
	await page.goto('/?demo=dla&seed=3&t=30');
	await ready(page);
	await expect(page.getByTestId('notation')).toHaveText('DLA(격자 성장)@entity');
	await page.locator('.stage').screenshot({ path: `${SHOTS}/07-dla.png` });
});

test('fractal zoom — 배율이 달라도 같은 가지 (자기유사)', async ({ page }) => {
	// 같은 t = 같은 결정. base만 바꿔 배율만 다르게 본다 (zoom = base^frac(t·rate)).
	await page.goto('/?demo=dla-zoom&seed=3&t=40');
	await ready(page);
	await expect(page.getByTestId('notation')).toHaveText(
		'FractalZoom(base, rate)@space + DLA(격자 성장)@entity'
	);
	const shots: string[] = [];
	for (const base of [1.2, 4]) {
		shots.push(await shot(page, `/?demo=dla-zoom&seed=3&t=40&p=fractalZoom.base:${base}`));
	}
	await pair(page, shots, ['×1.1', '×2.3 — 같은 가지'], `${SHOTS}/08-fractal-zoom.png`);
});

test('bounce + squash + spring — 라우팅으로 갈라 건 팔로우스루', async ({ page }) => {
	await page.goto('/?demo=bounce-tail&seed=1&t=0.79');
	await ready(page);
	await expect(page.getByTestId('notation')).toHaveText(
		'Bounce(g, e)@entity[ball] + Squash(vel.y→scale)@deform[ball]×exa1.8 + ' +
			'Spring(chain)@deform[tail←ball]×exa1.8'
	);
	await expect(page.locator('.badge')).toContainText('2 entities');

	// 낙하 → 접지 → 되튐. 몸이 멈춘 순간 꼬리는 계속 내려간다.
	const shots: string[] = [];
	for (const t of [0.72, 0.79, 0.95]) {
		shots.push(await shot(page, `/?demo=bounce-tail&seed=1&t=${t}`));
	}
	await strip(
		page,
		shots,
		['0.72s — 낙하, 늘어남', '0.79s — 접지, 꼬리는 계속 내려간다', '0.95s — 되튐, 꼬리가 감긴다'],
		`${SHOTS}/09-bounce-tail.png`,
		0.62
	);
});

test('noise field — 바람이 vel에 더해진다 (write mode add)', async ({ page }) => {
	await page.goto('/?demo=noise-flock&seed=5&trail=1&t=18');
	await ready(page);
	await expect(page.getByTestId('notation')).toHaveText(
		'NoiseField(flow)@space + Boids(분리·정렬·응집)@flock + Elastic(vel→stretch)@deform ×exa1.8'
	);
	const shots: string[] = [];
	for (const force of [0, 380]) {
		shots.push(
			await shot(page, `/?demo=noise-flock&seed=5&trail=1&t=18&p=noiseField.force:${force}`)
		);
	}
	await pair(page, shots, ['바람 0 — 무리 규칙만', '바람 380 — 흐름이 얹힌다'], `${SHOTS}/10-noise-flock.png`);
});

test('fourier — 원 위의 원이 글자를 그린다', async ({ page }) => {
	await page.goto('/?demo=fourier&seed=1&trail=1&t=14.3');
	await ready(page);
	await expect(page.getByTestId('notation')).toHaveText('Fourier(N항)@entity');
	const shots: string[] = [];
	for (const n of [3, 16]) {
		shots.push(await shot(page, `/?demo=fourier&seed=1&trail=1&t=14.3&p=fourier.terms:${n}`));
	}
	// 항이 모자라면 높은 주파수가 빠져 모서리부터 뭉개진다
	await pair(page, shots, ['N=3 — 뭉개짐', 'N=16 — 글자가 된다'], `${SHOTS}/11-fourier.png`);
});

test('orbit — 자전 + 공전 중첩 (한 코어를 세 번)', async ({ page }) => {
	await page.goto('/?demo=orbit&seed=1&trail=1&t=20');
	await ready(page);
	await expect(page.getByTestId('notation')).toHaveText(
		'Orbit(spin:rev)@entity[sun] + Orbit(spin:rev)@entity[planet] + ' +
			'Orbit(spin:rev)@entity[moon←planet]'
	);
	await expect(page.locator('.badge')).toContainText('3 entities');

	// 세계에서 본 달의 궤적은 원 위의 원. 두 주기의 비가 고리 수를 정한다.
	const shots: string[] = [];
	for (const rev of [0.15, 0.4]) {
		shots.push(await shot(page, `/?demo=orbit&seed=1&trail=1&t=20&p=orbit@moon.rev:${rev}`));
	}
	await pair(page, shots, ['달 : 행성 = 3 : 1', '= 8 : 1'], `${SHOTS}/12-orbit.png`);
});

test('장면 · 바람 속 군무', async ({ page }) => {
	await page.goto('/?demo=scene-murmuration&t=34');
	await ready(page);
	await expect(page.getByTestId('notation')).toHaveText(
		'NoiseField(flow)@space + Boids(분리·정렬·응집)@flock + Elastic(vel→stretch)@deform ×exa1.8'
	);
	await expect(page.locator('.block.warn')).toHaveCount(0);
	await page.locator('.stage').screenshot({ path: `${SHOTS}/13-scene-murmuration.png` });
});

test('장면 · 포식자 산개', async ({ page }) => {
	await page.goto('/?demo=scene-hunt&t=17.4');
	await ready(page);
	// 무리와 포식자가 라우팅으로 갈려 있다 — Elastic이 [bird]에만 걸려 rot 충돌이 없다
	await expect(page.getByTestId('notation')).toHaveText(
		'Flee(거리→회피)@flock[bird←hunter] + Boids(분리·정렬·응집)@flock[bird] + ' +
			'Orbit(spin:rev)@entity[hunter] + Elastic(vel→stretch)@deform[bird] ×exa1.8'
	);
	await expect(page.locator('.block.warn')).toHaveCount(0);

	const shots: string[] = [];
	for (const t of [15.6, 16.8, 17.4]) {
		shots.push(await shot(page, `/?demo=scene-hunt&t=${t}`));
	}
	await strip(
		page,
		shots,
		['15.6s — 무리가 휜다', '16.8s — 뚫고 들어온다', '17.4s — 한 갈래가 뜯긴다'],
		`${SHOTS}/14-scene-hunt.png`
	);
});

test('장면 · 사냥 — 그룹 앵커', async ({ page }) => {
	await page.goto('/?demo=scene-chase&t=24');
	await ready(page);
	// Seek의 앵커가 그룹이다: [hunter←bird] — bird 하나가 아니라 bird 전부를 본다
	await expect(page.getByTestId('notation')).toHaveText(
		'Flee(거리→회피)@flock[bird←hunter] + Boids(분리·정렬·응집)@flock[bird] + ' +
			'Seek(가장 가까운 것→요격)@entity[hunter←bird] + Elastic(vel→stretch)@deform[bird] ×exa1.8'
	);
	await expect(page.locator('.badge')).toContainText('151 entities');
	await expect(page.locator('.block.warn')).toHaveCount(0);

	const shots: string[] = [];
	for (const t of [21, 24, 27]) {
		shots.push(await shot(page, `/?demo=scene-chase&t=${t}`));
	}
	await strip(
		page,
		shots,
		['21s — 앞질러 간다', '24s — 무리를 가른다', '27s — 놓쳤다'],
		`${SHOTS}/15-scene-chase.png`
	);
});
