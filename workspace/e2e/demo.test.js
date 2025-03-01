//import { expect, test } from '@playwright/test';
import { globby } from 'globby';


const route = ({ url }) => {
	const relative = url.split('routes')[1];
	return relative.slice(0, relative.lastIndexOf('/') + 1);
};

// test('home page has expected h1', async ({ page }) => {
// 	//await page.goto(route(import.meta));
// 	//await expect(page.locator('h1')).toBeVisible();
// });

globby('test-pages-dist/**/*.js')
	.then(files => files.forEach(async (file) => {
		const imports = await import(`${process.cwd()}/${file}`);
		console.log(imports);
		console.log(file);
	}));