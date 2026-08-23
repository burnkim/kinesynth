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
		await page.goto(`/?demo=bounce-squash&seed=1&t=${T_IMPACT}&p=squash.exa:${exa}`);
		await ready(page);
		const buf = await page.locator('.stage').screenshot();
		shots.push(`data:image/png;base64,${buf.toString('base64')}`);
	}

	// 두 장을 브라우저 캔버스에서 나란히 합성 — 외부 이미지 라이브러리 없이.
	const composed = await page.evaluate(async ([a, b]) => {
		const load = (src: string) =>
			new Promise<HTMLImageElement>((res) => {
				const img = new Image();
				img.onload = () => res(img);
				img.src = src;
			});
		const [ia, ib] = await Promise.all([load(a), load(b)]);
		const gap = 16;
		const bar = 56;
		const cv = document.createElement('canvas');
		cv.width = ia.width + ib.width + gap;
		cv.height = Math.max(ia.height, ib.height) + bar;
		const ctx = cv.getContext('2d')!;
		ctx.fillStyle = '#0a0c11';
		ctx.fillRect(0, 0, cv.width, cv.height);
		ctx.drawImage(ia, 0, bar);
		ctx.drawImage(ib, ia.width + gap, bar);
		ctx.fillStyle = '#dce7ff';
		ctx.font = '600 30px system-ui, sans-serif';
		ctx.fillText('exa 1.0 — 물리적 사실', 24, 38);
		ctx.fillStyle = '#ffb44d';
		ctx.fillText('exa 2.5 — 만화', ia.width + gap + 24, 38);
		ctx.strokeStyle = '#1e2942';
		ctx.beginPath();
		ctx.moveTo(ia.width + gap / 2, bar);
		ctx.lineTo(ia.width + gap / 2, cv.height);
		ctx.stroke();
		return cv.toDataURL('image/png');
	}, shots);

	writeFileSync(`${SHOTS}/03-exa-compare.png`, Buffer.from(composed.split(',')[1], 'base64'));
});
