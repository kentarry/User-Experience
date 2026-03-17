// --- Icon Wrapper for Lucide (CDN vanilla → React components) ---
function createLucideIcon(...names) {
  return function LucideIconComponent({ size = 24, className = '' }) {
    const ref = React.useRef(null);
    React.useEffect(() => {
      if (ref.current) {
        ref.current.innerHTML = '';
        let icon = null;
        for (const n of names) { if (lucide.icons[n]) { icon = lucide.icons[n]; break; } }
        if (icon) {
          const svg = lucide.createElement(icon);
          svg.setAttribute('width', String(size));
          svg.setAttribute('height', String(size));
          if (className) svg.setAttribute('class', className);
          ref.current.appendChild(svg);
        }
      }
    }, [size, className]);
    return React.createElement('span', { ref, style: { display: 'inline-flex', alignItems: 'center' } });
  };
}

var Settings = createLucideIcon('settings');
var Download = createLucideIcon('download');
var FileText = createLucideIcon('file-text');
var Plus = createLucideIcon('plus');
var Trash2 = createLucideIcon('trash-2');
var ImageIcon = createLucideIcon('image');
var MessageSquare = createLucideIcon('message-square');
var AlertTriangle = createLucideIcon('triangle-alert', 'alert-triangle');
var Loader2 = createLucideIcon('loader-circle', 'loader-2');
var Sparkles = createLucideIcon('sparkles');
var Upload = createLucideIcon('upload');
var FileSpreadsheet = createLucideIcon('file-spreadsheet');
var RefreshCcw = createLucideIcon('refresh-ccw');
var Code = createLucideIcon('code');
var Trophy = createLucideIcon('trophy');
var UserIcon = createLucideIcon('user');
var FolderInput = createLucideIcon('folder-input');
var Eye = createLucideIcon('eye');
var EyeOff = createLucideIcon('eye-off');
var X = createLucideIcon('x');

// --- Default Prompts ---
var DEFAULT_UX_EXPERT_PROMPT = `
##角色（Role）
你是一位UI、UX領域的專家，熟讀尼爾森十大原理，網頁程式框架，藝術美學配色，包含行為心理學、消費心理學等知識。
請以UI/UX的標準進行分析與建議。

##任務（Task）
針對遊戲業界產品進行圖片分析。

##輸出格式（Output Requirement）
**請務必以 JSON 格式回傳**，JSON 物件需包含：
1. "observation": 字串陣列 (Array of Strings)，3-5 點具體觀察。
2. "suggestion": 字串陣列 (Array of Strings)，3-5 點具體建議。
`;

var DEFAULT_DATA_IMPORT_PROMPT = `
## 角色
你是一位具備使用者體驗分析與資訊統整能力的專業分析助手，擅長從非結構化的玩家體驗回饋中提煉重點。

## 任務目標
分析提供的 Excel Raw Data (JSON Array)，將相似回饋歸納為 Issues，並找出每個 Issue 的最佳建議者。

## 核心規則：精準 ID 映射 (Row-Level Mapping) - 至關重要！
請將輸入陣列中的每一筆資料視為一個不可分割的物件：\\\`{ "_id", "user", "account", "uxContext", "suggestion" }\\\`。
為了保證資料 100% 正確，**嚴禁你自己輸出人名或帳號**，所有的對應都必須使用 \\\`_id\\\` 進行關聯。

1. **Issue 歸納規則 (Many-to-Many Mapping)**：
   - 將多筆資料歸納為同一個 Issue 時，\\\`relatedRowIds\\\` 陣列**必須包含**這些資料的 \\\`_id\\\`。
   - 例如：若 \\\`_id: "R1"\\\` 和 \\\`_id: "R5"\\\` 反映了同一個問題，則 \\\`relatedRowIds: ["R1", "R5"]\\\`。

2. **資料來源嚴格區隔 (Strict Source Separation) - 極端嚴格**：
   - **單向隔離原則**：在生成 \\\`issue\\\` (問題總結) 時，**僅能讀取** \\\`uxContext\\\` 欄位。
   - **嚴禁跨欄位推論**：嚴禁讀取 \\\`suggestion\\\` 內容來反推 Issue。即使 \\\`suggestion\\\` 暗示了問題，只要 \\\`uxContext\\\` 是空的或未提及該問題，該 \\\`_id\\\` 就**絕對不能**放入該 Issue 的 \\\`relatedRowIds\\\`。

3. **最佳建議規則 (Semantic Extraction & ID Locking)**：
   - 當判定某個 Issue 的最佳建議來自特定一筆資料時，請將該筆資料的 \\\`_id\\\` 填入 \\\`bestSuggesterRowId\\\`。
   - **來源鎖定**：\\\`bestSuggesterRowId\\\` 必須是 \\\`relatedRowIds\\\` 陣列中的其中一個 \\\`_id\\\`。
   - **精準提取 (Semantic Extraction - 保留原始前綴)**：
     - 分析當前 Issue 的主題，並從該 \\\`_id\\\` 的原始 \\\`suggestion\\\` 中，**只提取與該主題高度相關**的那一段文字作為 \\\`bestSuggestionRawText\\\`。
     - **關鍵規則：嚴禁刪除原始標記**：提取時，必須**完整保留**該句開頭的「時間/班別/分類標記」（例如：\\\`0123早:規格建議_\\\`）。
   - **多建議排版規則**：若同一位使用者針對此 Issue 提出了兩點或以上的不同建議，請在中間插入 **兩個換行符號 (\\\\n\\\\n)** 進行分隔。

## 處理流程
將所有歸納好的資料輸出。注意：確保 \\\`relatedRowIds\\\` 完整包含所有提及該問題的 \\\`_id\\\`。

## 輸出格式 (JSON Output Only)
請嚴格遵守以下 JSON 結構回傳：

{
  "meta": {
    "title": "玩家體驗測試報告 - [自動判斷專案名]",
    "date": "[YYYY-MM-DD]"
  },
  "summary": {
    "content": "[40-60字的體驗總結]",
    "impactLevel": "High"
  },
  "criticalIssues": [
    {
      "issue": "[整合後的玩家體驗感想]",
      "relatedRowIds": ["R1", "R2", "R3"],
      "suggestion": "[針對此問題的具體優化建議]",
      "bestSuggestionRawText": "[經過精準提取與排版後的建議文字]",
      "bestSuggesterRowId": "R1"
    }
  ],
  "secondaryIssues": [ ...同樣結構... ],
  "aiAnalysis": []
}

## Raw Data Input
`;

var initialData = {
  meta: {
    title: "玩家體驗測試報告 - 預設專案",
    date: new Date().toISOString().split('T')[0],
    testerCount: 0
  },
  summary: {
    content: "尚無資料，請由右側匯入 Excel 測試數據，或手動輸入。",
    impactLevel: "Medium"
  },
  criticalIssues: [],
  secondaryIssues: [],
  aiAnalysis: []
};
