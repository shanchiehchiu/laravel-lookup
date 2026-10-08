// 執行前：PLAYWRIGHT_PATH（可省略）、CHROME_PATH（可省略）、BASE_URL（預設 http://127.0.0.1:8000）
// 需先啟動示範專案：php artisan serve
// 端對端驗證：ProductLookup 多選 + 捲動載入 + 確認區塊；另驗單選沒有被破壞
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8000';
const results = [];
function check(name, ok, detail = '') {
    results.push({ name, ok });
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}

(async () => {
    const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || undefined });
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    page.on('dialog', (d) => { errors.push('dialog: ' + d.message()); d.dismiss(); });

    await page.goto(BASE + '/orders/create', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.ProductLookup && window.jQuery && window.bootstrap);

    const modal = page.locator('#productLookupModal');
    const rows = page.locator('#product_lookup_results tr.product-lookup-row, #product_lookup_results tr:has(.product-lookup-choice)');
    const boxes = page.locator('#product_lookup_results .product-lookup-choice');

    // ---- 1. 多選：Enter 找不到精確符合 → 開窗並以「包含」查詢 ----
    const firstSerial = page.locator('#items_area .item-row').first().locator('.quick-product-serial');
    await firstSerial.click();
    await firstSerial.fill('P0');
    await firstSerial.press('Enter');
    await modal.waitFor({ state: 'visible' });
    await page.waitForFunction(() => document.querySelectorAll('#product_lookup_results .product-lookup-choice').length > 0);

    check('多選：結果列是勾選框（checkbox）', (await boxes.first().getAttribute('type')) === 'checkbox');
    check('多選：標題列有全選已載入框', await page.locator('#productLookupModal_select_all').count() === 1);
    check('多選：第一頁 10 筆', (await boxes.count()) === 10, `實際 ${await boxes.count()}`);

    // ---- 2. 延遲載入：捲到底自動載入下一頁 ----
    const scrollBox = page.locator('#productLookupModal .product-lookup-scroll');
    for (let i = 0; i < 6 && (await boxes.count()) < 30; i++) {
        await scrollBox.evaluate((el) => { el.scrollTop = el.scrollHeight; });
        await page.waitForTimeout(700);
    }
    check("延遲載入：捲動後列數會增加（已超過第一頁）", (await boxes.count()) >= 30, `實際 ${await boxes.count()}`);
    check('延遲載入：不顯示上一頁／下一頁按鈕', (await page.locator('#productLookupModal_pager button').count()) === 0);

    // ---- 3. 多選：勾選 3 筆（一筆跨在後面載入的頁） ----
    await boxes.nth(0).check();   // P001 之類第一頁的
    await boxes.nth(1).check();   // 第二筆
    await boxes.nth(15).check();  // 第二頁之後載入的
    const pickedSerials = [0, 1, 15].map(async (i) => boxes.nth(i).getAttribute('data-product-serial'));
    const picked = await Promise.all(pickedSerials);

    const chipCount = await page.locator('#productLookupModal_selected .product-lookup-chip').count();
    check('確認區塊：顯示 3 個已選產品', chipCount === 3, `實際 ${chipCount}`);
    check('確認鈕顯示筆數', (await page.locator('#product_lookup_confirm').innerText()).includes('加入 3 筆'));

    // 點整列也能切換勾選
    await page.locator('#product_lookup_results tr').nth(2).click({ position: { x: 300, y: 10 } });
    check('點整列切換勾選（新增一筆）', (await page.locator('#productLookupModal_selected .product-lookup-chip').count()) === 4);
    await page.locator('#product_lookup_results tr').nth(2).click({ position: { x: 300, y: 10 } });
    check('再點一次整列取消勾選', (await page.locator('#productLookupModal_selected .product-lookup-chip').count()) === 3);

    // 全選框：只看已載入的列（27 筆），全選後已選應為 27 筆，再取消回 0
    await page.locator('#productLookupModal_select_all').check();
    const loadedNow = await boxes.count();
    const afterAll = await page.locator("#productLookupModal_selected .product-lookup-chip").count();
    check("全選已載入：已載入的列全部進入已選", afterAll === loadedNow, `載入 ${loadedNow} 筆，已選 ${afterAll} 筆`);
    await page.locator('#productLookupModal_select_all').uncheck();
    check('取消全選：已選回到 0 筆', (await page.locator('#productLookupModal_selected').evaluate((el) => el.classList.contains('d-none'))) === true);

    // 重新勾回 3 筆
    await boxes.nth(0).check();
    await boxes.nth(1).check();
    await boxes.nth(15).check();

    // 確認區塊的 ✕ 移除一筆，並取消該列勾選
    await page.locator('#productLookupModal_selected [data-remove-id]').nth(2).click();
    const afterRemove = await page.locator('#productLookupModal_selected .product-lookup-chip').count();
    check('確認區塊 ✕ 移除後剩 2 筆', afterRemove === 2, `實際 ${afterRemove}`);
    const sumChecked = await boxes.evaluateAll((els) => els.filter((e) => e.checked).length);
    check('移除後結果列勾選同步為 2 筆', sumChecked === 2, `實際 ${sumChecked}`);

    // ---- 4. 確認：第一筆填入目前列，其餘各新增一列 ----
    await page.locator('#product_lookup_confirm').click();
    await modal.waitFor({ state: 'hidden' });
    const itemRows = page.locator('#items_area .item-row');
    check('確認後明細共 2 列（原 1 列 + 新增 1 列）', (await itemRows.count()) === 2, `實際 ${await itemRows.count()}`);

    const r0 = await itemRows.nth(0).locator('.quick-product-serial').inputValue();
    const r1 = await itemRows.nth(1).locator('.quick-product-serial').inputValue();
    const expected = await page.evaluate(() => null); // placeholder
    check('第一列填入第一個勾選的產品', r0 === picked[0], `列0=${r0} 預期=${picked[0]}`);
    check('第二列填入第二個勾選的產品', r1 === picked[1], `列1=${r1} 預期=${picked[1]}`);
    const hidden0 = await itemRows.nth(0).locator('select[name$="[product_id]"]').inputValue();
    const hidden1 = await itemRows.nth(1).locator('select[name$="[product_id]"]').inputValue();
    check('產品 id 寫入隱藏 select（觸發表單送出用）', hidden0 !== '' && hidden1 !== '' && hidden0 !== hidden1, `${hidden0}, ${hidden1}`);
    check('名稱欄位同步帶入', (await itemRows.nth(0).locator('.quick-product-name').inputValue()).startsWith('示範產品'));

    // 再開一次：已選應清空（新的選取工作階段）
    await itemRows.nth(0).locator('.quick-product-serial').click();
    await itemRows.nth(0).locator('.quick-product-serial').fill('P0');
    await itemRows.nth(0).locator('.quick-product-serial').press('Enter');
    await modal.waitFor({ state: 'visible' });
    await page.waitForFunction(() => document.querySelectorAll('#product_lookup_results .product-lookup-choice').length > 0);
    check('再次開窗：已選清空', (await page.locator('#productLookupModal_selected .product-lookup-chip').count()) === 0);
    await page.locator('#product_lookup_confirm').click();   // 沒選任何產品按確認不應有作用
    await page.waitForTimeout(300);
    check('沒選任何產品按確認：視窗保持開啟、不改動明細', await modal.isVisible() && (await itemRows.count()) === 2);
    await page.locator('#productLookupModal .btn-close').click();
    await modal.waitFor({ state: 'hidden' });

    // ---- 5. 單選模式（同一頁切換成單選實例）沒有被破壞 ----
    await page.evaluate(() => {
        $(document).off('.productLookup_productLookupModal');
        window.__single = ProductLookup.init({
            infoUrl: '/lookup/products/info', lookupUrl: '/lookup/products', metadataUrl: '/lookup/products/metadata',
            fieldOptionsUrl: '/lookup/products/field-options', containerSelector: '#items_area', rowSelector: '.item-row',
            serialSelector: '.quick-product-serial', nameSelector: '.quick-product-name',
            selectSelector: 'select[name$="[product_id]"]', addRowSelector: '.add-item-row', multiple: false,
        });
    });
    const single = itemRows.nth(1).locator('.quick-product-serial');
    await single.click();
    await single.fill('P0');
    await single.press('Enter');
    await modal.waitFor({ state: 'visible' });
    await page.waitForFunction(() => document.querySelectorAll('#product_lookup_results .product-lookup-choice').length > 0);
    check('單選：結果列是單選鈕（radio）', (await boxes.first().getAttribute('type')) === 'radio');
    check('單選：沒有確認區塊', (await page.locator('#productLookupModal_selected').evaluate((el) => el.classList.contains('d-none'))) === true);
    await boxes.nth(3).evaluate((el) => el.closest('tr').click());
    await page.locator('#product_lookup_confirm').click();
    await modal.waitFor({ state: 'hidden' });
    const singleSerial = await itemRows.nth(1).locator('.quick-product-serial').inputValue();
    check('單選：點整列確認後填入該列', singleSerial.startsWith('P0'), `實際 ${singleSerial}`);
    check('單選：不會新增列', (await itemRows.count()) === 2);

    // ---- 6. 無 JS 錯誤 ----
    check('頁面沒有 JS 錯誤', errors.length === 0, errors.slice(0, 3).join(' | '));

    await browser.close();
    const failed = results.filter((r) => !r.ok).length;
    console.log(`\n${results.length - failed}/${results.length} passed`);
    process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('E2E crashed:', e); process.exit(2); });
