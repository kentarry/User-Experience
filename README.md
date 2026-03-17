# UX Report Tool 📊

AI 驅動的玩家體驗測試報告生成工具，整合 Google Gemini 進行資料分析與圖像判讀。

## ✨ 功能

- **Excel 匯入** — 上傳使用者體驗回饋 Excel，AI 自動清洗、整併、分類
- **AI 圖像分析** — 上傳遊戲截圖，AI 以 UI/UX 專家角度分析
- **即時預覽** — 左側即時報告預覽，支援匯出/內部兩種檢視模式
- **HTML 報告匯出** — 一鍵產出精美 HTML 報告（含資料快照，可回匯）
- **HTML 報告匯入** — 載入先前匯出的報告繼續編輯
- **JSON 編輯器** — 直接編輯 Raw Data
- **Prompt 自訂** — 可調整 AI 分析指令與匯入規則

## 🚀 快速開始

### 1. 安裝

```bash
git clone https://github.com/your-username/ux-report-tool.git
cd ux-report-tool
npm install
```

### 2. 設定 API Key

複製 `.env.example` 為 `.env`，填入你的 [Google Gemini API Key](https://aistudio.google.com/apikey)：

```bash
cp .env.example .env
# 編輯 .env，填入 VITE_GEMINI_API_KEY=your_key
```

### 3. 啟動開發伺服器

```bash
npm run dev
```

### 4. 建置生產版本

```bash
npm run build
npm run preview  # 本地預覽
```

## 🌐 GitHub Pages 部署

1. Push 程式碼至 GitHub `main` 分支
2. 到 Repository → Settings → Pages → Source 選擇 **GitHub Actions**
3. 到 Repository → Settings → Secrets and variables → Actions → 新增 `VITE_GEMINI_API_KEY`
4. Push 後 GitHub Actions 會自動 build 並部署

## 📁 專案結構

```
├── src/
│   ├── components/
│   │   ├── Section.jsx        # 可摺疊區塊
│   │   ├── InputGroup.jsx     # 標籤輸入元件
│   │   └── Modal.jsx          # 對話框元件
│   ├── utils/
│   │   ├── gemini.js          # Gemini API 呼叫與重試
│   │   ├── exportHtml.js      # HTML 報告匯出
│   │   └── importExcel.js     # Excel 匯入與 AI 分析
│   ├── constants.js           # 預設 Prompt 與初始資料
│   ├── App.jsx                # 主要元件
│   ├── main.jsx               # React 進入點
│   └── index.css              # Tailwind 與自訂樣式
├── .github/workflows/
│   └── deploy.yml             # GitHub Pages 自動部署
├── .env.example               # 環境變數範本
├── index.html                 # Vite 進入 HTML
├── vite.config.js
├── tailwind.config.js
└── package.json
```

## 🛠 技術棧

- **React 18** + **Vite 6**
- **Tailwind CSS 3**
- **Lucide React** (圖標)
- **SheetJS (xlsx)** (Excel 解析)
- **Google Gemini API** (AI 分析)

## 📝 License

MIT
