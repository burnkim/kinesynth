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
