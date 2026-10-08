# laravel-lookup

Claude Code 技能：把彈窗搜尋選取功能導入 Laravel 專案。

包含：

- **Lookup**：彈窗搜尋選取，支援單選、複選（`multiple`）與延遲載入（`infiniteScroll`）。
- **批次選取產品**：勾選多筆產品，一次加入明細列。
- **ProductLookup**：明細列輸入產品編號按 Enter 帶入；查無時開彈窗，支援複選與確認區塊。

## 支援版本

- Laravel 13：PHP 8.3 以上
- Laravel 10：PHP 8.1 至 8.3
- 前端以 CDN 載入 jQuery、Select2、Bootstrap，不需要 npm

## 安裝

把這個 repo 放到 Claude Code 的技能目錄：

```bash
git clone https://github.com/shanchiehchiu/laravel-lookup.git ~/.claude/skills/laravel-lookup
```

之後在 Claude Code 中要求「導入 Laravel 彈窗搜尋選取」即可觸發。

## 內容

| 路徑 | 說明 |
|---|---|
| `SKILL.md` | 技能主檔：功能選擇、部署步驟、驗證方式、移植規則 |
| `assets/` | 可直接複製到目標專案的 JS、彈窗骨架與後端 trait |
| `references/` | Lookup 與 ProductLookup 的完整規格 |
| `examples/demo-app/` | 可執行的示範：控制器、模型、遷移、種子資料、路由、視圖、測試與瀏覽器測試腳本 |

## 驗證範例

示範專案的測試：

```bash
php artisan test          # PHPUnit，31 項
./vendor/bin/pint --test  # 格式檢查
```

瀏覽器端對端測試（需先啟動示範專案）：

```bash
node examples/demo-app/tests/browser/product-lookup-e2e.js
```

環境變數：`PLAYWRIGHT_PATH`、`CHROME_PATH`、`BASE_URL`（預設 `http://127.0.0.1:8000`）。

## 注意

- 資產是可移植的起點。路由、模型、授權範圍與搜尋欄位，必須依目標專案調整。
- 查詢 API 的可搜尋欄位必須是白名單。
- 進階搜尋引擎不在本技能內。

## 授權

本專案以 MIT 授權發布。詳見 `LICENSE`。
