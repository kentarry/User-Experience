/**
 * Generate and download the HTML report.
 * @param {object} data - The full report data.
 */
export function exportHtmlReport(data) {
  const sanitizeIssues = (issues) => issues.map(item => {
    const { relatedPersonnel, bestSuggestionRawText, bestSuggester, ...rest } = item;
    return rest;
  });

  const cleanData = {
    ...data,
    criticalIssues: sanitizeIssues(data.criticalIssues),
    secondaryIssues: sanitizeIssues(data.secondaryIssues)
  };

  const jsonSnapshot = JSON.stringify(data);

  const escapeHtml = (str) => {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  };

  const htmlContent = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(cleanData.meta.title)}</title>
    <script src="https://cdn.tailwindcss.com"><\/script>
    <style>
      body { background-color: #0f1115; color: #e2e8f0; font-family: sans-serif; }
      .custom-scrollbar::-webkit-scrollbar { width: 8px; }
      .custom-scrollbar::-webkit-scrollbar-track { background: #1e293b; }
      .custom-scrollbar::-webkit-scrollbar-thumb { background: #475569; border-radius: 4px; }
    </style>
</head>
<body class="p-8 max-w-5xl mx-auto custom-scrollbar">
    <div class="mb-8 border-b border-slate-700 pb-4 flex justify-between items-end">
        <div>
            <h1 class="text-3xl font-bold text-white mb-2">${escapeHtml(cleanData.meta.title)}</h1>
            <p class="text-slate-400 text-sm">報告日期: ${escapeHtml(cleanData.meta.date)} | 總測人數: ${cleanData.meta.testerCount}人</p>
        </div>
    </div>

    <div class="mb-8 bg-slate-800 border border-slate-600 rounded-lg overflow-hidden">
        <div class="bg-slate-700 px-4 py-2 border-b border-slate-600 flex justify-between items-center">
            <h3 class="font-bold text-white flex items-center gap-2">使用者體驗 - 總結</h3>
            <span class="bg-red-500/20 text-red-300 text-xs px-2 py-0.5 rounded border border-red-500/30">Impact: ${escapeHtml(cleanData.summary.impactLevel)}</span>
        </div>
        <div class="p-5 text-slate-200 leading-relaxed text-lg whitespace-pre-wrap">${escapeHtml(cleanData.summary.content)}</div>
    </div>

    ${renderIssueTable('使用者體驗回饋 (重要)', cleanData.criticalIssues, 'green', escapeHtml)}
    ${renderIssueTable('使用者體驗回饋 (次要)', cleanData.secondaryIssues, 'blue', escapeHtml)}

    <div class="mb-8">
        <div class="bg-orange-900/30 border border-orange-500/50 rounded-t-lg px-4 py-2 flex items-center gap-2">
            <h3 class="text-lg font-bold text-orange-100">AI - UI/UX 圖像判讀與建議</h3>
        </div>
        <div class="border-x border-b border-orange-500/30 bg-slate-800/50 p-6 rounded-b-lg space-y-8">
             ${cleanData.aiAnalysis.map(item => `
             <div class="flex gap-6 border-b border-slate-700 pb-6 last:border-0 last:pb-0">
                  <div class="w-1/2 flex flex-col gap-2">
                    <span class="text-xs text-slate-400">AI 辨識用圖片</span>
                    <div class="rounded-lg overflow-hidden border border-slate-600 bg-black/40 min-h-[150px] flex items-center justify-center">
                      ${item.imageUrl ? `<img src="${item.imageUrl}" class="w-full object-cover" />` : `<div class="text-slate-500 text-xs">尚無圖片</div>`}
                    </div>
                  </div>
                  <div class="w-1/2 flex flex-col justify-center">
                    <div class="flex items-center gap-2 mb-2">
                      <span class="bg-orange-500/20 text-orange-300 px-2 py-0.5 rounded text-xs border border-orange-500/30 font-mono">${escapeHtml(item.id)}</span>
                      <span class="text-orange-400 font-bold text-sm">AI 觀察與建議</span>
                    </div>
                    <div class="space-y-3">
                        <div class="bg-slate-900/50 p-3 rounded border border-slate-700/50">
                          <p class="text-slate-400 text-xs mb-2 font-bold">觀察 (Observation)</p>
                          <ul class="list-disc list-outside ml-4 space-y-1">
                              ${Array.isArray(item.observation) ? item.observation.map(p => `<li class="text-slate-200 text-sm leading-relaxed pl-1 marker:text-slate-500">${escapeHtml(p)}</li>`).join('') : ''}
                          </ul>
                        </div>
                        <div class="bg-slate-900/50 p-3 rounded border border-purple-500/30">
                          <p class="text-purple-400 text-xs mb-2 font-bold">建議 (Suggestion)</p>
                          <ul class="list-disc list-outside ml-4 space-y-1">
                              ${Array.isArray(item.suggestion) ? item.suggestion.map(p => `<li class="text-slate-200 text-sm leading-relaxed pl-1 marker:text-purple-500">${escapeHtml(p)}</li>`).join('') : ''}
                          </ul>
                        </div>
                    </div>
                  </div>
             </div>`).join('')}
        </div>
    </div>

    <script id="data-snapshot" type="application/json">${jsonSnapshot}<\/script>
</body>
</html>`;

  const blob = new Blob([htmlContent], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `UX_Report_${data.meta.date}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function renderIssueTable(title, issues, color, escapeHtml) {
  const colorMap = {
    green: { heading: 'text-green-400', border: 'border-green-500', cell: 'text-green-400' },
    blue: { heading: 'text-blue-400', border: 'border-blue-500', cell: 'text-blue-400' }
  };
  const c = colorMap[color];

  return `
    <div class="mb-8">
        <h3 class="text-xl font-bold ${c.heading} mb-3 border-l-4 ${c.border} pl-3">${title}</h3>
        <div class="overflow-hidden rounded-lg border border-slate-600">
            <table class="w-full text-sm text-left">
                <thead class="text-xs uppercase bg-slate-700 text-slate-200">
                    <tr>
                        <th class="px-4 py-3 w-16 text-center border-r border-slate-600">編號</th>
                        <th class="px-4 py-3 border-r border-slate-600">使用者體驗 (Issue)</th>
                        <th class="px-4 py-3 w-16 text-center border-r border-slate-600">人數</th>
                        <th class="px-4 py-3 w-16 text-center border-r border-slate-600">編號</th>
                        <th class="px-4 py-3">組員優化建議 (Suggestion)</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-600 bg-slate-800">
                    ${issues.map(item => `
                    <tr class="hover:bg-slate-750">
                        <td class="px-4 py-3 text-center ${c.cell} font-mono border-r border-slate-600">${escapeHtml(item.id)}</td>
                        <td class="px-4 py-3 text-slate-200 border-r border-slate-600 leading-relaxed whitespace-pre-wrap">
                            <div class="font-medium text-slate-200">${escapeHtml(item.issue)}</div>
                        </td>
                        <td class="px-4 py-3 text-center font-bold text-white border-r border-slate-600">${item.count}</td>
                        <td class="px-4 py-3 text-center text-purple-400 font-mono border-r border-slate-600">${escapeHtml(item.suggestionId)}</td>
                        <td class="px-4 py-3 text-slate-300 leading-relaxed whitespace-pre-wrap">
                            <div>${escapeHtml(item.suggestion)}</div>
                        </td>
                    </tr>`).join('')}
                </tbody>
            </table>
        </div>
    </div>`;
}
