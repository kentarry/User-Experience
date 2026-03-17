import * as XLSX from 'xlsx';
import { callGemini, parseAIJson } from './gemini';

/**
 * Parse an Excel file and use Gemini AI to analyze UX feedback data.
 * @param {File} file - The uploaded Excel file.
 * @param {string} dataImportPrompt - The prompt to send to Gemini.
 * @param {string} apiKey - The Gemini API key.
 * @param {Array} existingAiAnalysis - Existing AI analysis items to preserve.
 * @returns {object} - The processed report data.
 */
export async function importExcelFile(file, dataImportPrompt, apiKey, existingAiAnalysis) {
  const fileNameTitle = file.name.replace(/\.[^/.]+$/, "");

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];

        const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1 });

        if (!rawRows || rawRows.length === 0) {
          throw new Error("讀取到的 Excel 為空，請檢查檔案。");
        }

        let headerRowIndex = -1;
        let feedbackIdx = -1;
        let suggestionIdx = -1;

        for (let r = 0; r < Math.min(rawRows.length, 10); r++) {
          const row = rawRows[r];
          if (!row || !Array.isArray(row)) continue;

          const fIdx = row.findIndex(cell => typeof cell === 'string' && cell.trim() === "使用者體驗");
          if (fIdx !== -1) {
            headerRowIndex = r;
            feedbackIdx = fIdx;
            suggestionIdx = row.findIndex(cell => typeof cell === 'string' && cell.trim() === "優化建議");
            break;
          }
        }

        if (headerRowIndex === -1 || feedbackIdx === -1) {
          throw new Error("無法自動偵測到「使用者體驗」標題欄位，請確認 Excel 格式。");
        }

        const nameIdx = feedbackIdx - 3;
        const accountIdx = feedbackIdx - 1;

        if (nameIdx < 0) {
          throw new Error("欄位結構異常：偵測到「使用者體驗」過於靠左，無法推算姓名欄位。");
        }

        const filteredData = [];

        for (let i = headerRowIndex + 1; i < rawRows.length; i++) {
          const row = rawRows[i];
          if (!row) continue;

          const name = row[nameIdx];
          const account = row[accountIdx];
          const feedback = row[feedbackIdx];
          const suggestion = suggestionIdx !== -1 ? row[suggestionIdx] : "";

          if (typeof name === 'string' && (name.includes("早班") || name.includes("中班") || name.includes("測試帳號") || name.includes("填寫完成"))) {
            continue;
          }
          if (!name || !feedback || feedback === "使用者體驗") {
            continue;
          }

          filteredData.push({
            user: name,
            account: account || "",
            uxContext: feedback,
            suggestion: suggestion || ""
          });
        }

        if (filteredData.length === 0) {
          throw new Error("未偵測到有效資料，請確認 Excel 格式。");
        }

        const uniqueTesters = new Set(filteredData.map(d => d.user)).size;

        const payload = {
          contents: [{ parts: [{ text: dataImportPrompt + "\n\n" + JSON.stringify(filteredData) }] }],
          generationConfig: { responseMimeType: "application/json" }
        };

        const textResponse = await callGemini(payload, apiKey);
        let importedData;
        try {
          importedData = parseAIJson(textResponse);
        } catch (e) {
          console.error("JSON Parse Error", textResponse);
          throw new Error("AI 回傳格式錯誤，請重試");
        }

        // Programmatic post-processing: normalize, threshold, sort, renumber
        const processIssues = (issues) => {
          if (!Array.isArray(issues)) return [];
          return issues.map(i => {
            const personnelArray = Array.isArray(i.relatedPersonnel) ? i.relatedPersonnel : [];
            const uniquePersonnel = [...new Set(personnelArray)];
            return {
              ...i,
              relatedPersonnel: uniquePersonnel,
              count: uniquePersonnel.length,
              bestSuggestionRawText: i.bestSuggestionRawText || "",
              bestSuggester: i.bestSuggester || { name: "", account: "" }
            };
          });
        };

        let allIssues = [];
        if (importedData.criticalIssues) allIssues = allIssues.concat(processIssues(importedData.criticalIssues));
        if (importedData.secondaryIssues) allIssues = allIssues.concat(processIssues(importedData.secondaryIssues));

        const criticalThreshold = Math.ceil(uniqueTesters * 0.35);
        const newCritical = [];
        const newSecondary = [];

        allIssues.forEach(issue => {
          if (issue.count === 0) return;
          if (issue.count >= criticalThreshold) {
            newCritical.push(issue);
          } else {
            newSecondary.push(issue);
          }
        });

        newCritical.sort((a, b) => b.count - a.count);
        newSecondary.sort((a, b) => b.count - a.count);

        newCritical.forEach((issue, idx) => {
          issue.id = `UX${String(idx + 1).padStart(2, '0')}`;
          issue.suggestionId = `S${String(idx + 1).padStart(2, '0')}`;
        });

        const criticalLen = newCritical.length;
        newSecondary.forEach((issue, idx) => {
          issue.id = `UX${String(criticalLen + idx + 1).padStart(2, '0')}`;
          issue.suggestionId = `S${String(criticalLen + idx + 1).padStart(2, '0')}`;
        });

        importedData.criticalIssues = newCritical;
        importedData.secondaryIssues = newSecondary;
        importedData.aiAnalysis = existingAiAnalysis || [];

        if (!importedData.meta) importedData.meta = {};
        importedData.meta.title = fileNameTitle;
        importedData.meta.date = new Date().toISOString().split('T')[0];
        importedData.meta.testerCount = uniqueTesters;

        resolve(importedData);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error("檔案讀取失敗"));

    try {
      reader.readAsBinaryString(file);
    } catch (error) {
      reject(new Error("處理檔案時發生錯誤：" + error.message));
    }
  });
}
