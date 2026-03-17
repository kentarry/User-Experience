Viewed app.js:1-432

Now I can see the exact lines to change. I need to:
1. Replace `const apiKey = "";` (line 5) with `const [apiKey, setApiKey] = useState("");`
2. Add an API Key input section with a link to Google AI Studio in the editor header area (after line 328)

Edited app.js

I also need to add an API key check in the [analyzeImage](cci:1://file:///c:/Users/raylee/Desktop/Antigravity/User%20Experience/src/App.jsx:103:2-137:4) function, since currently it only checks for the image but not the key. Let me also add the check for [handleFileUpload](cci:1://file:///c:/Users/raylee/Desktop/Antigravity/User%20Experience/app.js:106:2-177:4):

Edited app.js

已完成修改！以下是調整的重點：

**🔑 API Key 輸入欄位**（位於右側編輯器頂部）
- 使用 `password` 類型的輸入框，保護 Key 不被旁人看到
- 右側有 👁 眼睛按鈕可以切換顯示/隱藏 Key
- 上方有 **「前往取得 API Key →」** 連結，點擊後會在新分頁開啟 [Google AI Studio](https://aistudio.google.com/apikey)，讓使用者直接取得自己的 Key
- 未輸入 Key 時，底部會顯示 ⚠️ 警告提示

**API Key 驗證**
- 執行 **AI 圖像分析** 或 **Excel 匯入** 時，若使用者尚未輸入 API Key，會彈出提示視窗，引導使用者先設定 Key

現在請您將更新後的 3 個檔案（[index.html](cci:7://file:///c:/Users/raylee/Desktop/Antigravity/User%20Experience/index.html:0:0-0:0)、[constants.js](cci:7://file:///c:/Users/raylee/Desktop/Antigravity/User%20Experience/constants.js:0:0-0:0)、[app.js](cci:7://file:///c:/Users/raylee/Desktop/Antigravity/User%20Experience/app.js:0:0-0:0)）上傳到 GitHub 覆蓋舊檔即可！
