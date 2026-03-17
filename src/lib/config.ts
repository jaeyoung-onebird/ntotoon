export const config = {
  panels: {
    maxCount: parseInt(process.env.MAX_PANELS || '20'),
    batchSize: parseInt(process.env.PANEL_BATCH_SIZE || '5'),
  },
  webtoon: {
    width: parseInt(process.env.WEBTOON_WIDTH || '1080'),
    panelGap: parseInt(process.env.PANEL_GAP || '30'),
  },
  ai: {
    modelCheap: process.env.GEMINI_MODEL_CHEAP || 'gemini-2.5-flash-preview-image-generation',
    modelQuality: process.env.GEMINI_MODEL_QUALITY || 'gemini-2.0-flash-preview-image-generation',
    analyzeModel: process.env.CLAUDE_ANALYZE_MODEL || 'claude-sonnet-4-6',
    qaModel: process.env.QA_MODEL || 'claude-sonnet-4-6',
    maxStyleRefs: parseInt(process.env.MAX_STYLE_REFS || '2'),
    maxEvalPanels: parseInt(process.env.MAX_EVAL_PANELS || '10'),
    maxCharRefs: parseInt(process.env.MAX_CHAR_REFS || '2'), // 패널당 최대 캐릭터 레퍼런스 수
  },
  credits: {
    exchangeRate: parseFloat(process.env.USD_TO_KRW || '1370'),
    creditValueKRW: parseInt(process.env.CREDIT_VALUE_KRW || '100'),
    markup: parseFloat(process.env.CREDIT_MARKUP || '1.3'),
    charSheetCostUSD: parseFloat(process.env.CHAR_SHEET_COST_USD || '0.067'),
    panelCostUSD: parseFloat(process.env.PANEL_COST_USD || '0.055'),
    claudeCostUSD: parseFloat(process.env.CLAUDE_COST_USD || '0.10'),
  },
  qa: {
    passScore: parseInt(process.env.QA_PASS_SCORE || '9'),
    maxRetries: parseInt(process.env.QA_MAX_RETRIES || '3'),
  },
} as const;
