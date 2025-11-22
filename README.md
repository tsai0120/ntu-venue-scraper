# NTU Volleyball Court Optimizer

> **簡介**  
> 這是一個用於 NTU 排球場預約與使用分析的 Web 應用程式。使用者可以即時抓取最新的場地排程、檢視各系所的使用情況、搜尋交換時段，並提供直覺式的 UI 介面（包含全域彈出視窗、團隊編輯器、表格式排程列表等）。

## 功能特色

| 功能 | 說明 |
|------|------|
| **即時抓取排程** | 透過爬蟲自動抓取 7 個排球場的最新預約資料，支援單日與學期週的抓取。 |
| **全域 Schedule Popup** | 點擊任意「Team」欄位即可彈出編輯視窗，使用 `position: fixed` 防止被表格裁切。 |
| **Teams Editor** | 支援「Create New Team」與「Edit」功能，別名（Alias）採多選下拉式，支援跨學院聯隊。 |
| **表格式 Schedule List** | 重新恢復傳統表格（Venue、Time、Team、Department、Status），Status 會根據當前時間顯示 **Booked** 或 **Used**。 |
| **Department Statistics** | 點擊系所名稱可展開顯示詳細預約資訊，包含 `Date Time Venue (Alias)` 格式。 |
| **Swap Suggestions** | 依據時間衝突自動產生交換建議，協助系所間互換時段。 |
| **防呆機制** | 所有資料讀取與渲染均加入 `?.`、陣列檢查與預設值，避免 `null/undefined` 造成的前端崩潰。 |

## 安裝與執行

### 前置需求

- **Node.js**（建議 20.x）  
- **npm**（隨 Node.js 安裝）  
- **Git**（用於版本控制與部署）

### 步驟

```bash
# 1. 下載專案
git clone [https://github.com/tsai0120/ntu-venue-scraper.git](https://github.com/tsai0120/ntu-venue-scraper.git)
cd ntu-venue-scraper

# 2. 安裝相依套件
npm install

# 3. 本機開發模式（自動重新整理）
npm run dev   # 預設在 http://localhost:3000

# 4. 建置正式版（產生 .next 靜態檔案）
npm run build
npm start     # 正式環境執行