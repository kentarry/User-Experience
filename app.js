/* Lucide icons and constants loaded from constants.js via window globals */
const { Settings, Download, FileText, Plus, Trash2, ImageIcon, MessageSquare, AlertTriangle, Loader2, Sparkles, Upload, FileSpreadsheet, RefreshCcw, Code, Trophy, UserIcon, FolderInput, Eye, EyeOff, X, DEFAULT_UX_EXPERT_PROMPT, DEFAULT_DATA_IMPORT_PROMPT, initialData } = window;
const { useState, useEffect } = React;

const App = () => {
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);

  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', message: '', isError: false });
  const showModal = (message, title = '提示', isError = false) => { setModalConfig({ isOpen: true, title, message, isError }); };
  const closeModal = () => { setModalConfig({ ...modalConfig, isOpen: false }); };

  useEffect(() => {
    const script = document.createElement('script');
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    script.async = true;
    document.body.appendChild(script);
    return () => { if (document.body.contains(script)) { document.body.removeChild(script); } }
  }, []);

  const [data, setData] = useState(initialData);
  const [activeTab, setActiveTab] = useState('editor');
  const [jsonInput, setJsonInput] = useState(JSON.stringify(initialData, null, 2));
  const [previewMode, setPreviewMode] = useState('export');
  const [uxExpertPrompt, setUxExpertPrompt] = useState(DEFAULT_UX_EXPERT_PROMPT);
  const [dataImportPrompt, setDataImportPrompt] = useState(DEFAULT_DATA_IMPORT_PROMPT);
  const [analyzingIds, setAnalyzingIds] = useState({});
  const [isImporting, setIsImporting] = useState(false);

  const handleJsonChange = (e) => {
    const newVal = e.target.value; setJsonInput(newVal);
    try { setData(JSON.parse(newVal)); } catch (err) { }
  };

  const updateField = (path, value) => {
    const newData = JSON.parse(JSON.stringify(data));
    const keys = path.split('.'); let current = newData;
    for (let i = 0; i < keys.length - 1; i++) { current = current[keys[i]]; }
    current[keys[keys.length - 1]] = value;
    setData(newData); setJsonInput(JSON.stringify(newData, null, 2));
  };

  const addItem = (listName) => {
    const newData = { ...data };
    const newItem = listName === 'aiAnalysis'
      ? { id: `AS0${newData[listName].length + 1}`, imageUrl: "", observation: [], suggestion: [] }
      : { id: `UX0${(newData.criticalIssues.length + newData.secondaryIssues.length) + 1}`, issue: "", count: 1, relatedPersonnel: [], suggestionId: `S0${(newData.criticalIssues.length + newData.secondaryIssues.length) + 1}`, suggestion: "", bestSuggestionRawText: "", bestSuggester: { name: "", account: "" } };
    newData[listName].push(newItem);
    setData(newData); setJsonInput(JSON.stringify(newData, null, 2));
  };

  const removeItem = (listName, index) => {
    const newData = { ...data }; newData[listName].splice(index, 1);
    setData(newData); setJsonInput(JSON.stringify(newData, null, 2));
  };

  const updateListItem = (listName, index, field, value) => {
    const newData = { ...data }; newData[listName][index][field] = value;
    setData(newData); setJsonInput(JSON.stringify(newData, null, 2));
  };

  const handleImageUpload = (index, e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => { const result = reader.result; updateListItem('aiAnalysis', index, 'imageUrl', result); analyzeImage(index, result); };
    reader.readAsDataURL(file);
  };

  const callGemini = async (payload) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`;
    const delays = [1000, 2000, 4000, 8000, 16000]; let lastError = null;
    for (let i = 0; i <= delays.length; i++) {
      try {
        const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const responseText = await response.text();
        if (!response.ok) throw new Error(`API 錯誤 (${response.status}): ${responseText}`);
        if (!responseText) throw new Error("API 回傳了空資料");
        let result; try { result = JSON.parse(responseText); } catch (e) { throw new Error(`API 解析失敗: ${response.status} - ${responseText.substring(0, 100)}`); }
        if (result.error) throw new Error(result.error.message);
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error("AI 回傳了空白內容");
        return text;
      } catch (error) { lastError = error; if (i < delays.length) { await new Promise(resolve => setTimeout(resolve, delays[i])); } }
    }
    throw new Error(lastError ? lastError.message : "未知的連線錯誤");
  };

  const analyzeImage = async (index, base64Image) => {
    if (!base64Image) { showModal("請先上傳圖片", "提示", true); return; }
    if (!apiKey) { showModal("請先在右側上方輸入 Gemini API Key，才能使用 AI 分析功能。", "API Key 缺失", true); return; }
    setAnalyzingIds(prev => ({ ...prev, [index]: true }));
    try {
      const base64Data = base64Image.split(',')[1];
      const mimeType = base64Image.split(';')[0].split(':')[1];
      const payload = { contents: [{ parts: [{ text: uxExpertPrompt }, { inlineData: { mimeType: mimeType, data: base64Data } }] }], generationConfig: { responseMimeType: "application/json" } };
      const textResponse = await callGemini(payload);
      let analysisResult;
      try { let cleanText = textResponse.trim(); if (cleanText.startsWith("```json")) cleanText = cleanText.substring(7); else if (cleanText.startsWith("```")) cleanText = cleanText.substring(3); if (cleanText.endsWith("```")) cleanText = cleanText.substring(0, cleanText.length - 3); analysisResult = JSON.parse(cleanText.trim()); } catch (e) { throw new Error("AI 回傳格式異常，無法解析為 JSON。"); }
      setData(prevData => {
        const newData = JSON.parse(JSON.stringify(prevData));
        newData.aiAnalysis[index].observation = Array.isArray(analysisResult.observation) ? analysisResult.observation : [analysisResult.observation || ""];
        newData.aiAnalysis[index].suggestion = Array.isArray(analysisResult.suggestion) ? analysisResult.suggestion : [analysisResult.suggestion || ""];
        setJsonInput(JSON.stringify(newData, null, 2)); return newData;
      });
    } catch (error) { showModal("AI 分析失敗：" + error.message, "錯誤", true); }
    finally { setAnalyzingIds(prev => ({ ...prev, [index]: false })); }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    if (!apiKey) { showModal("請先在右側上方輸入 Gemini API Key，才能使用 Excel 匯入功能。", "API Key 缺失", true); return; }
    const fileNameTitle = file.name.replace(/\.[^/.]+$/, "");
    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        if (!window.XLSX) { showModal("Excel 解析元件尚未載入完成，請重整頁面後再試。", "元件錯誤", true); setIsImporting(false); return; }
        const wb = window.XLSX.read(bstr, { type: 'binary' }); const ws = wb.Sheets[wb.SheetNames[0]];
        const rawRows = window.XLSX.utils.sheet_to_json(ws, { header: 1 });
        if (!rawRows || rawRows.length === 0) { showModal("讀取到的 Excel 為空，請檢查檔案。", "格式錯誤", true); setIsImporting(false); return; }
        let headerRowIndex = -1, feedbackIdx = -1, suggestionIdx = -1;
        for (let r = 0; r < Math.min(rawRows.length, 10); r++) {
          const row = rawRows[r]; if (!row || !Array.isArray(row)) continue;
          const fIdx = row.findIndex(cell => typeof cell === 'string' && cell.trim() === "使用者體驗");
          if (fIdx !== -1) { headerRowIndex = r; feedbackIdx = fIdx; suggestionIdx = row.findIndex(cell => typeof cell === 'string' && cell.trim() === "優化建議"); break; }
        }
        if (headerRowIndex === -1 || feedbackIdx === -1) { showModal("無法自動偵測到「使用者體驗」標題欄位，請確認 Excel 格式。", "欄位錯誤", true); setIsImporting(false); return; }
        const nameIdx = feedbackIdx - 3; const accountIdx = feedbackIdx - 1;
        if (nameIdx < 0) { showModal("欄位結構異常：偵測到「使用者體驗」過於靠左，無法推算姓名欄位。", "結構錯誤", true); setIsImporting(false); return; }
        const filteredData = [];
        for (let i = headerRowIndex + 1; i < rawRows.length; i++) {
          const row = rawRows[i]; if (!row) continue;
          const name = row[nameIdx], account = row[accountIdx], feedback = row[feedbackIdx], suggestion = suggestionIdx !== -1 ? row[suggestionIdx] : "";
          if (typeof name === 'string' && (name.includes("早班") || name.includes("中班") || name.includes("測試帳號") || name.includes("填寫完成"))) continue;
          if (!name || !feedback || feedback === "使用者體驗") continue;
          filteredData.push({ _id: `R${i}`, user: name, account: account || "", uxContext: feedback, suggestion: suggestion || "" });
        }
        if (filteredData.length === 0) { showModal("未偵測到有效資料，請確認 Excel 格式。", "無資料", true); setIsImporting(false); return; }
        const uniqueTesters = new Set(filteredData.map(d => d.user)).size;
        const payload = { contents: [{ parts: [{ text: dataImportPrompt + "\n\n" + JSON.stringify(filteredData) }] }], generationConfig: { responseMimeType: "application/json" } };
        const textResponse = await callGemini(payload);
        let importedData;
        try { let cleanText = textResponse.trim(); if (cleanText.startsWith("```json")) cleanText = cleanText.substring(7); else if (cleanText.startsWith("```")) cleanText = cleanText.substring(3); if (cleanText.endsWith("```")) cleanText = cleanText.substring(0, cleanText.length - 3); importedData = JSON.parse(cleanText.trim()); } catch (e) { throw new Error("AI 回傳格式錯誤，請重試"); }

        const rowMap = new Map(filteredData.map(d => [d._id, d]));
        const processIssues = (issues) => {
          if (!Array.isArray(issues)) return [];
          return issues.map(i => {
            const relatedIds = Array.isArray(i.relatedRowIds) ? i.relatedRowIds : [];
            const validRows = relatedIds.map(id => rowMap.get(id)).filter(Boolean);
            const fallbackPersonnel = Array.isArray(i.relatedPersonnel) ? i.relatedPersonnel : [];
            const personnelNames = validRows.length > 0 ? validRows.map(r => r.user) : fallbackPersonnel;
            const uniquePersonnel = [...new Set(personnelNames)];
            let bestSuggester = { name: "", account: "" };
            if (i.bestSuggesterRowId && rowMap.has(i.bestSuggesterRowId)) { const bestRow = rowMap.get(i.bestSuggesterRowId); bestSuggester = { name: bestRow.user, account: bestRow.account }; }
            else if (i.bestSuggester && i.bestSuggester.name) { bestSuggester = i.bestSuggester; }
            const { relatedRowIds, bestSuggesterRowId, ...restProps } = i;
            return { ...restProps, relatedPersonnel: uniquePersonnel, count: uniquePersonnel.length, bestSuggestionRawText: i.bestSuggestionRawText || "", bestSuggester: bestSuggester };
          });
        };
        let allIssues = [];
        if (importedData.criticalIssues) allIssues = allIssues.concat(processIssues(importedData.criticalIssues));
        if (importedData.secondaryIssues) allIssues = allIssues.concat(processIssues(importedData.secondaryIssues));
        const criticalThreshold = Math.ceil(uniqueTesters * 0.35);
        const newCritical = [], newSecondary = [];
        allIssues.forEach(issue => { if (issue.count === 0) return; if (issue.count >= criticalThreshold) newCritical.push(issue); else newSecondary.push(issue); });
        newCritical.sort((a, b) => b.count - a.count); newSecondary.sort((a, b) => b.count - a.count);
        newCritical.forEach((issue, idx) => { issue.id = `UX${String(idx + 1).padStart(2, '0')}`; issue.suggestionId = `S${String(idx + 1).padStart(2, '0')}`; });
        const criticalLen = newCritical.length;
        newSecondary.forEach((issue, idx) => { issue.id = `UX${String(criticalLen + idx + 1).padStart(2, '0')}`; issue.suggestionId = `S${String(criticalLen + idx + 1).padStart(2, '0')}`; });
        importedData.criticalIssues = newCritical; importedData.secondaryIssues = newSecondary;
        importedData.aiAnalysis = data.aiAnalysis || [];
        if (!importedData.meta) importedData.meta = {};
        importedData.meta.title = fileNameTitle; importedData.meta.date = new Date().toISOString().split('T')[0]; importedData.meta.testerCount = uniqueTesters;
        setData(importedData); setJsonInput(JSON.stringify(importedData, null, 2)); setActiveTab('editor'); setIsImporting(false);
      } catch (error) { showModal("匯入失敗：" + error.message, "錯誤", true); setIsImporting(false); }
    };
    reader.onerror = () => { showModal("檔案讀取失敗", "錯誤", true); setIsImporting(false); };
    try { reader.readAsBinaryString(file); } catch (error) { showModal("處理檔案時發生錯誤：" + error.message, "錯誤", true); setIsImporting(false); }
  };

  const handleHtmlImport = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const doc = new DOMParser().parseFromString(evt.target.result, 'text/html');
        const scriptTag = doc.getElementById('data-snapshot');
        if (scriptTag && scriptTag.textContent) { const parsedData = JSON.parse(scriptTag.textContent); setData(parsedData); setJsonInput(JSON.stringify(parsedData, null, 2)); setActiveTab('editor'); showModal("成功匯入舊版報告資料！", "匯入成功"); }
        else showModal("無法在 HTML 中找到資料快照，請確認檔案是否為此工具產生的報告。", "格式錯誤", true);
      } catch (err) { showModal("匯入失敗：檔案解析錯誤。", "解析錯誤", true); }
    };
    reader.readAsText(file); e.target.value = '';
  };

  const handleExportHtml = () => {
    const sanitizeIssues = (issues) => issues.map(item => { const { relatedPersonnel, bestSuggestionRawText, bestSuggester, ...rest } = item; return rest; });
    const cleanData = { ...data, criticalIssues: sanitizeIssues(data.criticalIssues), secondaryIssues: sanitizeIssues(data.secondaryIssues) };
    const jsonSnapshot = JSON.stringify(data);
    const issueRows = (issues, color) => issues.map(item => `<tr class="hover:bg-slate-750"><td class="px-4 py-3 text-center text-${color}-400 font-mono border-r border-slate-600">${item.id}</td><td class="px-4 py-3 text-slate-200 border-r border-slate-600 leading-relaxed whitespace-pre-wrap"><div class="font-medium text-slate-200">${item.issue}</div></td><td class="px-4 py-3 text-center font-bold text-white border-r border-slate-600">${item.count}</td><td class="px-4 py-3 text-center text-purple-400 font-mono border-r border-slate-600">${item.suggestionId}</td><td class="px-4 py-3 text-slate-300 leading-relaxed whitespace-pre-wrap"><div>${item.suggestion}</div></td></tr>`).join('');
    const tableBlock = (title, issues, color) => `<div class="mb-8"><h3 class="text-xl font-bold text-${color}-400 mb-3 border-l-4 border-${color}-500 pl-3">${title}</h3><div class="overflow-hidden rounded-lg border border-slate-600"><table class="w-full text-sm text-left"><thead class="text-xs uppercase bg-slate-700 text-slate-200"><tr><th class="px-4 py-3 w-16 text-center border-r border-slate-600">編號</th><th class="px-4 py-3 border-r border-slate-600">使用者體驗 (Issue)</th><th class="px-4 py-3 w-16 text-center border-r border-slate-600">人數</th><th class="px-4 py-3 w-16 text-center border-r border-slate-600">編號</th><th class="px-4 py-3">組員優化建議 (Suggestion)</th></tr></thead><tbody class="divide-y divide-slate-600 bg-slate-800">${issueRows(issues, color)}</tbody></table></div></div>`;
    const aiBlock = cleanData.aiAnalysis.map(item => `<div class="flex gap-6 border-b border-slate-700 pb-6 last:border-0 last:pb-0"><div class="w-1/2 flex flex-col gap-2"><span class="text-xs text-slate-400">AI 辨識用圖片</span><div class="rounded-lg overflow-hidden border border-slate-600 bg-black/40 min-h-[150px] flex items-center justify-center">${item.imageUrl ? `<img src="${item.imageUrl}" class="w-full object-cover" />` : `<div class="text-slate-500 text-xs">尚無圖片</div>`}</div></div><div class="w-1/2 flex flex-col justify-center"><div class="flex items-center gap-2 mb-2"><span class="bg-orange-500/20 text-orange-300 px-2 py-0.5 rounded text-xs border border-orange-500/30 font-mono">${item.id}</span><span class="text-orange-400 font-bold text-sm">AI 觀察與建議</span></div><div class="space-y-3"><div class="bg-slate-900/50 p-3 rounded border border-slate-700/50"><p class="text-slate-400 text-xs mb-2 font-bold">觀察 (Observation)</p><ul class="list-disc list-outside ml-4 space-y-1">${Array.isArray(item.observation) ? item.observation.map(p => `<li class="text-slate-200 text-sm leading-relaxed pl-1 marker:text-slate-500">${p}</li>`).join('') : ''}</ul></div><div class="bg-slate-900/50 p-3 rounded border border-purple-500/30"><p class="text-purple-400 text-xs mb-2 font-bold">建議 (Suggestion)</p><ul class="list-disc list-outside ml-4 space-y-1">${Array.isArray(item.suggestion) ? item.suggestion.map(p => `<li class="text-slate-200 text-sm leading-relaxed pl-1 marker:text-purple-500">${p}</li>`).join('') : ''}</ul></div></div></div></div>`).join('');
    const htmlContent = `<!DOCTYPE html><html lang="zh-TW"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${cleanData.meta.title}</title><script src="https://cdn.tailwindcss.com"><\/script><style>body{background-color:#0f1115;color:#e2e8f0;font-family:sans-serif;}.custom-scrollbar::-webkit-scrollbar{width:8px}.custom-scrollbar::-webkit-scrollbar-track{background:#1e293b}.custom-scrollbar::-webkit-scrollbar-thumb{background:#475569;border-radius:4px}</style></head><body class="p-8 max-w-5xl mx-auto custom-scrollbar"><div class="mb-8 border-b border-slate-700 pb-4 flex justify-between items-end"><div><h1 class="text-3xl font-bold text-white mb-2">${cleanData.meta.title}</h1><p class="text-slate-400 text-sm">報告日期: ${cleanData.meta.date} | 總測人數: ${cleanData.meta.testerCount}人</p></div></div><div class="mb-8 bg-slate-800 border border-slate-600 rounded-lg overflow-hidden"><div class="bg-slate-700 px-4 py-2 border-b border-slate-600 flex justify-between items-center"><h3 class="font-bold text-white flex items-center gap-2">使用者體驗 - 總結</h3><span class="bg-red-500/20 text-red-300 text-xs px-2 py-0.5 rounded border border-red-500/30">Impact: ${cleanData.summary.impactLevel}</span></div><div class="p-5 text-slate-200 leading-relaxed text-lg whitespace-pre-wrap">${cleanData.summary.content}</div></div>${tableBlock('使用者體驗回饋 (重要)', cleanData.criticalIssues, 'green')}${tableBlock('使用者體驗回饋 (次要)', cleanData.secondaryIssues, 'blue')}<div class="mb-8"><div class="bg-orange-900/30 border border-orange-500/50 rounded-t-lg px-4 py-2 flex items-center gap-2"><h3 class="text-lg font-bold text-orange-100">AI - UI/UX 圖像判讀與建議</h3></div><div class="border-x border-b border-orange-500/30 bg-slate-800/50 p-6 rounded-b-lg space-y-8">${aiBlock}</div></div><script id="data-snapshot" type="application/json">${jsonSnapshot}<\/script></body></html>`;
    const blob = new Blob([htmlContent], { type: 'text/html' }); const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `UX_Report_${data.meta.date}.html`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const isLoading = isImporting || Object.values(analyzingIds).some(v => v === true);

  return (
    <div className="flex h-screen w-full bg-slate-900 text-slate-100 font-sans overflow-hidden relative">
      <div className="w-[70%] h-full overflow-y-auto p-8 border-r border-slate-700 custom-scrollbar bg-[#0f1115]">
        <div className="mb-8 border-b border-slate-700 pb-4 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">{data.meta.title}</h1>
            <p className="text-slate-400 text-sm">報告日期: {data.meta.date} | 總測人數: {data.meta.testerCount}人</p>
          </div>
          <div className="text-right">
            <div className="flex bg-slate-800 rounded p-1 border border-slate-700">
              <button onClick={() => setPreviewMode('export')} className={`px-3 py-1 text-xs rounded transition-colors flex items-center gap-1 ${previewMode === 'export' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}><Eye size={12} /> 匯出報告預覽</button>
              <button onClick={() => setPreviewMode('internal')} className={`px-3 py-1 text-xs rounded transition-colors flex items-center gap-1 ${previewMode === 'internal' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}><EyeOff size={12} /> 內部完整資料</button>
            </div>
          </div>
        </div>
        <div className="mb-8 bg-slate-800 border border-slate-600 rounded-lg overflow-hidden">
          <div className="bg-slate-700 px-4 py-2 border-b border-slate-600 flex justify-between items-center">
            <h3 className="font-bold text-white flex items-center gap-2"><FileText size={16} /> 使用者體驗 - 總結</h3>
            <span className="bg-red-500/20 text-red-300 text-xs px-2 py-0.5 rounded border border-red-500/30">Impact: {data.summary.impactLevel}</span>
          </div>
          <div className="p-5 text-slate-200 leading-relaxed text-lg whitespace-pre-wrap">{data.summary.content}</div>
        </div>
        {/* Critical Issues */}
        <div className="mb-8">
          <h3 className="text-xl font-bold text-green-400 mb-3 border-l-4 border-green-500 pl-3">使用者體驗回饋 (重要)</h3>
          <div className="overflow-hidden rounded-lg border border-slate-600">
            {data.criticalIssues.length > 0 ? (
              <table className="w-full text-sm text-left"><thead className="text-xs uppercase bg-slate-700 text-slate-200"><tr><th className="px-4 py-3 w-16 text-center border-r border-slate-600">編號</th><th className="px-4 py-3 border-r border-slate-600">使用者體驗 (Issue)</th><th className="px-4 py-3 w-16 text-center border-r border-slate-600">人數</th><th className="px-4 py-3 w-16 text-center border-r border-slate-600">編號</th><th className="px-4 py-3">組員優化建議 (Suggestion)</th></tr></thead>
                <tbody className="divide-y divide-slate-600 bg-slate-800">
                  {data.criticalIssues.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-750">
                      <td className="px-4 py-3 text-center text-green-400 font-mono border-r border-slate-600">{item.id}</td>
                      <td className="px-4 py-3 text-slate-200 border-r border-slate-600 leading-relaxed whitespace-pre-wrap">
                        <div className="mb-2">{item.issue}</div>
                        {previewMode === 'internal' && Array.isArray(item.relatedPersonnel) && item.relatedPersonnel.length > 0 && (
                          <div className="mt-2"><span className="text-[10px] text-blue-300 mr-2 block mb-1">相關人員:</span><div className="flex flex-wrap gap-1">{item.relatedPersonnel.map((person, pIdx) => (<span key={pIdx} className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-900/50 text-blue-200 border border-blue-800">{person}</span>))}</div></div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-white border-r border-slate-600">{item.count}</td>
                      <td className="px-4 py-3 text-center text-purple-400 font-mono border-r border-slate-600">{item.suggestionId}</td>
                      <td className="px-4 py-3 text-slate-300 leading-relaxed whitespace-pre-wrap">
                        <div className="mb-2">{item.suggestion}</div>
                        {previewMode === 'internal' && item.bestSuggestionRawText && (<div className="bg-slate-900/30 p-2 rounded border border-slate-700/50 text-xs italic text-slate-400 mb-2 whitespace-pre-wrap"><span className="block text-[10px] text-slate-500 not-italic mb-1">原始建議:</span>"{item.bestSuggestionRawText}"</div>)}
                        {previewMode === 'internal' && (item.bestSuggester && item.bestSuggester.name) && (<div className="text-xs flex items-center gap-1 text-orange-400"><span>🏆 最佳建議者: {item.bestSuggester.name}</span><span className="text-orange-400/60">({item.bestSuggester.account || 'No ID'})</span></div>)}
                      </td>
                    </tr>))}
                </tbody></table>
            ) : <div className="p-4 text-center text-slate-500 italic">尚無資料，請匯入 Excel</div>}
          </div>
        </div>
        {/* Secondary Issues */}
        <div className="mb-10">
          <h3 className="text-xl font-bold text-blue-400 mb-3 border-l-4 border-blue-500 pl-3">使用者體驗回饋 (次要)</h3>
          <div className="overflow-hidden rounded-lg border border-slate-600">
            {data.secondaryIssues.length > 0 ? (
              <table className="w-full text-sm text-left"><thead className="text-xs uppercase bg-slate-700 text-slate-200"><tr><th className="px-4 py-3 w-16 text-center border-r border-slate-600">編號</th><th className="px-4 py-3 border-r border-slate-600">使用者體驗 (Issue)</th><th className="px-4 py-3 w-16 text-center border-r border-slate-600">人數</th><th className="px-4 py-3 w-16 text-center border-r border-slate-600">編號</th><th className="px-4 py-3">組員優化建議 (Suggestion)</th></tr></thead>
                <tbody className="divide-y divide-slate-600 bg-slate-800">
                  {data.secondaryIssues.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-750">
                      <td className="px-4 py-3 text-center text-blue-400 font-mono border-r border-slate-600">{item.id}</td>
                      <td className="px-4 py-3 text-slate-200 border-r border-slate-600 leading-relaxed whitespace-pre-wrap">
                        <div className="mb-2">{item.issue}</div>
                        {previewMode === 'internal' && Array.isArray(item.relatedPersonnel) && item.relatedPersonnel.length > 0 && (
                          <div className="mt-2"><span className="text-[10px] text-blue-300 mr-2 block mb-1">相關人員:</span><div className="flex flex-wrap gap-1">{item.relatedPersonnel.map((person, pIdx) => (<span key={pIdx} className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-900/50 text-blue-200 border border-blue-800">{person}</span>))}</div></div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-white border-r border-slate-600">{item.count}</td>
                      <td className="px-4 py-3 text-center text-purple-400 font-mono border-r border-slate-600">{item.suggestionId}</td>
                      <td className="px-4 py-3 text-slate-300 leading-relaxed whitespace-pre-wrap">
                        <div className="mb-2">{item.suggestion}</div>
                        {previewMode === 'internal' && item.bestSuggestionRawText && (<div className="bg-slate-900/30 p-2 rounded border border-slate-700/50 text-xs italic text-slate-400 mb-2 whitespace-pre-wrap"><span className="block text-[10px] text-slate-500 not-italic mb-1">原始建議:</span>"{item.bestSuggestionRawText}"</div>)}
                        {previewMode === 'internal' && (item.bestSuggester && item.bestSuggester.name) && (<div className="text-xs flex items-center gap-1 text-orange-400"><span>🏆 最佳建議者: {item.bestSuggester.name}</span><span className="text-orange-400/60">({item.bestSuggester.account || 'No ID'})</span></div>)}
                      </td>
                    </tr>))}
                </tbody></table>
            ) : <div className="p-4 text-center text-slate-500 italic">尚無資料，請匯入 Excel</div>}
          </div>
        </div>
        {/* AI Image Analysis */}
        <div className="mb-8">
          <div className="bg-orange-900/30 border border-orange-500/50 rounded-t-lg px-4 py-2 flex items-center gap-2"><AlertTriangle size={18} className="text-orange-400" /><h3 className="text-lg font-bold text-orange-100">AI - UI/UX 圖像判讀與建議</h3></div>
          <div className="border-x border-b border-orange-500/30 bg-slate-800/50 p-6 rounded-b-lg space-y-8">
            {data.aiAnalysis.length > 0 ? data.aiAnalysis.map((item, idx) => (
              <div key={idx} className="flex gap-6 border-b border-slate-700 pb-6 last:border-0 last:pb-0">
                <div className="w-1/2 flex flex-col gap-2">
                  <span className="text-xs text-slate-400">AI 辨識用圖片</span>
                  <div className="rounded-lg overflow-hidden border border-slate-600 relative group bg-black/40 min-h-[150px] flex items-center justify-center">
                    {item.imageUrl ? (<img src={item.imageUrl} alt="Analysis" className="w-full object-cover" />) : (<div className="text-slate-500 text-xs flex flex-col items-center"><ImageIcon size={24} className="mb-2 opacity-50" />尚無圖片</div>)}
                  </div>
                </div>
                <div className="w-1/2 flex flex-col justify-center">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="bg-orange-500/20 text-orange-300 px-2 py-0.5 rounded text-xs border border-orange-500/30 font-mono">{item.id}</span>
                    <span className="text-orange-400 font-bold text-sm">AI 觀察與建議</span>
                  </div>
                  <div className="space-y-3">
                    <div className="bg-slate-900/50 p-3 rounded border border-slate-700/50">
                      <p className="text-slate-400 text-xs mb-2 font-bold">觀察 (Observation)</p>
                      {Array.isArray(item.observation) && item.observation.length > 0 ? (<ul className="list-disc list-outside ml-4 space-y-1">{item.observation.map((point, i) => (<li key={i} className="text-slate-200 text-sm leading-relaxed pl-1 marker:text-slate-500">{point}</li>))}</ul>) : <p className="text-slate-500 text-sm">等待分析...</p>}
                    </div>
                    <div className="bg-slate-900/50 p-3 rounded border border-purple-500/30">
                      <p className="text-purple-400 text-xs mb-2 font-bold">建議 (Suggestion)</p>
                      {Array.isArray(item.suggestion) && item.suggestion.length > 0 ? (<ul className="list-disc list-outside ml-4 space-y-1">{item.suggestion.map((point, i) => (<li key={i} className="text-slate-200 text-sm leading-relaxed pl-1 marker:text-purple-500">{point}</li>))}</ul>) : <p className="text-slate-500 text-sm">等待分析...</p>}
                    </div>
                  </div>
                </div>
              </div>
            )) : <div className="text-center text-slate-500 text-sm">尚無圖像分析，請從右側新增。</div>}
          </div>
        </div>
      </div>

      {/* RIGHT: Editor */}
      <div className="w-[30%] bg-slate-800 border-l border-slate-700 flex flex-col h-full shadow-2xl z-10">
        <div className="p-4 bg-slate-900 border-b border-slate-700">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2"><Settings size={18} className="animate-spin-slow" /> 報告編輯器</h2>
            <div className="flex gap-1 bg-slate-800 rounded p-1">
              <button onClick={() => setActiveTab('editor')} className={`px-3 py-1 text-xs rounded transition-colors ${activeTab === 'editor' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>GUI</button>
              <button onClick={() => setActiveTab('prompts')} className={`px-3 py-1 text-xs rounded transition-colors ${activeTab === 'prompts' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>Prompts</button>
              <button onClick={() => setActiveTab('json')} className={`px-3 py-1 text-xs rounded transition-colors ${activeTab === 'json' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>JSON</button>
            </div>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-slate-300 font-bold flex items-center gap-1.5">🔑 Gemini API Key</label>
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors">前往取得 API Key →</a>
            </div>
            <div className="flex gap-2 items-center">
              <div className="relative flex-1">
                <input
                  type={showApiKey ? "text" : "password"}
                  className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-xs text-white outline-none focus:border-blue-500 pr-8 transition-colors"
                  placeholder="輸入您的 Gemini API Key..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
                <button onClick={() => setShowApiKey(!showApiKey)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                  {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            {!apiKey && <p className="text-[10px] text-amber-400/80 mt-1.5">⚠️ 需要 API Key 才能使用 AI 分析和 Excel 匯入功能</p>}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {activeTab === 'editor' && (<EditorTab data={data} previewMode={previewMode} isImporting={isImporting} analyzingIds={analyzingIds} updateField={updateField} addItem={addItem} removeItem={removeItem} updateListItem={updateListItem} handleFileUpload={handleFileUpload} handleHtmlImport={handleHtmlImport} handleImageUpload={handleImageUpload} analyzeImage={analyzeImage} />)}
          {activeTab === 'prompts' && (<PromptsTab uxExpertPrompt={uxExpertPrompt} setUxExpertPrompt={setUxExpertPrompt} dataImportPrompt={dataImportPrompt} setDataImportPrompt={setDataImportPrompt} />)}
          {activeTab === 'json' && (<div className="h-full flex flex-col"><p className="text-xs text-slate-400 mb-2">完整 Raw Data JSON：</p><textarea className="flex-1 w-full bg-slate-950 font-mono text-xs text-green-400 p-4 rounded border border-slate-700 outline-none resize-none" value={jsonInput} onChange={handleJsonChange} spellCheck="false" /></div>)}
        </div>
        <div className="p-4 border-t border-slate-700 bg-slate-900">
          <button onClick={handleExportHtml} className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded flex items-center justify-center gap-2 transition-all shadow-lg shadow-green-900/20"><Download size={18} /> 匯出 HTML 報告</button>
        </div>
      </div>
      {isLoading && (<div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center cursor-not-allowed"><Loader2 size={48} className="text-blue-400 animate-spin mb-4" /><p className="text-white text-lg font-bold tracking-wider">資料處理中...</p></div>)}
      {modalConfig.isOpen && (<div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"><div className="bg-slate-800 border border-slate-600 rounded-lg shadow-xl max-w-sm w-full relative"><button onClick={closeModal} className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"><X size={18} /></button><div className="p-6"><div className="flex items-center gap-3 mb-4">{modalConfig.isError ? (<AlertTriangle className="text-red-400" size={24} />) : (<MessageSquare className="text-blue-400" size={24} />)}<h3 className={`text-lg font-bold ${modalConfig.isError ? 'text-red-400' : 'text-blue-400'}`}>{modalConfig.title}</h3></div><p className="text-slate-300 leading-relaxed mb-6 whitespace-pre-wrap">{modalConfig.message}</p><div className="flex justify-end"><button onClick={closeModal} className="px-5 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors text-sm font-medium">確定</button></div></div></div></div>)}
    </div>
  );
};

// Sub-components to keep the main component clean
const EditorTab = ({ data, isImporting, analyzingIds, updateField, addItem, removeItem, updateListItem, handleFileUpload, handleHtmlImport, handleImageUpload, analyzeImage }) => (
  <>
    <div className="mb-4 bg-slate-700/30 border border-slate-600 rounded-lg p-3">
      <h4 className="text-slate-300 text-xs font-bold mb-2 flex items-center gap-2"><FolderInput size={14} /> 匯入舊版 HTML 報告</h4>
      <label className="flex-1 cursor-pointer bg-slate-800 border border-slate-600 rounded py-2 px-3 hover:bg-slate-700 transition-colors flex items-center justify-center gap-2 text-xs text-slate-300"><Code size={14} /><span>選擇 HTML 檔案還原</span><input type="file" accept=".html" className="hidden" onChange={handleHtmlImport} /></label>
    </div>
    <div className="mb-6 bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
      <h4 className="text-blue-400 text-sm font-bold mb-2 flex items-center gap-2"><FileSpreadsheet size={16} /> 匯入 Excel 原始資料</h4>
      <p className="text-xs text-slate-400 mb-3 leading-relaxed">上傳使用者體驗回饋的 Excel (.xlsx)，AI 將自動清洗空洞回饋、整併相似問題、統計頻率並歸納重點。</p>
      <label className={`flex items-center justify-center gap-2 w-full py-3 rounded border border-dashed cursor-pointer transition-all ${isImporting ? 'bg-slate-800 border-slate-600 text-slate-500' : 'bg-blue-600/10 border-blue-500/50 text-blue-300 hover:bg-blue-600/20'}`}>
        {isImporting ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
        <span className="text-xs font-bold">{isImporting ? "AI 正在分析資料..." : "點擊上傳 Excel 檔"}</span>
        <input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleFileUpload} disabled={isImporting} />
      </label>
    </div>
    <div className="space-y-6">
      <Section title="1. 報告基礎資訊">
        <InputGroup label="報告標題" value={data.meta.title} onChange={(e) => updateField('meta.title', e.target.value)} />
        <div className="grid grid-cols-2 gap-2"><InputGroup label="日期" type="date" value={data.meta.date} onChange={(e) => updateField('meta.date', e.target.value)} /><InputGroup label="測試總人數" type="number" value={data.meta.testerCount} onChange={(e) => updateField('meta.testerCount', parseInt(e.target.value))} /></div>
      </Section>
      <Section title="2. 體驗總結 (Summary)">
        <textarea className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white focus:border-blue-500 outline-none h-32 leading-relaxed" value={data.summary.content} onChange={(e) => updateField('summary.content', e.target.value)} />
      </Section>
      <Section title="3. 重要問題 (Critical)">
        {data.criticalIssues.map((item, idx) => <IssueEditor key={idx} listName="criticalIssues" item={item} idx={idx} colorClass="text-green-400" removeItem={removeItem} updateListItem={updateListItem} />)}
        <button onClick={() => addItem('criticalIssues')} className="w-full py-2 border border-dashed border-slate-600 rounded text-slate-400 hover:text-white hover:border-slate-400 text-xs flex items-center justify-center gap-1"><Plus size={14} /> 新增重要問題</button>
      </Section>
      <Section title="4. 次要問題 (Secondary)">
        {data.secondaryIssues.map((item, idx) => <IssueEditor key={idx} listName="secondaryIssues" item={item} idx={idx} colorClass="text-blue-400" removeItem={removeItem} updateListItem={updateListItem} />)}
        <button onClick={() => addItem('secondaryIssues')} className="w-full py-2 border border-dashed border-slate-600 rounded text-slate-400 hover:text-white hover:border-slate-400 text-xs flex items-center justify-center gap-1"><Plus size={14} /> 新增次要問題</button>
      </Section>
      <Section title="5. AI 圖像分析 (Smart Analysis)">
        {data.aiAnalysis.map((item, idx) => (
          <div key={idx} className="mb-4 bg-slate-900/50 p-3 rounded border border-slate-700 relative group">
            <button onClick={() => removeItem('aiAnalysis', idx)} className="absolute top-2 right-2 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity z-10"><Trash2 size={14} /></button>
            <div className="mb-3"><label className="text-xs text-slate-500 mb-1 block">1. 上傳遊戲截圖</label><div className="flex gap-2 items-center">
              <label className="flex-1 cursor-pointer bg-slate-800 border border-slate-600 border-dashed rounded h-16 flex flex-col items-center justify-center hover:bg-slate-700 transition-colors relative overflow-hidden">{item.imageUrl ? (<img src={item.imageUrl} className="absolute inset-0 w-full h-full object-cover opacity-50" alt="Preview" />) : null}<div className="relative z-10 flex flex-col items-center"><Upload size={16} className="text-slate-400" /><span className="text-[10px] text-slate-400 mt-1">點擊上傳</span></div><input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(idx, e)} /></label>
              <button onClick={() => analyzeImage(idx, item.imageUrl)} disabled={analyzingIds[idx] || !item.imageUrl} className={`h-16 w-16 rounded flex flex-col items-center justify-center gap-1 text-[10px] font-bold border transition-all ${analyzingIds[idx] ? 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed' : !item.imageUrl ? 'bg-slate-800 text-slate-600 border-slate-700 cursor-not-allowed' : 'bg-orange-600 hover:bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-900/20'}`}>{analyzingIds[idx] ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}{analyzingIds[idx] ? '分析中' : 'AI 分析'}</button>
            </div></div>
            <div className="mt-2"><label className="text-xs text-slate-500 mb-1 block">AI 觀察 (每行一點)</label><textarea className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-xs text-slate-300 mb-2 h-20" value={Array.isArray(item.observation) ? item.observation.join('\n') : item.observation} onChange={(e) => updateListItem('aiAnalysis', idx, 'observation', e.target.value.split('\n'))} placeholder="等待 AI 分析..." /></div>
            <div className="mt-1"><label className="text-xs text-purple-400/70 mb-1 block">UIUX 建議 (每行一點)</label><textarea className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-xs text-purple-300 h-24" value={Array.isArray(item.suggestion) ? item.suggestion.join('\n') : item.suggestion} onChange={(e) => updateListItem('aiAnalysis', idx, 'suggestion', e.target.value.split('\n'))} placeholder="等待 AI 分析..." /></div>
          </div>
        ))}
        <button onClick={() => addItem('aiAnalysis')} className="w-full py-2 border border-dashed border-orange-500/50 rounded text-orange-400 hover:text-orange-200 hover:border-orange-400 text-xs flex items-center justify-center gap-1"><Plus size={14} /> 新增圖片分析</button>
      </Section>
    </div>
  </>
);

const IssueEditor = ({ listName, item, idx, colorClass, removeItem, updateListItem }) => (
  <div className="mb-4 bg-slate-900/50 p-3 rounded border border-slate-700 relative group">
    <button onClick={() => removeItem(listName, idx)} className="absolute top-2 right-2 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14} /></button>
    <div className="flex gap-2 mb-2">
      <input className={`w-16 bg-slate-800 border border-slate-600 rounded px-2 text-xs ${colorClass}`} value={item.id} onChange={(e) => updateListItem(listName, idx, 'id', e.target.value)} />
      <input className="w-16 bg-slate-800 border border-slate-600 rounded px-2 text-xs text-white text-center" type="number" value={item.count} onChange={(e) => updateListItem(listName, idx, 'count', parseInt(e.target.value))} title="人數" />
    </div>
    <textarea className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-xs text-slate-300 mb-2 h-16" placeholder="問題描述..." value={item.issue} onChange={(e) => updateListItem(listName, idx, 'issue', e.target.value)} />
    <div className="mb-2"><label className="text-[10px] text-blue-300 block mb-1">相關人員 (陣列, 以逗號分隔)</label><textarea className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-blue-200" placeholder="UserA, UserB..." value={Array.isArray(item.relatedPersonnel) ? item.relatedPersonnel.join(', ') : ""} onChange={(e) => updateListItem(listName, idx, 'relatedPersonnel', e.target.value.split(',').map(s => s.trim()))} /></div>
    <textarea className="w-full bg-slate-800 border border-slate-600/50 rounded p-2 text-xs text-purple-300 h-16 mb-2" placeholder="優化建議..." value={item.suggestion} onChange={(e) => updateListItem(listName, idx, 'suggestion', e.target.value)} />
    <div className="bg-slate-800 border border-slate-700 rounded p-2">
      <div className="text-[10px] text-orange-400 mb-1 flex items-center gap-1 font-bold"><Trophy size={10} /> 最佳建議提供者</div>
      <div className="flex gap-2 mb-2"><input className="w-1/2 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-slate-300" placeholder="姓名" value={item.bestSuggester?.name || ""} onChange={(e) => updateListItem(listName, idx, 'bestSuggester', { ...item.bestSuggester, name: e.target.value })} /><input className="w-1/2 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-slate-400" placeholder="帳號" value={item.bestSuggester?.account || ""} onChange={(e) => updateListItem(listName, idx, 'bestSuggester', { ...item.bestSuggester, account: e.target.value })} /></div>
      <textarea className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-slate-400 italic" placeholder="原始回饋內容 (Raw Content)..." value={item.bestSuggestionRawText || ""} onChange={(e) => updateListItem(listName, idx, 'bestSuggestionRawText', e.target.value)} />
    </div>
  </div>
);

const PromptsTab = ({ uxExpertPrompt, setUxExpertPrompt, dataImportPrompt, setDataImportPrompt }) => (
  <div className="space-y-6 h-full flex flex-col">
    <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 flex-1 flex flex-col">
      <h4 className="text-sm font-bold text-orange-400 mb-2 flex items-center gap-2"><ImageIcon size={16} /> AI 圖像分析指令 (Image Prompt)</h4>
      <p className="text-xs text-slate-400 mb-2">這是點擊「AI 分析」按鈕時，發送給 AI 的指令。您可以根據專案需求微調分析邏輯。</p>
      <textarea className="flex-1 w-full bg-slate-900 border border-slate-600 rounded p-3 text-xs text-slate-300 font-mono leading-relaxed outline-none focus:border-orange-500 resize-none" value={uxExpertPrompt} onChange={(e) => setUxExpertPrompt(e.target.value)} spellCheck="false" />
    </div>
    <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 flex-1 flex flex-col">
      <h4 className="text-sm font-bold text-blue-400 mb-2 flex items-center gap-2"><FileSpreadsheet size={16} /> Excel 匯入分析指令 (Data Prompt)</h4>
      <p className="text-xs text-slate-400 mb-2">這是匯入 Excel 檔案時，AI 用於清洗、整併與分類資料的指令。可調整門檻 (如 35%) 或分類規則。</p>
      <textarea className="flex-1 w-full bg-slate-900 border border-slate-600 rounded p-3 text-xs text-slate-300 font-mono leading-relaxed outline-none focus:border-blue-500 resize-none" value={dataImportPrompt} onChange={(e) => setDataImportPrompt(e.target.value)} spellCheck="false" />
    </div>
  </div>
);

const Section = ({ title, children }) => (<div className="border border-slate-600/50 rounded-lg p-3 bg-slate-800/50"><h4 className="text-sm font-bold text-blue-400 mb-3 pb-2 border-b border-slate-600/50 flex items-center justify-between">{title}</h4>{children}</div>);
const InputGroup = ({ label, type = "text", value, onChange }) => (<div className="mb-2"><label className="text-xs text-slate-400 block mb-1">{label}</label><input type={type} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm text-white focus:border-blue-500 outline-none transition-colors" value={value} onChange={onChange} /></div>);

// --- Render ---
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
