import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { createPortfolioHeatmap } from './lib/portfolioHeatmap.js';
import { createPortfolioAllocation } from './lib/portfolioAllocation.js';
import {
  collapsePortfolioItemsForDisplay as collapsePortfolioItemsForDisplayShared,
  parsePortfolioTextDetailed as parsePortfolioTextDetailedShared,
  shouldFallbackToLocalTimeline as shouldFallbackToLocalTimelineShared,
} from './lib/portfolioIngestionCore.js';
import { createPortfolioScorecard } from './lib/portfolioScoring.js';
import { enrichPortfolioItem } from './lib/securityKnowledge.js';

const VIEWBOX_SIZE = 640;
const VIEWBOX_HALF = VIEWBOX_SIZE / 2;
const MIN_ATOMS = 1;
const MAX_PORTFOLIOS = 12;
const BOND_LENGTH = 214;
const CAMERA_DISTANCE = 470;
const CAMERA_NEAR_CLIP = 136;
const TRACKBALL_RADIUS = 208;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const AUTO_ROTATE_SPEED = 0.018;
const DEFAULT_SCENE_CAMERA = {
  panX: 0,
  panY: 0,
  dolly: 0,
  zoom: 1,
  roll: 0,
  driftX: 0,
  driftY: 0,
  focus: 0,
};
const LOW_COUNT_LAYOUTS = {
  2: [
    [0.82, 0.12, 0.56],
    [-0.74, -0.24, -0.63],
  ],
  3: [
    [0.86, 0.08, 0.5],
    [-0.42, 0.82, -0.38],
    [-0.48, -0.8, -0.36],
  ],
  4: [
    [1, 1, 1],
    [1, -1, -1],
    [-1, 1, -1],
    [-1, -1, 1],
  ],
  5: [
    [0, 1, 0.46],
    [0.92, 0.1, -0.34],
    [-0.58, 0.72, -0.38],
    [-0.72, -0.58, -0.36],
    [0.62, -0.76, 0.1],
  ],
};
const GROUP_OPTION_KEYS = ['region', 'sector', 'style', 'risk'];
const SCORE_AXIS_KEYS = [
  'profitability',
  'diversification',
  'riskManagement',
  'composition',
  'timing',
  'stability',
];
const LANGUAGE_OPTIONS = ['ko', 'en'];
const ASSET_CLASS_MODE_OPTIONS = ['auto', 'preferOriginal'];
const ALLOCATION_WEIGHT_MODE_OPTIONS = ['auto', 'stock', 'assetClass', 'account'];
const SCORE_WEIGHT_PRESET_OPTIONS = ['balanced', 'returnFocus', 'longTermReturnFocus', 'stabilityFocus'];
const STORAGE_KEYS = {
  language: 'atom-sketch-language',
  assetClassMode: 'atom-sketch-asset-class-mode',
  allocationWeightMode: 'atom-sketch-allocation-weight-mode',
  scoreWeightPreset: 'atom-sketch-score-weight-preset',
  settingsDockPosition: 'atom-sketch-settings-dock-position',
  toolTriggerPosition: 'atom-sketch-tool-trigger-position',
  groupDockPosition: 'atom-sketch-group-dock-position',
  heatmapDockPosition: 'atom-sketch-heatmap-dock-position',
  scoreDockPosition: 'atom-sketch-score-dock-position-v2',
  allocationDockPosition: 'atom-sketch-allocation-dock-position',
};
const MOBILE_BREAKPOINT = 560;
const REVIEW_TOOLTIP_MAX_WIDTH = 18 * 16;
const REVIEW_TOOLTIP_VIEWPORT_INSET = 18;
const REVIEW_TOOLTIP_VERTICAL_GAP = 10;
const SHOOTING_STAR_INTERVAL_MS = 30000;
const SHOOTING_STAR_CLEAR_BUFFER_MS = 420;
const SCENE_FRAME_INTERVAL_MS = 1000 / 30;
const LARGE_SCENE_FRAME_INTERVAL_MS = 1000 / 24;
const DRAG_SCENE_FRAME_INTERVAL_MS = 1000 / 60;
const REDUCED_MOTION_FRAME_INTERVAL_MS = 1000 / 12;
const LARGE_SCENE_ATOM_THRESHOLD = 12;
const DRAG_ROTATION_RESPONSE = 30;
const IDLE_ROTATION_RESPONSE = 10;
const DRAG_ROTATION_SENSITIVITY = 0.68;
const DRAG_SPIN_DECAY = 7.4;
const MAX_DRAG_SPIN_VELOCITY = 0.58;
const SECURITY_ENRICHMENT_RETRY_DELAYS_MS = [0, 1500, 5000, 14000];
const ACTIVE_FLOATING_TOOL_Z_INDEX = 80;
const FLOATING_TOOL_Z_INDEX = {
  settings: 30,
  'tool-menu': 31,
  group: 32,
  heatmap: 33,
  allocation: 34,
  score: 35,
};
const UI_TEXT = {
  ko: {
    groupLabels: {
      region: '투자 지역',
      sector: '분야',
      style: '투자 스타일',
      risk: '위험 등급',
    },
    scoreAxisLabels: {
      profitability: '수익성',
      diversification: '분산투자',
      riskManagement: '위험관리',
      composition: '포트폴리오 구성',
      timing: '투자 타이밍',
      stability: '수익 안정성',
    },
    fieldLabels: {
      stockCode: '종목코드',
      stockName: '종목명',
      accountId: '계좌 ID',
      accountType: '계좌유형',
      buyDate: '매수일',
      buyPrice: '매수가',
      shares: '보유수량',
      return: '수익률',
      region: '투자 지역',
      sector: '분야',
      style: '투자 스타일',
      risk: '위험 등급',
      assetClass: '자산 구분',
      currency: '통화',
      marketCapClass: '규모 분류',
      volatility: '변동성',
      taxStatus: '과세 구분',
      benchmark: '비교 지수',
    },
    settings: '설정',
    language: '언어',
    korean: '한국어',
    english: '영어',
    settingsAria: '설정 열기',
    settingsSectionLanguage: '언어',
    settingsSectionAssetClassMode: '자산군 분류 방식',
    settingsSectionAllocationWeightMode: '도넛 차트 표시 기준',
    settingsSectionScoreWeightPreset: '스파이더 차트 축 가중치',
    settingsSectionLayoutReset: '배치 초기화',
    settingsAssetClassAuto: '자동 분류',
    settingsAssetClassPreferOriginal: '원본 자산군 우선',
    settingsAllocationWeightAuto: '자동',
    settingsAllocationWeightStock: '종목별 비중',
    settingsAllocationWeightAssetClass: '자산군 기준',
    settingsAllocationWeightAccount: '계좌 기준',
    settingsScoreWeightBalanced: '균형 중심',
    settingsScoreWeightReturnFocus: '수익 중심',
    settingsScoreWeightLongTermReturnFocus: '장기수익 중심',
    settingsScoreWeightStabilityFocus: '안정 중심',
    settingsResetLayoutAction: '현재 배치 다시 맞추기',
    uploadAria: '투자 데이터 업로드',
    uploadHint: '투자 데이터를 업로드 해주세요',
    uploadDragHint: 'CSV 파일을 여기에 끌어다 놓으세요',
    reviewTitle: '업로드 진단',
    reviewStatusOk: '정상',
    reviewStatusNeedsReview: '검토 필요',
    reviewStatusBlocked: '차단',
    toolMenuAria: '도구 선택 열기',
    groupToolAria: '하이라이트 도구 열기',
    scoreToolAria: '스파이더 차트 열기',
    clearUploadAria: '업로드 파일 지우기',
    clearCenterAria: '선택 강조 해제',
    heatmapAria: '수익 캘린더 히트맵 열기',
    contributionAria: '깃허브 잔디밭 아이콘',
    heatmapChartAria: '포트폴리오 수익 캘린더 히트맵',
    heatmapHint: '날짜 위에 커서를 올려 손익 확인',
    heatmapEmpty: '날짜와 손익 데이터가 없어 히트맵을 표시할 수 없습니다.',
    heatmapLess: '적음',
    heatmapMore: '많음',
    scoreChartAria: '포트폴리오 레이더 점수 차트',
    allocationTitle: '자산 비중',
    allocationChartAria: '포트폴리오 자산 비중 도넛 차트',
    allocationTotalReturn: '총 수익률',
    allocationUnknown: '미분류',
    allocationShareLabel: '전체 비중',
    allocationSourceExplicit: '비중 컬럼 기준',
    allocationSourcePosition: '매수가 × 수량 기준',
    allocationSourceEqual: '균등 비중 기준',
    atomAria: '검은 배경 위 손으로 그린 인터랙티브 원자 스케치',
    scorePointUnit: '점',
    parseError: '종목 행을 찾지 못했습니다. ticker/name 컬럼이 있는 CSV를 올려주세요.',
    readError: '파일을 읽지 못했습니다.',
    maxFilesError: '포트폴리오는 최대 12개까지 업로드할 수 있습니다.',
  },
  en: {
    groupLabels: {
      region: 'Region',
      sector: 'Field',
      style: 'Style',
      risk: 'Risk Level',
    },
    scoreAxisLabels: {
      profitability: 'Profitability',
      diversification: 'Diversification',
      riskManagement: 'Risk Control',
      composition: 'Composition',
      timing: 'Timing',
      stability: 'Stability',
    },
    fieldLabels: {
      stockCode: 'Ticker',
      stockName: 'Name',
      accountId: 'Account ID',
      accountType: 'Account Type',
      buyDate: 'Buy Date',
      buyPrice: 'Buy Price',
      shares: 'Shares',
      return: 'Return',
      region: 'Region',
      sector: 'Field',
      style: 'Style',
      risk: 'Risk Level',
      assetClass: 'Asset Class',
      currency: 'Currency',
      marketCapClass: 'Market Cap',
      volatility: 'Volatility',
      taxStatus: 'Tax Status',
      benchmark: 'Benchmark',
    },
    settings: 'Settings',
    language: 'Language',
    korean: 'Korean',
    english: 'English',
    settingsAria: 'Open settings',
    settingsSectionLanguage: 'Language',
    settingsSectionAssetClassMode: 'Asset Class Mode',
    settingsSectionAllocationWeightMode: 'Donut Weight Basis',
    settingsSectionScoreWeightPreset: 'Spider Axis Weights',
    settingsSectionLayoutReset: 'Dock Layout Reset',
    settingsAssetClassAuto: 'Auto classify',
    settingsAssetClassPreferOriginal: 'Prefer original class',
    settingsAllocationWeightAuto: 'Auto',
    settingsAllocationWeightStock: 'By security weight',
    settingsAllocationWeightAssetClass: 'By asset class',
    settingsAllocationWeightAccount: 'By account',
    settingsScoreWeightBalanced: 'Balanced',
    settingsScoreWeightReturnFocus: 'Return focus',
    settingsScoreWeightLongTermReturnFocus: 'Long-term return',
    settingsScoreWeightStabilityFocus: 'Stability focus',
    settingsResetLayoutAction: 'Realign current docks',
    uploadAria: 'Upload investment data',
    uploadHint: 'Please upload your investment data',
    uploadDragHint: 'Drop CSV files here',
    reviewTitle: 'Upload Review',
    reviewStatusOk: 'OK',
    reviewStatusNeedsReview: 'Needs Review',
    reviewStatusBlocked: 'Blocked',
    toolMenuAria: 'Open tool picker',
    groupToolAria: 'Open highlight tool',
    scoreToolAria: 'Open radar chart',
    clearUploadAria: 'Clear uploaded file',
    clearCenterAria: 'Clear highlighted atom selection',
    heatmapAria: 'Open profit calendar heatmap',
    contributionAria: 'GitHub contribution icon',
    heatmapChartAria: 'Portfolio profit calendar heatmap',
    heatmapHint: 'Hover a date to inspect the result',
    heatmapEmpty: 'No date and return data was found for the heatmap.',
    heatmapLess: 'Less',
    heatmapMore: 'More',
    scoreChartAria: 'Portfolio radar score chart',
    allocationTitle: 'Asset Mix',
    allocationChartAria: 'Portfolio asset allocation donut chart',
    allocationTotalReturn: 'Total Return',
    allocationUnknown: 'Unclassified',
    allocationShareLabel: 'Portfolio Share',
    allocationSourceExplicit: 'Weighted by allocation column',
    allocationSourcePosition: 'Weighted by buy price × shares',
    allocationSourceEqual: 'Weighted equally',
    atomAria: 'Interactive hand-drawn atom sketch on a black background',
    scorePointUnit: 'pts',
    parseError: 'Could not find portfolio rows. Upload a CSV with ticker or name columns.',
    readError: 'Could not read the file.',
    maxFilesError: 'You can upload up to 12 portfolios.',
  },
};
const TOOLTIP_WIDTH = 320;
const TOOLTIP_HEIGHT = 260;
const ALLOCATION_SEGMENT_PALETTE = [
  {
    main: '#f2f2f2',
    soft: 'rgba(242, 242, 242, 0.34)',
    glow: 'rgba(242, 242, 242, 0.18)',
    highlight: 'rgba(255, 255, 255, 0.78)',
  },
  {
    main: '#d6d6d6',
    soft: 'rgba(214, 214, 214, 0.34)',
    glow: 'rgba(214, 214, 214, 0.18)',
    highlight: 'rgba(247, 247, 247, 0.66)',
  },
  {
    main: '#bdbdbd',
    soft: 'rgba(189, 189, 189, 0.34)',
    glow: 'rgba(189, 189, 189, 0.18)',
    highlight: 'rgba(234, 234, 234, 0.6)',
  },
  {
    main: '#a4a4a4',
    soft: 'rgba(164, 164, 164, 0.34)',
    glow: 'rgba(164, 164, 164, 0.18)',
    highlight: 'rgba(223, 223, 223, 0.58)',
  },
  {
    main: '#8a8a8a',
    soft: 'rgba(138, 138, 138, 0.34)',
    glow: 'rgba(138, 138, 138, 0.18)',
    highlight: 'rgba(212, 212, 212, 0.56)',
  },
  {
    main: '#727272',
    soft: 'rgba(114, 114, 114, 0.34)',
    glow: 'rgba(114, 114, 114, 0.18)',
    highlight: 'rgba(198, 198, 198, 0.54)',
  },
];

function readStoredOption(key, allowed, fallback) {
  if (typeof window === 'undefined') {
    return fallback;
  }

  const value = window.localStorage.getItem(key);
  return allowed.includes(value) ? value : fallback;
}

function readStoredPosition(key) {
  if (!key || typeof window === 'undefined') {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(key);
    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue);
    if (!Number.isFinite(parsed?.x) || !Number.isFinite(parsed?.y)) {
      return null;
    }

    return {
      x: parsed.x,
      y: parsed.y,
    };
  } catch {
    return null;
  }
}

function writeStoredPosition(key, position) {
  if (!key || typeof window === 'undefined') {
    return;
  }

  if (!Number.isFinite(position?.x) || !Number.isFinite(position?.y)) {
    return;
  }

  window.localStorage.setItem(
    key,
    JSON.stringify({
      x: Math.round(position.x),
      y: Math.round(position.y),
    }),
  );
}

function clearStoredPosition(key) {
  if (!key || typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(key);
}

function makeDemoItem({
  label,
  detail,
  region,
  sector,
  style,
  risk,
  code,
  buyDate,
  buyPrice,
  shares,
}) {
  return enrichPortfolioItem({
    label,
    code,
    name: label,
    detail,
    region,
    sector,
    style,
    risk,
    fields: [
      { label: '종목코드', value: code },
      { label: '매수일', value: buyDate },
      { label: '매수가', value: buyPrice },
      { label: '보유수량', value: shares },
      { label: '수익률', value: detail },
      { label: '투자 지역', value: region },
      { label: '분야', value: sector },
      { label: '투자 스타일', value: style },
      { label: '위험 등급', value: risk },
    ].filter((item) => item.value),
  });
}

const DEFAULT_PORTFOLIO_ITEMS = [
  makeDemoItem({
    label: 'QQQM',
    detail: '+4.8%',
    region: '미국',
    sector: '대형 기술주',
    style: '성장주',
    risk: '고위험',
    code: 'QQQM',
    buyDate: '2025-11-18',
    buyPrice: '$205.40',
    shares: '14주',
  }),
  makeDemoItem({
    label: 'VEA',
    detail: '+1.6%',
    region: '선진국',
    sector: '국제 주식',
    style: '분산형',
    risk: '중위험',
    code: 'VEA',
    buyDate: '2025-10-22',
    buyPrice: '$52.10',
    shares: '31주',
  }),
  makeDemoItem({
    label: 'SCHD',
    detail: '-0.9%',
    region: '미국',
    sector: '배당주',
    style: '배당주',
    risk: '중위험',
    code: 'SCHD',
    buyDate: '2025-09-04',
    buyPrice: '$27.84',
    shares: '44주',
  }),
  makeDemoItem({
    label: 'SOXX',
    detail: '+7.3%',
    region: '미국',
    sector: '반도체',
    style: '성장주',
    risk: '고위험',
    code: 'SOXX',
    buyDate: '2025-12-12',
    buyPrice: '$231.65',
    shares: '8주',
  }),
  makeDemoItem({
    label: 'AAPL',
    detail: '+5.1%',
    region: '미국',
    sector: '기술',
    style: '성장주',
    risk: '고위험',
    code: 'AAPL',
    buyDate: '2025-07-01',
    buyPrice: '$208.10',
    shares: '12주',
  }),
  makeDemoItem({
    label: 'MSFT',
    detail: '+3.9%',
    region: '미국',
    sector: '기술',
    style: '성장주',
    risk: '고위험',
    code: 'MSFT',
    buyDate: '2025-08-15',
    buyPrice: '$421.30',
    shares: '7주',
  }),
  makeDemoItem({
    label: 'VTI',
    detail: '+2.4%',
    region: '미국',
    sector: '광범위 시장',
    style: '분산형',
    risk: '중위험',
    code: 'VTI',
    buyDate: '2025-06-10',
    buyPrice: '$284.26',
    shares: '16주',
  }),
  makeDemoItem({
    label: 'BND',
    detail: '-1.2%',
    region: '미국',
    sector: '채권',
    style: '배당주',
    risk: '저위험',
    code: 'BND',
    buyDate: '2025-05-02',
    buyPrice: '$72.44',
    shares: '28주',
  }),
  makeDemoItem({
    label: 'IAU',
    detail: '+0.7%',
    region: '글로벌',
    sector: '원자재',
    style: '방어형',
    risk: '중위험',
    code: 'IAU',
    buyDate: '2025-04-19',
    buyPrice: '$58.21',
    shares: '19주',
  }),
];
const HEADER_KEYWORDS = [
  'ticker',
  'symbol',
  'code',
  'name',
  'security',
  'asset',
  'assetclass',
  'assettype',
  'assetname',
  'securityname',
  'productname',
  'weight',
  'allocation',
  'ratio',
  'share',
  'quantity',
  'date',
  'day',
  'price',
  'buyprice',
  'buydate',
  'region',
  'country',
  'sector',
  'industry',
  'style',
  'strategy',
  'risk',
  'acct',
  'acctid',
  'accountid',
  'accountnumber',
  'ordertype',
  'buysell',
  'account',
  'accounttype',
  'accountkind',
  'currency',
  'benchmark',
  '종목',
  '종목명',
  '자산명',
  '상품명',
  '보유',
  '비중',
  '수량',
  '매수',
  '매입',
  '현재가',
  '손익',
  '평가손익',
  '시가총액',
  '지역',
  '분야',
  '스타일',
  '위험',
  '자산',
  '계좌',
  '계좌유형',
  '계좌종류',
  '통화',
  '금액',
  'return',
  'dailyreturn',
  'cumulativereturn',
  'returns',
  'performance',
  'change',
  '수익률',
  '일일수익률',
  '누적수익률',
  '날짜',
  '일자',
  '등락률',
];

function normalizeHeader(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^\ufeff/, '')
    .replace(/[\s_.\-/%()[\]]+/g, '');
}

function noise(seed) {
  const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
  return value - Math.floor(value);
}

function jitter(seed, amount) {
  return (noise(seed) * 2 - 1) * amount;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function damp(current, target, lambda, delta) {
  return current + (target - current) * (1 - Math.exp(-lambda * delta));
}

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function createPortfolioEntry(fileName, items, entryId) {
  const displayItems = collapsePortfolioItemsForDisplayShared(items);

  return {
    id:
      entryId ||
      (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `portfolio-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`),
    fileName,
    items: displayItems,
    timelineItems: items,
    parserDiagnostics: null,
    agentReview: null,
    ingestSource: 'client-local',
  };
}

function createPortfolioEntryFromPayload(payload, entryId) {
  const timelineItems = Array.isArray(payload?.timelineItems) ? payload.timelineItems : [];
  const displayItems = Array.isArray(payload?.items)
    ? payload.items
    : collapsePortfolioItemsForDisplayShared(timelineItems);

  return {
    id:
      entryId ||
      (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `portfolio-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`),
    fileName: payload?.fileName || 'portfolio.csv',
    items: displayItems,
    timelineItems,
    parserDiagnostics: payload?.parserDiagnostics ?? null,
    agentReview: payload?.agentReview ?? null,
    ingestSource: payload?.ingestSource ?? 'server',
  };
}

function buildLocalPortfolioPayload(fileName, localItems, parserDiagnostics, overrides = {}) {
  const displayItems = collapsePortfolioItemsForDisplayShared(localItems);

  return {
    fileName,
    itemCount: localItems.length,
    securityCount: displayItems.length,
    items: displayItems,
    timelineItems: localItems,
    parserDiagnostics,
    agentReview: null,
    ingestSource: 'client-local',
    ...overrides,
  };
}

function reviewStatusLabel(text, status) {
  if (status === 'blocked') {
    return text.reviewStatusBlocked;
  }

  if (status === 'needs-review') {
    return text.reviewStatusNeedsReview;
  }

  return text.reviewStatusOk;
}

function resolveEntryReviewStatus(entry) {
  if (!entry) {
    return 'ok';
  }

  if (
    entry.ingestSource === 'client-local-fallback' ||
    entry.ingestSource === 'server-with-local-timeline'
  ) {
    return entry.agentReview?.status === 'blocked' ? 'blocked' : 'needs-review';
  }

  return entry.agentReview?.status ?? entry.parserDiagnostics?.reviewStatus ?? 'ok';
}

function buildUploadReviewPreview(entry) {
  if (!entry) {
    return null;
  }

  const status = resolveEntryReviewStatus(entry);
  if (status === 'ok') {
    return null;
  }

  const summary = String(entry.agentReview?.summary ?? '').trim();
  const warnings = (entry.agentReview?.warnings ?? entry.parserDiagnostics?.warnings ?? [])
    .filter((warning) => String(warning?.message ?? '').trim())
    .slice(0, 3);

  if (!summary && !warnings.length) {
    return null;
  }

  return {
    status,
    summary,
    warnings,
  };
}

function supportsHoverTooltip() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }

  return window.matchMedia('(hover: hover)').matches;
}

function readPrefersReducedMotion() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }

  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function sceneFrameIntervalFor(atomCount, reducedMotion, isDragging = false) {
  if (reducedMotion) {
    return REDUCED_MOTION_FRAME_INTERVAL_MS;
  }

  if (isDragging) {
    return DRAG_SCENE_FRAME_INTERVAL_MS;
  }

  return atomCount > LARGE_SCENE_ATOM_THRESHOLD
    ? LARGE_SCENE_FRAME_INTERVAL_MS
    : SCENE_FRAME_INTERVAL_MS;
}

function uiInsetFor(width) {
  if (width <= MOBILE_BREAKPOINT) {
    return 14.4;
  }

  return clamp(width * 0.022, 16, 28.8);
}

function gearSizeFor(width) {
  return (width <= MOBILE_BREAKPOINT ? 3.7 : 4.45) * 16;
}

function groupDockSizeFor(width) {
  return (width <= MOBILE_BREAKPOINT ? 3.1 : 3.55) * 16;
}

function scoreDockSizeFor(width) {
  return (width <= MOBILE_BREAKPOINT ? 3.65 : 4.2) * 16;
}

function allocationWidgetSizeFor(width) {
  return (width <= MOBILE_BREAKPOINT ? 3.5 : 4) * 16;
}

function toolTriggerSizeFor(width) {
  return scoreDockSizeFor(width);
}

function toolDockGapFor(width) {
  return width <= MOBILE_BREAKPOINT ? 12 : 16;
}

function toolDockStackStepFor(width) {
  return width <= MOBILE_BREAKPOINT ? 68 : 76;
}

function stackDockBelow(anchorX, anchorY, previousSize, dockSize, width, height, steps = 1) {
  const inset = toolDockGapFor(width);
  const step = toolDockStackStepFor(width) * steps;

  return {
    x: clamp(
      anchorX + (previousSize - dockSize) * 0.5,
      inset,
      width - dockSize - inset,
    ),
    y: clamp(
      anchorY + previousSize * 0.5 + step - dockSize * 0.5,
      inset,
      height - dockSize - inset,
    ),
  };
}

function stackDockBelowRect(rect, previousSize, dockSize, width, height, steps = 1) {
  const anchorX = rect.left + rect.width * 0.5 - previousSize * 0.5;
  const anchorY = rect.top + rect.height * 0.5 - previousSize * 0.5;
  return stackDockBelow(anchorX, anchorY, previousSize, dockSize, width, height, steps);
}

function swirlDockSizeFor(width) {
  return (width <= MOBILE_BREAKPOINT ? 3.05 : 3.38) * 16;
}

function swirlDockYFor(width) {
  return 202 + scoreDockSizeFor(width) + (width <= MOBILE_BREAKPOINT ? 42 : 48);
}

function heatmapDockSizeFor(width) {
  return (width <= MOBILE_BREAKPOINT ? 3.15 : 3.5) * 16;
}

function floatingPanelSideFor(positionX, dockSize, viewportWidth) {
  if (typeof positionX !== 'number') {
    return 'right';
  }

  const resolvedViewportWidth =
    typeof viewportWidth === 'number'
      ? viewportWidth
      : typeof window !== 'undefined'
        ? window.innerWidth
        : 0;

  if (!resolvedViewportWidth) {
    return 'right';
  }

  return positionX + dockSize * 0.5 >= resolvedViewportWidth * 0.5 ? 'left' : 'right';
}

function heatmapDockYFor(width) {
  return swirlDockYFor(width) + swirlDockSizeFor(width) + (width <= MOBILE_BREAKPOINT ? 38 : 44);
}

function uploadDockCenterOffsetFor(width, anchorWidth = 0) {
  if (anchorWidth > 0) {
    return clamp(
      anchorWidth * 0.26,
      width <= MOBILE_BREAKPOINT ? 70 : 78,
      width <= MOBILE_BREAKPOINT ? 92 : 108,
    );
  }

  return width <= MOBILE_BREAKPOINT ? 78 : 92;
}

function useFloatingHandle({
  initialPosition,
  fallbackSize,
  measureBounds,
  onInteract,
  onPress,
  resetSignal,
  followAnchor = true,
  continuousFollow = false,
  storageKey = null,
}) {
  const containerRef = useRef(null);
  const hasUserMovedRef = useRef(false);
  const snapContextRef = useRef({
    clearPress: null,
    clampPosition: null,
    initialPosition: null,
  });
  const pressRef = useRef({
    pointerId: null,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    lastX: 0,
    lastY: 0,
    pressAt: 0,
    dragStarted: false,
    action: 'toggle',
    holdTimer: null,
  });
  const [dragging, setDragging] = useState(false);
  const [position, setPosition] = useState(() => {
    if (typeof window === 'undefined') {
      return { x: 0, y: 0 };
    }

    const storedPosition = readStoredPosition(storageKey);
    if (storedPosition) {
      hasUserMovedRef.current = true;
      return storedPosition;
    }

    return initialPosition(window);
  });

  const clampPosition = (nextX, nextY) => {
    if (typeof window === 'undefined') {
      return { x: nextX, y: nextY };
    }

    const margin = uiInsetFor(window.innerWidth);
    const fallback = fallbackSize(window.innerWidth);
    const measuredBounds = measureBounds?.({
      container: containerRef.current,
      fallback,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      nextX,
      nextY,
    });
    const width =
      measuredBounds?.width ?? containerRef.current?.offsetWidth ?? fallback.width;
    const height =
      measuredBounds?.height ?? containerRef.current?.offsetHeight ?? fallback.height;
    const offsetX = measuredBounds?.offsetX ?? 0;
    const offsetY = measuredBounds?.offsetY ?? 0;

    return {
      x: clamp(
        nextX,
        margin - offsetX,
        Math.max(margin - offsetX, window.innerWidth - width - margin - offsetX),
      ),
      y: clamp(
        nextY,
        margin - offsetY,
        Math.max(margin - offsetY, window.innerHeight - height - margin - offsetY),
      ),
    };
  };

  const reusePositionIfUnchanged = (current, next) =>
    Math.abs(current.x - next.x) < 0.01 && Math.abs(current.y - next.y) < 0.01
      ? current
      : next;

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    let frameId = 0;
    let cancelled = false;
    let remainingFrames = 0;

    const syncPosition = () => {
      if (cancelled) {
        return;
      }

      setPosition((current) => {
        if (hasUserMovedRef.current) {
          return reusePositionIfUnchanged(current, clampPosition(current.x, current.y));
        }

        if (!followAnchor) {
          return reusePositionIfUnchanged(current, clampPosition(current.x, current.y));
        }

        const anchored = initialPosition(window);
        return reusePositionIfUnchanged(current, clampPosition(anchored.x, anchored.y));
      });

      remainingFrames -= 1;
      if (
        followAnchor &&
        !hasUserMovedRef.current &&
        remainingFrames > 0
      ) {
        frameId = window.requestAnimationFrame(syncPosition);
        return;
      }

      frameId = 0;
    };

    const scheduleSync = (frames = continuousFollow ? 120 : 18) => {
      remainingFrames = Math.max(remainingFrames, frames);
      if (!frameId) {
        frameId = window.requestAnimationFrame(syncPosition);
      }
    };

    const handleResize = () => scheduleSync();

    scheduleSync();
    window.addEventListener('resize', handleResize);

    return () => {
      cancelled = true;
      window.removeEventListener('resize', handleResize);
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [continuousFollow, fallbackSize, followAnchor, initialPosition, measureBounds]);

  const beginDrag = () => {
    if (pressRef.current.pointerId === null) {
      return;
    }

    window.clearTimeout(pressRef.current.holdTimer);
    pressRef.current.holdTimer = null;
    pressRef.current.dragStarted = true;
    hasUserMovedRef.current = true;
    setDragging(true);
    document.body.style.cursor = 'grabbing';
    setPosition(
      clampPosition(
        pressRef.current.originX + (pressRef.current.lastX - pressRef.current.startX),
        pressRef.current.originY + (pressRef.current.lastY - pressRef.current.startY),
      ),
    );
  };

  const clearPress = () => {
    window.clearTimeout(pressRef.current.holdTimer);
    pressRef.current.pointerId = null;
    pressRef.current.dragStarted = false;
    pressRef.current.action = 'toggle';
    pressRef.current.holdTimer = null;
    setDragging(false);
    document.body.style.cursor = '';
  };

  snapContextRef.current.clearPress = clearPress;
  snapContextRef.current.clampPosition = clampPosition;
  snapContextRef.current.initialPosition = initialPosition;

  const snapToInitial = useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }

    snapContextRef.current.clearPress?.();
    hasUserMovedRef.current = false;
    clearStoredPosition(storageKey);
    const anchored = snapContextRef.current.initialPosition?.(window) ?? { x: 0, y: 0 };
    setPosition(snapContextRef.current.clampPosition?.(anchored.x, anchored.y) ?? anchored);
  }, [storageKey]);

  useEffect(() => {
    if (!resetSignal || typeof window === 'undefined') {
      return;
    }

    snapToInitial();
  }, [resetSignal, snapToInitial]);

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !storageKey ||
      dragging ||
      !hasUserMovedRef.current
    ) {
      return;
    }

    writeStoredPosition(storageKey, position);
  }, [dragging, position, storageKey]);

  useEffect(() => {
    const handleWindowPointerMove = (event) => {
      if (pressRef.current.pointerId !== event.pointerId) {
        return;
      }

      pressRef.current.lastX = event.clientX;
      pressRef.current.lastY = event.clientY;
      const deltaX = event.clientX - pressRef.current.startX;
      const deltaY = event.clientY - pressRef.current.startY;
      const distanceSquared = deltaX * deltaX + deltaY * deltaY;
      const action = pressRef.current.action;
      const dragDistanceThreshold = action === 'toggle' ? 36 : 9;
      const shouldStartDrag =
        distanceSquared > dragDistanceThreshold ||
        (action !== 'toggle' && performance.now() - pressRef.current.pressAt > 90);

      if (!pressRef.current.dragStarted) {
        if (shouldStartDrag) {
          beginDrag();
        } else {
          return;
        }
      }

      event.preventDefault();
      onInteract?.();
      setPosition(
        clampPosition(
          pressRef.current.originX + deltaX,
          pressRef.current.originY + deltaY,
        ),
      );
    };

    const handleWindowPointerUp = (event) => {
      if (pressRef.current.pointerId !== event.pointerId) {
        return;
      }

      const deltaX = event.clientX - pressRef.current.startX;
      const deltaY = event.clientY - pressRef.current.startY;
      const wasDrag = pressRef.current.dragStarted;
      const wasClick = !wasDrag && deltaX * deltaX + deltaY * deltaY < 100;
      const action = pressRef.current.action;

      clearPress();

      if (wasDrag) {
        event.preventDefault();
        return;
      }

      if (wasClick && action === 'toggle') {
        onInteract?.();
        onPress?.();
      }
    };

    const handleWindowPointerCancel = (event) => {
      if (pressRef.current.pointerId !== event.pointerId) {
        return;
      }

      clearPress();
    };

    window.addEventListener('pointermove', handleWindowPointerMove, {
      passive: false,
    });
    window.addEventListener('pointerup', handleWindowPointerUp);
    window.addEventListener('pointercancel', handleWindowPointerCancel);

    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
      window.removeEventListener('pointercancel', handleWindowPointerCancel);
      window.clearTimeout(pressRef.current.holdTimer);
    };
  }, [onInteract, onPress]);

  const startPress = (event, action, options = {}) => {
    const {
      capture = false,
      preventDefault = false,
      stopPropagation = false,
      holdDelay = 90,
    } = options;

    if (preventDefault) {
      event.preventDefault();
    }

    if (stopPropagation) {
      event.stopPropagation();
    }

    onInteract?.();
    if (capture) {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }
    pressRef.current.pointerId = event.pointerId;
    pressRef.current.startX = event.clientX;
    pressRef.current.startY = event.clientY;
    pressRef.current.originX = position.x;
    pressRef.current.originY = position.y;
    pressRef.current.lastX = event.clientX;
    pressRef.current.lastY = event.clientY;
    pressRef.current.pressAt = performance.now();
    pressRef.current.dragStarted = false;
    pressRef.current.action = action;
    pressRef.current.holdTimer =
      Number.isFinite(holdDelay) && holdDelay >= 0
        ? window.setTimeout(beginDrag, holdDelay)
        : null;
  };

  const handlePointerDown = (event) => {
    startPress(event, 'toggle', {
      capture: true,
      preventDefault: true,
      stopPropagation: true,
      holdDelay: null,
    });
  };

  const handleDragPointerDown = (event) => {
    startPress(event, 'drag', {
      capture: false,
      preventDefault: false,
      stopPropagation: true,
      holdDelay: 90,
    });
  };

  return {
    containerRef,
    dragging,
    position,
    handlePointerDown,
    handleDragPointerDown,
    snapToInitial,
  };
}

function alignedDockXFor(width, dockSize, anchorWidth = 0) {
  const centerX = uiInsetFor(width) + uploadDockCenterOffsetFor(width, anchorWidth);
  return centerX - dockSize * 0.5;
}

function format(value) {
  return value.toFixed(2);
}

function createShootingStar() {
  const seed =
    (typeof performance !== 'undefined' ? performance.now() : Date.now()) * 0.001 +
    Math.random() * 17;

  return {
    id: `shooting-star-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    startX: 62 + noise(seed + 0.13) * 26,
    startY: 6 + noise(seed + 0.47) * 20,
    travelX: -(180 + noise(seed + 0.83) * 118),
    travelY: 110 + noise(seed + 1.19) * 138,
    angle: -34 + jitter(seed + 1.51, 5.6),
    length: 92 + noise(seed + 1.87) * 72,
    duration: 1800 + noise(seed + 2.23) * 940,
    scale: 0.82 + noise(seed + 2.59) * 0.28,
    opacity: 0.34 + noise(seed + 2.93) * 0.14,
  };
}

function compactLabel(value, max = 18) {
  if (!value) {
    return '';
  }

  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function compactFileName(fileName, max = 18) {
  const cleanName = String(fileName ?? '').trim();

  if (!cleanName || cleanName.length <= max) {
    return cleanName;
  }

  const extensionMatch = cleanName.match(/(\.[^.]{1,5})$/);
  const extension = extensionMatch?.[1] ?? '';
  const baseName = extension ? cleanName.slice(0, -extension.length) : cleanName;
  const extensionBudget = extension ? extension.length : 0;
  const availableBase = Math.max(6, max - extensionBudget - 1);
  const frontLength = Math.max(4, Math.ceil(availableBase * 0.58));
  const backLength = Math.max(3, availableBase - frontLength);

  if (baseName.length <= frontLength + backLength + 1) {
    return `${compactLabel(baseName, max - extensionBudget)}${extension}`;
  }

  return `${baseName.slice(0, frontLength)}…${baseName.slice(-backLength)}${extension}`;
}

function textFor(language) {
  return UI_TEXT[language] ?? UI_TEXT.ko;
}

function groupOptionsFor(language) {
  const labels = textFor(language).groupLabels;
  return GROUP_OPTION_KEYS.map((key) => ({ key, label: labels[key] }));
}

function scoreAxesFor(language) {
  const labels = textFor(language).scoreAxisLabels;
  return SCORE_AXIS_KEYS.map((key) => ({ key, label: labels[key] }));
}

function formatHeatmapValue(value, mode) {
  if (!Number.isFinite(value)) {
    return '';
  }

  if (mode === 'percent') {
    const fixed = Math.abs(value) >= 10 ? value.toFixed(1) : value.toFixed(2);
    const trimmed = fixed.replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0$/, '');
    return `${value > 0 ? '+' : ''}${trimmed}%`;
  }

  const fixed = Math.abs(value) >= 100 ? value.toFixed(0) : value.toFixed(1);
  const trimmed = fixed.replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0$/, '');
  return `${value > 0 ? '+' : ''}${trimmed}`;
}

function formatHeatmapDateLabel(date, language) {
  return new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'ko-KR', {
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function formatHeatmapMonthLabel(date, language) {
  return new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'ko-KR', {
    month: 'short',
  }).format(date);
}

function formatAllocationPercent(value) {
  if (!Number.isFinite(value)) {
    return '0%';
  }

  const percentValue = value * 100;
  const fixed = percentValue >= 10 ? percentValue.toFixed(1) : percentValue.toFixed(2);
  const trimmed = fixed.replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0$/, '');
  return `${trimmed}%`;
}

function normalizeDisplayKey(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/^\ufeff/, '')
    .replace(/[\s_.\-/%()[\]]+/g, '');
}

function canHighlightGroupField(atom, groupKey) {
  if (!atom || !groupKey) {
    return false;
  }

  const value = String(atom[groupKey] ?? '').trim();
  if (!value) {
    return false;
  }

  const source = String(atom.metadataSourceByField?.[groupKey] ?? '').trim().toLowerCase();
  return source === 'provided' || source === 'reference' || source === 'derived' || source === 'wikidata';
}

function resolveFieldLabelKey(label) {
  const normalized = normalizeDisplayKey(label);

  if (['종목코드', 'ticker', 'symbol', 'stockcode', 'securitycode'].map(normalizeDisplayKey).includes(normalized)) {
    return 'stockCode';
  }

  if (
    ['종목명', '자산명', '상품명', 'name', 'security', 'securityname', 'assetname', 'productname', 'company'].map(
      normalizeDisplayKey,
    ).includes(normalized)
  ) {
    return 'stockName';
  }

  if (['계좌id', '계좌번호', '계좌코드', 'acctid', 'accountid', 'accountnumber'].map(normalizeDisplayKey).includes(normalized)) {
    return 'accountId';
  }

  if (['계좌유형', '계좌종류', '계좌구분', 'accounttype', 'accountkind', 'accountclass'].map(normalizeDisplayKey).includes(normalized)) {
    return 'accountType';
  }

  if (['매수일', '매입일', '취득일', 'buydate', 'purchasedate'].map(normalizeDisplayKey).includes(normalized)) {
    return 'buyDate';
  }

  if (['매수가', '매입가', 'buyprice', 'purchaseprice', 'entryprice'].map(normalizeDisplayKey).includes(normalized)) {
    return 'buyPrice';
  }

  if (['보유수량', '수량', 'shares', 'quantity'].map(normalizeDisplayKey).includes(normalized)) {
    return 'shares';
  }

  if (['수익률', '등락률', 'return', 'returns', 'performance', 'change'].map(normalizeDisplayKey).includes(normalized)) {
    return 'return';
  }

  if (['투자지역', '지역', 'region', 'market', 'country'].map(normalizeDisplayKey).includes(normalized)) {
    return 'region';
  }

  if (['분야', '업종', '산업', '섹터', 'sector', 'industry', 'theme'].map(normalizeDisplayKey).includes(normalized)) {
    return 'sector';
  }

  if (['투자스타일', '스타일', 'style', 'strategy', 'factor'].map(normalizeDisplayKey).includes(normalized)) {
    return 'style';
  }

  if (['위험등급', '위험', '리스크', 'risk', 'riskgrade', 'risklevel'].map(normalizeDisplayKey).includes(normalized)) {
    return 'risk';
  }

  if (['자산구분', 'assetclass', 'asset type', 'assettype'].map(normalizeDisplayKey).includes(normalized)) {
    return 'assetClass';
  }

  if (['통화', 'currency', 'fx', 'quotedcurrency'].map(normalizeDisplayKey).includes(normalized)) {
    return 'currency';
  }

  if (['규모분류', '시가총액분류', 'marketcap', 'marketcapclass', 'capstyle'].map(normalizeDisplayKey).includes(normalized)) {
    return 'marketCapClass';
  }

  if (['변동성', 'volatility', 'volatilitylevel'].map(normalizeDisplayKey).includes(normalized)) {
    return 'volatility';
  }

  if (['과세구분', 'taxstatus', 'taxtreatment', 'taxable'].map(normalizeDisplayKey).includes(normalized)) {
    return 'taxStatus';
  }

  if (['비교지수', '벤치마크', 'benchmark', 'referenceindex'].map(normalizeDisplayKey).includes(normalized)) {
    return 'benchmark';
  }

  return null;
}

function formatFieldLabel(label, language = 'ko') {
  const key = resolveFieldLabelKey(label);
  if (!key) {
    return label;
  }

  return textFor(language).fieldLabels[key] ?? label;
}

const CORE_ATOM_INFO_FIELDS = [
  { key: 'region', label: '투자 지역' },
  { key: 'sector', label: '분야' },
  { key: 'style', label: '투자 스타일' },
  { key: 'risk', label: '위험 등급' },
];

function atomInfoFallbackValue(language = 'ko') {
  return language === 'en' ? 'Checking' : '확인 중';
}

function buildAtomInfoFields(atom, language = 'ko') {
  if (!atom) {
    return [];
  }

  const fields = Array.isArray(atom.fields) ? atom.fields : [];
  const resolvedFields = [];
  const seenKeys = new Set();
  const seenLabels = new Set();
  const fallbackValue = atomInfoFallbackValue(language);

  const pushField = (label, value) => {
    const trimmedLabel = String(label ?? '').trim();
    const trimmedValue = String(value ?? '').trim();

    if (!trimmedLabel || !trimmedValue) {
      return;
    }

    const resolvedKey = resolveFieldLabelKey(trimmedLabel);
    const dedupeKey = resolvedKey || normalizeDisplayKey(trimmedLabel);
    if (dedupeKey && seenKeys.has(dedupeKey)) {
      return;
    }

    if (seenLabels.has(trimmedLabel)) {
      return;
    }

    if (dedupeKey) {
      seenKeys.add(dedupeKey);
    }
    seenLabels.add(trimmedLabel);
    resolvedFields.push({ label: trimmedLabel, value: trimmedValue });
  };

  CORE_ATOM_INFO_FIELDS.forEach(({ key, label }) => {
    const matchedField = fields.find((field) => resolveFieldLabelKey(field?.label) === key);
    const matchedValue = String(matchedField?.value ?? '').trim();
    const atomValue = String(atom[key] ?? '').trim();

    pushField(label, matchedValue || atomValue || fallbackValue);
  });

  fields.forEach((field) => {
    pushField(field?.label, field?.value);
  });

  return resolvedFields;
}

function hashString(value) {
  return Array.from(String(value ?? '')).reduce(
    (accumulator, character) => accumulator * 31 + character.charCodeAt(0),
    7,
  );
}

function createContributionPreview(items) {
  const columns = 4;
  const rows = 4;
  const total = columns * rows;
  const baseSeed = items.reduce(
    (accumulator, item, index) =>
      accumulator + hashString(item.label) * (index + 1) + hashString(item.detail),
    17,
  );

  const cells = Array.from({ length: total }, (_, index) => {
    const signal = noise(baseSeed + index * 19);
    const intensitySignal = noise(baseSeed + 401 + index * 13);
    const positive = signal > 0.42;
    const hasData = signal > 0.22;
    return {
      key: `contribution-${index}`,
      hasData,
      positive: hasData ? positive : false,
      intensity: hasData ? 0.22 + intensitySignal * 0.78 : 0,
    };
  });

  return { cells, columns, rows };
}

const META_VALUE_TRANSLATIONS = {
  en: {
    미국: 'US',
    한국: 'Korea',
    글로벌: 'Global',
    선진국: 'Developed Markets',
    일본: 'Japan',
    홍콩: 'Hong Kong',
    캐나다: 'Canada',
    고위험: 'High Risk',
    중위험: 'Medium Risk',
    저위험: 'Low Risk',
    성장주: 'Growth',
    가치주: 'Value',
    배당주: 'Dividend',
    방어형: 'Defensive',
    분산형: 'Diversified',
    개별주식: 'Single Stock',
    '주식 ETF': 'Equity ETF',
    '채권 ETF': 'Bond ETF',
    '원자재 ETF': 'Commodity ETF',
    기술: 'Technology',
    '인터넷 플랫폼': 'Internet Platform',
    반도체: 'Semiconductors',
    '반도체/전자': 'Semiconductors / Electronics',
    '철강/소재': 'Steel / Materials',
    자동차: 'Automobiles',
    배터리: 'Batteries',
    금융: 'Financials',
    바이오: 'Biotech',
    '방산/산업재': 'Aerospace / Industrials',
    '플랫폼/소비재': 'Platform / Consumer',
    전기차: 'EV',
    복합금융: 'Diversified Financials',
    필수소비재: 'Consumer Staples',
    에너지: 'Energy',
    '대형 기술주': 'Large-Cap Tech',
    '광범위 시장': 'Broad Market',
    '국제 주식': 'International Equities',
    채권: 'Bonds',
    원자재: 'Commodities',
    금: 'Gold',
    부동산: 'Real Estate',
    '전세계 주식': 'Global Equities',
    '배당 ETF': 'Dividend ETF',
    '국내 주식': 'Korean Stocks',
    '미국 주식': 'US Stocks',
    '해외 주식': 'International Stocks',
    '국내 주식 ETF': 'Korean Equity ETF',
    '미국 주식 ETF': 'US Equity ETF',
    '글로벌 주식 ETF': 'Global Equity ETF',
    '금/원자재 ETF': 'Gold / Commodity ETF',
    '리츠/부동산': 'REIT / Real Estate',
    '현금성 자산': 'Cash & Cash Equivalents',
    '디지털 자산': 'Digital Assets',
    대체자산: 'Alternative Assets',
    '기타 자산': 'Other Assets',
    미분류: 'Unclassified',
  },
  ko: {
    us: '미국',
    unitedstates: '미국',
    america: '미국',
    korea: '한국',
    southkorea: '한국',
    global: '글로벌',
    developedmarkets: '선진국',
    japan: '일본',
    hongkong: '홍콩',
    canada: '캐나다',
    highrisk: '고위험',
    mediumrisk: '중위험',
    lowrisk: '저위험',
    growth: '성장주',
    value: '가치주',
    dividend: '배당주',
    defensive: '방어형',
    diversified: '분산형',
    singlestock: '개별주식',
    equityetf: '주식 ETF',
    bondetf: '채권 ETF',
    commodityetf: '원자재 ETF',
    technology: '기술',
    internetplatform: '인터넷 플랫폼',
    semiconductors: '반도체',
    semiconductorselectronics: '반도체/전자',
    steelmaterials: '철강/소재',
    automobiles: '자동차',
    batteries: '배터리',
    financials: '금융',
    biotech: '바이오',
    aerospaceindustrials: '방산/산업재',
    platformconsumer: '플랫폼/소비재',
    ev: '전기차',
    diversifiedfinancials: '복합금융',
    consumerstaples: '필수소비재',
    energy: '에너지',
    largecaptech: '대형 기술주',
    broadmarket: '광범위 시장',
    internationalequities: '국제 주식',
    bonds: '채권',
    commodities: '원자재',
    gold: '금',
    realestate: '부동산',
    globalequities: '전세계 주식',
    dividendetf: '배당 ETF',
    koreanstocks: '국내 주식',
    domesticstocks: '국내 주식',
    usstocks: '미국 주식',
    internationalstocks: '해외 주식',
    koreanequityetf: '국내 주식 ETF',
    domesticequityetf: '국내 주식 ETF',
    usequityetf: '미국 주식 ETF',
    globalequityetf: '글로벌 주식 ETF',
    goldcommodityetf: '금/원자재 ETF',
    reitrealestate: '리츠/부동산',
    cashcashequivalents: '현금성 자산',
    digitalassets: '디지털 자산',
    alternativeassets: '대체자산',
    otherassets: '기타 자산',
    unclassified: '미분류',
    shares: '주',
    sh: '주',
  },
};

function translateDisplayValue(value, language = 'ko') {
  const trimmed = String(value ?? '').trim();

  if (!trimmed) {
    return value;
  }

  if (language === 'en') {
    const sharesMatch = trimmed.match(/^([0-9]+(?:\.[0-9]+)?)\s*주$/);
    if (sharesMatch) {
      return `${sharesMatch[1]} sh`;
    }
  }

  if (language === 'ko') {
    const sharesMatch = trimmed.match(/^([0-9]+(?:\.[0-9]+)?)\s*(?:shares?|sh)$/i);
    if (sharesMatch) {
      return `${sharesMatch[1]}주`;
    }
  }

  const normalized = normalizeDisplayKey(trimmed);
  return META_VALUE_TRANSLATIONS[language]?.[normalized] ?? META_VALUE_TRANSLATIONS[language]?.[trimmed] ?? value;
}

function normalizeMetaValue(value, max = 22) {
  return compactLabel(value.trim(), max);
}

function countCharacter(value, character) {
  return value.split(character).length - 1;
}

function detectDelimiter(text) {
  const sample = text.split(/\r?\n/).find((line) => line.trim()) ?? '';
  const candidates = [',', '\t', ';', '|'];

  return candidates.reduce((best, candidate) =>
    countCharacter(sample, candidate) > countCharacter(sample, best) ? candidate : best,
  );
}

function parseSeparatedText(text, delimiter) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (character === '"') {
      const next = text[index + 1];

      if (quoted && next === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (character === delimiter && !quoted) {
      row.push(cell);
      cell = '';
      continue;
    }

    if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[index + 1] === '\n') {
        index += 1;
      }

      row.push(cell);
      if (row.some((entry) => entry.trim())) {
        rows.push(row);
      }
      row = [];
      cell = '';
      continue;
    }

    cell += character;
  }

  row.push(cell);
  if (row.some((entry) => entry.trim())) {
    rows.push(row);
  }

  return rows;
}

function looksLikeHeader(row) {
  return row
    .map((cell) => normalizeHeader(cell))
    .some((cell) => HEADER_KEYWORDS.some((keyword) => cell.includes(keyword)));
}

function looksLikeRecognizedHeaderCell(value) {
  const trimmed = String(value ?? '').trim();

  if (!trimmed) {
    return false;
  }

  if (isPlaceholderHeaderLabel(trimmed) || resolveFieldLabelKey(trimmed)) {
    return true;
  }

  const normalized = normalizeHeader(trimmed);
  return HEADER_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function looksLikeExplicitHeaderRow(row) {
  const values = row.map((cell) => String(cell ?? '').trim()).filter(Boolean);

  if (values.length < 2) {
    return false;
  }

  return matchRatio(values, looksLikeRecognizedHeaderCell) >= 0.45;
}

function isPlaceholderHeaderLabel(label) {
  const normalized = String(label ?? '')
    .trim()
    .toLowerCase()
    .replace(/^\ufeff/, '')
    .replace(/[\s_.\-/%()[\]:]+/g, '');

  if (!normalized) {
    return true;
  }

  return /^(?:column|col|field|header|value|item|attribute|unnamed|untitled)(?:[a-z]+)?\d*$/i.test(normalized);
}

function looksLikePlaceholderHeaderRow(row) {
  const values = row.map((cell) => String(cell ?? '').trim()).filter(Boolean);

  if (values.length < 2) {
    return false;
  }

  return matchRatio(values, isPlaceholderHeaderLabel) >= 0.6;
}

function pickColumnIndex(headers, candidates) {
  return headers.findIndex((header) =>
    candidates.some((candidate) => header.includes(candidate)),
  );
}

function pickResolvedFieldIndex(fieldKeys, fallbackHeaders, key, candidates = []) {
  const resolvedIndex = fieldKeys.findIndex((fieldKey) => fieldKey === key);

  if (resolvedIndex >= 0) {
    return resolvedIndex;
  }

  return pickColumnIndex(fallbackHeaders, candidates);
}

const KNOWN_CURRENCY_CODES = new Set(['USD', 'KRW', 'EUR', 'JPY', 'CNY', 'HKD', 'GBP', 'CAD', 'AUD', 'CHF']);
const NON_STOCK_LABEL_FIELD_KEYS = new Set([
  'accountId',
  'accountType',
  'buyDate',
  'buyPrice',
  'shares',
  'return',
  'region',
  'sector',
  'style',
  'risk',
  'assetClass',
  'currency',
  'marketCapClass',
  'volatility',
  'taxStatus',
  'benchmark',
]);
const ACCOUNT_TYPE_PATTERN =
  /^(isa|irp|ira|cma|cma-rp|mmf|rp|연금|연금저축|퇴직연금|개인연금|중개형isa|일반계좌|종합계좌|증권계좌|해외주식|국내주식|계좌)$/i;
const ACCOUNT_ID_PATTERN = /^[A-Z]{1,3}\d{5,12}$/i;
const TRADE_META_PATTERN =
  /^(buy|sell|nasdaq|nyse|arca|bats|iex|smart|mkt|lmt|stop|stp|market|limit|day|gtc|ioc|fok|open|close|o|c|a)$/i;
const SECURITY_BRAND_HINT_PATTERN =
  /(tiger|kodex|arirang|ace|kbstar|hanaro|kosef|sol|rise|plus|timefolio|spdr|ishares|vanguard|invesco|schwab|etf|etn|fund|trust)/i;
const COMPANY_NAME_HINT_PATTERN =
  /(inc|corp|corporation|co\.?|company|ltd|limited|plc|holdings?|group|pharma|therapeutics|bank|energy|systems|technologies|motors?|semiconductor|전자|화학|금융|은행|제약|바이오|홀딩스?|건설|증권|통신|식품|에너지|반도체)/i;
const GENERIC_META_EXACT_PATTERN =
  /^(high|medium|low|taxable|stock|stocks|equity|equities|etf|fund|bond|bonds|reit|cash|commodity|crypto|growth|value|dividend|defensive|blend|income|quality|momentum|미국|한국|국내|해외|글로벌|선진국(?:가)?|신흥국(?:가)?|유럽|일본|중국|홍콩|캐나다|기술|반도체|금융|에너지|바이오|헬스|소재|자동차|배터리|인터넷|플랫폼|부동산|소비재|산업재|주식|채권|리츠|원자재|펀드|현금|성장주|가치주|배당주|방어형|분산형|고위험|중위험|저위험|대형주|중형주|소형주|large\\s*cap|mid\\s*cap|small\\s*cap|mega\\s*cap|developed(?:\\s*markets?)?|emerging(?:\\s*markets?)?|europe|japan|china|hong\\s*kong|canada|technology|semiconductor|financials?|energy|biotech|health|materials?|automobile|battery|internet|platform|real\\s*estate|consumer|industrial)$/i;
const GENERIC_META_TOKEN_PATTERN =
  /(지역|국가|시장|분야|업종|산업|섹터|스타일|전략|팩터|위험|등급|변동성|자산군|자산구분|규모|시가총액|country|region|market|sector|industry|style|strategy|factor|risk|grade|volatility|asset\\s*class|asset\\s*type|market\\s*cap|cap\\s*class)/i;
const SECURITY_NAME_HINT_PATTERN =
  /(tiger|kodex|arirang|ace|kbstar|hanaro|kosef|sol|rise|plus|timefolio|spdr|ishares|vanguard|invesco|schwab|s&p|nasdaq|dow|russell|msci|kospi|kosdaq|etf|etn|fund|trust|tiger|kodex|미국|글로벌|반도체|배당|테크|성장|채권|금리|리츠|부동산)/i;

function matchRatio(values, predicate) {
  if (!values.length) {
    return 0;
  }

  const matched = values.filter((value) => predicate(value)).length;
  return matched / values.length;
}

function distinctValueCount(values, normalize = normalizeDisplayKey) {
  return new Set(values.map((value) => normalize(value)).filter(Boolean)).size;
}

function formatAtomDateLabel(value) {
  const trimmed = String(value ?? '').trim();

  if (!trimmed) {
    return '';
  }

  const normalized = trimmed.replace(/\s+/, ' ');
  const isoDateTimeMatch = normalized.match(
    /^(\d{4})[-/\.](\d{1,2})[-/\.](\d{1,2})(?:[T\s]\d{1,2}:\d{2}(?::\d{2})?)?/,
  );
  if (isoDateTimeMatch) {
    const [, year, month, day] = isoDateTimeMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  const isoDateMatch = trimmed.match(/^(\d{4})[-/\.](\d{1,2})[-/\.](\d{1,2})/);
  if (isoDateMatch) {
    const [, year, month, day] = isoDateMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  const compactMatch = trimmed.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compactMatch) {
    const [, year, month, day] = compactMatch;
    return `${year}-${month}-${day}`;
  }

  const shortDateMatch = trimmed.match(/^(\d{1,2})[-/\.](\d{1,2})[-/\.](\d{2,4})(?:[T\s]\d{1,2}:\d{2}(?::\d{2})?)?/);
  if (shortDateMatch) {
    const [, month, day, year] = shortDateMatch;
    const fullYear = year.length === 2 ? `20${year}` : year;
    return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  return trimmed;
}

function isTickerLikeValue(value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) {
    return false;
  }

  if (KNOWN_CURRENCY_CODES.has(trimmed.toUpperCase())) {
    return false;
  }

  if (/^\d{8}$/.test(trimmed) && isDateLikeValue(trimmed)) {
    return false;
  }

  return /^([A-Z]{1,5}(?:\.[A-Z])?|[A-Z]{1,6}|[0-9]{4,8})$/.test(trimmed);
}

function isDateLikeValue(value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) {
    return false;
  }

  if (/^\d{8}$/.test(trimmed)) {
    const year = Number.parseInt(trimmed.slice(0, 4), 10);
    const month = Number.parseInt(trimmed.slice(4, 6), 10) - 1;
    const day = Number.parseInt(trimmed.slice(6, 8), 10);
    const date = new Date(year, month, day);
    return Number.isFinite(date.getTime());
  }

  if (
    /^\d{4}[-/\.]\d{1,2}[-/\.]\d{1,2}(?:[T\s]\d{1,2}:\d{2}(?::\d{2})?)?$/.test(trimmed) ||
    /^\d{1,2}[-/\.]\d{1,2}[-/\.]\d{2,4}(?:[T\s]\d{1,2}:\d{2}(?::\d{2})?)?$/.test(trimmed)
  ) {
    const date = new Date(trimmed.replace(/\./g, '-').replace(/^(\d{4}-\d{1,2}-\d{1,2})\s+/, '$1T'));
    return Number.isFinite(date.getTime());
  }

  return false;
}

function isNumericLikeValue(value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) {
    return false;
  }

  const numeric = Number.parseFloat(trimmed.replace(/[^0-9.+-]/g, ''));
  return Number.isFinite(numeric);
}

function isShareLikeValue(value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) {
    return false;
  }

  if (!/^\d+(?:\.\d+)?(?:\s*(?:주|shares?|sh))?$/i.test(trimmed)) {
    return false;
  }

  return Number.parseFloat(trimmed.replace(/[^0-9.+-]/g, '')) > 0;
}

function isPriceLikeValue(value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) {
    return false;
  }

  if (!isNumericLikeValue(trimmed)) {
    return false;
  }

  return /[$₩€¥]|krw|usd|eur|jpy|원|달러/i.test(trimmed) || Number.parseFloat(trimmed.replace(/[^0-9.+-]/g, '')) >= 1;
}

function isAccountTypeValue(value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) {
    return false;
  }

  if (ACCOUNT_ID_PATTERN.test(trimmed)) {
    return true;
  }

  if (ACCOUNT_TYPE_PATTERN.test(trimmed)) {
    return true;
  }

  return /(account|brokerage|pension|retirement|taxable|deferred|절세계좌|퇴직|연금|계좌)/i.test(trimmed);
}

function hasSecurityNameContext(value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) {
    return false;
  }

  return (
    isTickerLikeValue(trimmed) ||
    SECURITY_BRAND_HINT_PATTERN.test(trimmed) ||
    COMPANY_NAME_HINT_PATTERN.test(trimmed)
  );
}

function isGenericMetaValue(value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) {
    return false;
  }

  if (GENERIC_META_EXACT_PATTERN.test(trimmed)) {
    return true;
  }

  if (hasSecurityNameContext(trimmed)) {
    return false;
  }

  return GENERIC_META_TOKEN_PATTERN.test(trimmed);
}

function isLikelySecurityName(value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed || isAccountTypeValue(trimmed)) {
    return false;
  }

  if (TRADE_META_PATTERN.test(trimmed)) {
    return false;
  }

  if (isGenericMetaValue(trimmed)) {
    return false;
  }

  if (looksLikeFreeTextName(trimmed)) {
    return true;
  }

  if (isTickerLikeValue(trimmed)) {
    return true;
  }

  return SECURITY_NAME_HINT_PATTERN.test(trimmed);
}

function looksLikeFreeTextName(value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) {
    return false;
  }

  if (
    isTickerLikeValue(trimmed) ||
    isDateLikeValue(trimmed) ||
    KNOWN_CURRENCY_CODES.has(trimmed.toUpperCase()) ||
    ACCOUNT_ID_PATTERN.test(trimmed) ||
    TRADE_META_PATTERN.test(trimmed)
  ) {
    return false;
  }

  if (/(s&p|nasdaq|dow|russell|msci|kospi|kosdaq|benchmark|index)/i.test(trimmed)) {
    return false;
  }

  if (isGenericMetaValue(trimmed)) {
    return false;
  }

  if (
    /^(stock|stocks|equity|equities|etf|fund|bond|bonds|reit|cash|commodity|crypto|개별주식|주식\s*etf|채권\s*etf|채권|리츠|현금성\s*자산|원자재|디지털\s*자산)$/i.test(
      trimmed,
    )
  ) {
    return false;
  }

  return /[a-z]/i.test(trimmed) || /[가-힣]/.test(trimmed);
}

function findBestSecurityNameColumnIndex(headerLabels, fieldKeys, bodyRows) {
  const columnCount = Math.max(headerLabels.length, ...bodyRows.map((row) => row.length));
  const columns = Array.from({ length: columnCount }, (_, columnIndex) => {
    const values = bodyRows
      .map((row) => String(row[columnIndex] ?? '').trim())
      .filter(Boolean);

    return {
      columnIndex,
      values,
      headerLabel: headerLabels[columnIndex] ?? `Column ${columnIndex + 1}`,
      fieldKey: fieldKeys[columnIndex] ?? resolveFieldLabelKey(headerLabels[columnIndex] ?? ''),
    };
  }).filter(({ values }) => values.length > 0);

  const bestColumn = columns
    .map((column) => ({
      ...column,
      score: scoreSecurityNameColumn(column.headerLabel, column.fieldKey, column.values),
    }))
    .sort((left, right) => right.score - left.score)[0];

  return bestColumn && bestColumn.score >= 0.5 ? bestColumn.columnIndex : -1;
}

function inferHeaderLabels(headerLabels, bodyRows) {
  const labels = [...headerLabels];
  const columnCount = Math.max(labels.length, ...bodyRows.map((row) => row.length));
  const candidateDefinitions = [
    {
      key: 'stockCode',
      label: '종목코드',
      minScore: 0.72,
      score: (values) => matchRatio(values, isTickerLikeValue),
    },
    {
      key: 'accountType',
      label: '계좌유형',
      minScore: 0.74,
      score: (values) => matchRatio(values, isAccountTypeValue),
    },
    {
      key: 'buyDate',
      label: '매수일',
      minScore: 0.84,
      score: (values) => matchRatio(values, isDateLikeValue),
    },
    {
      key: 'buyPrice',
      label: '매수가',
      minScore: 0.76,
      score: (values) => matchRatio(values, isPriceLikeValue),
    },
    {
      key: 'shares',
      label: '보유수량',
      minScore: 0.78,
      score: (values) => matchRatio(values, isShareLikeValue),
    },
    {
      key: 'return',
      label: '수익률',
      minScore: 0.72,
      score: (values) =>
        matchRatio(values, (value) => {
          const trimmed = String(value ?? '').trim();
          const parsed = Number.parseFloat(trimmed.replace(/[,%\s]/g, ''));
          if (!Number.isFinite(parsed)) {
            return false;
          }

          return trimmed.includes('%') || /^[+-]/.test(trimmed) || Math.abs(parsed) <= 100;
        }),
    },
    {
      key: 'assetClass',
      label: '자산 구분',
      minScore: 0.72,
      score: (values) =>
        matchRatio(values, (value) =>
          /^(stock|stocks|equity|equities|etf|fund|bond|bonds|reit|cash|commodity|crypto|개별주식|주식\s*etf|채권\s*etf|채권|리츠|현금성\s*자산|원자재|디지털\s*자산)$/i.test(
            String(value ?? '').trim(),
          ),
        ),
    },
    {
      key: 'marketCapClass',
      label: '규모 분류',
      minScore: 0.68,
      score: (values) =>
        matchRatio(values, (value) =>
          /(mega\s*cap|large\s*cap|mid\s*cap|small\s*cap|대형주|중형주|소형주)/i.test(String(value ?? '').trim()),
        ),
    },
    {
      key: 'region',
      label: '투자 지역',
      minScore: 0.72,
      score: (values) =>
        matchRatio(values, (value) =>
          /^(미국|한국|국내|해외|글로벌|일본|중국|홍콩|캐나다|유럽|us|usa|united states|korea|global|international|japan|china|hong kong|canada|europe)$/i.test(
            String(value ?? '').trim(),
          ),
        ),
    },
    {
      key: 'sector',
      label: '분야',
      minScore: 0.68,
      score: (values) =>
        matchRatio(values, (value) =>
          /(기술|반도체|금융|에너지|바이오|헬스|소재|자동차|배터리|인터넷|플랫폼|부동산|소비재|산업재|technology|semiconductor|financial|energy|biotech|health|material|automobile|battery|internet|platform|real estate|consumer|industrial)/i.test(
            String(value ?? '').trim(),
          ),
        ),
    },
    {
      key: 'style',
      label: '투자 스타일',
      minScore: 0.68,
      score: (values) =>
        matchRatio(values, (value) =>
          /^(성장주|가치주|배당주|방어형|분산형|growth|value|dividend|defensive|income|blend|quality|momentum)$/i.test(
            String(value ?? '').trim(),
          ),
        ),
    },
    {
      key: 'currency',
      label: '통화',
      minScore: 0.8,
      score: (values) =>
        matchRatio(values, (value) => KNOWN_CURRENCY_CODES.has(String(value ?? '').trim().toUpperCase())),
    },
    {
      key: 'risk',
      label: '위험 등급',
      minScore: 0.68,
      score: (values) =>
        matchRatio(values, (value) =>
          /^(high|medium|low|aggressive|moderate|conservative|고위험|중위험|저위험)$/i.test(
            String(value ?? '').trim(),
          ),
        ),
    },
    {
      key: 'volatility',
      label: '변동성',
      minScore: 0.68,
      score: (values) =>
        matchRatio(values, (value) =>
          /^(high|medium|low|고변동|중변동|저변동)$/i.test(String(value ?? '').trim()),
        ),
    },
    {
      key: 'taxStatus',
      label: '과세 구분',
      minScore: 0.72,
      score: (values) =>
        matchRatio(values, (value) =>
          /^(taxable|tax[-\s]?deferred|tax[-\s]?exempt|과세|비과세|절세|일반계좌|연금|ira|isa)$/i.test(
            String(value ?? '').trim(),
          ),
        ),
    },
    {
      key: 'benchmark',
      label: '비교 지수',
      minScore: 0.68,
      score: (values) =>
        matchRatio(values, (value) =>
          /(s&p|nasdaq|nyse|dow|russell|msci|kospi|kosdaq|index|지수|benchmark)/i.test(
            String(value ?? '').trim(),
          ),
        ),
    },
  ];

  const scoredMatches = [];

  for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
    const values = bodyRows
      .map((row) => String(row[columnIndex] ?? '').trim())
      .filter(Boolean);

    if (!values.length) {
      continue;
    }

    candidateDefinitions.forEach((candidate) => {
      const score = candidate.score(values);
      if (score >= candidate.minScore) {
        scoredMatches.push({
          columnIndex,
          key: candidate.key,
          label: candidate.label,
          score,
        });
      }
    });
  }

  scoredMatches
    .sort((left, right) => right.score - left.score)
    .forEach(({ columnIndex, key, label }) => {
      const alreadyAssignedKey = labels.some((currentLabel) => resolveFieldLabelKey(currentLabel) === key);
      if (alreadyAssignedKey) {
        return;
      }

      const currentLabel = labels[columnIndex] ?? '';
      if (!isPlaceholderHeaderLabel(currentLabel)) {
        return;
      }

      labels[columnIndex] = label;
    });

  const inferredNameColumnIndex = Array.from({ length: columnCount }, (_, columnIndex) => {
    const values = bodyRows
      .map((row) => String(row[columnIndex] ?? '').trim())
      .filter(Boolean);

    return {
      columnIndex,
      score: matchRatio(values, isLikelySecurityName),
      values,
    };
  })
    .filter(({ values }) => values.length > 0)
    .sort((left, right) => right.score - left.score)
    .find(({ columnIndex, score }) => {
      const currentLabel = labels[columnIndex] ?? '';
      return isPlaceholderHeaderLabel(currentLabel) && score >= 0.68;
    });

  const hasAssignedStockName = labels.some((currentLabel) => resolveFieldLabelKey(currentLabel) === 'stockName');
  if (inferredNameColumnIndex && !hasAssignedStockName) {
    labels[inferredNameColumnIndex.columnIndex] = '종목명';
  }

  return Array.from({ length: columnCount }, (_, index) => labels[index] || `Column ${index + 1}`);
}

function scoreSecurityNameColumn(headerLabel, fieldKey, values) {
  if (!values.length) {
    return 0;
  }

  const normalizedHeader = normalizeHeader(headerLabel);
  const securityRatio = matchRatio(values, isLikelySecurityName);
  const accountRatio = matchRatio(values, isAccountTypeValue);
  const dateRatio = matchRatio(values, isDateLikeValue);
  const numericRatio = matchRatio(
    values,
    (value) => isNumericLikeValue(value) && !isTickerLikeValue(value),
  );
  const shortNumericRatio = matchRatio(values, (value) => /^\d{1,3}(?:\.\d+)?$/.test(String(value ?? '').trim()));
  const metaValueRatio = matchRatio(
    values,
    (value) => isGenericMetaValue(value),
  );
  let bonus = 0;

  if (fieldKey === 'stockName') {
    bonus += 0.18;
  }

  if (fieldKey === 'stockCode') {
    bonus -= 0.56;
  }

  if (/(assetname|securityname|productname|자산명|상품명)/.test(normalizedHeader)) {
    bonus += 0.24;
  }

  if (/(name|security|company|종목명)/.test(normalizedHeader)) {
    bonus += 0.14;
  }

  if (
    fieldKey === 'accountId' ||
    fieldKey === 'accountType' ||
    /(acctid|accountid|accountnumber|accounttype|accountkind|accountclass|계좌id|계좌번호|계좌유형|계좌종류|계좌)/.test(
      normalizedHeader,
    )
  ) {
    bonus -= 0.9;
  }

  if (
    fieldKey &&
    [
      'accountId',
      'accountType',
      'buyDate',
      'buyPrice',
      'shares',
      'return',
      'region',
      'sector',
      'style',
      'risk',
      'assetClass',
      'currency',
      'marketCapClass',
      'volatility',
      'taxStatus',
      'benchmark',
    ].includes(fieldKey)
  ) {
    bonus -= 0.9;
  }

  if (
    /(date|day|buydate|tradedate|recorddate|valuedate|매수일|날짜|일자|계좌|account|region|country|market|분야|sector|industry|style|risk|assetclass|currency|marketcap|volatility|tax|benchmark|return|performance|change|shares|quantity|buyprice|price)/.test(
      normalizedHeader,
    )
  ) {
    bonus -= 0.82;
  }

  return (
    securityRatio -
    accountRatio * 1.25 -
    dateRatio * 1.1 -
    numericRatio * 0.95 -
    shortNumericRatio * 1.35 -
    metaValueRatio * 1.2 +
    bonus
  );
}

function scoreAccountTypeColumn(headerLabel, fieldKey, values) {
  if (!values.length) {
    return 0;
  }

  const normalizedHeader = normalizeHeader(headerLabel);
  const securityRatio = matchRatio(values, isLikelySecurityName);
  const accountRatio = matchRatio(
    values,
    (value) => isAccountTypeValue(value) && !ACCOUNT_ID_PATTERN.test(String(value ?? '').trim()),
  );
  let bonus = 0;

  if (fieldKey === 'accountType') {
    bonus += 0.24;
  }

  if (/(accounttype|accountkind|accountclass|계좌유형|계좌종류|계좌)/.test(normalizedHeader)) {
    bonus += 0.28;
  }

  if (fieldKey === 'stockName' && accountRatio >= 0.7) {
    bonus += 0.18;
  }

  return accountRatio - securityRatio * 1.15 + bonus;
}

function scoreAccountIdColumn(headerLabel, fieldKey, values) {
  if (!values.length) {
    return 0;
  }

  const normalizedHeader = normalizeHeader(headerLabel);
  const idRatio = matchRatio(values, (value) => ACCOUNT_ID_PATTERN.test(String(value ?? '').trim()));
  let bonus = 0;

  if (fieldKey === 'accountId') {
    bonus += 0.28;
  }

  if (/(acctid|accountid|accountnumber|계좌id|계좌번호|계좌코드)/.test(normalizedHeader)) {
    bonus += 0.3;
  }

  if (fieldKey === 'stockName' || fieldKey === 'stockCode') {
    bonus -= 0.4;
  }

  return idRatio + bonus;
}

function normalizePortfolioFieldLabels(headerLabels, bodyRows) {
  const labels = [...headerLabels];
  const columnCount = Math.max(labels.length, ...bodyRows.map((row) => row.length));
  const columns = Array.from({ length: columnCount }, (_, columnIndex) => {
    const values = bodyRows
      .map((row) => String(row[columnIndex] ?? '').trim())
      .filter(Boolean);

    return {
      columnIndex,
      values,
      headerLabel: labels[columnIndex] ?? `Column ${columnIndex + 1}`,
      fieldKey: resolveFieldLabelKey(labels[columnIndex] ?? ''),
    };
  }).filter(({ values }) => values.length > 0);

  const bestSecurityColumn = [...columns]
    .map((column) => ({
      ...column,
      score: scoreSecurityNameColumn(column.headerLabel, column.fieldKey, column.values),
    }))
    .sort((left, right) => right.score - left.score)
    .find((column) => column.score >= 0.5);

  if (bestSecurityColumn) {
    labels[bestSecurityColumn.columnIndex] = '종목명';
  }

  const bestAccountIdColumn = [...columns]
    .filter((column) => column.columnIndex !== bestSecurityColumn?.columnIndex)
    .map((column) => ({
      ...column,
      score: scoreAccountIdColumn(column.headerLabel, column.fieldKey, column.values),
    }))
    .sort((left, right) => right.score - left.score)
    .find((column) => column.score >= 0.78);

  if (bestAccountIdColumn) {
    labels[bestAccountIdColumn.columnIndex] = '계좌 ID';
  }

  const bestAccountColumn = [...columns]
    .filter(
      (column) =>
        column.columnIndex !== bestSecurityColumn?.columnIndex &&
        column.columnIndex !== bestAccountIdColumn?.columnIndex,
    )
    .map((column) => ({
      ...column,
      score: scoreAccountTypeColumn(column.headerLabel, column.fieldKey, column.values),
    }))
    .sort((left, right) => right.score - left.score)
    .find((column) => column.score >= 0.7);

  if (bestAccountColumn) {
    labels[bestAccountColumn.columnIndex] = '계좌유형';
  }

  return labels;
}

function selectPortfolioLabelStrategy({
  bodyRows,
  headers,
  fieldKeys,
  dateIndex,
  nameIndex,
  tickerIndex,
}) {
  if (dateIndex < 0 || bodyRows.length < 8) {
    return 'security';
  }

  const dateValues = bodyRows
    .map((row) => String(row[dateIndex] ?? '').trim())
    .filter(Boolean);

  if (dateValues.length < 8) {
    return 'security';
  }

  const dateDistinctCount = distinctValueCount(dateValues, formatAtomDateLabel);
  const dateDistinctRatio = dateDistinctCount / dateValues.length;

  if (dateDistinctRatio < 0.45) {
    return 'security';
  }

  const securityIndex = nameIndex >= 0 ? nameIndex : tickerIndex;
  const securityValues =
    securityIndex >= 0
      ? bodyRows
          .map((row) => String(row[securityIndex] ?? '').trim())
          .filter(Boolean)
      : [];
  const securityDistinctCount = securityValues.length
    ? distinctValueCount(securityValues)
    : Number.POSITIVE_INFINITY;
  const hasDailySeriesHeaders = headers.some(
    (header) =>
      header.includes('일일수익률') ||
      header.includes('누적수익률') ||
      header.includes('dailyreturn') ||
      header.includes('cumulativereturn'),
  );
  const hasTimeSeriesMetricHeaders = headers.some(
    (header) =>
      header.includes('초기금액') ||
      header.includes('평가금액') ||
      header.includes('initialamount') ||
      header.includes('marketvalue') ||
      header.includes('valuation'),
  );
  const hasGenericDateHeader =
    fieldKeys[dateIndex] === 'buyDate' ||
    headers[dateIndex]?.includes('날짜') ||
    headers[dateIndex]?.includes('일자') ||
    headers[dateIndex]?.includes('date');

  if (
    hasGenericDateHeader &&
    (hasDailySeriesHeaders || hasTimeSeriesMetricHeaders) &&
    securityDistinctCount <= Math.max(8, Math.round(dateDistinctCount * 0.35)) &&
    dateDistinctCount >= securityDistinctCount * 2
  ) {
    return 'date';
  }

  return 'security';
}

function formatReturnDetail(value, label = '') {
  const trimmed = value.trim();

  if (!trimmed) {
    return '';
  }

  const numeric = Number.parseFloat(trimmed.replace(/[,%\s]/g, ''));
  if (!Number.isFinite(numeric)) {
    return '';
  }

  const explicitPercent =
    /%|pct|percent|return|yield|change|rate|수익률|등락률|변동률|손익률/i.test(String(label ?? '').trim());
  const percentValue =
    explicitPercent || trimmed.includes('%') || Math.abs(numeric) > 1 ? numeric : numeric * 100;
  const fixed = percentValue
    .toFixed(Math.abs(percentValue) >= 10 ? 1 : 2)
    .replace(/(\.\d*?[1-9])0+$/, '$1')
    .replace(/\.0$/, '');
  const sign = percentValue > 0 ? '+' : '';

  return `${sign}${fixed}%`;
}

function countReplacementCharacters(text) {
  return (text.match(/\uFFFD/g) ?? []).length;
}

async function readPortfolioFile(file) {
  const buffer = await file.arrayBuffer();
  const decoders = ['utf-8', 'euc-kr'];
  let bestText = '';
  let bestScore = Number.POSITIVE_INFINITY;

  for (const encoding of decoders) {
    try {
      const text = new TextDecoder(encoding).decode(buffer);
      const score = countReplacementCharacters(text);

      if (score < bestScore) {
        bestText = text;
        bestScore = score;
      }
    } catch {
      continue;
    }
  }

  return bestText;
}

async function ingestPortfolioTextViaApi(fileName, text) {
  const response = await fetch('/api/portfolio/ingest', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fileName,
      text,
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      payload && typeof payload.error === 'string' ? payload.error : 'Portfolio ingestion failed.',
    );
  }

  return payload;
}

async function enrichSecurityItemsViaApi(items, options = {}) {
  const response = await fetch('/api/securities/enrich', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      items,
      force: Boolean(options.force),
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      payload && typeof payload.error === 'string' ? payload.error : 'Security enrichment failed.',
    );
  }

  return payload;
}

const STRONG_METADATA_SOURCES = new Set(['provided', 'reference', 'wikidata', 'yahoo']);

function hasMissingCoreMetadata(item) {
  return ['region', 'sector', 'style', 'risk'].some((field) => {
    const value = String(item?.[field] ?? '').trim();
    const source = String(
      item?.metadataSourceByField?.[field] ?? item?.metadataSource ?? 'raw',
    )
      .trim()
      .toLowerCase();

    return !value || !STRONG_METADATA_SOURCES.has(source);
  });
}

function metadataMergeKey(item) {
  return [
    item?.code,
    item?.ticker,
    item?.name,
    item?.companyName,
    item?.label,
  ]
    .map((value) => normalizeDisplayKey(value))
    .find(Boolean) ?? '';
}

function mergeSecurityMetadataItems(baseItems, enrichedItems) {
  if (!Array.isArray(baseItems) || !Array.isArray(enrichedItems) || !enrichedItems.length) {
    return baseItems;
  }

  const enrichedByKey = new Map();
  enrichedItems.forEach((item, index) => {
    const key = metadataMergeKey(item) || `index:${index}`;
    if (!enrichedByKey.has(key)) {
      enrichedByKey.set(key, item);
    }
  });

  return baseItems.map((item, index) => {
    const key = metadataMergeKey(item) || `index:${index}`;
    return enrichedByKey.get(key) ?? enrichedItems[index] ?? item;
  });
}

function midpoint(a, b) {
  return {
    x: (a.x + b.x) * 0.5,
    y: (a.y + b.y) * 0.5,
  };
}

function closedSketchPath(points) {
  const firstMid = midpoint(points[points.length - 1], points[0]);
  let path = `M ${format(firstMid.x)} ${format(firstMid.y)}`;

  for (let index = 0; index < points.length; index += 1) {
    const next = points[(index + 1) % points.length];
    const currentMid = midpoint(points[index], next);
    path += ` Q ${format(points[index].x)} ${format(points[index].y)} ${format(
      currentMid.x,
    )} ${format(currentMid.y)}`;
  }

  return path;
}

function openSketchPath(points) {
  if (points.length < 2) {
    return '';
  }

  let path = `M ${format(points[0].x)} ${format(points[0].y)}`;

  for (let index = 1; index < points.length - 1; index += 1) {
    const currentMid = midpoint(points[index], points[index + 1]);
    path += ` Q ${format(points[index].x)} ${format(points[index].y)} ${format(
      currentMid.x,
    )} ${format(currentMid.y)}`;
  }

  const last = points[points.length - 1];
  path += ` L ${format(last.x)} ${format(last.y)}`;
  return path;
}

function buildAllocationArcPath({
  centerX,
  centerY,
  radius,
  startAngle,
  endAngle,
  seed,
  wobble = 2.4,
}) {
  const span = endAngle - startAngle;

  if (span <= 0.02) {
    return '';
  }

  const steps = Math.max(8, Math.ceil(span / (Math.PI / 18)));
  const points = [];

  for (let index = 0; index <= steps; index += 1) {
    const progress = index / steps;
    const angle = startAngle + span * progress;
    const radialOffset =
      Math.sin(seed * 0.031 + progress * Math.PI * 4.2) * wobble * 0.34 +
      jitter(seed + index * 3.17, wobble * 0.24);
    const tangentOffset = jitter(seed + 200 + index * 2.41, wobble * 0.16);
    const localRadius = radius + radialOffset;

    points.push({
      x:
        centerX +
        Math.cos(angle) * localRadius +
        Math.cos(angle + Math.PI / 2) * tangentOffset,
      y:
        centerY +
        Math.sin(angle) * localRadius +
        Math.sin(angle + Math.PI / 2) * tangentOffset,
    });
  }

  return openSketchPath(points);
}

function buildLoopPath(radius, seed) {
  const points = [];

  for (let index = 0; index < 10; index += 1) {
    const angle = (index / 10) * Math.PI * 2;
    const ring = radius + jitter(seed + index * 1.19, radius * 0.22);
    points.push({
      x: Math.cos(angle) * ring + jitter(seed + index * 2.17, 0.92),
      y: Math.sin(angle) * ring + jitter(seed + index * 3.03, 0.92),
    });
  }

  return closedSketchPath(points);
}

function buildBlotPath(radius, seed) {
  const points = [];

  for (let index = 0; index < 12; index += 1) {
    const angle = (index / 12) * Math.PI * 2;
    const ring = radius + jitter(seed + index * 2.31, radius * 0.27);
    points.push({
      x: Math.cos(angle) * ring + jitter(seed + index * 3.3, 1.7),
      y: Math.sin(angle) * ring + jitter(seed + index * 4.4, 1.7),
    });
  }

  return closedSketchPath(points);
}

function createAtomState(config) {
  return {
    ...config,
    baseDirection: new THREE.Vector3(...config.direction).normalize(),
    hovered: false,
    hoverMix: 0,
    dragging: false,
    dragMix: 0,
    nodeTilt: jitter(config.seed + 401, 16),
    labelTilt: jitter(config.seed + 509, 8),
    labelOffset: 20 + noise(config.seed + 557) * 14,
    nodePaths: [
      buildLoopPath(config.node, config.seed + 201),
      buildLoopPath(config.node * 0.84, config.seed + 301),
    ],
  };
}

function createSceneCameraRig() {
  return {
    current: {
      panX: 0,
      panY: 0,
      dolly: 0,
      zoom: 1,
      roll: 0,
      driftX: 0,
      driftY: 0,
      focus: 0,
    },
    target: {
      panX: 0,
      panY: 0,
      dolly: 0,
      zoom: 1,
      roll: 0,
      driftX: 0,
      driftY: 0,
      focus: 0,
    },
  };
}

function projectPoint(position, camera = DEFAULT_SCENE_CAMERA) {
  const translatedX = position.x + (camera.panX ?? 0);
  const translatedY = position.y + (camera.panY ?? 0);
  const translatedZ = position.z + (camera.dolly ?? 0);
  const roll = ((camera.roll ?? 0) * Math.PI) / 180;
  const rollCos = Math.cos(roll);
  const rollSin = Math.sin(roll);
  const rolledX = translatedX * rollCos - translatedY * rollSin;
  const rolledY = translatedX * rollSin + translatedY * rollCos;
  const perspective = CAMERA_DISTANCE / Math.max(CAMERA_NEAR_CLIP, CAMERA_DISTANCE - translatedZ);
  const zoom = camera.zoom ?? 1;

  return {
    x: rolledX * perspective * zoom + (camera.driftX ?? 0),
    y: rolledY * perspective * zoom + (camera.driftY ?? 0),
    scale: perspective * zoom,
    depth: clamp((translatedZ / BOND_LENGTH + 1) * 0.5, 0, 1),
  };
}

function buildBondPath(atom, variant, phase) {
  const end = {
    x: atom.x + jitter(atom.seed + variant * 5.1, 1.8),
    y: atom.y + jitter(atom.seed + variant * 6.1, 1.8),
  };
  const length = Math.hypot(end.x, end.y) || 1;
  const direction = {
    x: end.x / length,
    y: end.y / length,
  };
  const normal = {
    x: -direction.y,
    y: direction.x,
  };
  const phaseWobble = Math.sin(phase + atom.seed * 0.11 + variant * 0.7) * 1.8;
  const depthCurve = (0.5 - atom.depth) * 14;
  const curve = depthCurve + phaseWobble + jitter(atom.seed + variant * 7.1, 6);
  const start = {
    x: jitter(atom.seed + variant * 2.1, 4),
    y: jitter(atom.seed + variant * 3.1, 4),
  };
  const controlOne = {
    x: end.x * (0.28 + variant * 0.025) + normal.x * (curve * 0.85),
    y: end.y * (0.28 + variant * 0.025) + normal.y * (curve * 0.85),
  };
  const controlTwo = {
    x:
      end.x * (0.68 - variant * 0.02) +
      normal.x * (curve * 0.45 + jitter(atom.seed + variant * 11.1, 5)),
    y:
      end.y * (0.68 - variant * 0.02) +
      normal.y * (curve * 0.45 + jitter(atom.seed + variant * 12.1, 5)),
  };

  return `M ${format(start.x)} ${format(start.y)} C ${format(controlOne.x)} ${format(
    controlOne.y,
  )} ${format(controlTwo.x)} ${format(controlTwo.y)} ${format(end.x)} ${format(
    end.y,
  )}`;
}

function buildScoreSketchPolygon(points, seed, wobble = 1.4) {
  const jitteredPoints = points.map((point, index) => ({
    x: point.x + jitter(seed + index * 1.37, wobble),
    y: point.y + jitter(seed + index * 2.11, wobble),
  }));

  return jitteredPoints
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${format(point.x)} ${format(point.y)}`)
    .join(' ')
    .concat(' Z');
}

function buildScoreAxisPath(start, end, seed) {
  const startPoint = {
    x: start.x + jitter(seed + 1.1, 0.8),
    y: start.y + jitter(seed + 2.3, 0.8),
  };
  const endPoint = {
    x: end.x + jitter(seed + 3.7, 1.2),
    y: end.y + jitter(seed + 4.9, 1.2),
  };

  return `M ${format(startPoint.x)} ${format(startPoint.y)} L ${format(endPoint.x)} ${format(
    endPoint.y,
  )}`;
}

function buildSketchBoxPath(x, y, width, height, seed, wobble = 1.4) {
  return buildScoreSketchPolygon(
    [
      { x, y },
      { x: x + width, y: y + jitter(seed + 1.2, wobble * 0.18) },
      { x: x + width + jitter(seed + 2.4, wobble * 0.18), y: y + height },
      { x: x + jitter(seed + 3.6, wobble * 0.18), y: y + height + jitter(seed + 4.8, wobble * 0.18) },
    ],
    seed,
    wobble,
  );
}

function trackballVector(point) {
  const x = clamp(point.x / TRACKBALL_RADIUS, -1, 1);
  const y = clamp(point.y / TRACKBALL_RADIUS, -1, 1);
  const lengthSquared = x * x + y * y;

  if (lengthSquared > 1) {
    const scale = 1 / Math.sqrt(lengthSquared);
    return new THREE.Vector3(x * scale, y * scale, 0);
  }

  return new THREE.Vector3(x, y, Math.sqrt(1 - lengthSquared));
}

function generateAtomLayout(items) {
  const visibleItems = items;

  if (!visibleItems.length) {
    return [];
  }

  const total = Math.max(visibleItems.length, MIN_ATOMS);

  if (total === 1) {
    return [
      {
        id: 'a1',
        direction: [0.86, 0.22, 0.46],
        node: 8.7,
        seed: 11,
        label: visibleItems[0]?.label ?? 'Stock',
        detail: visibleItems[0]?.detail ?? '',
        region: visibleItems[0]?.region ?? '',
        sector: visibleItems[0]?.sector ?? '',
        style: visibleItems[0]?.style ?? '',
        risk: visibleItems[0]?.risk ?? '',
        assetClass: visibleItems[0]?.assetClass ?? '',
        metadataSource: visibleItems[0]?.metadataSource ?? 'raw',
        metadataSourceByField: visibleItems[0]?.metadataSourceByField ?? {},
        fields: visibleItems[0]?.fields ?? [],
      },
    ];
  }

  if (LOW_COUNT_LAYOUTS[total]) {
    return Array.from({ length: total }, (_, index) => {
      const preset = LOW_COUNT_LAYOUTS[total][index] ?? [0, 0, 1];
      const direction = new THREE.Vector3(...preset)
        .add(
          new THREE.Vector3(
            jitter(1500 + index * 19, 0.08),
            jitter(1600 + index * 23, 0.08),
            jitter(1700 + index * 29, 0.08),
          ),
        )
        .normalize();

      return {
        id: `a${index + 1}`,
        direction: [direction.x, direction.y, direction.z],
        node: 7.9 + noise(1800 + index * 31) * 1.6,
        seed: 11 + index * 23,
        label: visibleItems[index]?.label ?? `Stock ${index + 1}`,
        detail: visibleItems[index]?.detail ?? '',
        region: visibleItems[index]?.region ?? '',
        sector: visibleItems[index]?.sector ?? '',
        style: visibleItems[index]?.style ?? '',
        risk: visibleItems[index]?.risk ?? '',
        assetClass: visibleItems[index]?.assetClass ?? '',
        metadataSource: visibleItems[index]?.metadataSource ?? 'raw',
        metadataSourceByField: visibleItems[index]?.metadataSourceByField ?? {},
        fields: visibleItems[index]?.fields ?? [],
      };
    });
  }

  return Array.from({ length: total }, (_, index) => {
    const ratio = total === 1 ? 0.5 : index / (total - 1);
    const y = 1 - ratio * 2;
    const radius = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = index * GOLDEN_ANGLE + jitter(1400 + index * 17, 0.24);
    const direction = new THREE.Vector3(
      Math.cos(theta) * radius + jitter(1500 + index * 19, 0.14),
      y + jitter(1600 + index * 23, 0.14),
      Math.sin(theta) * radius + jitter(1700 + index * 29, 0.14),
    ).normalize();

    return {
      id: `a${index + 1}`,
      direction: [direction.x, direction.y, direction.z],
      node: 7.8 + noise(1800 + index * 31) * 1.7,
      seed: 11 + index * 23,
      label: visibleItems[index]?.label ?? `Stock ${index + 1}`,
      detail: visibleItems[index]?.detail ?? '',
      region: visibleItems[index]?.region ?? '',
      sector: visibleItems[index]?.sector ?? '',
      style: visibleItems[index]?.style ?? '',
      risk: visibleItems[index]?.risk ?? '',
      assetClass: visibleItems[index]?.assetClass ?? '',
      metadataSource: visibleItems[index]?.metadataSource ?? 'raw',
      metadataSourceByField: visibleItems[index]?.metadataSourceByField ?? {},
      fields: visibleItems[index]?.fields ?? [],
    };
  });
}

const PORTFOLIO_PREVIEW_SLOTS = [
  { x: -0.12, y: -0.02, scale: 0.32, rotation: -23, z: -1160, blur: 0.66, opacity: 0.64, shadow: 18, delay: '-2.4s', duration: '5.8s' },
  { x: 1.12, y: 0.07, scale: 0.24, rotation: 18, z: -1380, blur: 1.02, opacity: 0.5, shadow: 14, delay: '-1.2s', duration: '6.4s' },
  { x: 0.1, y: 0.09, scale: 0.2, rotation: -7, z: -1540, blur: 1.28, opacity: 0.42, shadow: 11, delay: '-1.8s', duration: '6.2s' },
  { x: 0.94, y: 0.27, scale: 0.28, rotation: 13, z: -1240, blur: 0.84, opacity: 0.56, shadow: 15, delay: '-2.9s', duration: '5.9s' },
  { x: -0.08, y: 0.82, scale: 0.29, rotation: 17, z: -1200, blur: 0.74, opacity: 0.6, shadow: 16, delay: '-3.1s', duration: '6.1s' },
  { x: 0.18, y: 1.08, scale: 0.21, rotation: -15, z: -1600, blur: 1.34, opacity: 0.38, shadow: 10, delay: '-1.5s', duration: '6.7s' },
  { x: 1.08, y: 0.96, scale: 0.23, rotation: -19, z: -1460, blur: 1.1, opacity: 0.46, shadow: 12, delay: '-0.8s', duration: '6.9s' },
  { x: 0.86, y: 0.72, scale: 0.19, rotation: 9, z: -1700, blur: 1.52, opacity: 0.34, shadow: 9, delay: '-2.2s', duration: '7.1s' },
  { x: 0.48, y: -0.12, scale: 0.18, rotation: -11, z: -1820, blur: 1.56, opacity: 0.32, shadow: 8, delay: '-3.4s', duration: '7.4s' },
  { x: -0.18, y: 0.43, scale: 0.2, rotation: 25, z: -1520, blur: 1.18, opacity: 0.42, shadow: 11, delay: '-0.6s', duration: '6.8s' },
  { x: 1.18, y: 0.48, scale: 0.18, rotation: -4, z: -1760, blur: 1.48, opacity: 0.34, shadow: 9, delay: '-2.7s', duration: '7.2s' },
  { x: 0.58, y: 1.16, scale: 0.17, rotation: 21, z: -1880, blur: 1.62, opacity: 0.3, shadow: 8, delay: '-1.9s', duration: '7.6s' },
];

const PREVIEW_ATOM_NODE_LIMIT = 6;

const PortfolioPreviewAtom = memo(function PortfolioPreviewAtom({ entry, slot }) {
  const previewNodes = useMemo(() => {
    const label = compactLabel(entry.fileName.replace(/\.[^.]+$/, ''), 16);

    return generateAtomLayout(entry.items)
      .slice(0, PREVIEW_ATOM_NODE_LIMIT)
      .map((atom, index) => {
        const direction = new THREE.Vector3(...atom.direction).normalize();
        const radius = 34 + direction.z * 12 + noise(atom.seed + 71) * 9;
        const x = direction.x * radius;
        const y = direction.y * radius;
        const depth = clamp((direction.z + 1) * 0.5, 0, 1);
        const loopOuter = buildLoopPath(6.6 + depth * 2.5 + index * 0.12, atom.seed + 1100);
        const loopMid = buildLoopPath(5.4 + depth * 1.9 + index * 0.1, atom.seed + 1146);
        const loopInner = buildLoopPath(4.1 + depth * 1.5 + index * 0.08, atom.seed + 1180);

        return {
          id: atom.id,
          x,
          y,
          depth,
          seed: atom.seed,
          outer: loopOuter,
          mid: loopMid,
          inner: loopInner,
          label,
        };
      });
  }, [entry.fileName, entry.items]);

  return (
    <div
      className="portfolio-preview"
      style={{
        left: `${slot.x * 100}%`,
        top: `${slot.y * 100}%`,
        transform: `translate3d(-50%, -50%, ${slot.z ?? -180}px) scale(${slot.scale}) rotate(${slot.rotation}deg)`,
        '--preview-z': `${slot.z ?? -180}px`,
        '--preview-scale': `${slot.scale}`,
        '--preview-blur': `${slot.blur ?? 0.3}px`,
        '--preview-opacity': `${slot.opacity ?? 0.78}`,
        '--preview-shadow': `${slot.shadow ?? 10}px`,
        '--preview-twinkle-delay': slot.delay ?? '0s',
        '--preview-twinkle-duration': slot.duration ?? '6.8s',
        '--preview-shift-x': `${(0.5 - slot.x) * 420}px`,
        '--preview-shift-y': `${(0.5 - slot.y) * 420}px`,
        '--preview-rotate-from': `${slot.rotation}deg`,
        '--preview-rotate-to': `${slot.rotation * 0.18}deg`,
        '--preview-focus-scale': `${slot.scale * 4.15}`,
        '--preview-focus-z': `${clamp(Math.abs(slot.z ?? -180) * 0.28, 116, 228)}px`,
      }}
      aria-label={entry.fileName}
    >
      <svg className="portfolio-preview__svg" viewBox="-80 -80 160 160" aria-hidden="true">
        <g className="portfolio-preview__core">
          {previewNodes.map((node, index) => {
            const curve = 5 + jitter(node.seed + 33, 8) + (0.5 - node.depth) * 12;
            const midX = node.x * 0.48 + curve * 0.18;
            const midY = node.y * 0.48 - curve * 0.22;
            const midXTwo = node.x * 0.76 - curve * 0.1;
            const midYTwo = node.y * 0.76 + curve * 0.14;
            const path = `M ${format(jitter(node.seed + 41, 1.8))} ${format(
              jitter(node.seed + 57, 1.8),
            )} C ${format(midX)} ${format(midY)} ${format(midXTwo)} ${format(midYTwo)} ${format(
              node.x,
            )} ${format(node.y)}`;

            return (
              <g key={node.id} opacity={0.46 + node.depth * 0.38 + index * 0.02}>
                <path className="portfolio-preview__bond-ghost" d={path} />
                <path className="portfolio-preview__bond-soft" d={path} />
                <path className="portfolio-preview__bond-main" d={path} />
                <g transform={`translate(${format(node.x)} ${format(node.y)}) rotate(${format(jitter(node.seed + 88, 18))})`}>
                  <path className="portfolio-preview__node-soft" d={node.outer} />
                  <path className="portfolio-preview__node-mid" d={node.mid} />
                  <path className="portfolio-preview__node-main" d={node.inner} />
                </g>
              </g>
            );
          })}

          <g transform={`rotate(${format(slot.rotation * 0.8)})`}>
            <path
              className="portfolio-preview__orbit"
              d={buildLoopPath(14.8, 2101 + slot.rotation)}
              opacity="0.46"
            />
            <path
              className="portfolio-preview__orbit"
              d={buildLoopPath(11.4, 2197 + slot.rotation)}
              opacity="0.34"
              transform="scale(0.92 0.78) rotate(18)"
            />
            {CENTER_BLOTS.map((path, index) => (
              <path
                key={`preview-blot-${index}`}
                className="portfolio-preview__center"
                d={path}
                opacity={0.5 + index * 0.12}
              />
            ))}
            {DUST.slice(0, 6).map((dot, index) => (
              <circle
                key={`preview-dust-${index}`}
                className="portfolio-preview__dust"
                cx={dot.x * 0.82}
                cy={dot.y * 0.82}
                r={dot.r * 0.92}
                opacity={0.22 + index * 0.05}
              />
            ))}
          </g>
        </g>
      </svg>
      <span className="portfolio-preview__label">{previewNodes[0]?.label ?? entry.fileName}</span>
    </div>
  );
});

const CENTER_BLOTS = [
  buildBlotPath(13.2, 501),
  buildBlotPath(10.7, 613),
  buildBlotPath(7.9, 727),
];
const CENTER_SPIN_LOOPS = [
  buildLoopPath(14.8, 811),
  buildLoopPath(12.9, 883),
];

const DUST = [
  { x: -22, y: 28, r: 1.4, opacity: 0.2 },
  { x: 10, y: -20, r: 1.2, opacity: 0.16 },
  { x: 28, y: 14, r: 1.2, opacity: 0.14 },
  { x: -36, y: -10, r: 0.95, opacity: 0.11 },
  { x: 44, y: -8, r: 1, opacity: 0.1 },
];

function SketchAtom({
  atom,
  phase,
  onPointerDown,
  onPointerEnter,
  onPointerMove,
  onPointerLeave,
}) {
  const softOpacity = 0.1 + atom.depth * 0.19 + atom.hoverMix * 0.07;
  const shadowOpacity = 0.18 + atom.depth * 0.3 + atom.hoverMix * 0.08;
  const mainOpacity = 0.3 + atom.depth * 0.48 + atom.hoverMix * 0.08;
  const scale = atom.scale * (0.86 + atom.depth * 0.1);
  const nodeScale =
    scale *
    ((atom.isSelected ? 0.92 : atom.isGroupMatch ? 0.91 : 0.9) +
      atom.hoverMix * 0.055 +
      atom.dragMix * 0.085);
  const nodeRotation =
    atom.nodeTilt + atom.position.z * 0.045 + Math.sin(phase + atom.seed) * 1.4;
  const lineLayers = [
    buildBondPath(atom, 0, phase),
    buildBondPath(atom, 1, phase),
    buildBondPath(atom, 2, phase),
  ];
  const dimFactor = atom.dimmed ? 0.18 : 1;
  const focusBoost = atom.isSelected ? 1.08 : atom.isGroupMatch ? 1.04 : 1;

  return (
    <>
      <path
        className="stroke-soft"
        d={lineLayers[2]}
        opacity={Math.min(1, softOpacity * dimFactor * focusBoost)}
        strokeWidth={0.88 + scale * 0.3}
      />
      <path
        className="stroke-shadow"
        d={lineLayers[1]}
        opacity={Math.min(1, shadowOpacity * dimFactor * focusBoost)}
        strokeWidth={1.3 + scale * 0.58}
      />
      <path
        className="stroke-main"
        d={lineLayers[0]}
        opacity={Math.min(1, mainOpacity * dimFactor * focusBoost)}
        strokeWidth={0.98 + scale * 0.46}
      />

      <g
        className="node-shell"
        transform={`translate(${format(atom.x)} ${format(atom.y)}) rotate(${format(
          nodeRotation,
        )}) scale(${format(nodeScale)})`}
      >
        <path
          className="node-soft"
          d={atom.nodePaths[0]}
          opacity={Math.min(
            1,
            (0.3 + atom.depth * 0.26 + atom.hoverMix * 0.12) * dimFactor * focusBoost,
          )}
          strokeWidth={1.08}
        />
        <path
          className="node-main"
          d={atom.nodePaths[1]}
          opacity={Math.min(
            1,
            (0.48 + atom.depth * 0.38 + atom.hoverMix * 0.08) * dimFactor * focusBoost,
          )}
          strokeWidth={1.24}
        />
        <circle
          className="node-hit"
          cx="0"
          cy="0"
          r={atom.node * 2.85}
          onPointerDown={onPointerDown}
          onPointerEnter={onPointerEnter}
          onPointerMove={onPointerMove}
          onPointerLeave={onPointerLeave}
        />
      </g>
    </>
  );
}

function SketchAura({ atom, phase }) {
  const dimFactor = atom.dimmed ? 0.12 : 1;
  const focusBoost = atom.isSelected ? 1.18 : atom.isGroupMatch ? 1.08 : 1;

  return (
    <path
      className="aura-line"
      d={buildBondPath(atom, 0, phase)}
      opacity={Math.min(
        0.22,
        (0.03 + atom.depth * 0.04 + atom.dragMix * 0.05) * dimFactor * focusBoost,
      )}
      strokeWidth={5.4 + atom.scale * 2.5}
    />
  );
}

function AtomLabel({ atom }) {
  const length = Math.hypot(atom.x, atom.y) || 1;
  const direction = {
    x: atom.x / length,
    y: atom.y / length,
  };
  const anchor =
    direction.x > 0.24 ? 'start' : direction.x < -0.24 ? 'end' : 'middle';
  const baseX = direction.x > 0.24 ? 10 : direction.x < -0.24 ? -10 : 0;
  const noteX = atom.x + direction.x * atom.labelOffset;
  const noteY = atom.y + direction.y * atom.labelOffset + jitter(atom.seed + 601, 4);
  const opacity =
    (0.48 + atom.depth * 0.32 + atom.hoverMix * 0.08) *
    (atom.dimmed ? 0.24 : atom.isSelected ? 1.06 : atom.isGroupMatch ? 1.03 : 1);

  return (
    <g
      className="label-note"
      transform={`translate(${format(noteX)} ${format(noteY)}) rotate(${format(
        atom.labelTilt + direction.x * 4,
      )})`}
      opacity={opacity}
    >
      <text className="label-main" textAnchor={anchor} x={baseX} y="-2">
        {atom.label}
      </text>
      {atom.detail ? (
        <text className="label-detail" textAnchor={anchor} x={baseX} y="13">
          {atom.detail}
        </text>
      ) : null}
    </g>
  );
}

function SketchGearIcon() {
  return (
    <svg className="settings-gear__icon" viewBox="0 0 48 48" aria-hidden="true">
      <path
        className="settings-gear__outline-soft"
        d="M24.2 7.1l3.2.9 1.4 4.5 4.4-.1 2.3 3-1.8 4.2 3.5 2.4-.8 4-4 1.4-.5 4.2-3.5 2.2-3.7-2.1-3.9 2.3-3.2-2.4.2-4.2-4-1.6-.8-3.7 3.1-2.9-1.8-4.1 2.7-3.2 4.3.2 1.5-4.6z"
      />
      <path
        className="settings-gear__outline-main"
        d="M24.4 6.4l3.5 1 1.3 4.6 4.3.1 2.5 3.1-1.9 4 3.2 2.6-.6 4.1-4.2 1.2-.4 4.3-3.6 2.4-3.6-2.2-4 2.3-3.1-2.7.2-4.1-4.2-1.5-.6-3.8 3.2-2.8-2-4 2.6-3.3 4.4.3 1.4-4.6z"
      />
      <path
        className="settings-gear__center-soft"
        d="M24.3 16.8c4.3-.1 7.1 3.1 7 7.2 0 4.1-2.9 7.1-7 7-3.9 0-6.9-2.9-6.9-7 .1-4.1 3-7.2 6.9-7.2z"
      />
      <path
        className="settings-gear__center-main"
        d="M24.2 17.6c3.8 0 6.2 2.9 6.2 6.5 0 3.7-2.4 6.4-6.1 6.4-3.6 0-6.2-2.6-6.2-6.4s2.5-6.5 6.1-6.5z"
      />
    </svg>
  );
}

function SketchPlusIcon() {
  return (
    <svg className="tool-plus__icon" viewBox="0 0 48 48" aria-hidden="true">
      <path
        className="tool-plus__stroke-soft"
        d="M22.7 8.8L28.5 9.2L28.1 20.3L39 20.7L38.6 27.9L27.7 27.5L27.4 39.1L20.8 38.7L21.2 27.2L9.7 27.4L9.2 20.9L21.7 20.6L22.7 8.8Z"
      />
      <path
        className="tool-plus__stroke-main"
        d="M23.6 8.1L28 8.4L27.8 21.2L39.2 21.3L38.9 26.8L27.4 27L27.1 39.8L21.2 39.3L21.7 26.6L8.8 26.9L8.5 21.6L22.1 21.3L23.6 8.1Z"
      />
      <path
        className="tool-plus__stroke-soft"
        d="M22.5 8.9L28.3 9.4L27.9 20.9L39.1 20.6L38.8 27.4L27.6 27.6L27.2 39.2L20.7 38.8L21 27.3L9.5 27.6L9.1 20.8L21.9 20.8L22.5 8.9Z"
      />
    </svg>
  );
}

function SketchUploadArrowIcon() {
  return (
    <svg className="upload-arrow__icon" viewBox="0 0 48 48" aria-hidden="true">
      <path
        className="upload-arrow__stroke-soft"
        d="M23.1 7.8L30.1 15.6L27.2 15.1L27.4 28.9L21.2 28.6L21.4 15.4L18 15.7L23.1 7.8Z"
      />
      <path
        className="upload-arrow__stroke-main"
        d="M23.7 7.1L29.7 14.6L26.6 14.2L26.7 30.3L21.7 30L21.8 14.6L18.2 15L23.7 7.1Z"
      />
      <path
        className="upload-arrow__stroke-soft"
        d="M12 31.4L15.7 35.2L31.8 35.4L35.6 31.7"
      />
      <path
        className="upload-arrow__stroke-main"
        d="M12.8 30.6L15.9 33.9L31.4 34L34.9 30.8"
      />
      <path
        className="upload-arrow__stroke-soft"
        d="M15.6 34.8L15.2 38L32 38.2L31.7 35"
      />
      <path
        className="upload-arrow__stroke-main"
        d="M16.1 34.1L15.8 37.1L31.4 37.2L31.2 34.3"
      />
    </svg>
  );
}

function SketchBurstIcon() {
  return (
    <svg className="group-dock__burst-icon" viewBox="0 0 48 48" aria-hidden="true">
      <path
        className="group-dock__burst-soft"
        d="M24.2 5.8L26.8 18L34.8 12.6L30.1 21L41.7 19.2L30.9 24.2L33.2 33.4L26 28.8L24.8 42.7L21.5 29.2L14.2 34.3L18.8 26.1L6.2 24.2L18.2 22.1L11.2 15.3L21.2 18.8Z"
      />
      <path
        className="group-dock__burst-main"
        d="M24.1 6.6L26.1 17.4L33.8 12.4L29.6 20.9L40 19.6L30.4 24.1L32.4 32.2L25.8 28L24.7 40.9L21.8 28.7L15.1 33.4L19.1 25.9L7.6 24L18.5 22L12.2 15.8L21.5 19Z"
      />
      <path
        className="group-dock__burst-core"
        d="M24.4 7.3L26.5 18.4L34 13.5L29.5 21.8L39.1 20.5L30.1 24.5L31.9 31.4L25.8 27.6L24.8 39.6L22.1 28.2L15.8 32.6L19.6 25.6L9 23.9L18.9 22.2L13 16.6L21.7 19.5Z"
        opacity="0.86"
      />
    </svg>
  );
}

function FloatingGroupDock({
  anchorRef,
  anchorPosition,
  options,
  activeKey,
  spawn,
  resetSignal,
  visible = true,
  layerStyle,
  onAnchorPositionChange,
  onChange,
  onInteract,
}) {
  const dockRef = useRef(null);
  const hasUserMovedRef = useRef(false);
  const storageKey = STORAGE_KEYS.groupDockPosition;
  const pressRef = useRef({
    pointerId: null,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    lastX: 0,
    lastY: 0,
    pressAt: 0,
    dragStarted: false,
    action: 'toggle',
    holdTimer: null,
  });
  const [expanded, setExpanded] = useState(false);
  const [dragging, setDragging] = useState(false);
  const anchoredPosition = () => {
    if (typeof window === 'undefined') {
      return { x: 0, y: 0 };
    }

    const dockSize = groupDockSizeFor(window.innerWidth);
    const triggerSize = toolTriggerSizeFor(window.innerWidth);
    if (anchorPosition) {
      return stackDockBelow(
        anchorPosition.x,
        anchorPosition.y,
        triggerSize,
        dockSize,
        window.innerWidth,
        window.innerHeight,
      );
    }

    const rect = anchorRef?.current?.getBoundingClientRect();

    if (!rect) {
      const inset = uiInsetFor(window.innerWidth);
      return stackDockBelow(
        inset,
        inset,
        triggerSize,
        dockSize,
        window.innerWidth,
        window.innerHeight,
      );
    }

    return stackDockBelowRect(
      rect,
      triggerSize,
      dockSize,
      window.innerWidth,
      window.innerHeight,
    );
  };
  const [position, setPosition] = useState(() => {
    const storedPosition = readStoredPosition(storageKey);
    if (storedPosition) {
      hasUserMovedRef.current = true;
      return storedPosition;
    }

    return anchoredPosition();
  });

  const clampDockPosition = (nextX, nextY) => {
    const margin = 18;
    const width = dockRef.current?.offsetWidth ?? 64;
    const height = dockRef.current?.offsetHeight ?? 64;

    return {
      x: clamp(nextX, margin, window.innerWidth - width - margin),
      y: clamp(nextY, margin, window.innerHeight - height - margin),
    };
  };

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const syncPosition = () => {
      setPosition((current) => {
        const next = clampDockPosition(current.x, current.y);
        if (hasUserMovedRef.current) {
          return next;
        }

        const anchored = anchoredPosition();
        return clampDockPosition(anchored.x, anchored.y);
      });
    };

    const frameId = window.requestAnimationFrame(syncPosition);
    window.addEventListener('resize', syncPosition);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', syncPosition);
    };
  }, [anchorRef, anchorPosition?.x, anchorPosition?.y, expanded]);

  useEffect(() => {
    if (!hasUserMovedRef.current) {
      onAnchorPositionChange?.(position);
    }
  }, [onAnchorPositionChange, position]);

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      dragging ||
      !hasUserMovedRef.current
    ) {
      return;
    }

    writeStoredPosition(storageKey, position);
  }, [dragging, position, storageKey]);

  useEffect(() => {
    if (!spawn) {
      return;
    }

    hasUserMovedRef.current = true;
    setExpanded(true);
    setPosition((current) => clampDockPosition(spawn.x ?? current.x, spawn.y ?? current.y));
  }, [spawn?.session]);

  useEffect(() => {
    if (!resetSignal) {
      return;
    }

    hasUserMovedRef.current = false;
    clearStoredPosition(storageKey);
    setExpanded(false);
    const anchored = anchoredPosition();
    setPosition(clampDockPosition(anchored.x, anchored.y));
  }, [resetSignal, storageKey]);

  const beginDrag = () => {
    if (pressRef.current.pointerId === null) {
      return;
    }

    window.clearTimeout(pressRef.current.holdTimer);
    pressRef.current.holdTimer = null;
    pressRef.current.dragStarted = true;
    hasUserMovedRef.current = true;
    setDragging(true);
    document.body.style.cursor = 'grabbing';
    setPosition(
      clampDockPosition(
        pressRef.current.originX + (pressRef.current.lastX - pressRef.current.startX),
        pressRef.current.originY + (pressRef.current.lastY - pressRef.current.startY),
      ),
    );
  };

  const clearPress = () => {
    window.clearTimeout(pressRef.current.holdTimer);
    pressRef.current.pointerId = null;
    pressRef.current.dragStarted = false;
    pressRef.current.action = 'toggle';
    pressRef.current.holdTimer = null;
    setDragging(false);
    document.body.style.cursor = '';
  };

  useEffect(() => {
    const handleWindowPointerMove = (event) => {
      if (pressRef.current.pointerId !== event.pointerId) {
        return;
      }

      pressRef.current.lastX = event.clientX;
      pressRef.current.lastY = event.clientY;
      const deltaX = event.clientX - pressRef.current.startX;
      const deltaY = event.clientY - pressRef.current.startY;
      const distanceSquared = deltaX * deltaX + deltaY * deltaY;
      const action = pressRef.current.action;
      const dragDistanceThreshold = action === 'toggle' ? 36 : 9;
      const shouldStartDrag =
        distanceSquared > dragDistanceThreshold ||
        (action !== 'toggle' && performance.now() - pressRef.current.pressAt > 140);

      if (!pressRef.current.dragStarted) {
        if (shouldStartDrag) {
          beginDrag();
        } else {
          return;
        }
      }

      event.preventDefault();
      onInteract();
      setPosition(
        clampDockPosition(
          pressRef.current.originX + deltaX,
          pressRef.current.originY + deltaY,
        ),
      );
    };

    const handleWindowPointerUp = (event) => {
      if (pressRef.current.pointerId !== event.pointerId) {
        return;
      }

      const deltaX = event.clientX - pressRef.current.startX;
      const deltaY = event.clientY - pressRef.current.startY;
      const wasDrag = pressRef.current.dragStarted;
      const wasClick = !wasDrag && deltaX * deltaX + deltaY * deltaY < 100;
      const action = pressRef.current.action;

      clearPress();

      if (wasDrag) {
        event.preventDefault();
        return;
      }

      if (wasClick && action === 'toggle') {
        onInteract();
        setExpanded((current) => !current);
      }
    };

    const handleWindowPointerCancel = (event) => {
      if (pressRef.current.pointerId !== event.pointerId) {
        return;
      }

      clearPress();
    };

    window.addEventListener('pointermove', handleWindowPointerMove, {
      passive: false,
    });
    window.addEventListener('pointerup', handleWindowPointerUp);
    window.addEventListener('pointercancel', handleWindowPointerCancel);

    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
      window.removeEventListener('pointercancel', handleWindowPointerCancel);
      window.clearTimeout(pressRef.current.holdTimer);
    };
  }, [onInteract]);

  const startPress = (event, action, options = {}) => {
    const {
      capture = false,
      preventDefault = false,
      stopPropagation = false,
      holdDelay = 140,
    } = options;

    if (preventDefault) {
      event.preventDefault();
    }

    if (stopPropagation) {
      event.stopPropagation();
    }

    onInteract();
    if (capture) {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }
    pressRef.current.pointerId = event.pointerId;
    pressRef.current.startX = event.clientX;
    pressRef.current.startY = event.clientY;
    pressRef.current.originX = position.x;
    pressRef.current.originY = position.y;
    pressRef.current.lastX = event.clientX;
    pressRef.current.lastY = event.clientY;
    pressRef.current.pressAt = performance.now();
    pressRef.current.dragStarted = false;
    pressRef.current.action = action;
    pressRef.current.holdTimer =
      Number.isFinite(holdDelay) && holdDelay >= 0
        ? window.setTimeout(beginDrag, holdDelay)
        : null;
  };

  const handleDockPointerDown = (event) => {
    startPress(event, 'toggle', {
      capture: true,
      preventDefault: true,
      stopPropagation: true,
      holdDelay: null,
    });
  };

  const handleDockSurfacePointerDown = (event) => {
    startPress(event, 'drag', {
      capture: false,
      preventDefault: false,
      stopPropagation: true,
      holdDelay: 140,
    });
  };

  const panelSide =
    typeof window === 'undefined'
      ? 'right'
      : floatingPanelSideFor(position.x, groupDockSizeFor(window.innerWidth), window.innerWidth);

  return (
    <div
      ref={dockRef}
      className={`group-dock${panelSide === 'left' ? ' is-flipped' : ''}${expanded ? ' is-expanded' : ''}${dragging ? ' is-dragging' : ''}${visible ? '' : ' is-hidden'}`}
      style={{
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
        ...layerStyle,
      }}
    >
      <button
        type="button"
        className="group-dock__burst"
        onPointerDown={handleDockPointerDown}
        aria-expanded={expanded}
      >
        <SketchBurstIcon />
      </button>

      <div className="group-dock__row" onPointerDown={handleDockSurfacePointerDown}>
        {options.map((option) => (
          <button
            key={option.key}
            type="button"
            className={`group-dock__option${option.key === activeKey ? ' is-active' : ''}`}
            onClick={() => {
              onInteract();
              onChange(option.key);
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function HoverCard({ atom, position, language }) {
  const infoFields = buildAtomInfoFields(atom, language);

  if (!atom || !infoFields.length || !position) {
    return null;
  }

  const returnRaw = atom.detail ?? '';
  const returnIsPositive = returnRaw.startsWith('+');
  const returnIsNegative = returnRaw.startsWith('-');
  const displayFields = returnRaw
    ? infoFields.filter((field) => resolveFieldLabelKey(field.label) !== 'return')
    : infoFields;

  return (
    <aside
      className="hover-card"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      <div className="hover-card__header">
        <div className="hover-card__title-wrap">
          <strong className="hover-card__title">{atom.label}</strong>
          {returnRaw ? (
            <span
              className={`hover-card__return${returnIsPositive ? ' is-positive' : returnIsNegative ? ' is-negative' : ''}`}
            >
              {returnRaw}
            </span>
          ) : null}
        </div>
      </div>

      <div className="hover-card__list">
        {displayFields.map((field, index) => (
          <div className="hover-card__row" key={`${atom.id}-${field.label}-${index}`}>
            <span className="hover-card__label">{formatFieldLabel(field.label, language)}</span>
            <span className="hover-card__value">{translateDisplayValue(field.value, language)}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}

function SketchRadarIcon({ scorecard, axes }) {
  const center = 24;
  const radius = 14.5;
  const angleStep = (Math.PI * 2) / axes.length;
  const ringRatios = [0.5, 1];
  const axisPoints = axes.map((axis, index) => {
    const angle = -Math.PI / 2 + index * angleStep;
    return {
      key: axis.key,
      angle,
      outerX: center + Math.cos(angle) * radius,
      outerY: center + Math.sin(angle) * radius,
      value: scorecard.metrics[axis.key],
    };
  });
  const radarPoints = axisPoints.map((axis) => {
    const scaledRadius = radius * (axis.value / 100);
    return {
      x: center + Math.cos(axis.angle) * scaledRadius,
      y: center + Math.sin(axis.angle) * scaledRadius,
    };
  });
  const ringPaths = ringRatios.map((ring, index) => {
    const points = axisPoints.map((axis) => ({
      x: center + Math.cos(axis.angle) * radius * ring,
      y: center + Math.sin(axis.angle) * radius * ring,
    }));

    return {
      key: `mini-ring-${ring}`,
      soft: buildScoreSketchPolygon(points, 3001 + index * 37, 0.58 + index * 0.12),
      main: buildScoreSketchPolygon(points, 3061 + index * 37, 0.42 + index * 0.08),
    };
  });
  const axisSketches = axisPoints.map((axis, index) => ({
    key: axis.key,
    soft: buildScoreAxisPath(
      { x: center, y: center },
      { x: axis.outerX, y: axis.outerY },
      3121 + index * 19,
    ),
    main: buildScoreAxisPath(
      { x: center, y: center },
      { x: axis.outerX, y: axis.outerY },
      3181 + index * 19,
    ),
  }));

  return (
    <svg className="score-dock__icon" viewBox="0 0 48 48" aria-hidden="true">
      {ringPaths.map((ring) => (
        <g key={ring.key}>
          <path d={ring.soft} className="score-dock__icon-grid-soft" />
          <path d={ring.main} className="score-dock__icon-grid-main" />
        </g>
      ))}

      {axisSketches.map((axis) => (
        <g key={axis.key}>
          <path d={axis.soft} className="score-dock__icon-grid-soft" />
          <path d={axis.main} className="score-dock__icon-grid-main" />
        </g>
      ))}

      <path
        d={buildScoreSketchPolygon(radarPoints, 3241, 0.84)}
        className="score-dock__icon-shape-soft"
      />
      <path
        d={buildScoreSketchPolygon(radarPoints, 3301, 0.52)}
        className="score-dock__icon-shape-main"
      />
    </svg>
  );
}

function SketchSpiralIcon() {
  return (
    <svg className="spiral-glyph__icon" viewBox="0 0 48 48" aria-hidden="true">
      <path
        className="spiral-glyph__soft"
        d="M34.6 11.3C29.4 6.9 19.5 7.2 14.5 12.5C9.9 17.3 9.6 25.6 14 30.7C18.4 35.9 26.7 36.7 31.9 33.1C36.1 30.2 37.9 24.7 36 20.1C34.2 15.9 29.6 13.3 25.2 14.1C21.1 14.8 17.9 18.3 17.9 22.4C17.9 26 20.6 29.1 24.1 29.4C27.2 29.6 29.9 27.5 30.2 24.8C30.4 22.5 29.1 20.6 26.9 19.9"
      />
      <path
        className="spiral-glyph__main"
        d="M33.3 11.2C28.8 7.5 20.1 7.5 15.1 12.1C10.2 16.6 9.9 24.8 14 30.1C18.1 35.4 26.4 36.3 31.3 32.8C35.4 29.8 37.1 24.5 35.3 20.3C33.7 16.4 29.4 14.2 25.4 14.8C21.6 15.3 18.5 18.5 18.4 22.2C18.3 25.8 20.9 28.7 24.1 28.9C27 29.1 29.5 27.1 29.8 24.6C30 22.2 28.8 20.2 26.3 19.4C24.2 18.8 21.8 19.7 20.8 21.6C19.9 23.4 20.3 25.7 21.9 27C23.3 28.1 25.5 28.1 26.9 27"
      />
      <path
        className="spiral-glyph__highlight"
        d="M33.1 11.8C28.5 8.1 20.3 8 15.8 12.5C11.5 16.9 11.2 24.6 14.8 29.3C18.5 34.1 25.9 35 30.6 31.9C34.4 29.4 35.9 24.7 34.4 20.7C33 17.1 29.1 15.1 25.6 15.6C22.3 16 19.6 18.8 19.4 22C19.2 25 21.3 27.5 24.1 27.9C26.7 28.1 28.7 26.4 28.9 24.3C29.1 22.4 28 20.8 26 20.1"
      />
    </svg>
  );
}

function PortfolioScoreCard({
  scorecard,
  axes,
  language,
  className = 'score-panel',
  onPointerDown,
}) {
  const [hoveredMetricKey, setHoveredMetricKey] = useState(null);
  const center = 104;
  const radius = 74;
  const angleStep = (Math.PI * 2) / axes.length;
  const rings = [0.25, 0.5, 0.75, 1];
  const text = textFor(language);
  const axisPoints = axes.map((axis, index) => {
    const angle = -Math.PI / 2 + index * angleStep;
    const outerX = center + Math.cos(angle) * radius;
    const outerY = center + Math.sin(angle) * radius;
    const labelRadius = radius + 8;
    const sin = Math.sin(angle);
    const cos = Math.cos(angle);
    const verticalOffset = sin > 0.82 ? 4 : sin < -0.82 ? -3 : 0;
    const horizontalOffset = cos > 0.82 ? 2 : cos < -0.82 ? -2 : 0;

    return {
      ...axis,
      angle,
      outerX,
      outerY,
      labelX: center + cos * labelRadius + horizontalOffset,
      labelY: center + sin * labelRadius + verticalOffset,
      value: scorecard.metrics[axis.key],
    };
  });
  const ringPaths = rings.map((ring, ringIndex) => {
    const ringPoints = axisPoints.map((axis) => ({
      x: center + Math.cos(axis.angle) * radius * ring,
      y: center + Math.sin(axis.angle) * radius * ring,
    }));

    return {
      key: `ring-${ring}`,
      soft: buildScoreSketchPolygon(ringPoints, 901 + ringIndex * 17, 0.95 + ringIndex * 0.28),
      main: buildScoreSketchPolygon(ringPoints, 933 + ringIndex * 17, 0.74 + ringIndex * 0.22),
    };
  });
  const axisSketches = axisPoints.map((axis, index) => ({
    key: axis.key,
    soft: buildScoreAxisPath(
      { x: center, y: center },
      { x: axis.outerX, y: axis.outerY },
      1101 + index * 23,
    ),
    main: buildScoreAxisPath(
      { x: center, y: center },
      { x: axis.outerX, y: axis.outerY },
      1163 + index * 23,
    ),
  }));
  const radarPoints = axisPoints.map((axis) => {
    const scaledRadius = radius * (axis.value / 100);
    return {
      ...axis,
      x: center + Math.cos(axis.angle) * scaledRadius,
      y: center + Math.sin(axis.angle) * scaledRadius,
    };
  });
  const radarPathSoft = buildScoreSketchPolygon(
    radarPoints.map(({ x, y }) => ({ x, y })),
    1407,
    1.95,
  );
  const radarPathMain = buildScoreSketchPolygon(
    radarPoints.map(({ x, y }) => ({ x, y })),
    1459,
    1.08,
  );
  const hoveredAxis = axisPoints.find((axis) => axis.key === hoveredMetricKey) ?? null;
  const scoreHintTransform = hoveredAxis
    ? hoveredAxis.labelY < center - 18
      ? 'translate(-50%, 0.9rem)'
      : hoveredAxis.labelY > center + 18
        ? 'translate(-50%, -115%)'
        : hoveredAxis.labelX > center + 18
          ? 'translate(-100%, -55%)'
          : hoveredAxis.labelX < center - 18
            ? 'translate(0, -55%)'
            : 'translate(-50%, -115%)'
    : '';

  return (
    <aside className={className} onPointerDown={onPointerDown} aria-label={text.heatmapChartAria}>
      <div className="score-chart-wrap">
        <svg className="score-chart" viewBox="0 0 208 208" role="img" aria-label={text.scoreChartAria}>
          <g className="score-grid">
            {ringPaths.map((ring) => {
              return (
                <g key={ring.key}>
                  <path d={ring.soft} className="score-grid-ring-soft" />
                  <path d={ring.main} className="score-grid-ring" />
                </g>
              );
            })}

            {axisSketches.map((axis) => (
              <g key={`axis-${axis.key}`}>
                <path className="score-grid-axis-soft" d={axis.soft} />
                <path className="score-grid-axis" d={axis.main} />
              </g>
            ))}
          </g>

          <path className="score-shape-soft" d={radarPathSoft} />
          <path className="score-shape-main" d={radarPathMain} />
          <path className="score-shape-ghost" d={radarPathSoft} />

          {radarPoints.map((axis, index) => {
            return (
              <g key={`point-${axis.key}`} transform={`translate(${format(axis.x)} ${format(axis.y)})`}>
                <path className="score-point-soft" d={buildLoopPath(3.15, 1701 + index * 37)} />
                <path className="score-point-main" d={buildLoopPath(2.42, 1759 + index * 37)} />
                <circle className="score-point-core" cx="0" cy="0" r="1.3" />
                <circle
                  className="score-point-hit"
                  cx="0"
                  cy="0"
                  r="10"
                  onPointerEnter={() => setHoveredMetricKey(axis.key)}
                  onPointerLeave={() => setHoveredMetricKey((current) => (current === axis.key ? null : current))}
                />
              </g>
            );
          })}

          <text className="score-center-value" x={center} y={center + 4} textAnchor="middle">
            {scorecard.overall}
          </text>

          {axisPoints.map((axis) => (
            <text
              key={`label-${axis.key}`}
              className="score-axis-label"
              x={axis.labelX}
              y={axis.labelY}
              textAnchor={
                Math.abs(axis.labelX - center) < 8 ? 'middle' : axis.labelX > center ? 'start' : 'end'
              }
            >
              {axis.label}
            </text>
          ))}
        </svg>

        {hoveredAxis ? (
          <div
            className="score-hint"
            style={{
              left: `${(hoveredAxis.outerX / 208) * 100}%`,
              top: `${(hoveredAxis.outerY / 208) * 100}%`,
              transform: scoreHintTransform,
            }}
          >
            <strong className="score-hint__title">
              {hoveredAxis.label} {hoveredAxis.value}
              {language === 'en' ? ` ${text.scorePointUnit}` : text.scorePointUnit}
            </strong>
            <p className="score-hint__body">{scorecard.explanations?.[hoveredAxis.key]}</p>
          </div>
        ) : null}
      </div>
    </aside>
  );
}

function SketchHeatmapIcon({ heatmap }) {
  const cells = heatmap.cells ?? [];
  const positiveCells = cells.filter((cell) => cell.positive);
  const negativeCells = cells.filter((cell) => cell.negative);
  const positiveGlow = positiveCells.length
    ? positiveCells.reduce(
        (sum, cell) => sum + (cell.positiveIntensity ?? cell.intensity ?? 0.36),
        0,
      ) / positiveCells.length
    : 0.22;
  const negativeWeight = negativeCells.length
    ? negativeCells.reduce(
        (sum, cell) => sum + (cell.negativeIntensity ?? cell.intensity ?? 0.22),
        0,
      ) / negativeCells.length
    : 0.1;
  const lineOpacity = Math.min(0.96, 0.52 + positiveGlow * 0.34 - negativeWeight * 0.08);
  const softOpacity = Math.min(0.7, 0.2 + positiveGlow * 0.28);
  const bladeShapes = [
    {
      key: 'left-short',
      soft: 'M11.4 39.6C11.1 33.2 11.8 28.2 15.4 22.4C18.8 24.4 21.5 29.2 23.6 35.7',
      main: 'M12.2 39.1C12.1 33.5 12.8 29 15.8 23.9C18.6 26.1 20.8 30 22.8 35.2',
    },
    {
      key: 'left-tall',
      soft: 'M17.4 36.6C16.8 27.1 17.8 19.4 21.1 8.2C24.4 12.2 26.2 19.8 27 35.4',
      main: 'M18.2 35.9C17.8 27.5 18.7 20.6 21.6 10C24.1 13.8 25.5 20.7 26.1 34.7',
    },
    {
      key: 'right-tall',
      soft: 'M26.4 35.5C27.3 27.4 29.1 21.1 34.8 15.6C36.6 20 36.6 27.2 33.9 35.7',
      main: 'M27 34.8C28 27.7 29.9 22.4 34.3 17.2C35.6 21.3 35.5 27.5 33.2 35.1',
    },
    {
      key: 'right-short',
      soft: 'M31.8 39.7C32.1 35.1 33.6 31.8 38.8 28.1C40.2 30.4 39.4 34.8 35.9 39.3',
      main: 'M32.4 39.1C32.8 35.2 34.1 32.4 38.1 29.5C39.1 31.7 38.5 35.2 35.6 38.8',
    },
  ];
  const baseCurves = {
    soft: 'M12.5 39.7L17.2 35.8L23.7 35.8L26.1 33.7L28.9 35.8L34.7 35.9L39 32.8L37.2 37.8L36.4 41.1L19.4 41.1L13.7 41Z',
    main: 'M13.4 39.4L17.8 36.4L23.9 36.4L26.2 34.5L28.7 36.4L34.3 36.4L38 33.8L36.3 38.1L35.6 40.3L19.7 40.4L14.5 40.4Z',
  };

  return (
    <svg className="heatmap-dock__icon" viewBox="0 0 48 48" aria-hidden="true">
      {bladeShapes.map((blade, index) => (
        <g key={blade.key}>
          <path
            d={blade.soft}
            className="heatmap-dock__grass-blade-soft"
            opacity={softOpacity - index * 0.022}
          />
          <path
            d={blade.main}
            className="heatmap-dock__grass-blade-main"
            opacity={lineOpacity - index * 0.014}
          />
        </g>
      ))}
      <path d={baseCurves.soft} className="heatmap-dock__grass-blade-soft" opacity={softOpacity * 0.92} />
      <path d={baseCurves.main} className="heatmap-dock__grass-blade-main" opacity={lineOpacity * 0.94} />
    </svg>
  );
}

function HeatmapCard({
  heatmap,
  language,
  className = 'heatmap-panel',
  onPointerDown,
}) {
  const latestDataCell = [...heatmap.cells].reverse().find((cell) => cell.hasData) ?? null;
  const [activeKey, setActiveKey] = useState(latestDataCell?.key ?? null);
  const text = textFor(language);

  useEffect(() => {
    setActiveKey((current) =>
      heatmap.cells.some((cell) => cell.key === current && cell.hasData)
        ? current
        : latestDataCell?.key ?? null,
    );
  }, [heatmap, latestDataCell]);

  const activeCell =
    heatmap.cells.find((cell) => cell.key === activeKey && cell.hasData) ?? latestDataCell;
  const dayLabels =
    language === 'en'
      ? [
          { label: 'Mon', row: 1 },
          { label: 'Wed', row: 3 },
          { label: 'Fri', row: 5 },
        ]
      : [
          { label: '월', row: 1 },
          { label: '수', row: 3 },
          { label: '금', row: 5 },
        ];
  const legendSteps = [0.1, 0.28, 0.46, 0.68, 0.92];

  return (
    <aside className={className} onPointerDown={onPointerDown} aria-label={text.heatmapChartAria}>
      {heatmap.entriesCount ? (
        <>
          <div
            className="heatmap-panel__months"
            style={{ gridTemplateColumns: `repeat(${heatmap.weeks}, var(--heat-cell-size))` }}
          >
            {heatmap.monthLabels.map((month) => (
              <span
                key={`month-${month.index}`}
                className="heatmap-panel__month"
                style={{ gridColumnStart: month.index + 1 }}
              >
                {formatHeatmapMonthLabel(month.date, language)}
              </span>
            ))}
          </div>

          <div className="heatmap-panel__body">
            <div className="heatmap-panel__days">
              {dayLabels.map((day) => (
                <span
                  key={day.label}
                  className="heatmap-panel__day"
                  style={{ gridRowStart: day.row }}
                >
                  {day.label}
                </span>
              ))}
            </div>

            <div
              className="heatmap-panel__grid"
              style={{ gridTemplateColumns: `repeat(${heatmap.weeks}, var(--heat-cell-size))` }}
            >
              {heatmap.cells.map((cell, index) => (
                <div
                  key={cell.key}
                  className={`heatmap-panel__cell${cell.positive ? ' is-positive' : ''}${
                    cell.negative ? ' is-negative' : ''
                  }${cell.hasData ? ' has-data' : ''}${cell.key === activeKey ? ' is-active' : ''}`}
                  style={{
                    gridColumnStart: Math.floor(index / 7) + 1,
                    gridRowStart: (index % 7) + 1,
                    '--heat-alpha': cell.positive
                      ? (0.14 + (cell.positiveIntensity ?? cell.intensity) * 0.84).toFixed(3)
                      : 0,
                    '--heat-dark-alpha': cell.negative
                      ? (0.16 + (cell.negativeIntensity ?? cell.intensity) * 0.8).toFixed(3)
                      : 0,
                    borderRadius: `${1 + Math.round(noise(3901 + index * 7) * 2.2)}px`,
                  }}
                  onPointerEnter={() => {
                    if (cell.hasData) {
                      setActiveKey(cell.key);
                    }
                  }}
                />
              ))}
            </div>
          </div>

          <div className="heatmap-panel__footer">
            <div className="heatmap-panel__meta">
              {activeCell ? (
                <>
                  <span>{formatHeatmapDateLabel(activeCell.date, language)}</span>
                  <strong>{formatHeatmapValue(activeCell.value, heatmap.valueMode)}</strong>
                </>
              ) : null}
            </div>

            <div className="heatmap-panel__legend" aria-hidden="true">
              <span className="heatmap-panel__legend-label">{text.heatmapLess}</span>
              <div className="heatmap-panel__legend-scale">
                {legendSteps.map((step, index) => (
                  <span
                    key={`legend-step-${step}`}
                    className={`heatmap-panel__legend-cell${
                      index === 0 ? ' is-negative' : ''
                    }`}
                    style={{
                      '--legend-alpha': step.toFixed(3),
                      '--legend-dark-alpha': (0.28 + step * 0.54).toFixed(3),
                    }}
                  />
                ))}
              </div>
              <span className="heatmap-panel__legend-label">{text.heatmapMore}</span>
            </div>
          </div>
        </>
      ) : (
        <p className="heatmap-panel__empty">{text.heatmapEmpty}</p>
      )}
    </aside>
  );
}

function PortfolioAllocationRing({
  allocation,
  language,
  hoverInfo = null,
  setSegmentHover,
  clearSegmentHover,
  interactive = false,
  className = 'allocation-chart',
  decorative = false,
  compact = false,
}) {
  const text = textFor(language);
  const center = 96;
  const radius = 58;
  const segmentGapAngle = allocation.segments.length > 1 ? 0.068 : 0;
  const trackPathSoft = buildAllocationArcPath({
    centerX: center,
    centerY: center,
    radius,
    startAngle: 0.02,
    endAngle: Math.PI * 2 - 0.04,
    seed: 9123,
    wobble: 2.8,
  });
  const trackPathMain = buildAllocationArcPath({
    centerX: center,
    centerY: center,
    radius: radius - 0.6,
    startAngle: 0.04,
    endAngle: Math.PI * 2 - 0.02,
    seed: 9277,
    wobble: 2.1,
  });
  let offset = 0;

  return (
    <svg
      className={className}
      viewBox="0 0 192 192"
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : text.allocationChartAria}
      aria-hidden={decorative || undefined}
    >
      <g className="allocation-chart__base">
        <circle className="allocation-chart__glow" cx={center} cy={center} r="72" />
        <path className="allocation-chart__track-soft" d={trackPathSoft} />
        <path className="allocation-chart__track" d={trackPathMain} />
      </g>

      {allocation.segments.map((segment, index) => {
        const palette = ALLOCATION_SEGMENT_PALETTE[index % ALLOCATION_SEGMENT_PALETTE.length];
        const isHovered = interactive && hoverInfo?.segmentId === segment.id;
        const isDimmed = interactive && hoverInfo?.segmentId && !isHovered;
        const startAngle = -Math.PI / 2 + offset * Math.PI * 2 + segmentGapAngle * 0.5;
        const endAngle =
          -Math.PI / 2 + (offset + segment.weight) * Math.PI * 2 - segmentGapAngle * 0.5;
        const softPath = buildAllocationArcPath({
          centerX: center,
          centerY: center,
          radius: radius + 0.8,
          startAngle,
          endAngle,
          seed: 1103 + index * 79,
          wobble: 3.3,
        });
        const mainPath = buildAllocationArcPath({
          centerX: center,
          centerY: center,
          radius,
          startAngle,
          endAngle,
          seed: 1277 + index * 79,
          wobble: 2.6,
        });
        const highlightPath = buildAllocationArcPath({
          centerX: center,
          centerY: center,
          radius: radius - 1.6,
          startAngle: startAngle + 0.006,
          endAngle: endAngle - 0.006,
          seed: 1411 + index * 79,
          wobble: 2.1,
        });

        offset += segment.weight;

        if (!mainPath) {
          return null;
        }

        return (
          <g
            key={segment.id}
            className={`allocation-chart__segment-group${isHovered ? ' is-active' : ''}${
              isDimmed ? ' is-dimmed' : ''
            }`}
          >
            {compact ? null : (
              <>
                <circle
                  className="allocation-chart__segment-cap"
                  cx={center + Math.cos(startAngle) * radius}
                  cy={center + Math.sin(startAngle) * radius}
                  r="1.5"
                  fill={palette.main}
                />
                <circle
                  className="allocation-chart__segment-cap"
                  cx={center + Math.cos(endAngle) * radius}
                  cy={center + Math.sin(endAngle) * radius}
                  r="1.35"
                  fill={palette.highlight}
                />
              </>
            )}
            <path
              className="allocation-chart__segment-soft"
              d={softPath}
              stroke={palette.soft}
            />
            <path
              className="allocation-chart__segment"
              d={mainPath}
              stroke={palette.main}
            />
            <path
              className="allocation-chart__segment-highlight"
              d={highlightPath}
              stroke={palette.highlight}
            />
            {interactive ? (
              <path
                className="allocation-chart__segment-hit"
                d={softPath || mainPath}
                onPointerEnter={(event) => {
                  setSegmentHover?.(segment, event.clientX, event.clientY);
                }}
                onPointerMove={(event) => {
                  setSegmentHover?.(segment, event.clientX, event.clientY);
                }}
                onPointerLeave={() => {
                  clearSegmentHover?.();
                }}
              />
            ) : null}
          </g>
        );
      })}

      <g transform={`translate(${center} ${center})`}>
        {compact ? (
          <>
            <path className="allocation-chart__core-soft" d={buildBlotPath(28.8, 8801)} />
            <path className="allocation-chart__core-main" d={buildBlotPath(25.2, 8947)} />
            <path className="allocation-chart__core-ring" d={buildLoopPath(24.1, 9193)} />
          </>
        ) : (
          <>
            <path className="allocation-chart__core-soft" d={buildBlotPath(41.5, 8801)} />
            <path className="allocation-chart__core-main" d={buildBlotPath(38.2, 8947)} />
            <path className="allocation-chart__core-ring-soft" d={buildLoopPath(39.6, 9061)} />
            <path className="allocation-chart__core-ring" d={buildLoopPath(34.8, 9193)} />
          </>
        )}
      </g>
      {compact ? null : (
        <>
          <text className="allocation-chart__center-label" x={center} y="84" textAnchor="middle">
            {text.allocationTotalReturn}
          </text>
          <text
            className={`allocation-chart__center-value${
              allocation.hasReturnData && allocation.totalReturn < 0 ? ' is-negative' : ''
            }`}
            x={center}
            y="108"
            textAnchor="middle"
          >
            {allocation.hasReturnData ? formatHeatmapValue(allocation.totalReturn, 'percent') : '—'}
          </text>
        </>
      )}
    </svg>
  );
}

function PortfolioAllocationCard({ allocation, language, onInteract, onPointerDown }) {
  const panelRef = useRef(null);
  const text = textFor(language);
  const [hoverInfo, setHoverInfo] = useState(null);

  const resolveHoverPosition = (clientX, clientY) => {
    const bounds = panelRef.current?.getBoundingClientRect();

    if (!bounds) {
      return { x: 96, y: 34 };
    }

    return {
      x: clamp(clientX - bounds.left, 84, bounds.width - 84),
      y: clamp(clientY - bounds.top - 16, 48, bounds.height - 24),
    };
  };

  const setSegmentHover = (segment, clientX, clientY) => {
    setHoverInfo({
      segmentId: segment.id,
      x: resolveHoverPosition(clientX, clientY).x,
      y: resolveHoverPosition(clientX, clientY).y,
    });
  };

  const clearSegmentHover = () => {
    setHoverInfo(null);
  };

  const hoveredSegment =
    allocation.segments.find((segment) => segment.id === hoverInfo?.segmentId) ?? null;
  const hoveredSegmentLabel = hoveredSegment
    ? hoveredSegment.isUnknown
      ? text.allocationUnknown
      : translateDisplayValue(hoveredSegment.label, language)
    : '';

  return (
    <aside
      ref={panelRef}
      className="allocation-panel"
      aria-label={text.allocationChartAria}
      onPointerDown={(event) => {
        onPointerDown?.(event);
        onInteract?.();
      }}
    >
      <div className="allocation-panel__chart-wrap">
        <PortfolioAllocationRing
          allocation={allocation}
          language={language}
          hoverInfo={hoverInfo}
          setSegmentHover={setSegmentHover}
          clearSegmentHover={clearSegmentHover}
          interactive
        />
      </div>

      {hoveredSegment && hoverInfo ? (
        <div
          className="allocation-panel__tooltip"
          style={{
            left: `${hoverInfo.x}px`,
            top: `${hoverInfo.y}px`,
          }}
        >
          <strong className="allocation-panel__tooltip-title">{hoveredSegmentLabel}</strong>
          <span className="allocation-panel__tooltip-value">
            {text.allocationShareLabel} {formatAllocationPercent(hoveredSegment.weight)}
          </span>
        </div>
      ) : null}

      <div className="allocation-panel__legend">
        {allocation.segments.map((segment, index) => {
          const palette = ALLOCATION_SEGMENT_PALETTE[index % ALLOCATION_SEGMENT_PALETTE.length];
          const label = segment.isUnknown
            ? text.allocationUnknown
            : translateDisplayValue(segment.label, language);
          const isHovered = hoverInfo?.segmentId === segment.id;
          const isDimmed = hoverInfo?.segmentId && !isHovered;

          return (
            <div
              key={`legend-${segment.id}`}
              className={`allocation-panel__legend-row${isHovered ? ' is-active' : ''}${
                isDimmed ? ' is-dimmed' : ''
              }`}
              onPointerEnter={(event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                setSegmentHover(segment, rect.left + rect.width * 0.5, rect.top);
              }}
              onPointerMove={(event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                setSegmentHover(segment, rect.left + rect.width * 0.5, rect.top);
              }}
              onPointerLeave={clearSegmentHover}
            >
              <span
                className="allocation-panel__swatch"
                style={{ '--segment-color': palette.main, '--segment-shadow': palette.glow }}
                aria-hidden="true"
              />
              <span className="allocation-panel__legend-label">{label}</span>
              <span className="allocation-panel__legend-value">{formatAllocationPercent(segment.weight)}</span>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function PortfolioAllocationWidget({
  allocation,
  language,
  anchorRef,
  anchorSelector,
  anchorPosition,
  anchorSize,
  anchorSteps = 1,
  resetSignal,
  visible = true,
  settingsOpen = false,
  layerStyle,
  onInteract,
}) {
  const text = textFor(language);
  const [open, setOpen] = useState(false);
  const pendingResetRef = useRef(0);

  const resolveAnchorRect = () =>
    anchorRef?.current?.getBoundingClientRect() ??
    (anchorSelector && typeof document !== 'undefined'
      ? document.querySelector(anchorSelector)?.getBoundingClientRect()
      : null);

  const allocationDock = useFloatingHandle({
    initialPosition: (win) => {
      const size = allocationWidgetSizeFor(win.innerWidth);
      const currentAnchorSize = anchorSize ?? scoreDockSizeFor(win.innerWidth);
      const rect = resolveAnchorRect();

      if (rect) {
        return stackDockBelowRect(
          rect,
          currentAnchorSize,
          size,
          win.innerWidth,
          win.innerHeight,
          anchorSteps,
        );
      }

      if (anchorPosition) {
        return stackDockBelow(
          anchorPosition.x,
          anchorPosition.y,
          currentAnchorSize,
          size,
          win.innerWidth,
          win.innerHeight,
          anchorSteps,
        );
      }

      const inset = uiInsetFor(win.innerWidth);

      return stackDockBelow(
        inset,
        inset,
        toolTriggerSizeFor(win.innerWidth),
        size,
        win.innerWidth,
        win.innerHeight,
        4,
      );
    },
    fallbackSize: (width) => {
      const size = allocationWidgetSizeFor(width);
      return { width: size, height: size };
    },
    measureBounds: ({ container, fallback, viewportWidth, nextX }) => {
      if (!open) {
        return fallback;
      }

      const panel = container?.querySelector('.allocation-panel');
      const panelWidth = panel?.offsetWidth ?? Math.min(13.8 * 16, viewportWidth - 32);
      const panelHeight = panel?.offsetHeight ?? 0;
      const panelOffset = (viewportWidth <= MOBILE_BREAKPOINT ? 0.34 : 0.55) * 16;
      const panelReachX = Math.max(0, panelWidth + panelOffset - fallback.width);
      const panelSide = floatingPanelSideFor(nextX ?? container?.getBoundingClientRect().left ?? 0, fallback.width, viewportWidth);

      return {
        width: fallback.width + panelReachX,
        height: Math.max(fallback.height, panelHeight + panelOffset),
        offsetX: panelSide === 'left' ? -panelReachX : 0,
        offsetY: 0,
      };
    },
    onInteract,
    onPress: () => {
      setOpen((current) => !current);
    },
    continuousFollow: true,
    storageKey: STORAGE_KEYS.allocationDockPosition,
  });

  useEffect(() => {
    if (!resetSignal) {
      return;
    }

    pendingResetRef.current = resetSignal;
    setOpen(false);
  }, [resetSignal]);

  useEffect(() => {
    if (!pendingResetRef.current || !resetSignal || typeof window === 'undefined') {
      return undefined;
    }

    let outerFrameId = 0;
    let innerFrameId = 0;

    outerFrameId = window.requestAnimationFrame(() => {
      innerFrameId = window.requestAnimationFrame(() => {
        if (pendingResetRef.current !== resetSignal) {
          return;
        }

        allocationDock.snapToInitial();
        pendingResetRef.current = 0;
      });
    });

    return () => {
      window.cancelAnimationFrame(outerFrameId);
      window.cancelAnimationFrame(innerFrameId);
    };
  }, [
    allocationDock.snapToInitial,
    anchorPosition?.x,
    anchorPosition?.y,
    anchorSteps,
    resetSignal,
  ]);

  useEffect(() => {
    if (!open || !visible) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, visible]);

  const panelSide =
    typeof window === 'undefined'
      ? 'right'
      : floatingPanelSideFor(
          allocationDock.position.x,
          allocationWidgetSizeFor(window.innerWidth),
          window.innerWidth,
        );

  return (
    <div
      ref={allocationDock.containerRef}
      className={`allocation-widget${panelSide === 'left' ? ' is-flipped' : ''}${open ? ' is-open' : ''}${allocationDock.dragging ? ' is-dragging' : ''}${visible ? '' : ' is-hidden'}`}
      style={{
        transform: `translate3d(${allocationDock.position.x}px, ${allocationDock.position.y}px, 0)`,
        ...layerStyle,
      }}
    >
      <button
        type="button"
        className={`allocation-toggle${open ? ' is-open' : ''}`}
        aria-label={text.allocationChartAria}
        aria-expanded={open}
        onPointerDown={allocationDock.handlePointerDown}
        onClick={(event) => {
          if (event.detail !== 0) {
            return;
          }

          onInteract?.();
          setOpen((current) => !current);
        }}
      >
        <PortfolioAllocationRing
          allocation={allocation}
          language={language}
          className="allocation-toggle__icon"
          decorative
          compact
        />
      </button>

      {open ? (
        <PortfolioAllocationCard
          allocation={allocation}
          language={language}
          onInteract={onInteract}
          onPointerDown={allocationDock.handleDragPointerDown}
        />
      ) : null}
    </div>
  );
}

function FloatingSpiralGlyph({ anchorRef }) {
  const anchoredPosition = () => {
    if (typeof window === 'undefined') {
      return { x: 0, y: 0 };
    }

    const width = window.innerWidth;

    return {
      x: alignedDockXFor(
        width,
        swirlDockSizeFor(width),
        anchorRef?.current?.getBoundingClientRect().width ?? 0,
      ),
      y: swirlDockYFor(width),
    };
  };
  const [position, setPosition] = useState(anchoredPosition);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const syncPosition = () => {
      setPosition(anchoredPosition());
    };

    const frameId = window.requestAnimationFrame(syncPosition);
    window.addEventListener('resize', syncPosition);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', syncPosition);
    };
  }, [anchorRef]);

  return (
    <div
      className="spiral-glyph"
      style={{
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
      }}
      aria-hidden="true"
    >
      <SketchSpiralIcon />
    </div>
  );
}

function FloatingHeatmapDock({
  anchorRef,
  anchorPosition,
  anchorSize,
  heatmap,
  language,
  visible = true,
  resetSignal,
  iconOnly = false,
  layerStyle,
  onAnchorPositionChange,
  onInteract,
}) {
  const dockRef = useRef(null);
  const hasUserMovedRef = useRef(false);
  const suppressHandleClickRef = useRef(false);
  const storageKey = STORAGE_KEYS.heatmapDockPosition;
  const pressRef = useRef({
    pointerId: null,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    lastX: 0,
    lastY: 0,
    pressAt: 0,
    dragStarted: false,
    action: 'toggle',
    holdTimer: null,
  });
  const [expanded, setExpanded] = useState(false);
  const [dragging, setDragging] = useState(false);
  const anchoredPosition = () => {
    if (typeof window === 'undefined') {
      return { x: 0, y: 0 };
    }

    const dockSize = heatmapDockSizeFor(window.innerWidth);
    const previousDockSize = anchorSize ?? scoreDockSizeFor(window.innerWidth);

    if (anchorPosition) {
      return stackDockBelow(
        anchorPosition.x,
        anchorPosition.y,
        previousDockSize,
        dockSize,
        window.innerWidth,
        window.innerHeight,
      );
    }

    const rect = anchorRef?.current?.getBoundingClientRect();

    if (rect) {
      return stackDockBelowRect(
        rect,
        toolTriggerSizeFor(window.innerWidth),
        dockSize,
        window.innerWidth,
        window.innerHeight,
        2,
      );
    }

    const inset = uiInsetFor(window.innerWidth);
    return stackDockBelow(
      inset,
      inset,
      toolTriggerSizeFor(window.innerWidth),
      dockSize,
      window.innerWidth,
      window.innerHeight,
      2,
    );
  };
  const [position, setPosition] = useState(() => {
    const storedPosition = readStoredPosition(storageKey);
    if (storedPosition) {
      hasUserMovedRef.current = true;
      return storedPosition;
    }

    return anchoredPosition();
  });

  const clampDockPosition = (nextX, nextY) => {
    const margin = 18;
    const dockSize = heatmapDockSizeFor(window.innerWidth);
    const panel = dockRef.current?.querySelector('.heatmap-panel--floating');
    const panelWidth = !iconOnly && expanded ? panel?.offsetWidth ?? 280 : 0;
    const panelSide =
      !iconOnly && expanded
        ? floatingPanelSideFor(nextX, dockSize, window.innerWidth)
        : 'right';
    const panelReachX =
      !iconOnly && expanded
        ? Math.max(0, panelWidth + (window.innerWidth <= MOBILE_BREAKPOINT ? -4 : 8))
        : 0;
    const width = dockSize + panelReachX;
    const height = !iconOnly && expanded ? Math.max(panel?.offsetHeight ?? dockSize, 208) : dockSize;
    const offsetX = panelSide === 'left' ? -panelReachX : 0;

    return {
      x: clamp(
        nextX,
        margin - offsetX,
        Math.max(margin - offsetX, window.innerWidth - width - margin - offsetX),
      ),
      y: clamp(nextY, margin, window.innerHeight - height - margin),
    };
  };

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const syncPosition = () => {
      setPosition((current) => {
        const next = clampDockPosition(current.x, current.y);
        if (hasUserMovedRef.current) {
          return next;
        }

        const anchored = anchoredPosition();
        return clampDockPosition(anchored.x, anchored.y);
      });
    };

    const frameId = window.requestAnimationFrame(syncPosition);
    window.addEventListener('resize', syncPosition);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', syncPosition);
    };
  }, [anchorRef, anchorPosition?.x, anchorPosition?.y, anchorSize, expanded, iconOnly]);

  useEffect(() => {
    if (!hasUserMovedRef.current) {
      onAnchorPositionChange?.(position);
    }
  }, [onAnchorPositionChange, position]);

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      dragging ||
      !hasUserMovedRef.current
    ) {
      return;
    }

    writeStoredPosition(storageKey, position);
  }, [dragging, position, storageKey]);

  useEffect(() => {
    if (!resetSignal) {
      return;
    }

    hasUserMovedRef.current = false;
    clearStoredPosition(storageKey);
    setExpanded(false);
    const anchored = anchoredPosition();
    setPosition(clampDockPosition(anchored.x, anchored.y));
  }, [resetSignal, storageKey]);

  const beginDrag = () => {
    if (pressRef.current.pointerId === null) {
      return;
    }

    window.clearTimeout(pressRef.current.holdTimer);
    pressRef.current.holdTimer = null;
    pressRef.current.dragStarted = true;
    hasUserMovedRef.current = true;
    suppressHandleClickRef.current = true;
    setDragging(true);
    document.body.style.cursor = 'grabbing';
    setPosition(
      clampDockPosition(
        pressRef.current.originX + (pressRef.current.lastX - pressRef.current.startX),
        pressRef.current.originY + (pressRef.current.lastY - pressRef.current.startY),
      ),
    );
  };

  const clearPress = () => {
    window.clearTimeout(pressRef.current.holdTimer);
    pressRef.current.pointerId = null;
    pressRef.current.dragStarted = false;
    pressRef.current.action = 'toggle';
    pressRef.current.holdTimer = null;
    setDragging(false);
    document.body.style.cursor = '';
  };

  useEffect(() => {
    const handleWindowPointerMove = (event) => {
      if (pressRef.current.pointerId !== event.pointerId) {
        return;
      }

      pressRef.current.lastX = event.clientX;
      pressRef.current.lastY = event.clientY;
      const deltaX = event.clientX - pressRef.current.startX;
      const deltaY = event.clientY - pressRef.current.startY;
      const distanceSquared = deltaX * deltaX + deltaY * deltaY;
      const action = pressRef.current.action;
      const dragDistanceThreshold = action === 'toggle' ? 36 : 9;
      const shouldStartDrag =
        distanceSquared > dragDistanceThreshold ||
        (action !== 'toggle' && performance.now() - pressRef.current.pressAt > 90);

      if (!pressRef.current.dragStarted) {
        if (shouldStartDrag) {
          beginDrag();
        } else {
          return;
        }
      }

      event.preventDefault();
      onInteract();
      setPosition(
        clampDockPosition(
          pressRef.current.originX + deltaX,
          pressRef.current.originY + deltaY,
        ),
      );
    };

    const handleWindowPointerUp = (event) => {
      if (pressRef.current.pointerId !== event.pointerId) {
        return;
      }

      const deltaX = event.clientX - pressRef.current.startX;
      const deltaY = event.clientY - pressRef.current.startY;
      const wasDrag = pressRef.current.dragStarted;
      const wasClick = !wasDrag && deltaX * deltaX + deltaY * deltaY < 100;
      const action = pressRef.current.action;

      clearPress();

      if (wasDrag) {
        event.preventDefault();
        return;
      }

      if (wasClick && action === 'toggle' && !iconOnly) {
        onInteract();
        suppressHandleClickRef.current = true;
        setExpanded((current) => !current);
      }
    };

    const handleWindowPointerCancel = (event) => {
      if (pressRef.current.pointerId !== event.pointerId) {
        return;
      }

      clearPress();
    };

    window.addEventListener('pointermove', handleWindowPointerMove, {
      passive: false,
    });
    window.addEventListener('pointerup', handleWindowPointerUp);
    window.addEventListener('pointercancel', handleWindowPointerCancel);

    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
      window.removeEventListener('pointercancel', handleWindowPointerCancel);
      window.clearTimeout(pressRef.current.holdTimer);
    };
  }, [expanded, iconOnly, onInteract]);

  const startPress = (event, action, options = {}) => {
    const {
      capture = false,
      preventDefault = false,
      stopPropagation = false,
      holdDelay = 90,
    } = options;

    if (preventDefault) {
      event.preventDefault();
    }

    if (stopPropagation) {
      event.stopPropagation();
    }

    onInteract();
    if (capture) {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }
    pressRef.current.pointerId = event.pointerId;
    pressRef.current.startX = event.clientX;
    pressRef.current.startY = event.clientY;
    pressRef.current.originX = position.x;
    pressRef.current.originY = position.y;
    pressRef.current.lastX = event.clientX;
    pressRef.current.lastY = event.clientY;
    pressRef.current.pressAt = performance.now();
    pressRef.current.dragStarted = false;
    pressRef.current.action = action;
    pressRef.current.holdTimer =
      Number.isFinite(holdDelay) && holdDelay >= 0
        ? window.setTimeout(beginDrag, holdDelay)
        : null;
  };

  const handleDockPointerDown = (event) => {
    startPress(event, 'toggle', {
      capture: true,
      preventDefault: false,
      stopPropagation: true,
      holdDelay: null,
    });
  };

  const handleDockClick = (event) => {
    event.stopPropagation();

    if (iconOnly || suppressHandleClickRef.current) {
      suppressHandleClickRef.current = false;
      return;
    }

    onInteract();
    setExpanded((current) => !current);
  };

  const handleDockSurfacePointerDown = (event) => {
    startPress(event, 'drag', {
      capture: false,
      preventDefault: false,
      stopPropagation: true,
      holdDelay: 90,
    });
  };

  const panelSide =
    typeof window === 'undefined'
      ? 'right'
      : floatingPanelSideFor(position.x, heatmapDockSizeFor(window.innerWidth), window.innerWidth);

  return (
    <div
      ref={dockRef}
      className={`heatmap-dock${panelSide === 'left' ? ' is-flipped' : ''}${expanded ? ' is-expanded' : ''}${dragging ? ' is-dragging' : ''}${visible ? '' : ' is-hidden'}`}
      style={{
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
        ...layerStyle,
      }}
    >
      <button
        type="button"
        className="heatmap-dock__handle"
        onPointerDown={handleDockPointerDown}
        onClick={handleDockClick}
        aria-expanded={expanded}
        aria-label={iconOnly ? textFor(language).contributionAria : textFor(language).heatmapAria}
      >
        <SketchHeatmapIcon heatmap={heatmap} />
      </button>

      {!iconOnly ? (
        <HeatmapCard
          heatmap={heatmap}
          language={language}
          className={`heatmap-panel heatmap-panel--floating${expanded ? ' is-open' : ''}`}
          onPointerDown={handleDockSurfacePointerDown}
        />
      ) : null}
    </div>
  );
}

function FloatingToolTrigger({
  anchorRef,
  anchorPosition,
  triggerRef,
  language,
  open,
  resetSignal,
  layerStyle,
  onToggle,
  onResetAlignment,
  onPositionChange,
  onInteract,
}) {
  const dockRef = useRef(null);
  const localTriggerRef = useRef(null);
  const hasUserMovedRef = useRef(false);
  const storageKey = STORAGE_KEYS.toolTriggerPosition;
  const pressRef = useRef({
    pointerId: null,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    lastX: 0,
    lastY: 0,
    pressAt: 0,
    dragStarted: false,
    holdTimer: null,
    longPressTimer: null,
    didLongPress: false,
  });
  const [dragging, setDragging] = useState(false);
  const anchoredPosition = () => {
    if (typeof window === 'undefined') {
      return { x: 0, y: 0 };
    }

    const triggerSize = scoreDockSizeFor(window.innerWidth);
    const inset = uiInsetFor(window.innerWidth);

    return {
      x: clamp(inset, inset, window.innerWidth - triggerSize - inset),
      y: clamp(inset, inset, window.innerHeight - triggerSize - inset),
    };
  };
  const [position, setPosition] = useState(() => {
    const storedPosition = readStoredPosition(storageKey);
    if (storedPosition) {
      hasUserMovedRef.current = true;
      return storedPosition;
    }

    return anchoredPosition();
  });

  const assignTriggerRef = (node) => {
    localTriggerRef.current = node;

    if (!triggerRef) {
      return;
    }

    if (typeof triggerRef === 'function') {
      triggerRef(node);
      return;
    }

    triggerRef.current = node;
  };

  const clampTriggerPosition = (nextX, nextY) => {
    const margin = 18;
    const viewportWidth = window.innerWidth;
    const triggerSize = scoreDockSizeFor(viewportWidth);
    const width = dockRef.current?.offsetWidth ?? triggerSize;
    const height = dockRef.current?.offsetHeight ?? triggerSize;
    const stackReachY = open
      ? triggerSize * 0.5 +
        toolDockStackStepFor(viewportWidth) * 4 +
        allocationWidgetSizeFor(viewportWidth) * 0.5
      : height;

    return {
      x: clamp(nextX, margin, window.innerWidth - width - margin),
      y: clamp(
        nextY,
        margin,
        Math.max(margin, window.innerHeight - margin - stackReachY),
      ),
    };
  };

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const syncPosition = () => {
      setPosition((current) => {
        const next = clampTriggerPosition(current.x, current.y);
        if (hasUserMovedRef.current) {
          return next;
        }

        const anchored = anchoredPosition();
        return clampTriggerPosition(anchored.x, anchored.y);
      });
    };

    const frameId = window.requestAnimationFrame(syncPosition);
    window.addEventListener('resize', syncPosition);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', syncPosition);
    };
  }, [anchorRef, anchorPosition?.x, anchorPosition?.y, open]);

  useEffect(() => {
    onPositionChange?.(position);
  }, [onPositionChange, position]);

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      dragging ||
      !hasUserMovedRef.current
    ) {
      return;
    }

    writeStoredPosition(storageKey, position);
  }, [dragging, position, storageKey]);

  useEffect(() => {
    if (!resetSignal) {
      return;
    }

    hasUserMovedRef.current = false;
    clearStoredPosition(storageKey);
    setPosition(clampTriggerPosition(anchoredPosition().x, anchoredPosition().y));
  }, [resetSignal, storageKey]);

  const beginDrag = () => {
    if (pressRef.current.pointerId === null) {
      return;
    }

    window.clearTimeout(pressRef.current.holdTimer);
    pressRef.current.holdTimer = null;
    pressRef.current.dragStarted = true;
    hasUserMovedRef.current = true;
    setDragging(true);
    document.body.style.cursor = 'grabbing';
    setPosition(
      clampTriggerPosition(
        pressRef.current.originX + (pressRef.current.lastX - pressRef.current.startX),
        pressRef.current.originY + (pressRef.current.lastY - pressRef.current.startY),
      ),
    );
  };

  const clearPress = () => {
    window.clearTimeout(pressRef.current.holdTimer);
    window.clearTimeout(pressRef.current.longPressTimer);
    pressRef.current.pointerId = null;
    pressRef.current.dragStarted = false;
    pressRef.current.holdTimer = null;
    pressRef.current.longPressTimer = null;
    pressRef.current.didLongPress = false;
    setDragging(false);
    document.body.style.cursor = '';
  };

  useEffect(() => {
    const handleWindowPointerMove = (event) => {
      if (pressRef.current.pointerId !== event.pointerId) {
        return;
      }

      pressRef.current.lastX = event.clientX;
      pressRef.current.lastY = event.clientY;
      const deltaX = event.clientX - pressRef.current.startX;
      const deltaY = event.clientY - pressRef.current.startY;
      const distanceSquared = deltaX * deltaX + deltaY * deltaY;

      if (!pressRef.current.dragStarted) {
        if (distanceSquared > 9) {
          window.clearTimeout(pressRef.current.longPressTimer);
          pressRef.current.longPressTimer = null;
          beginDrag();
        } else {
          return;
        }
      }

      event.preventDefault();
      onInteract();
      setPosition(
        clampTriggerPosition(
          pressRef.current.originX + deltaX,
          pressRef.current.originY + deltaY,
        ),
      );
    };

    const handleWindowPointerUp = (event) => {
      if (pressRef.current.pointerId !== event.pointerId) {
        return;
      }

      const deltaX = event.clientX - pressRef.current.startX;
      const deltaY = event.clientY - pressRef.current.startY;
      const wasDrag = pressRef.current.dragStarted;
      const wasLongPress = pressRef.current.didLongPress;
      const wasClick = !wasDrag && deltaX * deltaX + deltaY * deltaY < 100;

      clearPress();

      if (wasLongPress) {
        return;
      }

      if (wasClick) {
        onInteract();
        onToggle();
      }
    };

    const handleWindowPointerCancel = (event) => {
      if (pressRef.current.pointerId !== event.pointerId) {
        return;
      }

      clearPress();
    };

    window.addEventListener('pointermove', handleWindowPointerMove, {
      passive: false,
    });
    window.addEventListener('pointerup', handleWindowPointerUp);
    window.addEventListener('pointercancel', handleWindowPointerCancel);

    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
      window.removeEventListener('pointercancel', handleWindowPointerCancel);
      window.clearTimeout(pressRef.current.holdTimer);
      window.clearTimeout(pressRef.current.longPressTimer);
    };
  }, [onInteract, onResetAlignment, onToggle, open]);

  const handleTriggerPointerDown = (event) => {
    event.preventDefault();
    event.stopPropagation();
    onInteract();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pressRef.current.pointerId = event.pointerId;
    pressRef.current.startX = event.clientX;
    pressRef.current.startY = event.clientY;
    pressRef.current.originX = position.x;
    pressRef.current.originY = position.y;
    pressRef.current.lastX = event.clientX;
    pressRef.current.lastY = event.clientY;
    pressRef.current.pressAt = performance.now();
    pressRef.current.dragStarted = false;
    pressRef.current.didLongPress = false;
    if (open) {
      pressRef.current.longPressTimer = window.setTimeout(() => {
        pressRef.current.didLongPress = true;
        onInteract();
        onResetAlignment?.();
      }, 320);
    }
  };

  return (
    <div
      ref={dockRef}
      className={`tool-menu tool-menu--floating${open ? ' is-open' : ''}${dragging ? ' is-dragging' : ''}`}
      style={{
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
        ...layerStyle,
      }}
    >
      <button
        ref={assignTriggerRef}
        className={`tool-menu__trigger${open ? ' is-open' : ''}`}
        type="button"
        onPointerDown={handleTriggerPointerDown}
        aria-label={textFor(language).toolMenuAria}
        aria-expanded={open}
      >
        <SketchPlusIcon />
      </button>
    </div>
  );
}

function FloatingRadarDock({
  anchorRef,
  anchorPosition,
  anchorSize,
  externalDockRef,
  scorecard,
  axes,
  language,
  spawn,
  resetSignal,
  visible = true,
  layerStyle,
  onPositionChange,
  onInteract,
}) {
  const dockRef = useRef(null);
  const hasUserMovedRef = useRef(false);
  const storageKey = STORAGE_KEYS.scoreDockPosition;
  const pressRef = useRef({
    pointerId: null,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    lastX: 0,
    lastY: 0,
    pressAt: 0,
    dragStarted: false,
    action: 'toggle',
    holdTimer: null,
  });
  const [expanded, setExpanded] = useState(false);
  const [dragging, setDragging] = useState(false);
  const anchoredPosition = () => {
    if (typeof window === 'undefined') {
      return { x: 0, y: 202 };
    }

    const scoreSize = scoreDockSizeFor(window.innerWidth);
    const previousDockSize = anchorSize ?? groupDockSizeFor(window.innerWidth);
    const triggerSize = toolTriggerSizeFor(window.innerWidth);
    if (anchorPosition) {
      return stackDockBelow(
        anchorPosition.x,
        anchorPosition.y,
        previousDockSize,
        scoreSize,
        window.innerWidth,
        window.innerHeight,
      );
    }

    const rect = anchorRef?.current?.getBoundingClientRect();

    if (!rect) {
      const inset = uiInsetFor(window.innerWidth);
      return stackDockBelow(
        inset,
        inset,
        triggerSize,
        scoreSize,
        window.innerWidth,
        window.innerHeight,
        3,
      );
    }

    return stackDockBelowRect(
      rect,
      triggerSize,
      scoreSize,
      window.innerWidth,
      window.innerHeight,
      3,
    );
  };
  const [position, setPosition] = useState(() => {
    const storedPosition = readStoredPosition(storageKey);
    if (storedPosition) {
      hasUserMovedRef.current = true;
      return storedPosition;
    }

    return anchoredPosition();
  });

  const assignDockRef = (node) => {
    dockRef.current = node;

    if (!externalDockRef) {
      return;
    }

    if (typeof externalDockRef === 'function') {
      externalDockRef(node);
      return;
    }

    externalDockRef.current = node;
  };

  const clampDockPosition = (nextX, nextY, options = {}) => {
    const margin = 18;
    const dockSize = scoreDockSizeFor(window.innerWidth);
    const panel = dockRef.current?.querySelector('.score-panel--floating');
    const shouldIncludePanel = options.expanded ?? expanded;
    const panelWidth = shouldIncludePanel ? panel?.offsetWidth ?? 308 : 0;
    const panelSide = shouldIncludePanel
      ? floatingPanelSideFor(nextX, dockSize, window.innerWidth)
      : 'right';
    const panelReachX = shouldIncludePanel ? Math.max(0, panelWidth - 11.2) : 0;
    const width = dockSize + panelReachX;
    const height = shouldIncludePanel ? Math.max(panel?.offsetHeight ?? dockSize, 308) : dockSize;
    const offsetX = panelSide === 'left' ? -panelReachX : 0;

    return {
      x: clamp(
        nextX,
        margin - offsetX,
        Math.max(margin - offsetX, window.innerWidth - width - margin - offsetX),
      ),
      y: clamp(nextY, margin, window.innerHeight - height - margin),
    };
  };

  const commitPosition = (nextPosition) => {
    setPosition((current) => {
      const resolved =
        typeof nextPosition === 'function' ? nextPosition(current) : nextPosition;
      onPositionChange?.(resolved);
      return resolved;
    });
  };

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const syncPosition = () => {
      commitPosition((current) => {
        const next = clampDockPosition(current.x, current.y);
        if (hasUserMovedRef.current) {
          return next;
        }

        const anchored = anchoredPosition();
        return clampDockPosition(anchored.x, anchored.y);
      });
    };

    const frameId = window.requestAnimationFrame(syncPosition);
    window.addEventListener('resize', syncPosition);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', syncPosition);
    };
  }, [anchorRef, anchorPosition?.x, anchorPosition?.y, anchorSize, expanded]);

  useEffect(() => {
    if (!spawn) {
      return;
    }

    hasUserMovedRef.current = true;
    setExpanded(true);
    commitPosition((current) => clampDockPosition(spawn.x ?? current.x, spawn.y ?? current.y));
  }, [spawn?.session]);

  useEffect(() => {
    if (!resetSignal) {
      return;
    }

    hasUserMovedRef.current = false;
    clearStoredPosition(storageKey);
    setExpanded(false);
    const anchored = anchoredPosition();
    commitPosition(clampDockPosition(anchored.x, anchored.y));
  }, [resetSignal, storageKey]);

  useEffect(() => {
    onPositionChange?.(position);
  }, [onPositionChange, position]);

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      dragging ||
      !hasUserMovedRef.current
    ) {
      return;
    }

    writeStoredPosition(storageKey, position);
  }, [dragging, position, storageKey]);

  const beginDrag = () => {
    if (pressRef.current.pointerId === null) {
      return;
    }

    window.clearTimeout(pressRef.current.holdTimer);
    pressRef.current.holdTimer = null;
    pressRef.current.dragStarted = true;
    hasUserMovedRef.current = true;
    setDragging(true);
    document.body.style.cursor = 'grabbing';
    commitPosition(
      clampDockPosition(
        pressRef.current.originX + (pressRef.current.lastX - pressRef.current.startX),
        pressRef.current.originY + (pressRef.current.lastY - pressRef.current.startY),
      ),
    );
  };

  const clearPress = () => {
    window.clearTimeout(pressRef.current.holdTimer);
    pressRef.current.pointerId = null;
    pressRef.current.dragStarted = false;
    pressRef.current.action = 'toggle';
    pressRef.current.holdTimer = null;
    setDragging(false);
    document.body.style.cursor = '';
  };

  useEffect(() => {
    const handleWindowPointerMove = (event) => {
      if (pressRef.current.pointerId !== event.pointerId) {
        return;
      }

      pressRef.current.lastX = event.clientX;
      pressRef.current.lastY = event.clientY;
      const deltaX = event.clientX - pressRef.current.startX;
      const deltaY = event.clientY - pressRef.current.startY;
      const distanceSquared = deltaX * deltaX + deltaY * deltaY;
      const action = pressRef.current.action;
      const dragDistanceThreshold = action === 'toggle' ? 36 : 9;
      const shouldStartDrag =
        distanceSquared > dragDistanceThreshold ||
        (action !== 'toggle' && performance.now() - pressRef.current.pressAt > 90);

      if (!pressRef.current.dragStarted) {
        if (shouldStartDrag) {
          beginDrag();
        } else {
          return;
        }
      }

      event.preventDefault();
      onInteract();
      commitPosition(
        clampDockPosition(
          pressRef.current.originX + deltaX,
          pressRef.current.originY + deltaY,
        ),
      );
    };

    const handleWindowPointerUp = (event) => {
      if (pressRef.current.pointerId !== event.pointerId) {
        return;
      }

      const deltaX = event.clientX - pressRef.current.startX;
      const deltaY = event.clientY - pressRef.current.startY;
      const wasDrag = pressRef.current.dragStarted;
      const wasClick = !wasDrag && deltaX * deltaX + deltaY * deltaY < 100;
      const action = pressRef.current.action;

      clearPress();

      if (wasDrag) {
        event.preventDefault();
        return;
      }

      if (wasClick && action === 'toggle') {
        onInteract();
        setExpanded((current) => !current);
      }
    };

    const handleWindowPointerCancel = (event) => {
      if (pressRef.current.pointerId !== event.pointerId) {
        return;
      }

      clearPress();
    };

    window.addEventListener('pointermove', handleWindowPointerMove, {
      passive: false,
    });
    window.addEventListener('pointerup', handleWindowPointerUp);
    window.addEventListener('pointercancel', handleWindowPointerCancel);

    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
      window.removeEventListener('pointercancel', handleWindowPointerCancel);
      window.clearTimeout(pressRef.current.holdTimer);
    };
  }, [anchorPosition?.x, anchorPosition?.y, anchorSize, expanded, onInteract]);

  const startPress = (event, action, options = {}) => {
    const {
      capture = false,
      preventDefault = false,
      stopPropagation = false,
      holdDelay = 90,
    } = options;

    if (preventDefault) {
      event.preventDefault();
    }

    if (stopPropagation) {
      event.stopPropagation();
    }

    onInteract();
    if (capture) {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }
    pressRef.current.pointerId = event.pointerId;
    pressRef.current.startX = event.clientX;
    pressRef.current.startY = event.clientY;
    pressRef.current.originX = position.x;
    pressRef.current.originY = position.y;
    pressRef.current.lastX = event.clientX;
    pressRef.current.lastY = event.clientY;
    pressRef.current.pressAt = performance.now();
    pressRef.current.dragStarted = false;
    pressRef.current.action = action;
    pressRef.current.holdTimer =
      Number.isFinite(holdDelay) && holdDelay >= 0
        ? window.setTimeout(beginDrag, holdDelay)
        : null;
  };

  const handleDockPointerDown = (event) => {
    startPress(event, 'toggle', {
      capture: true,
      preventDefault: true,
      stopPropagation: true,
      holdDelay: null,
    });
  };

  const handleDockSurfacePointerDown = (event) => {
    startPress(event, 'drag', {
      capture: false,
      preventDefault: false,
      stopPropagation: true,
      holdDelay: 90,
    });
  };

  const panelSide =
    typeof window === 'undefined'
      ? 'right'
      : floatingPanelSideFor(position.x, scoreDockSizeFor(window.innerWidth), window.innerWidth);

  return (
    <div
      ref={assignDockRef}
      className={`score-dock${panelSide === 'left' ? ' is-flipped' : ''}${expanded ? ' is-expanded' : ''}${dragging ? ' is-dragging' : ''}${visible ? '' : ' is-hidden'}`}
      style={{
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
        ...layerStyle,
      }}
    >
      <button
        type="button"
        className="score-dock__handle"
        onPointerDown={handleDockPointerDown}
        aria-expanded={expanded}
      >
        <SketchRadarIcon scorecard={scorecard} axes={axes} />
      </button>

      <PortfolioScoreCard
        scorecard={scorecard}
        axes={axes}
        language={language}
        className={`score-panel score-panel--floating${expanded ? ' is-open' : ''}`}
        onPointerDown={handleDockSurfacePointerDown}
      />
    </div>
  );
}

function AtomSketch({
  atoms,
  pulse,
  centerMotion,
  centerClickBurst,
  standalone,
  svgRef,
  ariaLabel,
  highlightActive,
  onCenterClick,
  onPointerDown,
  onPointerEnter,
  onPointerMove,
  onPointerLeave,
}) {
  const phase = pulse * Math.PI * 2;
  const useDetailFilters = atoms.length <= LARGE_SCENE_ATOM_THRESHOLD;
  const backAtoms = atoms
    .filter((atom) => atom.position.z < 0)
    .sort((left, right) => left.position.z - right.position.z);
  const frontAtoms = atoms
    .filter((atom) => atom.position.z >= 0)
    .sort((left, right) => left.position.z - right.position.z);
  const centerGlowDrift = standalone ? (Math.sin(centerMotion * 0.56 - 0.6) * 0.5 + 0.5) : 0;
  const centerBlinkWave = standalone ? (Math.sin(centerMotion * 1.74 - 0.85) * 0.5 + 0.5) : 0;
  const centerScale = standalone
    ? 1.4 + centerClickBurst * 0.22
    : 0.985 + Math.sin(phase * 0.5) * 0.012;
  const centerBlink = standalone
    ? 0.34 + centerBlinkWave * 0.88 + centerClickBurst * 0.2
    : 1;
  const centerAuraOpacity = standalone ? 0.04 + centerBlink * 0.92 : 0;
  const centerCoreOpacity = standalone ? 0.08 + centerBlink * 0.72 : 0;
  const centerHighlightOpacity = standalone ? 0.06 + centerBlink * 0.62 : 0;
  const centerAuraScale = standalone
    ? 1 + centerClickBurst * 0.24 + centerGlowDrift * 0.04 + centerBlinkWave * 0.015
    : 1;
  const centerCoreScale = standalone ? 1 + centerClickBurst * 0.1 + centerGlowDrift * 0.02 : 1;

  return (
    <svg
      ref={svgRef}
      className="sketch-svg"
      viewBox="-320 -320 640 640"
      role="img"
      aria-label={ariaLabel}
    >
      <defs>
        <filter id="smudge" x="-25%" y="-25%" width="150%" height="150%">
          <feGaussianBlur stdDeviation="0.52" />
        </filter>
        <filter id="glow" x="-35%" y="-35%" width="170%" height="170%">
          <feGaussianBlur stdDeviation="4.8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g className="aura-layer" filter={useDetailFilters ? 'url(#glow)' : undefined}>
        {standalone ? (
          <g
            className="center-aura"
            opacity={centerAuraOpacity}
            transform={`scale(${format(centerAuraScale)} ${format(
              0.95 + centerClickBurst * 0.08 + centerGlowDrift * 0.04 + centerBlinkWave * 0.02,
            )})`}
          >
            <ellipse
              className="center-glow-outer"
              cx="0"
              cy="0"
              rx="31"
              ry="24"
              transform="rotate(-18)"
            />
            <ellipse
              className="center-glow-mid"
              cx="3"
              cy="-2"
              rx="22"
              ry="17"
              transform="rotate(11)"
              opacity="0.92"
            />
            <ellipse
              className="center-glow-core"
              cx="-4"
              cy="-7"
              rx="9"
              ry="6"
              transform="rotate(-24)"
              opacity={centerHighlightOpacity}
            />
          </g>
        ) : null}

        {backAtoms.map((atom) => (
          <SketchAura key={`back-aura-${atom.id}`} atom={atom} phase={phase} />
        ))}
        {frontAtoms.map((atom) => (
          <SketchAura key={`front-aura-${atom.id}`} atom={atom} phase={phase} />
        ))}
      </g>

      <g className="sketch-core" filter={useDetailFilters ? 'url(#smudge)' : undefined}>
        {backAtoms.map((atom) => (
          <SketchAtom
            key={`back-${atom.id}`}
            atom={atom}
            phase={phase}
            onPointerDown={(event) => onPointerDown(atom.id, event)}
            onPointerEnter={(event) => onPointerEnter(atom.id, event)}
            onPointerMove={(event) => onPointerMove(atom.id, event)}
            onPointerLeave={() => onPointerLeave(atom.id)}
          />
        ))}

        <g
          transform={`rotate(-12) scale(${format(centerScale * centerCoreScale)} ${format(
            centerScale * (0.98 + centerClickBurst * 0.04 + centerGlowDrift * 0.02),
          )})`}
        >
          {standalone ? (
            <g opacity={centerCoreOpacity}>
              <ellipse
                className="center-shell-shadow"
                cx="1"
                cy="2"
                rx="14.8"
                ry="12.3"
                transform="rotate(9)"
              />
              <ellipse
                className="center-shell-rim"
                cx="-1"
                cy="-1"
                rx="13.2"
                ry="10.9"
                transform="rotate(-13)"
              />
              <ellipse
                className="center-shell-highlight"
                cx="-5"
                cy="-7"
                rx="5.8"
                ry="4.1"
                transform="rotate(-26)"
                opacity={centerHighlightOpacity}
              />
            </g>
          ) : null}

          {standalone ? (
            <g
              opacity={0.08 + centerBlink * 0.68}
              transform={`scale(${format(1 + centerClickBurst * 0.06)} ${format(
                1.01 + centerClickBurst * 0.03 + centerGlowDrift * 0.02,
              )})`}
            >
              <path
                className="center-orbit"
                d={CENTER_SPIN_LOOPS[0]}
                transform="rotate(8) scale(0.72 1.06)"
              />
              <path
                className="center-orbit"
                d={CENTER_SPIN_LOOPS[1]}
                transform="rotate(-21) scale(1.08 0.52)"
                opacity="0.78"
              />
            </g>
          ) : null}

          <g transform={standalone ? `scale(${format(1 + centerClickBurst * 0.05)})` : undefined}>
            {CENTER_BLOTS.map((path, index) => (
              <path
                key={`blot-${index}`}
                className="center-blot"
                d={path}
                opacity={
                  (standalone
                    ? 0.46 + centerBlink * 0.78 + index * 0.02
                    : highlightActive
                      ? 0.86 + pulse * 0.08 + index * 0.015
                      : 0.68 + pulse * 0.08) * centerBlink
                }
              />
            ))}

            {DUST.map((dot, index) => (
              <circle
                key={`dust-${index}`}
                className="graphite-dust"
                cx={dot.x}
                cy={dot.y}
                r={dot.r}
                opacity={(dot.opacity + pulse * 0.04) * (standalone ? 0.34 + centerBlink * 1.18 : 1)}
              />
            ))}
          </g>

          {onCenterClick ? (
            <circle
              className="center-hit"
              cx="0"
              cy="0"
              r={standalone ? 60 : 56}
              onPointerDown={(event) => {
                event.stopPropagation();
                event.preventDefault();
                event.currentTarget.setPointerCapture?.(event.pointerId);
              }}
              onPointerUp={(event) => {
                event.stopPropagation();
                event.preventDefault();
                onCenterClick?.();
              }}
            />
          ) : null}
        </g>

        {frontAtoms.map((atom) => (
          <SketchAtom
            key={`front-${atom.id}`}
            atom={atom}
            phase={phase}
            onPointerDown={(event) => onPointerDown(atom.id, event)}
            onPointerEnter={(event) => onPointerEnter(atom.id, event)}
            onPointerMove={(event) => onPointerMove(atom.id, event)}
            onPointerLeave={() => onPointerLeave(atom.id)}
          />
        ))}
      </g>

      <g className="label-layer">
        {atoms.map((atom) => (
          <AtomLabel key={`label-${atom.id}`} atom={atom} />
        ))}
      </g>
    </svg>
  );
}

export default function App() {
  const shellRef = useRef(null);
  const svgRef = useRef(null);
  const fileInputRef = useRef(null);
  const uploadButtonRef = useRef(null);
  const uploadPlusWrapRef = useRef(null);
  const toolTriggerRef = useRef(null);
  const scoreDockRef = useRef(null);
  const settingsRef = useRef(null);
  const atomsRef = useRef(generateAtomLayout([]).map(createAtomState));
  const cameraRef = useRef(createSceneCameraRig());
  const rotationRef = useRef({
    current: new THREE.Quaternion(),
    target: new THREE.Quaternion(),
    lastTrack: new THREE.Vector3(0, 0, 1),
    spinAxis: new THREE.Vector3(0, 1, 0),
    spinVelocity: 0,
    lastDragAt: 0,
  });
  const spreadRef = useRef({ current: 0, target: 0, timeoutId: null });
  const dragRef = useRef({ atomId: null, moved: false, startX: 0, startY: 0 });
  const interactionRef = useRef({
    lastInputAt: typeof performance !== 'undefined' ? performance.now() : 0,
    hoveringAtomId: null,
    selectedAtomId: null,
  });
  const motionPreferenceRef = useRef({
    reduced: readPrefersReducedMotion(),
    visible: typeof document === 'undefined' || document.visibilityState !== 'hidden',
  });
  const frameCommitRef = useRef(0);
  const targetTiltRef = useRef({ x: 0, y: 0 });
  const currentTiltRef = useRef({ x: 0, y: 0 });
  const pendingHoverInfoRef = useRef(null);
  const [portfolioEntries, setPortfolioEntries] = useState([]);
  const [activePortfolioId, setActivePortfolioId] = useState(null);
  const [portfolioError, setPortfolioError] = useState('');
  const [portfolioErrorClosing, setPortfolioErrorClosing] = useState(false);
  const [hoveredFileEntryId, setHoveredFileEntryId] = useState(null);
  const [hoveredFileAnchorRect, setHoveredFileAnchorRect] = useState(null);
  const [toolTrayOpen, setToolTrayOpen] = useState(false);
  const [toolTriggerPosition, setToolTriggerPosition] = useState(() =>
    readStoredPosition(STORAGE_KEYS.toolTriggerPosition),
  );
  const [groupDockPosition, setGroupDockPosition] = useState(() =>
    readStoredPosition(STORAGE_KEYS.groupDockPosition),
  );
  const [heatmapDockPosition, setHeatmapDockPosition] = useState(() =>
    readStoredPosition(STORAGE_KEYS.heatmapDockPosition),
  );
  const [scoreDockPosition, setScoreDockPosition] = useState(() =>
    readStoredPosition(STORAGE_KEYS.scoreDockPosition),
  );
  const [showGroupDock, setShowGroupDock] = useState(false);
  const [showScoreDock, setShowScoreDock] = useState(false);
  const [groupDockSpawn, setGroupDockSpawn] = useState(null);
  const [scoreDockSpawn, setScoreDockSpawn] = useState(null);
  const [dockResetAt, setDockResetAt] = useState(0);
  const [activeGroupKey, setActiveGroupKey] = useState(null);
  const [selectedAtomId, setSelectedAtomId] = useState(null);
  const [hoverInfo, setHoverInfo] = useState(null);
  const [frameTime, setFrameTime] = useState(0);
  const [shootingStar, setShootingStar] = useState(null);
  const [fileDragActive, setFileDragActive] = useState(false);
  const fileDragCounterRef = useRef(0);
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  const [introCenterBurstAt, setIntroCenterBurstAt] = useState(-1);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeFloatingTool, setActiveFloatingTool] = useState(null);
  const [language, setLanguage] = useState(() => {
    if (typeof window === 'undefined') {
      return 'ko';
    }

    return readStoredOption(STORAGE_KEYS.language, LANGUAGE_OPTIONS, 'ko');
  });
  const [assetClassMode, setAssetClassMode] = useState(() =>
    readStoredOption(STORAGE_KEYS.assetClassMode, ASSET_CLASS_MODE_OPTIONS, 'auto'),
  );
  const [allocationWeightMode, setAllocationWeightMode] = useState(() =>
    readStoredOption(STORAGE_KEYS.allocationWeightMode, ALLOCATION_WEIGHT_MODE_OPTIONS, 'auto'),
  );
  const [scoreWeightPreset, setScoreWeightPreset] = useState(() =>
    readStoredOption(STORAGE_KEYS.scoreWeightPreset, SCORE_WEIGHT_PRESET_OPTIONS, 'balanced'),
  );

  const noteInteraction = () => {
    interactionRef.current.lastInputAt = performance.now();
  };

  const interactWithFloatingTool = useCallback((toolKey) => {
    noteInteraction();
    setActiveFloatingTool((current) => (current === toolKey ? current : toolKey));
  }, []);

  const floatingLayerStyleFor = useCallback(
    (toolKey) => ({
      zIndex:
        activeFloatingTool === toolKey
          ? ACTIVE_FLOATING_TOOL_Z_INDEX
          : FLOATING_TOOL_Z_INDEX[toolKey],
    }),
    [activeFloatingTool],
  );
  const interactWithSettingsTool = useCallback(
    () => interactWithFloatingTool('settings'),
    [interactWithFloatingTool],
  );
  const interactWithGroupTool = useCallback(
    () => interactWithFloatingTool('group'),
    [interactWithFloatingTool],
  );
  const interactWithHeatmapTool = useCallback(
    () => interactWithFloatingTool('heatmap'),
    [interactWithFloatingTool],
  );
  const interactWithScoreTool = useCallback(
    () => interactWithFloatingTool('score'),
    [interactWithFloatingTool],
  );
  const interactWithToolMenu = useCallback(
    () => interactWithFloatingTool('tool-menu'),
    [interactWithFloatingTool],
  );
  const interactWithAllocationTool = useCallback(
    () => interactWithFloatingTool('allocation'),
    [interactWithFloatingTool],
  );

  const openPortfolioPicker = () => {
    noteInteraction();
    fileInputRef.current?.click();
  };

  const showPortfolioError = (message) => {
    setPortfolioErrorClosing(false);
    setPortfolioError(message);
  };

  const clearPortfolioError = () => {
    setPortfolioErrorClosing(false);
    setPortfolioError('');
  };

  const clearHoveredFileTooltip = useCallback(() => {
    setHoveredFileEntryId(null);
    setHoveredFileAnchorRect(null);
  }, []);

  const openHoveredFileTooltip = useCallback(
    (entry, anchorElement) => {
      if (!entry || !anchorElement) {
        clearHoveredFileTooltip();
        return;
      }

      const bounds = anchorElement.getBoundingClientRect();
      const nextAnchorRect = {
        left: Math.round(bounds.left * 100) / 100,
        top: Math.round(bounds.top * 100) / 100,
        width: Math.round(bounds.width * 100) / 100,
        height: Math.round(bounds.height * 100) / 100,
      };

      setHoveredFileEntryId(entry.id);
      setHoveredFileAnchorRect((current) => {
        if (
          current &&
          current.left === nextAnchorRect.left &&
          current.top === nextAnchorRect.top &&
          current.width === nextAnchorRect.width &&
          current.height === nextAnchorRect.height
        ) {
          return current;
        }

        return nextAnchorRect;
      });
    },
    [clearHoveredFileTooltip],
  );

  const scheduleSecurityMetadataEnrichment = useCallback((entryId, seedItems) => {
    if (!entryId || !Array.isArray(seedItems) || !seedItems.some(hasMissingCoreMetadata)) {
      return;
    }

    void (async () => {
      let workingItems = seedItems;

      for (const delayMs of SECURITY_ENRICHMENT_RETRY_DELAYS_MS) {
        if (delayMs > 0) {
          await wait(delayMs);
        }

        try {
          const enrichment = await enrichSecurityItemsViaApi(workingItems, { force: true });
          if (!Array.isArray(enrichment?.items) || !enrichment.items.length) {
            continue;
          }

          workingItems = enrichment.items;

          setPortfolioEntries((current) =>
            current.map((entry) =>
              entry.id === entryId
                ? {
                    ...entry,
                    items: mergeSecurityMetadataItems(entry.items, enrichment.items),
                  }
                : entry,
            ),
          );

          if (!workingItems.some(hasMissingCoreMetadata)) {
            return;
          }
        } catch {
          // Keep the best available local or server-derived metadata and retry later.
        }
      }
    })();
  }, []);

  const settingsDock = useFloatingHandle({
    initialPosition: (win) => {
      const inset = uiInsetFor(win.innerWidth);
      const size = gearSizeFor(win.innerWidth);
      return {
        x: win.innerWidth - size - inset,
        y: inset,
      };
    },
    fallbackSize: (width) => {
      const size = gearSizeFor(width);
      return { width: size, height: size };
    },
    onInteract: interactWithSettingsTool,
    onPress: () => {
      setSettingsOpen((current) => !current);
    },
    storageKey: STORAGE_KEYS.settingsDockPosition,
  });

  const createDockSpawn = (rect, size) => ({
    x: rect.left + rect.width * 0.5 - size * 0.5,
    y: rect.top + rect.height * 0.5 - size * 0.5,
    session: performance.now(),
  });

  const handleSelectGroupDock = (rect) => {
    noteInteraction();
    setShowGroupDock(true);
    setGroupDockSpawn(createDockSpawn(rect, groupDockSizeFor(window.innerWidth)));
  };

  const handleSelectScoreDock = (rect) => {
    noteInteraction();
    setShowScoreDock(true);
    setScoreDockSpawn(createDockSpawn(rect, scoreDockSizeFor(window.innerWidth)));
  };

  const updateHoverInfo = (atomId, clientX, clientY) => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    pendingHoverInfoRef.current = {
      atomId,
      x: Math.round(clamp(clientX + 18, 16, viewportWidth - TOOLTIP_WIDTH - 16)),
      y: Math.round(clamp(clientY + 18, 16, viewportHeight - TOOLTIP_HEIGHT - 16)),
    };
  };

  const clientToLocalPoint = (clientX, clientY) => {
    const svg = svgRef.current;

    if (!svg) {
      return null;
    }

    const bounds = svg.getBoundingClientRect();

    if (!bounds.width || !bounds.height) {
      return null;
    }

    return {
      x: ((clientX - bounds.left) / bounds.width) * VIEWBOX_SIZE - VIEWBOX_HALF,
      y: ((clientY - bounds.top) / bounds.height) * VIEWBOX_SIZE - VIEWBOX_HALF,
    };
  };

  useEffect(() => {
    interactionRef.current.selectedAtomId = selectedAtomId;
  }, [selectedAtomId]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const motionQuery =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null;

    const syncMotionPreference = () => {
      motionPreferenceRef.current.reduced = Boolean(motionQuery?.matches);
      document.documentElement.dataset.motion = motionPreferenceRef.current.reduced
        ? 'reduced'
        : 'full';
      frameCommitRef.current = 0;
    };

    const syncVisibility = () => {
      motionPreferenceRef.current.visible = document.visibilityState !== 'hidden';
      frameCommitRef.current = 0;
    };

    syncMotionPreference();
    syncVisibility();
    document.addEventListener('visibilitychange', syncVisibility);
    if (motionQuery?.addEventListener) {
      motionQuery.addEventListener('change', syncMotionPreference);
    } else {
      motionQuery?.addListener?.(syncMotionPreference);
    }

    return () => {
      document.removeEventListener('visibilitychange', syncVisibility);
      if (motionQuery?.removeEventListener) {
        motionQuery.removeEventListener('change', syncMotionPreference);
      } else {
        motionQuery?.removeListener?.(syncMotionPreference);
      }
      delete document.documentElement.dataset.motion;
    };
  }, []);

  useEffect(() => {
    let frameId = 0;
    let last = performance.now();
    const autoRotateY = new THREE.Quaternion();
    const autoRotateX = new THREE.Quaternion();
    const spinQuaternion = new THREE.Quaternion();
    const yAxis = new THREE.Vector3(0, 1, 0);
    const xAxis = new THREE.Vector3(1, 0, 0);

    const animate = (now) => {
      const delta = Math.min((now - last) / 1000, 0.05);
      last = now;
      const motionPreference = motionPreferenceRef.current;
      const isDraggingStructure = Boolean(dragRef.current.atomId);
      const hasDragSpin = rotationRef.current.spinVelocity > 0.01;

      if (!motionPreference.visible) {
        frameId = window.requestAnimationFrame(animate);
        return;
      }

      currentTiltRef.current.x = damp(
        currentTiltRef.current.x,
        targetTiltRef.current.x,
        7,
        delta,
      );
      currentTiltRef.current.y = damp(
        currentTiltRef.current.y,
        targetTiltRef.current.y,
        7,
        delta,
      );

      if (shellRef.current) {
        shellRef.current.style.setProperty(
          '--drift-x',
          `${(motionPreference.reduced ? 0 : currentTiltRef.current.x * 4).toFixed(2)}px`,
        );
        shellRef.current.style.setProperty(
          '--drift-y',
          `${(motionPreference.reduced ? 0 : currentTiltRef.current.y * 4).toFixed(2)}px`,
        );
      }

      for (const atom of atomsRef.current) {
        atom.hoverMix = damp(atom.hoverMix, atom.hovered ? 1 : 0, 10, delta);
        atom.dragMix = damp(atom.dragMix, atom.dragging ? 1 : 0, 12, delta);
      }

      spreadRef.current.current = damp(
        spreadRef.current.current,
        spreadRef.current.target,
        spreadRef.current.target > spreadRef.current.current ? 12 : 18,
        delta,
      );

      const shouldAutoRotate =
        !motionPreference.reduced &&
        !isDraggingStructure;

      if (!motionPreference.reduced && !isDraggingStructure && hasDragSpin) {
        spinQuaternion.setFromAxisAngle(
          rotationRef.current.spinAxis,
          Math.min(rotationRef.current.spinVelocity * delta, 0.04),
        );
        rotationRef.current.target.premultiply(spinQuaternion).normalize();
        rotationRef.current.spinVelocity *= Math.exp(-DRAG_SPIN_DECAY * delta);
        if (rotationRef.current.spinVelocity < 0.01) {
          rotationRef.current.spinVelocity = 0;
        }
      }

      if (shouldAutoRotate) {
        autoRotateY.setFromAxisAngle(yAxis, delta * AUTO_ROTATE_SPEED);
        autoRotateX.setFromAxisAngle(xAxis, Math.sin(now * 0.00012) * delta * 0.0038);
        rotationRef.current.target
          .premultiply(autoRotateY)
          .premultiply(autoRotateX)
          .normalize();
      }

      rotationRef.current.current.slerp(
        rotationRef.current.target,
        1 - Math.exp(-(isDraggingStructure ? DRAG_ROTATION_RESPONSE : IDLE_ROTATION_RESPONSE) * delta),
      );
      rotationRef.current.current.normalize();
      const idleDriftX =
        motionPreference.reduced
          ? 0
          : Math.sin(now * 0.00018) * 8.2 +
            Math.cos(now * 0.000071 + currentTiltRef.current.x * 0.8) * 2.0;
      const idleDriftY =
        motionPreference.reduced
          ? 0
          : Math.cos(now * 0.00015) * 6.4 +
            Math.sin(now * 0.000096 + currentTiltRef.current.y * 0.9) * 1.8;

      cameraRef.current.target.focus = 0;
      cameraRef.current.target.panX = 0;
      cameraRef.current.target.panY = 0;
      cameraRef.current.target.dolly = 0;
      cameraRef.current.target.zoom = 1;
      cameraRef.current.target.roll =
        motionPreference.reduced
          ? 0
          : Math.sin(now * 0.00009) * 0.64 + currentTiltRef.current.x * 0.42;
      cameraRef.current.target.driftX = idleDriftX;
      cameraRef.current.target.driftY = idleDriftY;

      cameraRef.current.current.panX = damp(
        cameraRef.current.current.panX,
        cameraRef.current.target.panX,
        5.8,
        delta,
      );
      cameraRef.current.current.panY = damp(
        cameraRef.current.current.panY,
        cameraRef.current.target.panY,
        5.8,
        delta,
      );
      cameraRef.current.current.dolly = damp(
        cameraRef.current.current.dolly,
        cameraRef.current.target.dolly,
        6.4,
        delta,
      );
      cameraRef.current.current.zoom = damp(
        cameraRef.current.current.zoom,
        cameraRef.current.target.zoom,
        6.2,
        delta,
      );
      cameraRef.current.current.roll = damp(
        cameraRef.current.current.roll,
        cameraRef.current.target.roll,
        5.4,
        delta,
      );
      cameraRef.current.current.driftX = damp(
        cameraRef.current.current.driftX,
        cameraRef.current.target.driftX,
        3.8,
        delta,
      );
      cameraRef.current.current.driftY = damp(
        cameraRef.current.current.driftY,
        cameraRef.current.target.driftY,
        3.8,
        delta,
      );
      cameraRef.current.current.focus = damp(
        cameraRef.current.current.focus,
        cameraRef.current.target.focus,
        6.8,
        delta,
      );

      if (
        now - frameCommitRef.current >=
        sceneFrameIntervalFor(
          atomsRef.current.length,
          motionPreference.reduced,
          isDraggingStructure || hasDragSpin,
        )
      ) {
        frameCommitRef.current = now;
        setFrameTime(now);
        if (pendingHoverInfoRef.current !== null) {
          const pending = pendingHoverInfoRef.current;
          pendingHoverInfoRef.current = null;
          setHoverInfo((current) => {
            if (
              current?.atomId === pending.atomId &&
              current.x === pending.x &&
              current.y === pending.y
            ) {
              return current;
            }
            return pending;
          });
        }
      }
      frameId = window.requestAnimationFrame(animate);
    };

    frameId = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(spreadRef.current.timeoutId);
      document.body.style.cursor = '';
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(STORAGE_KEYS.language, language);
    document.documentElement.lang = language === 'en' ? 'en' : 'ko';
    window.localStorage.removeItem('atom-sketch-theme');
    delete document.documentElement.dataset.theme;
    document.documentElement.style.colorScheme = 'dark';
  }, [language]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const motionQuery =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null;

    let clearId = 0;

    const triggerShootingStar = () => {
      if (motionQuery?.matches || document.visibilityState === 'hidden') {
        return;
      }

      const nextShootingStar = createShootingStar();
      setShootingStar(nextShootingStar);
      window.clearTimeout(clearId);
      clearId = window.setTimeout(() => {
        setShootingStar((current) =>
          current?.id === nextShootingStar.id ? null : current,
        );
      }, nextShootingStar.duration + SHOOTING_STAR_CLEAR_BUFFER_MS);
    };

    const clearActiveShootingStar = () => {
      if (!motionQuery?.matches && document.visibilityState !== 'hidden') {
        return;
      }

      window.clearTimeout(clearId);
      setShootingStar(null);
    };

    const intervalId = window.setInterval(triggerShootingStar, SHOOTING_STAR_INTERVAL_MS);
    document.addEventListener('visibilitychange', clearActiveShootingStar);
    if (motionQuery?.addEventListener) {
      motionQuery.addEventListener('change', clearActiveShootingStar);
    } else {
      motionQuery?.addListener?.(clearActiveShootingStar);
    }

    return () => {
      window.clearInterval(intervalId);
      window.clearTimeout(clearId);
      document.removeEventListener('visibilitychange', clearActiveShootingStar);
      if (motionQuery?.removeEventListener) {
        motionQuery.removeEventListener('change', clearActiveShootingStar);
      } else {
        motionQuery?.removeListener?.(clearActiveShootingStar);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(STORAGE_KEYS.assetClassMode, assetClassMode);
  }, [assetClassMode]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(STORAGE_KEYS.allocationWeightMode, allocationWeightMode);
  }, [allocationWeightMode]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(STORAGE_KEYS.scoreWeightPreset, scoreWeightPreset);
  }, [scoreWeightPreset]);

  useEffect(() => {
    if (!settingsOpen) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (settingsRef.current?.contains(event.target)) {
        return;
      }

      setSettingsOpen(false);
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [settingsOpen]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement ||
        event.target.isContentEditable
      ) {
        return;
      }

      if (event.key === 'Escape') {
        if (settingsOpen) {
          setSettingsOpen(false);
        } else if (toolTrayOpen) {
          setToolTrayOpen(false);
        }
        return;
      }

      if ((event.key === 'u' || event.key === 'U') && !event.metaKey && !event.ctrlKey && !event.altKey) {
        openPortfolioPicker();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [settingsOpen, toolTrayOpen]);

  useEffect(() => {
    if (!portfolioError) {
      setPortfolioErrorClosing(false);
      return undefined;
    }

    const fadeId = window.setTimeout(() => {
      setPortfolioErrorClosing(true);
    }, 3000);
    const clearId = window.setTimeout(() => {
      clearPortfolioError();
    }, 3600);

    return () => {
      window.clearTimeout(fadeId);
      window.clearTimeout(clearId);
    };
  }, [portfolioError]);

  const activePortfolio =
    portfolioEntries.find((entry) => entry.id === activePortfolioId) ?? portfolioEntries[0] ?? null;
  const portfolioItems = activePortfolio?.items ?? [];
  const portfolioTimelineItems = activePortfolio?.timelineItems ?? portfolioItems;

  useEffect(() => {
    atomsRef.current = generateAtomLayout(portfolioItems).map(createAtomState);
    dragRef.current.atomId = null;
    dragRef.current.moved = false;
    rotationRef.current.spinVelocity = 0;
    interactionRef.current.hoveringAtomId = null;
    interactionRef.current.selectedAtomId = null;
    interactionRef.current.lastInputAt = performance.now();
    pendingHoverInfoRef.current = null;
    document.body.style.cursor = '';
    setSelectedAtomId(null);
    setHoverInfo(null);
  }, [portfolioItems]);

  useEffect(() => {
    if (!activePortfolioId && portfolioEntries.length) {
      setActivePortfolioId(portfolioEntries[0].id);
    }
  }, [activePortfolioId, portfolioEntries]);

  useEffect(() => {
    const deltaQuaternion = new THREE.Quaternion();
    const appliedDeltaQuaternion = new THREE.Quaternion();
    const dragSpinAxis = new THREE.Vector3();

    const updateDraggedStructure = (event) => {
      if (!dragRef.current.atomId) {
        return;
      }

      event.preventDefault();
      noteInteraction();

      if (!dragRef.current.moved) {
        const moveX = event.clientX - dragRef.current.startX;
        const moveY = event.clientY - dragRef.current.startY;
        if (moveX * moveX + moveY * moveY > 36) {
          dragRef.current.moved = true;
        }
      }

      const point = clientToLocalPoint(event.clientX, event.clientY);
      if (!point) {
        return;
      }

      const nextTrack = trackballVector(point);
      deltaQuaternion.setFromUnitVectors(rotationRef.current.lastTrack, nextTrack);
      appliedDeltaQuaternion.identity().slerp(deltaQuaternion, DRAG_ROTATION_SENSITIVITY);
      rotationRef.current.target.premultiply(appliedDeltaQuaternion).normalize();
      const now = performance.now();
      const elapsed = rotationRef.current.lastDragAt
        ? Math.max((now - rotationRef.current.lastDragAt) / 1000, 0.001)
        : 0;
      const quaternionW = clamp(appliedDeltaQuaternion.w, -1, 1);
      const angle = 2 * Math.acos(quaternionW);
      const sinHalfAngle = Math.sqrt(Math.max(0, 1 - quaternionW * quaternionW));

      if (elapsed > 0 && angle > 0.0001 && sinHalfAngle > 0.0001) {
        dragSpinAxis
          .set(
            appliedDeltaQuaternion.x / sinHalfAngle,
            appliedDeltaQuaternion.y / sinHalfAngle,
            appliedDeltaQuaternion.z / sinHalfAngle,
          )
          .normalize();
        rotationRef.current.spinAxis.lerp(dragSpinAxis, 0.42).normalize();
        rotationRef.current.spinVelocity =
          rotationRef.current.spinVelocity * 0.52 +
          clamp(angle / elapsed, 0, MAX_DRAG_SPIN_VELOCITY) * 0.48;
      }

      rotationRef.current.lastDragAt = now;
      rotationRef.current.lastTrack.copy(nextTrack);
    };

    const endDrag = () => {
      if (!dragRef.current.atomId) {
        return;
      }

      const clickedAtomId = dragRef.current.atomId;
      const wasMoved = dragRef.current.moved;
      const atom = atomsRef.current.find((item) => item.id === clickedAtomId);
      if (atom) {
        atom.dragging = false;
      }

      dragRef.current.atomId = null;
      dragRef.current.moved = false;
      if (!wasMoved) {
        rotationRef.current.spinVelocity = 0;
      } else {
        interactionRef.current.hoveringAtomId = null;
      }
      interactionRef.current.lastInputAt = performance.now();
      pendingHoverInfoRef.current = null;
      document.body.style.cursor = '';
      setHoverInfo(null);

      if (!wasMoved) {
        setSelectedAtomId((current) => (current === clickedAtomId ? null : clickedAtomId));
      }
    };

    window.addEventListener('pointermove', updateDraggedStructure, {
      passive: false,
    });
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);

    return () => {
      window.removeEventListener('pointermove', updateDraggedStructure);
      window.removeEventListener('pointerup', endDrag);
      window.removeEventListener('pointercancel', endDrag);
    };
  }, []);

  const handleNodePointerDown = (atomId, event) => {
    event.stopPropagation();
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);

    if (dragRef.current.atomId) {
      const previousAtom = atomsRef.current.find(
        (item) => item.id === dragRef.current.atomId,
      );

      if (previousAtom) {
        previousAtom.dragging = false;
      }
    }

    const atom = atomsRef.current.find((item) => item.id === atomId);
    const point = clientToLocalPoint(event.clientX, event.clientY);

    if (!atom || !point) {
      return;
    }

    dragRef.current.atomId = atomId;
    dragRef.current.moved = false;
    dragRef.current.startX = event.clientX;
    dragRef.current.startY = event.clientY;
    interactionRef.current.hoveringAtomId = atomId;
    noteInteraction();
    atom.dragging = true;
    rotationRef.current.lastTrack.copy(trackballVector(point));
    rotationRef.current.lastDragAt = performance.now();
    rotationRef.current.spinVelocity = 0;
    frameCommitRef.current = 0;
    pendingHoverInfoRef.current = null;
    document.body.style.cursor = 'grabbing';
    setHoverInfo(null);
  };

  const handleNodeEnter = (atomId, event) => {
    const atom = atomsRef.current.find((item) => item.id === atomId);

    if (!atom) {
      return;
    }

    atom.hovered = true;
    interactionRef.current.hoveringAtomId = atomId;
    noteInteraction();
    updateHoverInfo(atomId, event.clientX, event.clientY);
    targetTiltRef.current.x = 0;
    targetTiltRef.current.y = 0;

    if (!atom.dragging) {
      document.body.style.cursor = 'grab';
    }
  };

  const handleNodeMove = (atomId, event) => {
    noteInteraction();

    if (dragRef.current.atomId) {
      return;
    }

    updateHoverInfo(atomId, event.clientX, event.clientY);
  };

  const handleNodeLeave = (atomId) => {
    const atom = atomsRef.current.find((item) => item.id === atomId);

    if (!atom) {
      if (pendingHoverInfoRef.current?.atomId === atomId) {
        pendingHoverInfoRef.current = null;
      }
      return;
    }

    atom.hovered = false;
    if (interactionRef.current.hoveringAtomId === atomId) {
      interactionRef.current.hoveringAtomId = null;
    }
    if (pendingHoverInfoRef.current?.atomId === atomId) {
      pendingHoverInfoRef.current = null;
    }
    noteInteraction();
    setHoverInfo((current) => (current?.atomId === atomId ? null : current));

    if (!atom.dragging) {
      document.body.style.cursor = '';
    }
  };

  const handlePointerMove = (event) => {
    noteInteraction();
    if (interactionRef.current.hoveringAtomId) {
      return;
    }
    const viewportWidth = window.innerWidth || event.currentTarget.clientWidth || 1;
    const viewportHeight = window.innerHeight || event.currentTarget.clientHeight || 1;
    const relativeX = event.clientX / viewportWidth;
    const relativeY = event.clientY / viewportHeight;

    targetTiltRef.current.x = clamp(relativeX * 2 - 1, -1, 1);
    targetTiltRef.current.y = clamp(relativeY * 2 - 1, -1, 1);
  };

  const handlePointerLeave = () => {
    noteInteraction();
    targetTiltRef.current.x = 0;
    targetTiltRef.current.y = 0;
  };

  const handleWheel = (event) => {
    if (event.deltaY <= 0) {
      return;
    }

    event.preventDefault();
    noteInteraction();

    spreadRef.current.target = clamp(
      spreadRef.current.target + event.deltaY * 0.0015,
      0,
      0.52,
    );

    window.clearTimeout(spreadRef.current.timeoutId);
    spreadRef.current.timeoutId = window.setTimeout(() => {
      spreadRef.current.target = 0;
    }, 90);
  };

  const handlePortfolioFileChange = async (event) => {
    const files = Array.from(event.target.files ?? []);
    const currentText = textFor(language);

    if (!files.length) {
      return;
    }

    noteInteraction();

    const remainingSlots = Math.max(0, MAX_PORTFOLIOS - portfolioEntries.length);
    if (!remainingSlots) {
      showPortfolioError(currentText.maxFilesError);
      event.target.value = '';
      return;
    }

    setPortfolioLoading(true);

    try {
      const nextPreparedEntries = [];

      for (const file of files.slice(0, remainingSlots)) {
        const text = await readPortfolioFile(file);
        const { items: localItems, diagnostics: localParserDiagnostics } =
          parsePortfolioTextDetailedShared(text);

        if (!localItems.length) {
          throw new Error(`${file.name}: ${currentText.parseError}`);
        }

        const entryId =
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `portfolio-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

        nextPreparedEntries.push({
          entryId,
          fileName: file.name,
          text,
          localItems,
          localParserDiagnostics,
          localEntry: createPortfolioEntryFromPayload(
            buildLocalPortfolioPayload(file.name, localItems, localParserDiagnostics),
            entryId,
          ),
        });
      }

      clearPortfolioError();
      setToolTrayOpen(false);
      setSelectedAtomId(null);
      setActiveGroupKey(null);
      setShowGroupDock(true);
      setShowScoreDock(true);
      setGroupDockSpawn(null);
      setScoreDockSpawn(null);
      setPortfolioEntries((current) =>
        [...current, ...nextPreparedEntries.map((entry) => entry.localEntry)].slice(0, MAX_PORTFOLIOS),
      );
      setActivePortfolioId((current) => current ?? nextPreparedEntries[0]?.entryId ?? null);
      setPortfolioLoading(false);

      nextPreparedEntries.forEach(
        ({ entryId, fileName, text, localItems, localParserDiagnostics }) => {
          void (async () => {
            let payload;

            try {
              payload = await ingestPortfolioTextViaApi(fileName, text);

              if (shouldFallbackToLocalTimelineShared(payload, localItems)) {
                payload = {
                  ...buildLocalPortfolioPayload(fileName, localItems, localParserDiagnostics, {
                    agentReview: {
                      ...(payload.agentReview ?? {}),
                      status:
                        payload.agentReview?.status === 'blocked' ? 'blocked' : 'needs-review',
                      summary:
                        payload.agentReview?.summary ??
                        '서버 결과를 받았지만 시계열 데이터는 로컬 파서를 우선 적용했습니다.',
                      warnings: [
                        ...(payload.agentReview?.warnings ?? []),
                        {
                          code: 'local-timeline-override',
                          severity: 'warning',
                          message:
                            '서버 시계열 결과가 너무 짧아 로컬 파서의 timeline 데이터를 표시합니다.',
                          source: 'client-fallback',
                        },
                      ],
                    },
                    ingestSource: 'server-with-local-timeline',
                  }),
                };
              } else {
                payload = {
                  ...payload,
                  ingestSource: 'server',
                };
              }
            } catch (error) {
              payload = buildLocalPortfolioPayload(fileName, localItems, localParserDiagnostics, {
                agentReview: {
                  mode: 'client-local-fallback',
                  status: localItems.length ? 'needs-review' : 'blocked',
                  summary: '서버 ingest에 실패해 브라우저 로컬 파서 결과를 유지합니다.',
                  warnings: [
                    {
                      code: 'server-ingest-failed',
                      severity: 'warning',
                      message:
                        error instanceof Error
                          ? error.message
                          : 'Server ingest failed. Showing the local parser result instead.',
                      source: 'client-fallback',
                    },
                  ],
                  agents: [],
                },
                ingestSource: 'client-local-fallback',
              });
            }

            setPortfolioEntries((current) =>
              current.map((entry) =>
                entry.id === entryId ? createPortfolioEntryFromPayload(payload, entryId) : entry,
              ),
            );
            scheduleSecurityMetadataEnrichment(entryId, payload?.items);
          })();
        },
      );
    } catch (error) {
      showPortfolioError(error instanceof Error ? error.message : currentText.readError);
      setPortfolioLoading(false);
    } finally {
      event.target.value = '';
    }
  };

  const processPortfolioFiles = async (files) => {
    const currentText = textFor(language);

    if (!files.length) {
      return;
    }

    noteInteraction();

    const remainingSlots = Math.max(0, MAX_PORTFOLIOS - portfolioEntries.length);
    if (!remainingSlots) {
      showPortfolioError(currentText.maxFilesError);
      return;
    }

    setPortfolioLoading(true);

    try {
      const nextPreparedEntries = [];

      for (const file of files.slice(0, remainingSlots)) {
        const text = await readPortfolioFile(file);
        const { items: localItems, diagnostics: localParserDiagnostics } =
          parsePortfolioTextDetailedShared(text);

        if (!localItems.length) {
          throw new Error(`${file.name}: ${currentText.parseError}`);
        }

        const entryId =
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `portfolio-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

        nextPreparedEntries.push({
          entryId,
          fileName: file.name,
          text,
          localItems,
          localParserDiagnostics,
          localEntry: createPortfolioEntryFromPayload(
            buildLocalPortfolioPayload(file.name, localItems, localParserDiagnostics),
            entryId,
          ),
        });
      }

      clearPortfolioError();
      setToolTrayOpen(false);
      setSelectedAtomId(null);
      setActiveGroupKey(null);
      setShowGroupDock(true);
      setShowScoreDock(true);
      setGroupDockSpawn(null);
      setScoreDockSpawn(null);
      setPortfolioEntries((current) =>
        [...current, ...nextPreparedEntries.map((entry) => entry.localEntry)].slice(0, MAX_PORTFOLIOS),
      );
      setActivePortfolioId((current) => current ?? nextPreparedEntries[0]?.entryId ?? null);
      setPortfolioLoading(false);

      nextPreparedEntries.forEach(
        ({ entryId, fileName, text, localItems, localParserDiagnostics }) => {
          void (async () => {
            let payload;

            try {
              payload = await ingestPortfolioTextViaApi(fileName, text);

              if (shouldFallbackToLocalTimelineShared(payload, localItems)) {
                payload = {
                  ...buildLocalPortfolioPayload(fileName, localItems, localParserDiagnostics, {
                    agentReview: {
                      ...(payload.agentReview ?? {}),
                      status:
                        payload.agentReview?.status === 'blocked' ? 'blocked' : 'needs-review',
                      summary:
                        payload.agentReview?.summary ??
                        '서버 결과를 받았지만 시계열 데이터는 로컬 파서를 우선 적용했습니다.',
                      warnings: [
                        ...(payload.agentReview?.warnings ?? []),
                        {
                          code: 'local-timeline-override',
                          severity: 'warning',
                          message:
                            '서버 시계열 결과가 너무 짧아 로컬 파서의 timeline 데이터를 표시합니다.',
                          source: 'client-fallback',
                        },
                      ],
                    },
                    ingestSource: 'server-with-local-timeline',
                  }),
                };
              } else {
                payload = {
                  ...payload,
                  ingestSource: 'server',
                };
              }
            } catch {
              payload = buildLocalPortfolioPayload(fileName, localItems, localParserDiagnostics, {
                agentReview: {
                  mode: 'client-local-fallback',
                  status: localItems.length ? 'needs-review' : 'blocked',
                  summary: '서버 ingest에 실패해 브라우저 로컬 파서 결과를 유지합니다.',
                  warnings: [
                    {
                      code: 'server-ingest-failed',
                      severity: 'warning',
                      message: 'Server ingest failed. Showing the local parser result instead.',
                      source: 'client-fallback',
                    },
                  ],
                  agents: [],
                },
                ingestSource: 'client-local-fallback',
              });
            }

            setPortfolioEntries((current) =>
              current.map((entry) =>
                entry.id === entryId ? createPortfolioEntryFromPayload(payload, entryId) : entry,
              ),
            );
            scheduleSecurityMetadataEnrichment(entryId, payload?.items);
          })();
        },
      );
    } catch (error) {
      showPortfolioError(error instanceof Error ? error.message : currentText.readError);
      setPortfolioLoading(false);
    }
  };

  const handleFileDragEnter = (event) => {
    if (!event.dataTransfer?.types?.includes('Files')) {
      return;
    }

    event.preventDefault();
    fileDragCounterRef.current += 1;
    setFileDragActive(true);
  };

  const handleFileDragOver = (event) => {
    if (!event.dataTransfer?.types?.includes('Files')) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  };

  const handleFileDragLeave = (event) => {
    fileDragCounterRef.current -= 1;
    if (fileDragCounterRef.current <= 0) {
      fileDragCounterRef.current = 0;
      setFileDragActive(false);
    }
  };

  const handleFileDrop = async (event) => {
    event.preventDefault();
    fileDragCounterRef.current = 0;
    setFileDragActive(false);

    const files = Array.from(event.dataTransfer?.files ?? []).filter((file) => {
      const name = file.name.toLowerCase();
      return name.endsWith('.csv') || name.endsWith('.tsv') || name.endsWith('.txt') ||
        file.type === 'text/csv' || file.type === 'text/tab-separated-values' || file.type === 'text/plain';
    });

    await processPortfolioFiles(files);
  };

  const handleClearPortfolio = (entryId) => {
    noteInteraction();
    clearHoveredFileTooltip();
    const nextEntries = portfolioEntries.filter((entry) => entry.id !== entryId);
    const nextActiveId =
      activePortfolioId === entryId ? nextEntries[0]?.id ?? null : activePortfolioId;

    setPortfolioEntries(nextEntries);
    setActivePortfolioId(nextActiveId);
    clearPortfolioError();
    if (!nextEntries.length) {
      setToolTrayOpen(false);
      setShowGroupDock(false);
      setShowScoreDock(false);
      setGroupDockSpawn(null);
      setScoreDockSpawn(null);
      setActiveGroupKey(null);
      setSelectedAtomId(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const hasPortfolio = portfolioEntries.length > 0;
  const showPortfolioChrome = hasPortfolio;
  const text = textFor(language);
  const hoveredFileEntry = useMemo(
    () => portfolioEntries.find((entry) => entry.id === hoveredFileEntryId) ?? null,
    [hoveredFileEntryId, portfolioEntries],
  );
  const hoveredFileTooltipStyle = useMemo(() => {
    if (
      !hoveredFileEntry ||
      !hoveredFileAnchorRect ||
      !uploadPlusWrapRef.current ||
      typeof window === 'undefined'
    ) {
      return null;
    }

    const containerRect = uploadPlusWrapRef.current.getBoundingClientRect();
    const maxWidth = clamp(
      window.innerWidth - REVIEW_TOOLTIP_VIEWPORT_INSET * 2,
      160,
      REVIEW_TOOLTIP_MAX_WIDTH,
    );
    const anchorCenter = hoveredFileAnchorRect.left + hoveredFileAnchorRect.width * 0.5;
    const clampedCenter = clamp(
      anchorCenter,
      REVIEW_TOOLTIP_VIEWPORT_INSET + maxWidth * 0.5,
      window.innerWidth - REVIEW_TOOLTIP_VIEWPORT_INSET - maxWidth * 0.5,
    );

    return {
      left: `${clampedCenter - containerRect.left}px`,
      top: `${hoveredFileAnchorRect.top - containerRect.top - REVIEW_TOOLTIP_VERTICAL_GAP}px`,
      maxWidth: `${maxWidth}px`,
    };
  }, [hoveredFileAnchorRect, hoveredFileEntry]);
  useEffect(() => {
    if (hoveredFileEntryId && !hoveredFileEntry) {
      clearHoveredFileTooltip();
    }
  }, [clearHoveredFileTooltip, hoveredFileEntry, hoveredFileEntryId]);
  const groupOptions = groupOptionsFor(language);
  const scoreAxes = scoreAxesFor(language);
  const handleResetDockLayout = () => {
    noteInteraction();
    setShowGroupDock(true);
    setShowScoreDock(true);

    if (typeof window !== 'undefined') {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const inset = uiInsetFor(width);
      const triggerSize = toolTriggerSizeFor(width);
      const triggerAnchor = toolTriggerPosition ?? {
        x: clamp(inset, inset, width - triggerSize - inset),
        y: clamp(inset, inset, height - triggerSize - inset),
      };
      const nextGroupPosition = stackDockBelow(
        triggerAnchor.x,
        triggerAnchor.y,
        triggerSize,
        groupDockSizeFor(width),
        width,
        height,
      );
      const nextHeatmapPosition = stackDockBelow(
        nextGroupPosition.x,
        nextGroupPosition.y,
        groupDockSizeFor(width),
        heatmapDockSizeFor(width),
        width,
        height,
      );
      const nextScorePosition = stackDockBelow(
        nextHeatmapPosition.x,
        nextHeatmapPosition.y,
        heatmapDockSizeFor(width),
        scoreDockSizeFor(width),
        width,
        height,
      );

      setGroupDockPosition(nextGroupPosition);
      setHeatmapDockPosition(nextHeatmapPosition);
      setScoreDockPosition(nextScorePosition);
    }

    setDockResetAt(performance.now());
  };
  const settingsSections = [
    {
      key: 'language',
      title: text.settingsSectionLanguage,
      options: LANGUAGE_OPTIONS.map((option) => ({
        key: option,
        label: option === 'ko' ? text.korean : text.english,
        active: language === option,
        onSelect: () => setLanguage(option),
      })),
    },
    {
      key: 'asset-class-mode',
      title: text.settingsSectionAssetClassMode,
      options: [
        {
          key: 'auto',
          label: text.settingsAssetClassAuto,
          active: assetClassMode === 'auto',
          onSelect: () => setAssetClassMode('auto'),
        },
        {
          key: 'preferOriginal',
          label: text.settingsAssetClassPreferOriginal,
          active: assetClassMode === 'preferOriginal',
          onSelect: () => setAssetClassMode('preferOriginal'),
        },
      ],
    },
    {
      key: 'allocation-weight-mode',
      title: text.settingsSectionAllocationWeightMode,
      options: [
        {
          key: 'auto',
          label: text.settingsAllocationWeightAuto,
          active: allocationWeightMode === 'auto',
          onSelect: () => setAllocationWeightMode('auto'),
        },
        {
          key: 'stock',
          label: text.settingsAllocationWeightStock,
          active: allocationWeightMode === 'stock',
          onSelect: () => setAllocationWeightMode('stock'),
        },
        {
          key: 'assetClass',
          label: text.settingsAllocationWeightAssetClass,
          active: allocationWeightMode === 'assetClass',
          onSelect: () => setAllocationWeightMode('assetClass'),
        },
        {
          key: 'account',
          label: text.settingsAllocationWeightAccount,
          active: allocationWeightMode === 'account',
          onSelect: () => setAllocationWeightMode('account'),
        },
      ],
    },
    {
      key: 'score-weight-preset',
      title: text.settingsSectionScoreWeightPreset,
      options: [
        {
          key: 'balanced',
          label: text.settingsScoreWeightBalanced,
          active: scoreWeightPreset === 'balanced',
          onSelect: () => setScoreWeightPreset('balanced'),
        },
        {
          key: 'returnFocus',
          label: text.settingsScoreWeightReturnFocus,
          active: scoreWeightPreset === 'returnFocus',
          onSelect: () => setScoreWeightPreset('returnFocus'),
        },
        {
          key: 'longTermReturnFocus',
          label: text.settingsScoreWeightLongTermReturnFocus,
          active: scoreWeightPreset === 'longTermReturnFocus',
          onSelect: () => setScoreWeightPreset('longTermReturnFocus'),
        },
        {
          key: 'stabilityFocus',
          label: text.settingsScoreWeightStabilityFocus,
          active: scoreWeightPreset === 'stabilityFocus',
          onSelect: () => setScoreWeightPreset('stabilityFocus'),
        },
      ],
    },
  ];
  const contributionPreview = useMemo(
    () => createContributionPreview(portfolioItems),
    [portfolioItems],
  );
  const portfolioAllocation = useMemo(
    () =>
      createPortfolioAllocation(portfolioItems, {
        classificationMode: assetClassMode,
        weightMode: allocationWeightMode,
      }),
    [allocationWeightMode, assetClassMode, portfolioItems],
  );
  const portfolioHeatmap = useMemo(
    () => createPortfolioHeatmap(portfolioTimelineItems, { weeks: 24 }),
    [portfolioTimelineItems],
  );
  const selectedAtom = atomsRef.current.find((atom) => atom.id === selectedAtomId) ?? null;
  const activeGroupValue =
    selectedAtom &&
    activeGroupKey &&
    canHighlightGroupField(selectedAtom, activeGroupKey) &&
    typeof selectedAtom[activeGroupKey] === 'string'
      ? selectedAtom[activeGroupKey].trim()
      : '';
  const normalizedActiveGroupValue = normalizeDisplayKey(activeGroupValue);
  const highlightActive = Boolean(selectedAtom && activeGroupKey && normalizedActiveGroupValue);
  const portfolioScorecard = useMemo(() => {
    if (!hasPortfolio) {
      return null;
    }

    return createPortfolioScorecard(portfolioItems, language, {
      weightPreset: scoreWeightPreset,
    });
  }, [hasPortfolio, language, portfolioItems, scoreWeightPreset]);
  const showCenterClearHit = Boolean(selectedAtomId || activeGroupKey);
  const clearCenterSelection = () => {
    noteInteraction();
    setSelectedAtomId(null);
    setActiveGroupKey(null);
  };
  const triggerIntroCenterBurst = () => {
    noteInteraction();
    setIntroCenterBurstAt(performance.now());
  };
  const introCenterBurst =
    !hasPortfolio && introCenterBurstAt >= 0
      ? Math.sin(clamp((frameTime - introCenterBurstAt) / 420, 0, 1) * Math.PI)
      : 0;
  const settingsPanelSide =
    typeof window === 'undefined'
      ? 'left'
      : floatingPanelSideFor(
          settingsDock.position.x,
          gearSizeFor(window.innerWidth),
          window.innerWidth,
        );

  const pulse = 0.5 + Math.sin(frameTime * 0.00042) * 0.5;
  const centerMotion = frameTime * 0.00112;
  const spreadScale = 1 + spreadRef.current.current;
  const nodeShrink = 1 - spreadRef.current.current * 0.1;
  const cameraMotion = cameraRef.current.current;
  const stageCameraX = cameraMotion.panX * 0.2 + cameraMotion.driftX * 0.84;
  const stageCameraY = cameraMotion.panY * 0.17 + cameraMotion.driftY * 0.9;
  const sceneStyle = {
    '--space-pan-x': `${format(cameraMotion.panX * -0.26 + cameraMotion.driftX * 1.18)}px`,
    '--space-pan-y': `${format(cameraMotion.panY * -0.22 + cameraMotion.driftY * 1.12)}px`,
    '--space-pan-stage-x': `${format(stageCameraX)}px`,
    '--space-pan-stage-y': `${format(stageCameraY)}px`,
    '--space-depth': format(cameraMotion.dolly * 0.012 + cameraMotion.focus * 0.38),
    '--camera-focus': format(cameraMotion.focus),
    '--camera-stage-zoom': format(
      1 + (cameraMotion.zoom - 1) * 0.42 + cameraMotion.focus * 0.025,
    ),
    '--camera-stage-roll': `${format(cameraMotion.roll * 0.46)}deg`,
    '--camera-glow': format(0.28 + cameraMotion.focus * 0.5),
  };
  const shootingStarStyle = useMemo(() => {
    if (!shootingStar) {
      return null;
    }

    return {
      '--shooting-star-left': `${format(shootingStar.startX)}%`,
      '--shooting-star-top': `${format(shootingStar.startY)}%`,
      '--shooting-star-travel-x': `${format(shootingStar.travelX)}px`,
      '--shooting-star-travel-y': `${format(shootingStar.travelY)}px`,
      '--shooting-star-angle': `${format(shootingStar.angle)}deg`,
      '--shooting-star-length': `${format(shootingStar.length)}px`,
      '--shooting-star-duration': `${format(shootingStar.duration)}ms`,
      '--shooting-star-scale': format(shootingStar.scale),
      '--shooting-star-opacity': format(shootingStar.opacity),
    };
  }, [shootingStar]);
  const atoms = useMemo(
    () =>
      atomsRef.current.map((atom) => {
        const position = atom.baseDirection
          .clone()
          .applyQuaternion(rotationRef.current.current)
          .multiplyScalar(BOND_LENGTH);
        const projection = projectPoint(position, cameraMotion);
        const matchesActiveGroup =
          highlightActive &&
          canHighlightGroupField(atom, activeGroupKey) &&
          normalizeDisplayKey(atom[activeGroupKey]) === normalizedActiveGroupValue;

        return {
          ...atom,
          ...projection,
          x: projection.x * spreadScale,
          y: projection.y * spreadScale,
          scale: projection.scale * nodeShrink,
          isSelected: atom.id === selectedAtomId,
          isGroupMatch: matchesActiveGroup,
          dimmed: highlightActive ? !matchesActiveGroup : false,
          position,
        };
      }),
    [
      activeGroupKey,
      cameraMotion,
      frameTime,
      highlightActive,
      nodeShrink,
      normalizedActiveGroupValue,
      selectedAtomId,
      spreadScale,
    ],
  );
  const hoveredAtom = atoms.find((atom) => atom.id === hoverInfo?.atomId) ?? null;

  return (
    <main
      ref={shellRef}
      className={`app-shell${fileDragActive ? ' is-file-drag' : ''}`}
      style={sceneStyle}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onWheel={handleWheel}
      onDragEnter={handleFileDragEnter}
      onDragOver={handleFileDragOver}
      onDragLeave={handleFileDragLeave}
      onDrop={handleFileDrop}
    >
      {fileDragActive ? (
        <div className="file-drop-overlay" aria-hidden="true">
          <div className="file-drop-overlay__inner">
            <div className="file-drop-overlay__icon">
              <SketchUploadArrowIcon />
            </div>
            <p className="file-drop-overlay__label">{text.uploadDragHint}</p>
          </div>
        </div>
      ) : null}
      <div className="space-depth" aria-hidden="true">
        <div className="space-depth__nebula space-depth__nebula--far" />
        <div className="space-depth__stars space-depth__stars--far" />
        <div className="space-depth__stars space-depth__stars--mid" />
        <div className="space-depth__stars space-depth__stars--near" />
        <div className="space-depth__meteor-field">
          {shootingStarStyle ? (
            <div
              key={shootingStar.id}
              className="space-depth__meteor"
              style={shootingStarStyle}
            />
          ) : null}
        </div>
        <div className="space-depth__halo" />
      </div>

      <div className="floating-ui-layer">
        {showPortfolioChrome && showGroupDock ? (
          <FloatingGroupDock
            anchorRef={toolTriggerRef}
            anchorPosition={toolTriggerPosition}
            options={groupOptions}
            activeKey={activeGroupKey}
            spawn={groupDockSpawn}
            resetSignal={dockResetAt}
            visible={toolTrayOpen}
            layerStyle={floatingLayerStyleFor('group')}
            onAnchorPositionChange={setGroupDockPosition}
            onChange={setActiveGroupKey}
            onInteract={interactWithGroupTool}
          />
        ) : null}

        {showPortfolioChrome && showScoreDock ? (
          <FloatingHeatmapDock
            anchorRef={toolTriggerRef}
            anchorPosition={groupDockPosition}
            anchorSize={groupDockSizeFor(typeof window === 'undefined' ? 1280 : window.innerWidth)}
            heatmap={{
              ...portfolioHeatmap,
              columns: contributionPreview.columns,
              rows: contributionPreview.rows,
            }}
            language={language}
            visible={toolTrayOpen}
            resetSignal={dockResetAt}
            layerStyle={floatingLayerStyleFor('heatmap')}
            onAnchorPositionChange={setHeatmapDockPosition}
            onInteract={interactWithHeatmapTool}
          />
        ) : null}

        {showPortfolioChrome && portfolioScorecard && showScoreDock ? (
          <FloatingRadarDock
            anchorRef={toolTriggerRef}
            anchorPosition={heatmapDockPosition}
            anchorSize={heatmapDockSizeFor(typeof window === 'undefined' ? 1280 : window.innerWidth)}
            externalDockRef={scoreDockRef}
            scorecard={portfolioScorecard}
            axes={scoreAxes}
            language={language}
            spawn={scoreDockSpawn}
            resetSignal={dockResetAt}
            visible={toolTrayOpen}
            layerStyle={floatingLayerStyleFor('score')}
            onPositionChange={setScoreDockPosition}
            onInteract={interactWithScoreTool}
          />
        ) : null}

        {showPortfolioChrome ? (
          <FloatingToolTrigger
            anchorRef={uploadButtonRef}
            triggerRef={toolTriggerRef}
            language={language}
            open={toolTrayOpen}
            resetSignal={dockResetAt}
            onToggle={() => {
              setToolTrayOpen((current) => {
                const next = !current;
                if (next) {
                  setShowGroupDock(true);
                  setShowScoreDock(true);
                }
                return next;
              });
              setShowGroupDock(true);
              setShowScoreDock(true);
            }}
            onResetAlignment={handleResetDockLayout}
            onPositionChange={setToolTriggerPosition}
            layerStyle={floatingLayerStyleFor('tool-menu')}
            onInteract={interactWithToolMenu}
          />
        ) : null}

        {showPortfolioChrome && portfolioAllocation && showScoreDock ? (
          <PortfolioAllocationWidget
            allocation={portfolioAllocation}
            language={language}
            anchorRef={toolTriggerRef}
            anchorSelector=".tool-menu--floating"
            anchorPosition={toolTriggerPosition}
            anchorSize={toolTriggerSizeFor(typeof window === 'undefined' ? 1280 : window.innerWidth)}
            anchorSteps={4}
            resetSignal={dockResetAt}
            visible={toolTrayOpen}
            settingsOpen={settingsOpen}
            layerStyle={floatingLayerStyleFor('allocation')}
            onInteract={interactWithAllocationTool}
          />
        ) : null}

        <div
          ref={settingsDock.containerRef}
          className={`settings-anchor${settingsPanelSide === 'right' ? ' is-flipped' : ''}${settingsDock.dragging ? ' is-dragging' : ''}`}
          style={{
            transform: `translate3d(${settingsDock.position.x}px, ${settingsDock.position.y}px, 0)`,
            ...floatingLayerStyleFor('settings'),
          }}
        >
          <div ref={settingsRef} className={`settings-wrap${settingsOpen ? ' is-open' : ''}`}>
            <button
              className="settings-gear"
              type="button"
              onPointerDown={settingsDock.handlePointerDown}
              aria-label={text.settingsAria}
              aria-expanded={settingsOpen}
            >
              <SketchGearIcon />
            </button>

            {settingsOpen ? (
              <div className="settings-panel" onPointerDown={settingsDock.handleDragPointerDown}>
                {settingsSections.map((section) => (
                  <section key={section.key} className="settings-panel__section">
                    <p className="settings-panel__title">{section.title}</p>
                    <div className="settings-panel__options">
                      {section.options.map((option) => (
                        <button
                          key={option.key}
                          type="button"
                          className={`settings-option${option.active ? ' is-active' : ''}`}
                          onClick={() => {
                            noteInteraction();
                            option.onSelect();
                          }}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </section>
                ))}
                <section className="settings-panel__section">
                  <p className="settings-panel__title">{text.settingsSectionLayoutReset}</p>
                  <button
                    type="button"
                    className="settings-action"
                    onClick={handleResetDockLayout}
                  >
                    {text.settingsResetLayoutAction}
                  </button>
                </section>
              </div>
            ) : null}
          </div>
        </div>

        <div className="upload-anchor">
          <input
            ref={fileInputRef}
            className="file-input"
            type="file"
            multiple
            accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values"
            onChange={handlePortfolioFileChange}
          />
          {showPortfolioChrome ? (
            <>
              <div ref={uploadPlusWrapRef} className="upload-plus-wrap is-loaded">
                <button
                  ref={uploadButtonRef}
                  className={`upload-plus${portfolioLoading ? ' is-loading' : ''}`}
                  type="button"
                  onClick={openPortfolioPicker}
                  aria-label={text.uploadAria}
                  aria-busy={portfolioLoading}
                >
                  <SketchUploadArrowIcon />
                </button>
                <div className="upload-file-chip-list">
                  {portfolioEntries.map((entry) => {
                    const entryReviewStatus = resolveEntryReviewStatus(entry);
                    const entryReviewLabel = reviewStatusLabel(text, entryReviewStatus);

                    return (
                      <div
                        key={entry.id}
                        className={`upload-file-chip${entry.id === activePortfolio?.id ? ' is-active' : ''}`}
                      >
                        <button
                          className="upload-file-chip__trigger"
                          type="button"
                          onMouseEnter={(event) => {
                            if (!supportsHoverTooltip()) {
                              return;
                            }

                            openHoveredFileTooltip(entry, event.currentTarget);
                          }}
                          onMouseLeave={clearHoveredFileTooltip}
                          onFocus={(event) => {
                            if (
                              typeof event.currentTarget.matches === 'function' &&
                              !event.currentTarget.matches(':focus-visible')
                            ) {
                              return;
                            }

                            openHoveredFileTooltip(entry, event.currentTarget);
                          }}
                          onBlur={clearHoveredFileTooltip}
                          onClick={() => {
                            noteInteraction();
                            setActivePortfolioId(entry.id);
                          }}
                          aria-label={`${entry.fileName} · ${entryReviewLabel}`}
                          title={entry.fileName}
                        >
                          <span
                            className={`upload-file-chip__status upload-file-chip__status--${entryReviewStatus}`}
                            aria-hidden="true"
                          />
                          <span className="upload-file-chip__name" title={entry.fileName}>
                            {entry.fileName}
                          </span>
                        </button>
                        <button
                          className="upload-file-chip__clear"
                          type="button"
                          onMouseEnter={clearHoveredFileTooltip}
                          onFocus={clearHoveredFileTooltip}
                          onClick={() => handleClearPortfolio(entry.id)}
                          aria-label={text.clearUploadAria}
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
                {hoveredFileEntry && hoveredFileTooltipStyle ? (
                  <div className="upload-file-name-tooltip" style={hoveredFileTooltipStyle}>
                    {hoveredFileEntry.fileName}
                  </div>
                ) : null}
              </div>

            </>
          ) : (
            <div className="upload-plus-wrap">
              <button
                ref={uploadButtonRef}
                className={`upload-plus upload-plus--large${portfolioLoading ? ' is-loading' : ''}`}
                type="button"
                onClick={openPortfolioPicker}
                aria-label={text.uploadAria}
                aria-busy={portfolioLoading}
              >
                <SketchUploadArrowIcon />
              </button>
            </div>
          )}
          {portfolioError ? (
            <p className={`upload-error${portfolioErrorClosing ? ' is-fading' : ''}`}>
              {portfolioError}
            </p>
          ) : null}
        </div>
      </div>

      <div className="stage-frame">
        <div className="stage-tilt">
          <div className="stage-reveal">
            <div className={`stage-breath${!hasPortfolio ? ' is-intro' : ''}`}>
              <div className="stage-camera">
                <AtomSketch
                  atoms={atoms}
                  pulse={pulse}
                  centerMotion={centerMotion}
                  centerClickBurst={introCenterBurst}
                  standalone={!hasPortfolio}
                  svgRef={svgRef}
                  ariaLabel={text.atomAria}
                  highlightActive={highlightActive}
                  onCenterClick={hasPortfolio ? clearCenterSelection : triggerIntroCenterBurst}
                  onPointerDown={handleNodePointerDown}
                  onPointerEnter={handleNodeEnter}
                  onPointerMove={handleNodeMove}
                  onPointerLeave={handleNodeLeave}
                />
                {portfolioEntries.length ? (
                  <div className="portfolio-preview-layer">
                    {portfolioEntries
                      .slice(0, PORTFOLIO_PREVIEW_SLOTS.length)
                      .map((entry, index) => (
                        <PortfolioPreviewAtom
                          key={entry.id}
                          entry={entry}
                          slot={PORTFOLIO_PREVIEW_SLOTS[index]}
                        />
                      ))}
                  </div>
                ) : null}
              </div>
              {showCenterClearHit ? (
                <button
                  className="center-clear-hit"
                  type="button"
                  aria-label={text.clearCenterAria}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    event.preventDefault();
                  }}
                  onClick={clearCenterSelection}
                />
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <HoverCard atom={hoveredAtom} position={hoverInfo} language={language} />
    </main>
  );
}
