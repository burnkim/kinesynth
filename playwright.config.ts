import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: 'tests',
	testMatch: '**/*.e2e.{ts,js}',
	outputDir: 'test-results',
	fullyParallel: false,
	workers: 1,
	use: {
		baseURL: 'http://localhost:4173',
		viewport: { width: 1280, height: 800 },
		deviceScaleFactor: 2
	},
	webServer: {
		command: 'pnpm run build && pnpm run preview',
		port: 4173,
		reuseExistingServer: !process.env.CI,
		timeout: 120_000
	}
});
