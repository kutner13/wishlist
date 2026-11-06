// Screenshots of the running dev server (wrangler dev on :8787) into docs/screenshots/.
// Usage: node scripts/screenshots.cjs   (requires `playwright` resolvable from node)
const { chromium } = require('playwright');
const path = require('node:path');

const BASE = process.env.BASE_URL || 'http://localhost:8787';
const OUT = path.resolve(__dirname, '../docs/screenshots');
const VIEWPORTS = {
	mobile: { width: 390, height: 844 },
	desktop: { width: 1280, height: 900 }
};

async function shoot(page, name, opts = {}) {
	await page.waitForTimeout(250);
	await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: opts.fullPage ?? false });
	console.log('wrote', name);
}

(async () => {
	const browser = await chromium.launch();
	for (const [label, viewport] of Object.entries(VIEWPORTS)) {
		const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
		const page = await ctx.newPage();

		await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
		await shoot(page, `home-${label}`);

		// Robbie's seeded list has themed sections (Toys, Pool bag, Books, Everything else).
		await page.goto(`${BASE}/robbie`, { waitUntil: 'networkidle' });
		await shoot(page, `robbie-list-${label}`, { fullPage: true });

		// Open the LEGO card (first item) as a sheet via client-side navigation.
		await page.click('a.card:has-text("LEGO Technic")');
		await page.waitForSelector('[role="dialog"]');
		await shoot(page, `item-sheet-before-${label}`);

		await page.click('[role="dialog"] button:has-text("Mark purchased")');
		await page.waitForSelector('[role="dialog"] button:has-text("Purchased ✓")');
		await shoot(page, `item-sheet-after-${label}`);

		// Undo so the next viewport sees the same starting state.
		await page.click('[role="dialog"] button:has-text("Undo")');
		await page.waitForSelector('[role="dialog"] button:has-text("Mark purchased")');

		await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
		await shoot(page, `admin-${label}`, { fullPage: true });

		// Guards: no horizontal scroll at phone width.
		const overflow = await page.evaluate(
			() => document.documentElement.scrollWidth - document.documentElement.clientWidth
		);
		console.log(label, 'horizontal overflow px:', overflow);
		await ctx.close();
	}
	await browser.close();
})().catch((e) => {
	console.error(e);
	process.exit(1);
});
