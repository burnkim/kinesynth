/**
 * Kinesynth · 뷰어 동작 검증
 * 슬라이더는 $state 프록시를 통해 engine.values를 직접 쓴다.
 * 표기법 문자열은 engine이 engine.values에서 만들므로, 표기법이 바뀌면 값이 실제로 엔진에 닿은 것.
 */
import { expect, test } from '@playwright/test';

test('exa 슬라이더가 엔진 값과 표기법에 반영된다', async ({ page }) => {
	await page.goto('/?demo=bounce-squash&seed=1&t=0.767');
	const notation = page.getByTestId('notation');
	await expect(notation).toHaveText(
		'Bounce(g, e)@entity + Squash(vel.y→scale)@deform ×exa1.8'
	);

	const exa = page.getByTestId('p-squash-exa');
	await exa.fill('2.5');
	await expect(notation).toHaveText(
		'Bounce(g, e)@entity + Squash(vel.y→scale)@deform ×exa2.5'
	);
});

test('프리셋을 바꾸면 스택과 표기법이 갈아끼워진다', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByTestId('notation')).toContainText('Bounce(g, e)@entity');
	await page.locator('#demo').selectOption('lissajous');
	await expect(page.getByTestId('notation')).toHaveText('Lissajous(a:b, δ)@entity');
	await expect(page.getByTestId('p-lissajous-a')).toBeVisible();
	await expect(page.getByTestId('p-squash-exa')).toHaveCount(0);
});

test('같은 시드는 같은 그림을 만든다 (재현성)', async ({ page }) => {
	await page.goto('/?demo=bounce-squash&seed=42&t=1.2');
	const a = await page.locator('.stage').screenshot();
	await page.goto('/?demo=bounce-squash&seed=42&t=1.2');
	const b = await page.locator('.stage').screenshot();
	expect(Buffer.compare(a, b)).toBe(0);
});

test('엔티티 500에서 실시간 60fps (PRD §8 성능 목표)', async ({ page }) => {
	await page.goto('/?demo=boids-elastic&seed=7&p=boids.n:500');
	await page.locator('canvas').waitFor();
	await page.waitForTimeout(3000); // fps 측정창(0.5s)이 여러 번 돌도록
	const fps = Number((await page.locator('.badge').innerText()).split(' ')[0]);
	expect(await page.locator('.badge').innerText()).toContain('500 entities');
	expect(fps).toBeGreaterThanOrEqual(55);
});

test('라우팅 — 대상이 갈리면 points 소유가 겹치지 않는다', async ({ page }) => {
	const warn: string[] = [];
	page.on('console', (m) => m.type() === 'warning' && warn.push(m.text()));

	await page.goto('/?demo=bounce-tail&seed=1&t=0.79');
	await page.locator('canvas').waitFor();

	// 몸(12각 폐곡선)과 꼬리(체인)가 서로 다른 엔티티다
	await expect(page.locator('.badge')).toContainText('2 entities');
	// 표기법에 대상과 앵커가 드러난다
	await expect(page.getByTestId('notation')).toContainText('[ball]');
	await expect(page.getByTestId('notation')).toContainText('[tail←ball]');
	// 소유 규칙 위반 없음 — 경고 패널도, 콘솔 경고도 없다
	await expect(page.locator('.block.warn')).toHaveCount(0);
	expect(warn.filter((m) => m.includes('kinesynth'))).toEqual([]);
});

test('모든 프리셋이 소유 규칙을 지킨다', async ({ page }) => {
	const ids = await page.goto('/').then(async () => {
		await page.locator('#demo').waitFor();
		return page.locator('#demo option').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value));
	});
	expect(ids.length).toBeGreaterThanOrEqual(9);
	for (const id of ids) {
		if (id === 'wind-bounce') continue; // 일부러 어긴 예시
		await page.goto(`/?demo=${id}`);
		await page.locator('canvas').waitFor();
		await expect(page.locator('.block.warn'), `프리셋 ${id}`).toHaveCount(0);
	}
});

test('write mode — vel을 set하는 코어가 add를 지우면 경고한다', async ({ page }) => {
	const warn: string[] = [];
	page.on('console', (m) => m.type() === 'warning' && warn.push(m.text()));

	await page.goto('/?demo=wind-bounce&seed=1');
	await page.locator('canvas').waitFor();
	await expect(page.locator('.block.warn')).toBeVisible();
	await expect(page.locator('.block.warn')).toContainText('vel set');
	await expect(page.locator('.block.warn')).toContainText('add를 지운다');
	expect(warn.some((m) => m.includes('kinesynth'))).toBe(true);
});
