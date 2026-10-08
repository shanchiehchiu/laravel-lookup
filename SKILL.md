---
name: laravel-lookup
description: 依關鍵字在 Laravel 專案中找到單據表單，替指定欄位套上彈窗選取：單選、複選（多選）、批次選取產品、ProductLookup 產品快速輸入（含複選與確認區塊），並支援延遲載入。觸發詞：彈窗選取、彈窗搜尋、單選、多選、複選、Lookup、ProductLookup、批次選取、延遲載入、關聯資料選取。
metadata:
  short-description: Laravel 彈窗選取（單選／多選，依關鍵字套用到單據）
---

# Laravel Lookup

本技能讓 agent 依使用者給的關鍵字，替 Laravel 專案中的某個單據套上彈窗選取功能。

使用者通常會這樣下指令：「幫訂單的客戶套單選彈窗」「幫進貨單的品項套多選彈窗」。agent 依下面的流程完成。

- 資產來自 `assets/`，範例來自 `examples/demo-app/`，規格在 `references/`。
- 技能附的是核心版。不含進階搜尋引擎。
- 路由、模型、授權範圍與欄位名稱必須依目標專案調整。

## 支援版本

- Laravel 13：PHP 8.3 以上。
- Laravel 10：PHP 8.1 至 8.3。
- 前端以 CDN 載入 jQuery 3.7.1、Select2 4.0.13、Bootstrap 5.3.3。不需要 npm。

## 第一步：依關鍵字定位

輸入範例：「訂單 客戶 單選」「進貨單 品項 多選」。

1. **找單據表單**：在專案中搜尋關鍵字。
   - `grep -ril "<關鍵字>" resources/views app/Http/Controllers routes`
   - 找到的 blade 檔就是表單候選。
2. **找要改的欄位**：在表單 blade 中找欄位。
   - `<select name="...">`：可以直接套用。
   - `<select multiple>`：複選欄位。
   - `<input type="text">` 或 `<input type="hidden">`：不能直接套用。先告知使用者，並說明要改成 `<select>`，取得同意後再改。
3. **判斷單選或多選**：
   - 使用者明說「單選」或「多選／複選」，依使用者的說法。
   - 使用者沒說時，依欄位本身判斷：`<select multiple>` 用複選，其他用單選。
   - 明細列（多列、每列一個產品）：產品用 ProductLookup；要一次加入多筆用批次選取。
4. **判斷資料來源**：
   - 從 controller 的 `store` 驗證規則找 `exists:表名,欄位`，就是關聯表。
   - 找到模型後，用它的查詢範圍（狀態、權限）當基底範圍。
   - 找不到時，才詢問使用者。
5. **只有上面四步仍無法判斷時，才詢問使用者**。列出編號選項，每個選項寫明動作與後果，並把推薦的選項放第一。

定位完成後，依下面的安裝流程實作。

## 安裝流程

### 步驟 0：前置檢查

1. 讀取 `composer.json`，確認 `laravel/framework` 版本與 `php` 限制。
2. 執行 `php -v`，確認 PHP 符合版本需求。不符合時，停止並告知使用者。
3. 確認 `routes/web.php`、`app/Http/Controllers/`、`resources/views/` 存在。
4. 確認目標頁面使用的 layout。沒有 layout 時，依步驟 3 建立最小 layout。

### 步驟 1：複製前端資產

| 來源（本技能） | 目標（專案） |
|---|---|
| `assets/lookup/public/js/lookup.js` | `public/js/lookup.js` |
| `assets/product-batch/public/js/product-batch-lookup.js` | `public/js/product-batch-lookup.js` |
| `assets/product-lookup/public/js/product-lookup.js` | `public/js/product-lookup.js` |
| `assets/lookup/resources/views/components/backend/lookup-modal.blade.php` | `resources/views/components/backend/lookup-modal.blade.php` |
| `assets/product-lookup/resources/views/components/backend/product/lookup-modal.blade.php` | `resources/views/components/backend/product/lookup-modal.blade.php` |

- `lookup.js`、`product-batch-lookup.js` 與兩個彈窗骨架必須原樣複製。
- `product-lookup.js` 寫死產品欄位名稱。產品欄位不是 `product_serial`、`name`、`price`、`id` 時，必須依 `references/product-lookup.md` 的「Product field mapping」修改對應設定，不能只改 API。
- 不要覆寫目標專案已存在的同名檔案。已存在時，先比較差異。

### 步驟 2：複製後端共用 trait

| 來源 | 目標 |
|---|---|
| `assets/lookup/app/Traits/LookupResponseTrait.php` | `app/Traits/LookupResponseTrait.php` |

trait 的命名空間是 `App\Traits`。它不依賴任何模型，不需要修改。

### 步驟 3：layout

目標 layout 必須符合下面的條件。沒有 layout 時，建立 `resources/views/layouts/app.blade.php`，內容如下：

```blade
<!DOCTYPE html>
<html lang="zh-Hant">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>@yield('title', '頁面')</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/select2/4.0.13/css/select2.min.css">
    @stack('style')
</head>
<body class="bg-light">
    <main class="container py-4">
        @yield('content')
    </main>

    {{-- 腳本順序不可對調 --}}
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/select2/4.0.13/js/select2.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
    <script src="{{ asset('js/lookup.js') }}"></script>
    <script src="{{ asset('js/product-lookup.js') }}"></script>
    <script src="{{ asset('js/product-batch-lookup.js') }}"></script>
    @stack('scripts')
</body>
</html>
```

已有 layout 時，只需要確認下面三件事，並補上缺少的部分：

- `<head>` 有 `@stack('style')`，並載入 Bootstrap 與 Select2 的 CSS。
- `</body>` 前依序載入 jQuery、Select2、Bootstrap，然後是技能的三支 JS。
- 有 `@stack('scripts')`。

目標已載入 jQuery 或 Bootstrap 時，不要重複載入。版本必須相容。

### 步驟 4：後端 API

**Lookup 查詢 API**：每種要彈窗挑選的資料各一支。

```php
<?php

namespace App\Http\Controllers;

use App\Models\Customer;               // 替換成目標專案的模型
use App\Traits\LookupResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LookupController extends Controller
{
    use LookupResponseTrait;

    public function customers(Request $request): JsonResponse
    {
        // 基底範圍：先套用狀態、權限、租戶等限制
        $query = Customer::query()->where('status', true)->orderBy('no');

        // 白名單：只允許這些查詢參數。key 是參數名，value 是 "運算:欄位"
        return $this->lookupResponse($query, $request, [
            'no' => 'like:no',
            'name' => 'like:name',
        ]);
    }
}
```

路由（名稱會在 JS 設定中使用）：

```php
Route::get('/lookup/customers', [LookupController::class, 'customers'])->name('customers.lookup');
```

**ProductLookup API**：需要四支端點。`info`（精確查詢）、`lookup`（分頁查詢，批次選取也用它）、`metadata`（欄位清單）、`fieldOptions`（遠端選項）。完整實作在 `examples/demo-app/app/Http/Controllers/ProductLookupController.php`。搜尋欄位白名單（`SEARCH_FIELDS`）必須依目標欄位改寫。

回應格式必須符合規格：`datas`、`current_page`、`last_page`、`total`。缺少時，分頁與延遲載入會失效。

### 步驟 5：接線到頁面

彈窗骨架必須放在 `</form>` **之外**，否則結果列的 radio 或 checkbox 會被一起送出。

```blade
<form method="POST" action="...">
    @csrf
    <select name="customer_id" required>
        <option value="">請選擇</option>
    </select>
    ...
</form>

<x-backend.lookup-modal />
<x-backend.product.lookup-modal />   {{-- 只有使用 ProductLookup 時才需要 --}}
```

在頁面的 `@push('scripts')` 中初始化：

```js
// Lookup 單選（延遲載入）
Lookup.attach('select[name="customer_id"]', {
    title: '選擇客戶',
    url: '{{ route('customers.lookup') }}',
    generalFields: [{ name: 'no', label: '客戶編號' }, { name: 'name', label: '客戶名稱' }],
    columns: [{ key: 'no', label: '客戶編號', nowrap: true }, { key: 'name', label: '客戶名稱' }],
    display: '{no} - {name}',
    infiniteScroll: true,
});

// Lookup 複選：目標必須是 <select multiple>
Lookup.attach('select[name="tag_ids[]"]', {
    title: '選擇標籤',
    url: '{{ route('tags.lookup') }}',
    multiple: true,
    multipleConfirmText: '套用',
    generalFields: [{ name: 'name', label: '標籤名稱' }],
    columns: [{ key: 'name', label: '標籤名稱' }],
    display: '{name}',
    infiniteScroll: true,
});

// ProductLookup（明細列快速輸入，可複選）
ProductLookup.init({
    infoUrl: '{{ route('products.lookup-info') }}',
    lookupUrl: '{{ route('products.lookup') }}',
    metadataUrl: '{{ route('products.lookup-metadata') }}',
    fieldOptionsUrl: '{{ route('products.lookup-field-options') }}',
    containerSelector: '#items_area',          // 明細列的容器
    rowSelector: '.item-row',                  // 單列
    serialSelector: '.quick-product-serial',   // 產品編號輸入框
    nameSelector: '.quick-product-name',       // 產品名稱顯示框
    selectSelector: 'select[name$="[product_id]"]',
    addRowSelector: '.add-item-row',           // 新增列按鈕（複選必須設定）
    multiple: true,
    infiniteScroll: true,
});

// 批次選取（一次加入多筆明細）
ProductBatchLookup.attach({
    button: '.batch-add-products',
    url: '{{ route('products.lookup') }}',
    title: '批次選取產品',
    multipleConfirmText: '加入明細',
    addButton: '.add-item-row',
    area: '#items_area',
    row: '.item-row',
    productSelect: 'select[name$="[product_id]"]',
    infiniteScroll: true,
    chunkSize: 20,                             // 每段寫入的列數，超過時顯示進度
    advanced: false,
    generalFields: [{ name: 'product_serial', label: '產品編號' }, { name: 'name', label: '產品名稱' }],
    columns: [
        { key: 'product_serial', label: '產品編號', nowrap: true },
        { key: 'name', label: '產品名稱' },
        { key: 'price', label: '單價', align: 'end', headAlign: 'end' },
    ],
    display: '{product_serial} - {name}',
});
```

明細列範例（完整版見 `examples/demo-app/resources/views/orders/create.blade.php` 的 `#item-row-template`）：

- 產品編號輸入框加上 `quick-product-serial`。
- 名稱顯示框加上 `quick-product-name`。
- 隱藏的產品 `<select>` 名稱必須以 `[product_id]` 結尾。
- 列本身加上 `item-row`。

### 步驟 6：資料層

目標專案已有對應的模型與資料表時，直接沿用。沒有時，依下面的欄位規格建立，並依目標專案的命名調整。

| 實體 | 欄位（必要） | 說明 |
|---|---|---|
| 客戶 `Customer` | `no` 唯一、`name`、`status` 布林 | `status` 為 false 的客戶不出現在彈窗，也不能儲存。 |
| 產品 `Product` | `product_serial` 唯一、`name`、`price`、`status` 布林 | 同上。 |
| 單據 `Order` | `customer_id` 外鍵、`note` 可空 | 單據表頭。 |
| 明細 `OrderItem` | `order_id`、`product_id`、`qty`、`price` | `price` 是下單當下的快照。 |

- 欄位名稱必須依目標專案調整，不得照抄範例。
- 儲存時的驗證規則參考 `examples/demo-app/app/Http/Controllers/OrderController.php`。客戶與產品都必須存在且啟用。
- 明細單價以資料庫為準，不採用前端送來的價格。

### 步驟 7：驗證

依序執行，並在回報中寫明實際結果：

1. `php artisan route:list --name=lookup`：確認路由存在。
2. `php artisan test`：確認既有測試通過。示範專案共 31 項，新專案的項目數依實際測試而定。
3. 目標專案有 Pint 時，執行 `./vendor/bin/pint --test`。
4. `node --check public/js/lookup.js`，以及 `product-lookup.js`、`product-batch-lookup.js`。
5. 瀏覽器端對端測試：參考 `examples/demo-app/tests/browser/product-lookup-e2e.js`。
   - 需先安裝 Playwright 與 Chromium：`npm i -D playwright && npx playwright install chromium`。
   - 執行前需先啟動專案（`php artisan serve`）並準備資料（`php artisan migrate:fresh --seed`）。
   - 環境變數：`PLAYWRIGHT_PATH`、`CHROME_PATH`、`BASE_URL`。
   - 無法安裝時，標示為未驗證。

沒有執行的檢查必須標為未驗證，不得寫成通過。

## 規則

- 核心不得包含任何模型、路由或業務欄位名稱。業務的預設值與查詢端點放在目標專案。
- `LookupResponseTrait` 是核心版，只做一般篩選與分頁。
- 不得把示範專案的路由名稱、模型名稱或路徑當成必要條件。`examples/` 只作參考。
- 寫入目標專案前，必須檢查目標檔案的現有呼叫端與行為。
- `idMode: 'select2'` 會更新既有的 select 並觸發 `change`，讓頁面原有的聯動照常執行。能用這個模式時優先使用。
- 以下事項不得自行決定，必須詢問使用者：要查詢的模型與可搜尋欄位、授權範圍、表單欄位名稱（當定位流程無法判斷時）。

## 技能內的檔案

- `assets/`：可複製到目標專案的 JS、彈窗骨架與後端 trait。
- `references/lookup-contract.md`：Lookup 完整規格，含複選、批次選取與 `lookup_id`。
- `references/product-lookup.md`：ProductLookup 完整規格，含 Product field mapping、複選與延遲載入。
- `examples/demo-app/`：完整示範，含控制器、模型、遷移、種子資料、路由、視圖、測試與瀏覽器腳本。

## 已知限制

- 進階搜尋引擎（多條件 AND/OR、欄位池 metadata 自動產生）不在技能內。
- ProductLookup 的 metadata 是手寫白名單，需依目標欄位調整。
- 表單驗證失敗後，明細列不會自動回填。
- 批次選取關閉了進階頁籤（`advanced: false`），只提供一般搜尋。
