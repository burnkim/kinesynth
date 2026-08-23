/**
 * Kinesynth · 배포 스모크 테스트 (옵트인)
 *
 * 기본 스위트에는 들어가지 않는다 — 네트워크가 필요하니까.
 *   LIVE_URL=https://kinesynth.vercel.app pnpm smoke
 */
import { expect, test } from '@playwright/test';

const LIVE = process.env.LIVE_URL;

test.skip(!LIVE, 'LIVE_URL이 없으면 건너뛴다');

test('배포된 사이트에서 코어 스택이 돈다', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (e) => errors.push(String(e)));
	page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

	// space + entity 합성, 결정론적 시각
	await page.goto(`${LIVE}/?demo=dla-zoom&seed=3&t=40`);
	await page.locator('canvas').waitFor();
	await expect(page.getByTestId('notation')).toHaveText(
		'FractalZoom(base, rate)@space + DLA(격자 성장)@entity'
	);
	await expect(page.locator('.badge')).toContainText('1100 entities');

	// URL 파라미터 오버라이드가 배포본에서도 먹는지
	await page.goto(`${LIVE}/?demo=bounce-squash&seed=1&t=0.767&p=squash.exa:2.5`);
	await page.locator('canvas').waitFor();
	await expect(page.getByTestId('notation')).toHaveText(
		'Bounce(g, e)@entity + Squash(vel.y→scale)@deform ×exa2.5'
	);

	// 실시간 재생 프레임레이트
	await page.goto(`${LIVE}/?demo=lissajous-spring&seed=1&trail=1`);
	await page.locator('canvas').waitFor();
	await page.waitForTimeout(2500);
	const fps = Number((await page.locator('.badge').innerText()).split(' ')[0]);
	expect(fps).toBeGreaterThanOrEqual(50);

	expect(errors, `콘솔 오류: ${errors.join(' | ')}`).toEqual([]);
});
