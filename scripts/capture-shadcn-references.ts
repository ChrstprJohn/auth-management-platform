import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Public documentation only; no application identities or server startup.
const output = fileURLToPath(
  new URL('../artifacts/web-review/polish-before/', import.meta.url),
);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  });
  await page.goto('https://ui.shadcn.com/view/new-york-v4/dashboard-01');
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: `${output}/reference-dashboard-01.png`,
    fullPage: true,
  });
  for (const component of ['card', 'table', 'badge', 'chart']) {
    const response = await page.goto(
      `https://ui.shadcn.com/docs/components/${component}`,
    );
    if (!response?.ok()) throw new Error(`Reference unavailable: ${component}`);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: `${output}/reference-${component}.png`,
      fullPage: false,
    });
  }
} finally {
  await browser.close();
}
