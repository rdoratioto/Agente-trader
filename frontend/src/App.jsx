import React, { useEffect, useMemo, useState } from "react";

/**
 * Agente Trader — MVP Dashboard
 * Versão limpa e estável
 *
 * Correções desta versão:
 * - Sem lucide-react, framer-motion ou recharts.
 * - Sem regex com caracteres invisíveis.
 * - Proteção para window, navigator e Notification.
 * - IDs únicos para mensagens e alertas.
 * - Dados vindos do backend são normalizados/enriquecidos antes de renderizar.
 * - Fallback local quando backend, Telegram ou Web Push falharem.
 * - Testes simples com console.assert.
 */

const SAFE_ENV = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};
const API_BASE_URL = SAFE_ENV.VITE_API_BASE_URL || "http://localhost:3001";
const VAPID_PUBLIC_KEY = SAFE_ENV.VITE_VAPID_PUBLIC_KEY || "";
const TELEGRAM_CHAT_ID = SAFE_ENV.VITE_TELEGRAM_CHAT_ID || "";
const IS_GITHUB_PAGES = typeof window !== "undefined" && window.location.hostname.endsWith("github.io");
const USE_BACKEND = !IS_GITHUB_PAGES && SAFE_ENV.VITE_USE_BACKEND !== "false";

const WATCHLIST = ["PETR4", "VALE3", "BOVA11", "HASH11", "MXRF11"];
const FALLBACK_NEWS = [
  {
    title: "Radar de mercado em modo demo",
    source: "Agente Trader",
    url: "https://www.bloomberg.com/markets",
    publishedAt: new Date().toISOString(),
    summary: "As notícias reais são atualizadas pelo GitHub Actions durante o build do Pages.",
  },
];

const ICONS = {
  bell: "🔔",
  brain: "🧠",
  up: "↗",
  down: "↘",
  activity: "📊",
  search: "🔎",
  filter: "⚙",
  alert: "⚠",
  check: "✓",
  refresh: "↻",
  database: "▣",
  wifi: "◉",
  offline: "○",
  server: "▤",
  gauge: "◌",
  chart: "⌁",
  support: "▔",
  resistance: "▁",
  sigma: "Σ",
  monitor: "▣",
  siren: "!",
  eye: "◉",
  bot: "🤖",
  send: "➤",
  radio: "◌",
  chat: "💬",
  user: "👤",
  spark: "✦",
  star: "★",
  list: "☷",
  shield: "◇",
  scale: "⚖",
  news: "◆",
};

const STORAGE_KEYS = {
  favorites: "agente-trader:favorites",
  profile: "agente-trader:profile",
  selectedTicker: "agente-trader:selected-ticker",
};

function createId(prefix = "id") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function hasNotificationSupport() {
  return typeof window !== "undefined" && "Notification" in window;
}

function hasServiceWorkerSupport() {
  return typeof navigator !== "undefined" && "serviceWorker" in navigator;
}

function readStoredJson(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = window.localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch (error) {
    return fallback;
  }
}

function readStoredText(key, fallback) {
  if (typeof window === "undefined") return fallback;
  return window.localStorage.getItem(key) || fallback;
}

function writeStoredJson(key, value) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function writeStoredText(key, value) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, value);
}

function Icon({ name, className = "", size = 18 }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-md ${className}`}
      style={{ width: size, height: size, fontSize: Math.max(12, size - 3), lineHeight: 1 }}
    >
      {ICONS[name] || "•"}
    </span>
  );
}

const fallbackRawAssets = [
  {
    ticker: "PETR4",
    name: "Petrobras PN",
    category: "Ação",
    price: 38.72,
    change: 1.84,
    volume: 42100000,
    source: "Simulado",
    updatedAt: "--",
    closes: [34.2, 34.7, 35.1, 35.6, 35.2, 35.8, 36.1, 36.4, 36.0, 36.3, 36.8, 37.0, 37.2, 37.5, 37.1, 37.7, 38.0, 38.1, 38.4, 38.72],
  },
  {
    ticker: "VALE3",
    name: "Vale ON",
    category: "Ação",
    price: 61.43,
    change: -0.92,
    volume: 25700000,
    source: "Simulado",
    updatedAt: "--",
    closes: [65.1, 64.8, 64.2, 63.7, 64.0, 63.6, 63.1, 62.8, 62.4, 62.1, 62.0, 61.9, 62.2, 61.7, 61.5, 61.2, 61.6, 61.8, 61.5, 61.43],
  },
  {
    ticker: "BOVA11",
    name: "ETF Ibovespa",
    category: "ETF",
    price: 127.85,
    change: 0.63,
    volume: 8400000,
    source: "Simulado",
    updatedAt: "--",
    closes: [119.2, 120.1, 121.5, 121.1, 122.4, 123.2, 123.8, 124.1, 124.9, 125.6, 126.2, 126.8, 126.4, 126.9, 127.1, 127.4, 127.0, 127.5, 127.2, 127.85],
  },
  {
    ticker: "HASH11",
    name: "ETF Cripto",
    category: "Cripto ETF",
    price: 52.18,
    change: 3.74,
    volume: 2900000,
    source: "Simulado",
    updatedAt: "--",
    closes: [42.5, 43.1, 44.0, 43.7, 44.9, 45.8, 46.4, 47.1, 47.9, 48.7, 49.6, 49.1, 50.2, 50.9, 51.4, 51.0, 51.8, 52.0, 51.7, 52.18],
  },
  {
    ticker: "MXRF11",
    name: "Maxi Renda FII",
    category: "FII",
    price: 10.31,
    change: 0.12,
    volume: 1700000,
    source: "Simulado",
    updatedAt: "--",
    closes: [10.12, 10.14, 10.18, 10.2, 10.19, 10.22, 10.21, 10.23, 10.24, 10.26, 10.28, 10.25, 10.27, 10.29, 10.3, 10.28, 10.31, 10.3, 10.32, 10.31],
  },
];

function urlBase64ToUint8Array(base64String) {
  if (typeof window === "undefined" || !base64String) return new Uint8Array();
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function formatCurrencyBRL(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return "--";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatVolume(value) {
  if (!value || Number.isNaN(Number(value))) return "--";
  const number = Number(value);
  if (number >= 1_000_000_000) return `${(number / 1_000_000_000).toFixed(1)}B`;
  if (number >= 1_000_000) return `${(number / 1_000_000).toFixed(1)}M`;
  if (number >= 1_000) return `${(number / 1_000).toFixed(1)}K`;
  return String(number);
}

function getSaoPauloMarketStatus(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const weekday = parts.find((part) => part.type === "weekday")?.value;
  const hour = Number(parts.find((part) => part.type === "hour")?.value || 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value || 0);
  const minutes = hour * 60 + minute;
  const isWeekend = weekday === "Sat" || weekday === "Sun";

  if (isWeekend) {
    return { label: "Mercado fechado", detail: "Fim de semana na B3", state: "closed" };
  }

  if (minutes >= 10 * 60 && minutes <= 17 * 60 + 55) {
    return { label: "Mercado aberto", detail: "Pregão regular da B3", state: "open" };
  }

  if (minutes >= 9 * 60 + 30 && minutes < 10 * 60) {
    return { label: "Pré-abertura", detail: "Abertura regular às 10:00", state: "preopen" };
  }

  if (minutes > 17 * 60 + 55 && minutes <= 18 * 60 + 30) {
    return { label: "Pós-mercado", detail: "Pregão regular encerrado", state: "after" };
  }

  return { label: "Mercado fechado", detail: "Fora do horário regular da B3", state: "closed" };
}

function average(values) {
  if (!Array.isArray(values) || values.length === 0) return 0;
  return values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length;
}

function calculateSMA(values, period) {
  if (!Array.isArray(values) || values.length === 0) return 0;
  return average(values.slice(-period));
}

function calculateEMA(values, period) {
  const numbers = Array.isArray(values) ? values.map(Number).filter(Number.isFinite) : [];
  if (!numbers.length) return 0;
  const multiplier = 2 / (period + 1);
  return numbers.reduce((ema, value, index) => (index === 0 ? value : value * multiplier + ema * (1 - multiplier)), numbers[0]);
}

function calculateMACD(values) {
  const numbers = Array.isArray(values) ? values.map(Number).filter(Number.isFinite) : [];
  const ema12 = calculateEMA(numbers, 12);
  const ema26 = calculateEMA(numbers, 26);
  const macd = ema12 - ema26;
  const macdSeries = numbers.map((_, index) => {
    const slice = numbers.slice(0, index + 1);
    return calculateEMA(slice, 12) - calculateEMA(slice, 26);
  });
  const signal = calculateEMA(macdSeries, 9);
  return { macd, signal, histogram: macd - signal };
}

function calculateStandardDeviation(values) {
  const numbers = Array.isArray(values) ? values.map(Number).filter(Number.isFinite) : [];
  if (!numbers.length) return 0;
  const mean = average(numbers);
  const variance = average(numbers.map((value) => (value - mean) ** 2));
  return Math.sqrt(variance);
}

function calculateBollingerBands(values, period = 20) {
  const recent = Array.isArray(values) ? values.slice(-period).map(Number).filter(Number.isFinite) : [];
  const middle = average(recent);
  const deviation = calculateStandardDeviation(recent);
  return { upper: middle + deviation * 2, middle, lower: middle - deviation * 2 };
}

function calculateRSI(values, period = 14) {
  if (!Array.isArray(values) || values.length < period + 1) return 50;
  const recent = values.slice(-(period + 1));
  let gains = 0;
  let losses = 0;

  for (let i = 1; i < recent.length; i += 1) {
    const diff = Number(recent[i]) - Number(recent[i - 1]);
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function calculateSupportResistance(values) {
  if (!Array.isArray(values) || values.length === 0) return { support: 0, resistance: 0 };
  const recent = values.slice(-20).map(Number).filter((value) => Number.isFinite(value));
  if (!recent.length) return { support: 0, resistance: 0 };
  return { support: Math.min(...recent), resistance: Math.max(...recent) };
}

function detectCategory(symbol, longName = "") {
  const lowerName = String(longName).toLowerCase();
  const upperSymbol = String(symbol || "").toUpperCase();
  if (lowerName.includes("fii") || lowerName.includes("fundo imobili")) return "FII";
  if (upperSymbol.includes("HASH")) return "Cripto ETF";
  if (lowerName.includes("etf") || upperSymbol.endsWith("11")) return "ETF/FII";
  return "Ação";
}

function calculateTechnicalScore({ price, change, volume, sma9, sma21, sma200, rsi, support, resistance }) {
  let score = 50;
  const reasons = [];

  if (price > sma9) {
    score += 8;
    reasons.push("preço acima da média de 9 períodos");
  } else {
    score -= 8;
    reasons.push("preço abaixo da média de 9 períodos");
  }

  if (sma9 > sma21) {
    score += 12;
    reasons.push("média curta acima da média de 21 períodos");
  } else {
    score -= 10;
    reasons.push("média curta abaixo da média de 21 períodos");
  }

  if (sma200 && price > sma200) {
    score += 10;
    reasons.push("preço acima da tendência principal");
  } else if (sma200) {
    score -= 10;
    reasons.push("preço abaixo da tendência principal");
  }

  if (rsi >= 45 && rsi <= 65) {
    score += 8;
    reasons.push("RSI saudável");
  } else if (rsi > 70) {
    score -= 8;
    reasons.push("RSI em sobrecompra");
  } else if (rsi < 30) {
    score += 5;
    reasons.push("RSI em sobrevenda");
  } else {
    score -= 2;
    reasons.push("RSI sem vantagem clara");
  }

  if (Number(change) > 1) {
    score += 8;
    reasons.push("variação positiva no período");
  } else if (Number(change) < -1) {
    score -= 8;
    reasons.push("variação negativa no período");
  }

  if (Number(volume) > 1_000_000) {
    score += 4;
    reasons.push("volume relevante");
  }

  const distanceToResistance = resistance && price ? ((resistance - price) / price) * 100 : 0;
  const distanceToSupport = support && price ? ((price - support) / price) * 100 : 0;

  if (distanceToResistance < 1 && distanceToResistance >= 0) {
    score -= 5;
    reasons.push("preço perto da resistência");
  }

  if (distanceToSupport < 1.5 && distanceToSupport >= 0) {
    score += 4;
    reasons.push("preço perto do suporte");
  }

  return { score: Math.max(0, Math.min(100, Math.round(score))), reasons };
}

function defineSignal(score, rsi, price, resistance, support) {
  const nearResistance = resistance ? (resistance - price) / price <= 0.01 && resistance >= price : false;
  const lostSupport = support ? price < support : false;
  if (lostSupport || score <= 35) return "Vender";
  if (score >= 75 && rsi < 72 && !nearResistance) return "Comprar";
  if (score >= 65) return "Comprar com cautela";
  if (score >= 52) return "Manter";
  return "Observar";
}

function defineRiskAndProfile({ category, change, rsi, score }) {
  const abs = Math.abs(Number(change || 0));
  if (category === "FII" || category === "ETF/FII") {
    if (abs < 1.2 && rsi < 70) return { profile: "Conservador", risk: "Baixo/Médio" };
    return { profile: "Moderado", risk: "Médio" };
  }
  if (category === "Cripto ETF" || abs >= 3 || rsi > 72) return { profile: "Agressivo", risk: "Muito alto" };
  if (score >= 70 || abs >= 1.5) return { profile: "Agressivo", risk: "Alto" };
  return { profile: "Moderado", risk: "Médio" };
}

function defineTrend({ price, sma9, sma21, sma200 }) {
  if (price > sma9 && sma9 > sma21 && sma21 >= sma200 * 0.98) return "Alta";
  if (price < sma9 && sma9 < sma21) return "Baixa";
  return "Lateral";
}

function defineIndicatorSignal(asset) {
  const positives = [
    asset.trend === "Alta",
    asset.macdHistogram > 0,
    asset.price > asset.bollingerMiddle,
    asset.relativeVolume >= 1,
  ].filter(Boolean).length;

  if (positives >= 3 && asset.rsi < 72) return "Confirma compra";
  if (asset.trend === "Baixa" || asset.macdHistogram < 0 || asset.price < asset.bollingerLower) return "Defensivo";
  return "Neutro";
}

function defineDecisionLight({ signal, score, rsi, trend, macdHistogram, price, support, resistance }) {
  const nearResistance = resistance && price ? (resistance - price) / price <= 0.012 && resistance >= price : false;
  const nearSupport = support && price ? (price - support) / price <= 0.015 && price >= support : false;
  const lostSupport = support && price ? price < support : false;

  if (lostSupport || signal === "Vender" || score <= 35) {
    return {
      action: "Sair no stop",
      state: "stop",
      color: "red",
      reason: "Tese técnica enfraquecida ou suporte perdido. Prioridade é proteger capital.",
    };
  }

  if (score <= 48 || trend === "Baixa" || macdHistogram < 0) {
    return {
      action: "Reduzir posição",
      state: "reduce",
      color: "orange",
      reason: "Momentum fraco. Vale diminuir exposição ou evitar nova entrada.",
    };
  }

  if (nearResistance || rsi >= 76) {
    return {
      action: "Realizar parcial",
      state: "trim",
      color: "amber",
      reason: "Preço esticado ou perto da resistência. Melhor proteger parte do ganho.",
    };
  }

  if ((signal === "Comprar" || signal === "Comprar com cautela") && score >= 68 && trend !== "Baixa" && macdHistogram >= 0) {
    return {
      action: nearSupport ? "Comprar com risco controlado" : "Comprar",
      state: "buy",
      color: "green",
      reason: nearSupport ? "Sinal positivo e preço próximo ao suporte favorecem risco/retorno." : "Score, tendência e momentum favorecem estudo de compra.",
    };
  }

  return {
    action: "Aguardar",
    state: "wait",
    color: "blue",
    reason: "Sem confirmação suficiente. Melhor esperar preço, volume ou tendência alinharem.",
  };
}

function buildChartData(closes) {
  const values = Array.isArray(closes) ? closes : [];
  const labels = ["D-9", "D-8", "D-7", "D-6", "D-5", "D-4", "D-3", "D-2", "D-1", "Hoje"];
  return values.slice(-10).map((value, index) => ({ label: labels[index] || `D-${index}`, value: Number(value) }));
}

function enrichAsset(rawAsset = {}) {
  const fallback = fallbackRawAssets.find((item) => item.ticker === rawAsset.ticker) || fallbackRawAssets[0];
  const rawCloses = Array.isArray(rawAsset.closes) && rawAsset.closes.length ? rawAsset.closes : rawAsset.data?.map((point) => point.value || point.v).filter(Boolean);
  const closes = Array.isArray(rawCloses) && rawCloses.length ? rawCloses.map(Number) : fallback.closes;
  const price = Number(rawAsset.price || rawAsset.regularMarketPrice || closes[closes.length - 1] || fallback.price || 0);
  const ticker = String(rawAsset.ticker || rawAsset.symbol || fallback.ticker).toUpperCase();
  const name = rawAsset.name || rawAsset.longName || rawAsset.shortName || fallback.name || ticker;
  const category = rawAsset.category || detectCategory(ticker, name);
  const change = Number(rawAsset.change ?? rawAsset.regularMarketChangePercent ?? fallback.change ?? 0);
  const volume = Number(rawAsset.volume ?? rawAsset.regularMarketVolume ?? fallback.volume ?? 0);
  const source = rawAsset.source || fallback.source || "Local";
  const updatedAt = rawAsset.updatedAt || new Date().toLocaleString("pt-BR");

  const sma9 = calculateSMA(closes, 9);
  const sma21 = calculateSMA(closes, 21);
  const sma200 = calculateSMA(closes, Math.min(200, closes.length));
  const rsi = calculateRSI(closes, 14);
  const macdData = calculateMACD(closes);
  const bollinger = calculateBollingerBands(closes, 20);
  const { support, resistance } = calculateSupportResistance(closes);
  const technical = calculateTechnicalScore({ price, change, volume, sma9, sma21, sma200, rsi, support, resistance });
  const signal = rawAsset.signal || defineSignal(technical.score, rsi, price, resistance, support);
  const riskData = defineRiskAndProfile({ category, change, rsi, score: technical.score });
  const trend = defineTrend({ price, sma9, sma21, sma200 });
  const averageVolume = fallback.volume || volume || 1;
  const relativeVolume = Number(volume || 0) / Number(averageVolume || 1);
  const decision = defineDecisionLight({ signal, score: technical.score, rsi, trend, macdHistogram: macdData.histogram, price, support, resistance });
  const stop = support ? support * 0.992 : price * 0.97;
  const target = resistance && resistance > price ? resistance : price * 1.06;
  const entry = signal === "Comprar" ? price * 1.002 : resistance ? resistance * 1.003 : price * 1.01;

  const reason = rawAsset.reason || `Score técnico ${technical.score}/100. O agente identificou ${technical.reasons.slice(0, 4).join(", ")}. ${
    signal === "Comprar"
      ? "Sinal forte, mas respeite stop e tamanho de posição."
      : signal === "Comprar com cautela"
      ? "Existe oportunidade, mas falta confirmação mais limpa."
      : signal === "Vender"
      ? "Cenário técnico fraco; prioridade é proteger capital."
      : signal === "Manter"
      ? "Cenário positivo, mas sem grande assimetria para nova entrada."
      : "Melhor aguardar confirmação antes de operar."
  }`;

  return {
    ...rawAsset,
    ticker,
    name,
    category,
    price,
    change,
    volume,
    source,
    updatedAt,
    closes,
    signal,
    risk: rawAsset.risk || riskData.risk,
    profile: rawAsset.profile || riskData.profile,
    confidence: Number(rawAsset.confidence ?? technical.score),
    score: Number(rawAsset.score ?? technical.score),
    rsi: Number(rawAsset.rsi ?? rsi),
    sma9: Number(rawAsset.sma9 ?? sma9),
    sma21: Number(rawAsset.sma21 ?? sma21),
    sma200: Number(rawAsset.sma200 ?? sma200),
    macd: Number(rawAsset.macd ?? macdData.macd),
    macdSignal: Number(rawAsset.macdSignal ?? macdData.signal),
    macdHistogram: Number(rawAsset.macdHistogram ?? macdData.histogram),
    bollingerUpper: Number(rawAsset.bollingerUpper ?? bollinger.upper),
    bollingerMiddle: Number(rawAsset.bollingerMiddle ?? bollinger.middle),
    bollingerLower: Number(rawAsset.bollingerLower ?? bollinger.lower),
    relativeVolume: Number(rawAsset.relativeVolume ?? relativeVolume),
    trend: rawAsset.trend || trend,
    decision: rawAsset.decision || decision,
    support: Number(rawAsset.support ?? support),
    resistance: Number(rawAsset.resistance ?? resistance),
    entry: rawAsset.entry || formatCurrencyBRL(entry),
    stop: rawAsset.stop || formatCurrencyBRL(stop),
    target: rawAsset.target || formatCurrencyBRL(target),
    volumeLabel: rawAsset.volumeLabel || formatVolume(volume),
    reason,
    data: Array.isArray(rawAsset.data) && rawAsset.data.length ? rawAsset.data.map((point) => ({ label: point.label || point.d || "", value: Number(point.value ?? point.v ?? 0) })) : buildChartData(closes),
  };
}

function createAlertFromAsset(asset) {
  const now = new Date();
  const time = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const nearResistance = asset.resistance ? Math.abs(asset.resistance - asset.price) / asset.price <= 0.008 : false;
  const nearSupport = asset.support ? Math.abs(asset.price - asset.support) / asset.price <= 0.01 : false;

  if (asset.score >= 75 && asset.signal === "Comprar") {
    return { id: createId(`${asset.ticker}-buy`), ticker: asset.ticker, severity: "high", type: "Compra", title: `${asset.ticker}: sinal técnico forte`, text: `Score ${asset.score}/100, RSI ${asset.rsi.toFixed(1)} e tendência favorável.`, time, read: false };
  }
  if (asset.score >= 65 && asset.signal === "Comprar com cautela") {
    return { id: createId(`${asset.ticker}-caution`), ticker: asset.ticker, severity: "medium", type: "Atenção", title: `${asset.ticker}: oportunidade em observação`, text: `Score ${asset.score}/100. Exige confirmação antes de entrada agressiva.`, time, read: false };
  }
  if (asset.signal === "Vender" || asset.score <= 35) {
    return { id: createId(`${asset.ticker}-sell`), ticker: asset.ticker, severity: "high", type: "Risco", title: `${asset.ticker}: risco técnico elevado`, text: `Score ${asset.score}/100. Revisar stop, exposição ou saída.`, time, read: false };
  }
  if (asset.rsi >= 70) {
    return { id: createId(`${asset.ticker}-rsi-high`), ticker: asset.ticker, severity: "medium", type: "RSI", title: `${asset.ticker}: RSI em sobrecompra`, text: `RSI em ${asset.rsi.toFixed(1)}. Evitar entrada por impulso.`, time, read: false };
  }
  if (asset.rsi <= 30) {
    return { id: createId(`${asset.ticker}-rsi-low`), ticker: asset.ticker, severity: "medium", type: "RSI", title: `${asset.ticker}: RSI em sobrevenda`, text: `RSI em ${asset.rsi.toFixed(1)}. Pode haver repique, mas precisa confirmar reversão.`, time, read: false };
  }
  if (nearResistance) {
    return { id: createId(`${asset.ticker}-resistance`), ticker: asset.ticker, severity: "medium", type: "Resistência", title: `${asset.ticker}: perto da resistência`, text: `Preço próximo de ${formatCurrencyBRL(asset.resistance)}.`, time, read: false };
  }
  if (nearSupport) {
    return { id: createId(`${asset.ticker}-support`), ticker: asset.ticker, severity: "low", type: "Suporte", title: `${asset.ticker}: próximo do suporte`, text: `Preço próximo de ${formatCurrencyBRL(asset.support)}.`, time, read: false };
  }
  return null;
}

function generateAlerts(assets) {
  const severityWeight = { high: 3, medium: 2, low: 1 };
  return assets
    .map((asset) => createAlertFromAsset(enrichAsset(asset)))
    .filter(Boolean)
    .sort((a, b) => severityWeight[b.severity] - severityWeight[a.severity]);
}

function getAssetBias(asset) {
  if (asset.signal === "Comprar") return 18;
  if (asset.signal === "Comprar com cautela") return 10;
  if (asset.signal === "Manter") return 4;
  if (asset.signal === "Observar") return -2;
  if (asset.signal === "Vender") return -20;
  return 0;
}

function getProfileFitScore(asset, profile) {
  if (profile === "Todos") return 0;
  if (asset.profile === profile) return 14;
  if (profile === "Conservador" && (asset.category === "FII" || asset.category === "ETF/FII")) return 8;
  if (profile === "Conservador" && asset.risk.includes("Muito")) return -25;
  if (profile === "Moderado" && asset.risk === "Muito alto") return -12;
  if (profile === "Agressivo" && asset.score >= 65) return 8;
  return -4;
}

function rankAssetsForConversation(assets, profile = "Todos") {
  return assets
    .map(enrichAsset)
    .map((asset) => {
      const distanceToResistance = asset.resistance && asset.price ? ((asset.resistance - asset.price) / asset.price) * 100 : 0;
      const resistancePenalty = distanceToResistance >= 0 && distanceToResistance < 1 ? 8 : 0;
      const totalScore = asset.score + getAssetBias(asset) + getProfileFitScore(asset, profile) - resistancePenalty;
      return { ...asset, conversationalScore: Math.round(totalScore) };
    })
    .sort((a, b) => b.conversationalScore - a.conversationalScore);
}

function describeAssetShort(asset) {
  return `${asset.ticker} está com score ${asset.score}/100, semáforo ${asset.decision.action}, sinal ${asset.signal}, tendência ${asset.trend}, MACD ${asset.macdHistogram >= 0 ? "positivo" : "negativo"}, RSI ${asset.rsi.toFixed(1)} e risco ${asset.risk}`;
}

function buildActionPlan(asset) {
  if (!asset) return "Ainda não tenho um ativo com vantagem suficiente para montar plano.";
  return `Meu plano de estudo para ${asset.ticker}: semáforo em "${asset.decision.action}", observar entrada em ${asset.entry}, usar stop em ${asset.stop} e alvo em ${asset.target}. A tese só continua válida se o preço respeitar suporte, o volume não secar e o RSI não ficar ainda mais esticado. Se perder suporte, eu deixaria de pensar em compra e passaria para proteção.`;
}

function buildHumanizedAnswer({ opening, take, evidence, action, caveat }) {
  return [
    opening,
    "",
    `Leitura direta: ${take}`,
    `Por quê: ${evidence}`,
    `Ação prática: ${action}`,
    `Cuidado: ${caveat || "isso é um radar de estudo, não uma ordem. Tamanho de posição e stop vêm antes de qualquer convicção."}`,
  ].filter(Boolean).join("\n");
}

function buildInvestmentAnswer(message, assets, profile) {
  const text = normalizeText(message);
  const safeAssets = assets.map(enrichAsset);
  const ranked = rankAssetsForConversation(safeAssets, profile);
  const best = ranked.filter((asset) => asset.signal !== "Vender").slice(0, 3);
  const weak = [...safeAssets].sort((a, b) => a.score - b.score).slice(0, 2);
  const strong = best[0];

  if (text.includes("plano") || text.includes("entrada") || text.includes("stop") || text.includes("alvo")) {
    return {
      focusTicker: strong?.ticker,
      text: buildHumanizedAnswer({
        opening: "Boa. Vou pensar como se a gente estivesse montando uma operação no papel, com critério e sem impulso.",
        take: strong ? `eu começaria estudando ${strong.ticker}, mas sem entrar no automático.` : "não apareceu um ativo forte o suficiente para virar plano agora.",
        evidence: strong ? describeAssetShort(strong) : "o radar não encontrou assimetria clara.",
        action: buildActionPlan(strong),
        caveat: "se o preço abrir muito longe da entrada ou bater perto da resistência, eu esperaria nova confirmação.",
      }),
    };
  }

  if (text.includes("comparar") || text.includes("compare")) {
    const comparison = ranked.slice(0, 4).map((asset) => `${asset.ticker}: score ${asset.score}/100, sinal ${asset.signal}, risco ${asset.risk}`).join("; ");
    return {
      focusTicker: ranked[0]?.ticker,
      text: buildHumanizedAnswer({
        opening: "Vamos comparar com calma. Eu olho primeiro força técnica, risco e se o ativo combina com seu perfil.",
        take: `${ranked[0]?.ticker || "nenhum ativo"} aparece melhor no ranking agora.`,
        evidence: comparison,
        action: `Eu estudaria ${ranked[0]?.ticker || "o primeiro do ranking"} antes dos outros e deixaria ${weak[0]?.ticker || "o mais fraco"} em observação defensiva.`,
        caveat: "ranking não é certeza. Ele só mostra prioridade de estudo com os dados disponíveis.",
      }),
    };
  }

  if (text.includes("carteira") || text.includes("alocar") || text.includes("posicao") || text.includes("posição")) {
    const conservative = rankAssetsForConversation(safeAssets, "Conservador").slice(0, 2);
    const growth = rankAssetsForConversation(safeAssets, "Agressivo").filter((asset) => asset.signal !== "Vender").slice(0, 2);
    return {
      text: buildHumanizedAnswer({
        opening: "Para carteira, eu não olharia só 'qual sobe mais'. Eu separaria defesa, oportunidade e controle de risco.",
        take: `base defensiva com ${conservative.map((asset) => asset.ticker).join(", ") || "--"} e bloco de oportunidade com ${growth.map((asset) => asset.ticker).join(", ") || "--"}.`,
        evidence: "os ativos defensivos tendem a ter risco menor no radar, enquanto o bloco agressivo busca score e momentum.",
        action: "eu evitaria concentrar tudo no ativo de maior score. Melhor montar uma lista curta, definir limite por ativo e só aumentar posição depois de confirmação.",
      }),
    };
  }

  if (text.includes("noticia") || text.includes("notícia") || text.includes("bloomberg")) {
    return {
      text: "Eu deixei uma faixa de notícias/atalhos de mercado no rodapé com links para Bloomberg Markets e Bloomberg Stocks. Como este deploy é estático e gratuito, eu não leio manchetes fechadas em tempo real dentro do app; uso os links oficiais para você abrir a cobertura atualizada.",
    };
  }

  if (text.includes("conservador")) {
    const conservative = rankAssetsForConversation(safeAssets, "Conservador").filter((asset) => !asset.risk.includes("Muito")).slice(0, 3);
    return {
      profileSuggestion: "Conservador",
      text: buildHumanizedAnswer({
        opening: "Entendi seu perfil. Sendo conservador, eu prefiro preservar capital antes de caçar oportunidade.",
        take: `eu olharia primeiro para ${conservative.map((asset) => asset.ticker).join(", ") || "nenhum ativo agora"}.`,
        evidence: `${conservative[0]?.ticker || "o melhor encaixe"} tem risco ${conservative[0]?.risk || "menor"}, score ${conservative[0]?.score || "--"}/100 e sinal ${conservative[0]?.signal || "neutro"}.`,
        action: "eu só estudaria entrada com posição pequena, stop definido e sem mexer em reserva de emergência.",
      }),
    };
  }

  if (text.includes("agressivo")) {
    const aggressive = rankAssetsForConversation(safeAssets, "Agressivo").slice(0, 3);
    return {
      profileSuggestion: "Agressivo",
      text: buildHumanizedAnswer({
        opening: "Perfil agressivo aceita mais oscilação, mas não aceita operar sem plano.",
        take: `o radar puxa mais para ${aggressive.map((asset) => asset.ticker).join(", ") || "nenhum ativo agora"}.`,
        evidence: `${aggressive[0]?.ticker || "o destaque"} tem score ${aggressive[0]?.score || "--"}/100 e sinal ${aggressive[0]?.signal || "neutro"}.`,
        action: "eu trataria como operação tática: entrada planejada, stop obrigatório e realização parcial se chegar perto do alvo.",
        caveat: "quanto mais agressivo o ativo, menor deveria ser a posição inicial.",
      }),
    };
  }

  if (text.includes("moderado")) {
    const moderate = rankAssetsForConversation(safeAssets, "Moderado").slice(0, 3);
    return {
      profileSuggestion: "Moderado",
      text: buildHumanizedAnswer({
        opening: "Para perfil moderado, o jogo é equilíbrio: não travar por medo, mas também não comprar qualquer sinal.",
        take: `no radar agora aparecem ${moderate.map((asset) => `${asset.ticker} (${asset.score}/100)`).join(", ") || "poucos nomes bons"}.`,
        evidence: `${moderate[0]?.ticker || "o melhor nome"} combina melhor score e risco dentro desse perfil.`,
        action: "eu estudaria uma entrada gradual e só reforçaria se o ativo confirmar força depois.",
      }),
    };
  }

  if (text.includes("vender") || text.includes("sair") || text.includes("realizar")) {
    return {
      focusTicker: weak[0]?.ticker,
      text: buildHumanizedAnswer({
        opening: "Para vender, eu separo duas coisas: realizar lucro e cortar risco. São decisões diferentes.",
        take: `os ativos que mais pedem atenção são ${weak.map((asset) => `${asset.ticker} com score ${asset.score}/100 e sinal ${asset.signal}`).join("; ")}.`,
        evidence: "score baixo, perda de suporte ou RSI ruim indicam que a tese enfraqueceu.",
        action: `eu revisaria stop e exposição em ${weak[0]?.ticker || "quem estiver mais fraco"}. Se já perdeu suporte, proteger capital vira prioridade.`,
        caveat: "eu não venderia no automático sem olhar seu preço de entrada e objetivo da posição.",
      }),
    };
  }

  if (text.includes("risco") || text.includes("perigoso") || text.includes("evitar")) {
    const risky = [...safeAssets].sort((a, b) => {
      const aRisk = a.risk.includes("Muito") ? 3 : a.risk === "Alto" ? 2 : 1;
      const bRisk = b.risk.includes("Muito") ? 3 : b.risk === "Alto" ? 2 : 1;
      return bRisk - aRisk || a.score - b.score;
    }).slice(0, 3);
    return {
      focusTicker: risky[0]?.ticker,
      text: buildHumanizedAnswer({
        opening: "Aqui eu vou ser mais defensivo, porque risco mal lido costuma custar caro.",
        take: `os pontos mais perigosos agora são ${risky.map((asset) => `${asset.ticker} (${asset.risk}, score ${asset.score}/100)`).join(", ")}.`,
        evidence: "RSI alto, preço perto de resistência e variação forte aumentam chance de entrada ruim.",
        action: "eu reduziria pressa, esperaria recuo ou confirmação e usaria stop mais disciplinado.",
      }),
    };
  }

  if (text.includes("onde") || text.includes("investir") || text.includes("comprar") || text.includes("melhor") || text.includes("oportunidade")) {
    return {
      focusTicker: strong?.ticker,
      text: buildHumanizedAnswer({
        opening: "Olhando só o radar técnico de agora, eu consigo priorizar o que vale estudar primeiro.",
        take: `meu top 3 seria ${best.map((asset, index) => `${index + 1}. ${asset.ticker} (${asset.score}/100, ${asset.signal}, risco ${asset.risk})`).join("; ")}.`,
        evidence: strong ? describeAssetShort(strong) : "não apareceu ativo forte o bastante.",
        action: strong ? buildActionPlan(strong) : "eu esperaria novo sinal antes de comprar.",
      }),
    };
  }

  return {
    text: buildHumanizedAnswer({
      opening: "Estou contigo. Me fala se você quer comprar, vender, comparar ou montar carteira que eu respondo em cima do radar.",
      take: `o ativo mais interessante para estudar agora é ${strong?.ticker || "nenhum"}.`,
      evidence: strong ? describeAssetShort(strong) : "os sinais estão fracos ou inconclusivos.",
      action: `você pode perguntar: "onde investir?", "o que vender?", "monte um plano", "compare os ativos" ou "explique ${strong?.ticker || "um ativo"}".`,
    }),
  };
}

function explainAssetForChat(asset) {
  const safeAsset = enrichAsset(asset);
  return buildHumanizedAnswer({
    opening: `Vamos olhar ${safeAsset.ticker} com objetividade.`,
    take: `${safeAsset.signal} no radar, com risco ${safeAsset.risk}.`,
    evidence: `Semáforo: ${safeAsset.decision.action}. Preço ${formatCurrencyBRL(safeAsset.price)}, score ${safeAsset.score}/100, tendência ${safeAsset.trend}, MACD ${safeAsset.macdHistogram.toFixed(2)}, RSI ${safeAsset.rsi.toFixed(1)}, Bollinger entre ${formatCurrencyBRL(safeAsset.bollingerLower)} e ${formatCurrencyBRL(safeAsset.bollingerUpper)}, suporte ${formatCurrencyBRL(safeAsset.support)} e resistência ${formatCurrencyBRL(safeAsset.resistance)}. ${safeAsset.reason}`,
    action: buildActionPlan(safeAsset),
    caveat: "se você já estiver posicionado, a decisão muda conforme seu preço médio e prazo.",
  });
}

async function fetchMarketData(symbols) {
  if (USE_BACKEND) {
    const query = encodeURIComponent(symbols.join(","));
    const response = await fetch(`${API_BASE_URL}/api/market/quotes?symbols=${query}`);
    if (!response.ok) throw new Error(`Backend de mercado não respondeu: ${response.status}`);
    const payload = await response.json();
    if (!payload.ok) throw new Error(payload.error || "Resposta inválida do backend de mercado.");
    const backendAssets = Array.isArray(payload.assets) ? payload.assets : [];
    return backendAssets.map(enrichAsset);
  }

  await new Promise((resolve) => setTimeout(resolve, 250));
  return fallbackRawAssets.map((asset) => enrichAsset({ ...asset, updatedAt: new Date().toLocaleString("pt-BR") }));
}

async function sendChatToBackend({ message, profile, symbols }) {
  const response = await fetch(`${API_BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, profile, symbols }),
  });

  if (!response.ok) throw new Error(`Backend do chat não respondeu: ${response.status}`);
  const payload = await response.json();
  if (!payload.ok) throw new Error(payload.error || "Resposta inválida do backend do chat.");
  return payload.response;
}

function badgeClass(signal) {
  if (signal === "Comprar") return "bg-emerald-500/15 text-emerald-300 border-emerald-400/30";
  if (signal === "Comprar com cautela") return "bg-amber-500/15 text-amber-300 border-amber-400/30";
  if (signal === "Vender") return "bg-red-500/15 text-red-300 border-red-400/30";
  if (signal === "Manter") return "bg-blue-500/15 text-blue-300 border-blue-400/30";
  return "bg-slate-500/15 text-slate-300 border-slate-400/30";
}

function alertClass(severity) {
  if (severity === "high") return "border-red-300/20 bg-red-300/10 text-red-100";
  if (severity === "medium") return "border-amber-300/20 bg-amber-300/10 text-amber-100";
  return "border-cyan-300/20 bg-cyan-300/10 text-cyan-100";
}

function riskClass(risk) {
  if (risk && (risk.includes("Muito") || risk === "Alto")) return "text-red-300";
  if (risk === "Médio") return "text-amber-300";
  return "text-emerald-300";
}

function indicatorClass(signal) {
  if (signal === "bullish") return "border-emerald-300/20 bg-emerald-300/10 text-emerald-100";
  if (signal === "bearish") return "border-red-300/20 bg-red-300/10 text-red-100";
  return "border-amber-300/20 bg-amber-300/10 text-amber-100";
}

function decisionClass(color) {
  const classes = {
    green: "border-emerald-300/30 bg-emerald-300/15 text-emerald-100",
    blue: "border-cyan-300/30 bg-cyan-300/15 text-cyan-100",
    amber: "border-amber-300/30 bg-amber-300/15 text-amber-100",
    orange: "border-orange-300/30 bg-orange-300/15 text-orange-100",
    red: "border-red-300/30 bg-red-300/15 text-red-100",
  };
  return classes[color] || classes.blue;
}

function runLogicTests() {
  const testAssets = fallbackRawAssets.map(enrichAsset);
  console.assert(formatCurrencyBRL(10.5).includes("R$"), "formatCurrencyBRL deve retornar BRL");
  console.assert(calculateSMA([1, 2, 3], 2) === 2.5, "calculateSMA deve calcular média correta");
  console.assert(calculateRSI([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], 14) === 100, "RSI de sequência crescente deve ser 100");
  console.assert(testAssets.every((asset) => asset.score >= 0 && asset.score <= 100), "Score deve ficar entre 0 e 100");
  console.assert(generateAlerts(testAssets).length > 0, "Deve gerar pelo menos um alerta com dados simulados");
  console.assert(buildChartData([1, 2, 3]).length === 3, "buildChartData deve preservar quantidade de pontos disponíveis");
  console.assert(detectCategory("HASH11", "") === "Cripto ETF", "HASH11 deve ser classificado como Cripto ETF");
  console.assert(rankAssetsForConversation(testAssets, "Conservador")[0].ticker, "Ranking conversacional deve retornar pelo menos um ativo");
  console.assert(buildInvestmentAnswer("onde investir", testAssets, "Todos").text.includes("top 3"), "Chat deve responder pergunta de investimento com ranking");
  console.assert(normalizeText("ação") === "acao", "normalizeText deve remover acentos");
  console.assert(createId("test") !== createId("test"), "createId deve gerar IDs diferentes");
  console.assert(typeof hasNotificationSupport() === "boolean", "hasNotificationSupport deve retornar boolean");
  console.assert(typeof hasServiceWorkerSupport() === "boolean", "hasServiceWorkerSupport deve retornar boolean");
}

if (typeof window !== "undefined" && !window.__AGENTE_TRADER_TESTS_RAN__) {
  window.__AGENTE_TRADER_TESTS_RAN__ = true;
  runLogicTests();
}

function MiniChart({ data, positive = true }) {
  const width = 140;
  const height = 58;
  const points = Array.isArray(data) && data.length ? data : [{ value: 0 }];
  const values = points.map((point) => Number(point.value || 0));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = points.length > 1 ? width / (points.length - 1) : width;
  const path = points
    .map((point, index) => {
      const x = index * step;
      const y = height - ((Number(point.value || 0) - min) / range) * height;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full overflow-visible" role="img" aria-label="Mini gráfico do ativo">
      <path d={path} fill="none" stroke="currentColor" strokeWidth="3" className={positive ? "text-emerald-300" : "text-red-300"} />
      <path d={`${path} L${width},${height} L0,${height} Z`} fill="currentColor" className={positive ? "text-emerald-300/10" : "text-red-300/10"} />
    </svg>
  );
}

function MetricCard({ icon, label, value, helper }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center gap-2 text-slate-400">
        <Icon name={icon} size={16} />
        <p className="text-xs">{label}</p>
      </div>
      <p className="mt-2 text-lg font-black text-white">{value}</p>
      {helper && <p className="mt-1 text-xs text-slate-500">{helper}</p>}
    </div>
  );
}

function AlertIcon({ type, severity }) {
  if (type === "Compra") return <Icon name="check" className="bg-emerald-400/10 text-emerald-300" />;
  if (severity === "high") return <Icon name="siren" className="bg-red-400/10 text-red-300" />;
  if (type === "RSI") return <Icon name="gauge" className="bg-amber-400/10 text-amber-300" />;
  if (type === "Suporte") return <Icon name="support" className="bg-cyan-400/10 text-cyan-300" />;
  return <Icon name="alert" className="bg-amber-400/10 text-amber-300" />;
}

function Toast({ alert, onClose, onOpen }) {
  return (
    <div className={`fixed right-5 top-5 z-50 w-[calc(100vw-40px)] max-w-md rounded-3xl border p-4 shadow-2xl backdrop-blur-xl ${alertClass(alert.severity)}`}>
      <div className="flex items-start gap-3">
        <div className="mt-1"><AlertIcon type={alert.type} severity={alert.severity} /></div>
        <button onClick={onOpen} className="flex-1 text-left">
          <p className="text-sm font-black">{alert.title}</p>
          <p className="mt-1 text-sm opacity-80">{alert.text}</p>
          <p className="mt-2 text-xs opacity-60">Clique para abrir o ativo</p>
        </button>
        <button onClick={onClose} className="rounded-full px-2 text-xl hover:bg-white/10" aria-label="Fechar alerta">×</button>
      </div>
    </div>
  );
}

function AgentChat({ messages, input, onInputChange, onSend, onQuickAsk }) {
  const quickPrompts = [
    "Onde investir hoje?",
    "O que comprar?",
    "O que vender?",
    "Monte um plano",
    "Compare os ativos",
    "Sou conservador",
    "Sou agressivo",
    "Ver notícias Bloomberg",
  ];

  return (
    <div className="rounded-3xl border border-cyan-300/20 bg-cyan-300/10 p-5 shadow-2xl shadow-black/20">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-cyan-100">
            <Icon name="chat" className="bg-cyan-300/10 text-cyan-200" />
            <h2 className="text-xl font-black">Copiloto de investimentos</h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-cyan-100/75">
            Converse com o agente para entender oportunidades, riscos e próximos passos. Ele usa o radar técnico atual e sempre trabalha com gestão de risco.
          </p>
        </div>
        <span className="rounded-full border border-cyan-200/20 bg-black/20 px-3 py-1 text-xs font-bold text-cyan-100">Beta</span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {quickPrompts.map((prompt) => (
          <button key={prompt} onClick={() => onQuickAsk(prompt)} className="rounded-full border border-white/10 bg-black/20 px-3 py-2 text-xs font-bold text-cyan-50 transition hover:bg-white/10">
            {prompt}
          </button>
        ))}
      </div>

      <div className="mt-5 max-h-80 space-y-3 overflow-auto rounded-3xl border border-white/10 bg-black/25 p-4">
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[88%] whitespace-pre-line rounded-3xl border px-4 py-3 text-sm leading-6 ${message.role === "user" ? "border-cyan-300/20 bg-cyan-300/15 text-cyan-50" : "border-white/10 bg-white/10 text-slate-100"}`}>
              <div className="mb-1 flex items-center gap-2 text-xs font-bold opacity-70">
                <Icon name={message.role === "user" ? "user" : "spark"} size={14} />
                {message.role === "user" ? "Você" : "Agente"}
              </div>
              {message.text}
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={onSend} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
        <input value={input} onChange={(event) => onInputChange(event.target.value)} placeholder="Pergunte: onde investir, o que vender, qual o risco..." className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500" />
        <button className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-200">
          <Icon name="send" /> Conversar
        </button>
      </form>

      <p className="mt-3 text-xs leading-5 text-cyan-100/60">Aviso: o agente não substitui consultor financeiro. Ele ajuda a estudar cenários, mas a decisão final e o risco são seus.</p>
    </div>
  );
}

function AssetCard({ asset, selected, favorite, onClick }) {
  const safeAsset = enrichAsset(asset);
  const isPositive = safeAsset.change >= 0;
  return (
    <button onClick={onClick} className={`text-left rounded-3xl border p-5 transition-all shadow-xl shadow-black/10 hover:-translate-y-1 ${selected ? "border-cyan-400/70 bg-cyan-400/10" : "border-white/10 bg-white/[0.06] hover:bg-white/[0.09]"}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-bold text-white">{safeAsset.ticker}</h3>
            {favorite && <Icon name="star" className="text-amber-300" size={16} />}
            <span className="rounded-full bg-white/10 px-2 py-1 text-xs text-slate-300">{safeAsset.category}</span>
          </div>
          <p className="mt-1 text-sm text-slate-400">{safeAsset.name}</p>
        </div>
        <div className={`flex items-center gap-1 text-sm font-semibold ${isPositive ? "text-emerald-300" : "text-red-300"}`}>
          <Icon name={isPositive ? "up" : "down"} size={16} />
          {isPositive ? "+" : ""}{Number(safeAsset.change || 0).toFixed(2)}%
        </div>
      </div>

      <div className="mt-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm text-slate-400">Preço</p>
          <p className="text-2xl font-bold text-white">{formatCurrencyBRL(safeAsset.price)}</p>
        </div>
        <div className="h-16 w-32"><MiniChart data={safeAsset.data} positive={isPositive} /></div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${badgeClass(safeAsset.signal)}`}>{safeAsset.signal}</span>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">Score: {safeAsset.score}/100</span>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">RSI: {safeAsset.rsi.toFixed(1)}</span>
      </div>
    </button>
  );
}

function MetricHeader({ icon, label, value }) {
  return (
    <div className="rounded-2xl bg-white/5 p-4">
      <Icon name={icon} className="bg-cyan-300/10 text-cyan-300" size={22} />
      <p className="mt-3 text-sm text-slate-400">{label}</p>
      <p className="text-lg font-bold text-white">{value}</p>
    </div>
  );
}

function MarketStatusBadge({ status }) {
  const classes = {
    open: "border-emerald-300/30 bg-emerald-300/15 text-emerald-100",
    preopen: "border-amber-300/30 bg-amber-300/15 text-amber-100",
    after: "border-cyan-300/30 bg-cyan-300/15 text-cyan-100",
    closed: "border-red-300/30 bg-red-300/15 text-red-100",
  };

  return (
    <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-bold ${classes[status.state] || classes.closed}`}>
      <span className={`h-2 w-2 rounded-full ${status.state === "open" ? "bg-emerald-300" : status.state === "closed" ? "bg-red-300" : "bg-amber-300"}`} />
      {status.label}
      <span className="hidden text-xs font-medium opacity-70 sm:inline">{status.detail}</span>
    </div>
  );
}

function SmallBox({ label, value, color = "text-white" }) {
  return (
    <div className="rounded-2xl bg-white/5 p-4">
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`mt-1 font-bold ${color}`}>{value}</p>
    </div>
  );
}

function IndicatorBox({ label, value, helper, signal = "neutral" }) {
  return (
    <div className={`rounded-2xl border p-4 ${indicatorClass(signal)}`}>
      <p className="text-xs font-bold uppercase opacity-65">{label}</p>
      <p className="mt-2 text-lg font-black">{value}</p>
      <p className="mt-1 text-xs leading-5 opacity-75">{helper}</p>
    </div>
  );
}

function DecisionSemaphore({ decision }) {
  const steps = [
    { state: "buy", label: "Comprar", color: "bg-emerald-300" },
    { state: "wait", label: "Aguardar", color: "bg-cyan-300" },
    { state: "trim", label: "Realizar", color: "bg-amber-300" },
    { state: "reduce", label: "Reduzir", color: "bg-orange-300" },
    { state: "stop", label: "Stop", color: "bg-red-300" },
  ];

  return (
    <div className={`rounded-3xl border p-5 ${decisionClass(decision.color)}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-wide opacity-70">Semáforo de decisão</p>
          <h3 className="mt-2 text-2xl font-black">{decision.action}</h3>
          <p className="mt-2 text-sm leading-6 opacity-80">{decision.reason}</p>
        </div>
        <Icon name="scale" size={26} />
      </div>
      <div className="mt-5 grid grid-cols-5 gap-2">
        {steps.map((step) => {
          const active = step.state === decision.state;
          return (
            <div key={step.state} className={`rounded-2xl border border-white/10 p-2 text-center ${active ? "bg-white/15" : "bg-black/20 opacity-55"}`}>
              <div className={`mx-auto h-3 w-3 rounded-full ${step.color} ${active ? "shadow-[0_0_18px_currentColor]" : ""}`} />
              <p className="mt-2 text-[10px] font-bold">{step.label}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AlertCenter({ alerts, selectedAssetAlerts, onMarkRead, onSelectTicker }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.07] p-6 shadow-2xl shadow-black/20">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Icon name="bell" className="bg-amber-300/10 text-amber-300" />
          <h2 className="text-xl font-bold text-white">Central de alertas</h2>
        </div>
        <button onClick={onMarkRead} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300 hover:bg-white/10">Marcar lidos</button>
      </div>
      <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 p-3 text-sm">
        <div className="flex items-center gap-2 text-slate-300">
          <Icon name="eye" />
          <span>Alertas deste ativo</span>
        </div>
        <span className="font-bold text-white">{selectedAssetAlerts.length}</span>
      </div>
      <div className="mt-5 max-h-[360px] space-y-3 overflow-auto pr-1">
        {alerts.length === 0 && <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-400">Nenhum alerta ativo no momento.</div>}
        {alerts.map((alert) => (
          <button key={alert.id} onClick={() => onSelectTicker(alert.ticker)} className={`w-full rounded-2xl border p-4 text-left transition hover:scale-[1.01] ${alertClass(alert.severity)} ${alert.read ? "opacity-55" : "opacity-100"}`}>
            <div className="flex items-start gap-3">
              <div className="mt-1"><AlertIcon type={alert.type} severity={alert.severity} /></div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-bold">{alert.title}</h3>
                  <span className="text-xs opacity-60">{alert.time}</span>
                  {!alert.read && <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold">NOVO</span>}
                </div>
                <p className="mt-1 text-sm leading-5 opacity-80">{alert.text}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function InfoBox({ icon, title, text, color = "cyan" }) {
  const colorClasses = {
    cyan: "border-cyan-300/20 bg-cyan-300/10 text-cyan-100",
    emerald: "border-emerald-300/20 bg-emerald-300/10 text-emerald-100",
    amber: "border-amber-300/20 bg-amber-300/10 text-amber-100",
  };
  return (
    <div className={`rounded-3xl border p-5 ${colorClasses[color]}`}>
      <div className="flex items-start gap-3">
        <Icon name={icon} size={22} />
        <div>
          <h3 className="font-bold">{title}</h3>
          <p className="mt-1 text-sm leading-6 opacity-80">{text}</p>
        </div>
      </div>
    </div>
  );
}

function RadarSummaryCard({ icon, label, title, detail, color = "cyan" }) {
  const colorClasses = {
    cyan: "border-cyan-300/20 bg-cyan-300/10 text-cyan-100",
    emerald: "border-emerald-300/20 bg-emerald-300/10 text-emerald-100",
    amber: "border-amber-300/20 bg-amber-300/10 text-amber-100",
    red: "border-red-300/20 bg-red-300/10 text-red-100",
  };

  return (
    <div className={`rounded-3xl border p-5 ${colorClasses[color]}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide opacity-70">{label}</p>
          <p className="mt-2 text-2xl font-black">{title}</p>
          <p className="mt-2 text-sm leading-6 opacity-80">{detail}</p>
        </div>
        <Icon name={icon} size={24} />
      </div>
    </div>
  );
}

function TradeIdeaCard({ icon, title, assets, emptyText, color = "cyan", onAsk }) {
  const colorClasses = {
    cyan: "border-cyan-300/20 bg-cyan-300/10 text-cyan-100",
    emerald: "border-emerald-300/20 bg-emerald-300/10 text-emerald-100",
    amber: "border-amber-300/20 bg-amber-300/10 text-amber-100",
    red: "border-red-300/20 bg-red-300/10 text-red-100",
  };

  return (
    <div className={`rounded-3xl border p-5 ${colorClasses[color]}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Icon name={icon} size={18} />
            <h3 className="font-black">{title}</h3>
          </div>
          <div className="mt-4 space-y-3">
            {assets.length === 0 && <p className="text-sm opacity-75">{emptyText}</p>}
            {assets.map((asset) => (
              <button key={asset.ticker} onClick={() => onAsk(`Explique ${asset.ticker} e monte plano com entrada, stop e alvo`)} className="w-full rounded-2xl border border-white/10 bg-black/20 p-3 text-left transition hover:bg-white/10">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-black">{asset.ticker}</span>
                  <span className="text-xs font-bold opacity-75">Score {asset.score}/100</span>
                </div>
                <p className="mt-1 text-xs leading-5 opacity-75">{asset.decision.action} · {asset.risk} · entrada {asset.entry}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function NewsTicker({ news }) {
  const items = news.length ? news.slice(0, 8).map((item) => ({ label: `${item.source}: ${item.title}`, url: item.url })) : FALLBACK_NEWS.map((item) => ({ label: item.title, url: item.url }));
  const repeatedItems = [...items, ...items, ...items];

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-red-500/30 bg-slate-950 text-white shadow-2xl">
      <div className="flex h-12 items-center overflow-hidden">
        <div className="flex h-full shrink-0 items-center gap-2 bg-red-600 px-4 text-xs font-black uppercase tracking-wide">
          <Icon name="news" size={14} />
          Mercado agora
        </div>
        <div className="hidden h-full shrink-0 items-center border-r border-white/10 bg-white px-4 text-xs font-black uppercase text-slate-950 sm:flex">Radar</div>
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="flex w-max animate-[ticker_55s_linear_infinite] items-center gap-8 whitespace-nowrap px-4 text-sm font-semibold">
            {repeatedItems.map((item, index) => (
              <a key={`${item.label}-${index}`} href={item.url} target="_blank" rel="noreferrer" className="text-slate-100 transition hover:text-red-200">
                <span className="mr-3 text-red-300">●</span>{item.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MarketNewsPanel({ news, updatedAt }) {
  const formattedUpdatedAt = updatedAt ? new Date(updatedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "--";

  return (
    <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-black/20">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-cyan-100">
            <Icon name="news" className="bg-cyan-300/10 text-cyan-300" />
            <h2 className="text-2xl font-black text-white">Notícias reais de mercado</h2>
          </div>
          <p className="mt-2 text-sm text-slate-400">Feed público atualizado no deploy automático do GitHub Pages.</p>
        </div>
        <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-bold text-slate-300">Atualizado: {formattedUpdatedAt}</span>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        {news.slice(0, 6).map((item) => (
          <a key={`${item.source}-${item.title}`} href={item.url} target="_blank" rel="noreferrer" className="rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:-translate-y-0.5 hover:bg-white/10">
            <div className="flex items-center justify-between gap-3">
              <span className="rounded-full bg-cyan-300/10 px-2 py-1 text-xs font-bold text-cyan-100">{item.source}</span>
              <span className="text-xs text-slate-500">{new Date(item.publishedAt).toLocaleDateString("pt-BR")}</span>
            </div>
            <h3 className="mt-3 line-clamp-3 text-sm font-black leading-6 text-white">{item.title}</h3>
            <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-400">{item.summary || "Abrir notícia na fonte."}</p>
          </a>
        ))}
      </div>
    </section>
  );
}

function App() {
  const [assets, setAssets] = useState(fallbackRawAssets.map(enrichAsset));
  const [selectedTicker, setSelectedTicker] = useState(() => readStoredText(STORAGE_KEYS.selectedTicker, "HASH11"));
  const [profile, setProfile] = useState(() => readStoredText(STORAGE_KEYS.profile, "Todos"));
  const [query, setQuery] = useState("");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [favoriteTickers, setFavoriteTickers] = useState(() => readStoredJson(STORAGE_KEYS.favorites, ["HASH11", "MXRF11"]));
  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("mock");
  const [error, setError] = useState("");
  const [alerts, setAlerts] = useState(() => generateAlerts(fallbackRawAssets.map(enrichAsset)));
  const [toast, setToast] = useState(null);
  const [browserPermission, setBrowserPermission] = useState(hasNotificationSupport() ? window.Notification.permission : "unsupported");
  const [webPushStatus, setWebPushStatus] = useState("not_configured");
  const [telegramStatus, setTelegramStatus] = useState("idle");
  const [chatInput, setChatInput] = useState("");
  const [marketStatus, setMarketStatus] = useState(() => getSaoPauloMarketStatus());
  const [marketNews, setMarketNews] = useState({ updatedAt: "", items: FALLBACK_NEWS });
  const [chatMessages, setChatMessages] = useState(() => [
    {
      id: "welcome",
      role: "assistant",
      text: "Fala, mano. Eu sou seu copiloto de investimentos. Posso te dizer quais ativos estudar primeiro, quais evitar, onde tem risco e qual entrada/stop/alvo o radar está enxergando. Pergunte: onde investir hoje?",
    },
  ]);

  const selectedAsset = assets.find((asset) => asset.ticker === selectedTicker) || assets[0] || enrichAsset(fallbackRawAssets[0]);
  const safeSelectedAsset = enrichAsset(selectedAsset);
  const selectedAssetAlerts = alerts.filter((alert) => alert.ticker === safeSelectedAsset.ticker);
  const favoriteSet = useMemo(() => new Set(favoriteTickers), [favoriteTickers]);
  const selectedIsFavorite = favoriteSet.has(safeSelectedAsset.ticker);
  const enrichedAssets = useMemo(() => assets.map(enrichAsset), [assets]);
  const radarSummary = useMemo(() => {
    const ranked = rankAssetsForConversation(enrichedAssets, profile);
    const best = ranked.find((asset) => asset.signal !== "Vender") || ranked[0];
    const riskiest = [...enrichedAssets].sort((a, b) => {
      const aRisk = a.risk.includes("Muito") ? 3 : a.risk === "Alto" ? 2 : 1;
      const bRisk = b.risk.includes("Muito") ? 3 : b.risk === "Alto" ? 2 : 1;
      return bRisk - aRisk || b.score - a.score;
    })[0];

    return { best, riskiest };
  }, [enrichedAssets, profile]);
  const buyCandidates = useMemo(() => {
    return rankAssetsForConversation(enrichedAssets, profile).filter((asset) => asset.signal !== "Vender" && asset.score >= 65).slice(0, 3);
  }, [enrichedAssets, profile]);
  const sellCandidates = useMemo(() => {
    return [...enrichedAssets].filter((asset) => asset.signal === "Vender" || asset.score <= 45 || asset.rsi >= 82).sort((a, b) => a.score - b.score).slice(0, 3);
  }, [enrichedAssets]);
  const watchCandidates = useMemo(() => {
    return [...enrichedAssets].filter((asset) => asset.signal === "Manter" || asset.signal === "Observar").sort((a, b) => b.score - a.score).slice(0, 3);
  }, [enrichedAssets]);

  function toggleSelectedFavorite() {
    setFavoriteTickers((current) => {
      if (current.includes(safeSelectedAsset.ticker)) return current.filter((ticker) => ticker !== safeSelectedAsset.ticker);
      return [...current, safeSelectedAsset.ticker].sort();
    });
  }

  function sendBrowserNotification(alert) {
    if (!hasNotificationSupport() || window.Notification.permission !== "granted") return;
    window.Notification(`Agente Trader — ${alert.title}`, { body: alert.text, tag: alert.id, silent: false });
  }

  function registerAlerts(nextAssets) {
    const nextAlerts = generateAlerts(nextAssets);
    setAlerts((current) => {
      const existingKeys = new Set(current.map((alert) => `${alert.ticker}-${alert.type}-${alert.title}`));
      const freshAlerts = nextAlerts.filter((alert) => !existingKeys.has(`${alert.ticker}-${alert.type}-${alert.title}`));
      const merged = [...freshAlerts, ...current].slice(0, 20);
      if (freshAlerts.length) {
        setToast(freshAlerts[0]);
        sendBrowserNotification(freshAlerts[0]);
      }
      return merged;
    });
  }

  async function requestBrowserPermission() {
    if (!hasNotificationSupport()) {
      setBrowserPermission("unsupported");
      return false;
    }
    const permission = await window.Notification.requestPermission();
    setBrowserPermission(permission);
    if (permission === "granted") {
      const testAlert = {
        id: createId("test"),
        ticker: safeSelectedAsset.ticker,
        severity: "low",
        type: "Sistema",
        title: "Push local ativado",
        text: "Agora o painel pode mostrar notificações do navegador.",
        time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        read: false,
      };
      setToast(testAlert);
      sendBrowserNotification(testAlert);
    }
    return permission === "granted";
  }

  async function registerWebPush() {
    try {
      if (!hasServiceWorkerSupport()) {
        setWebPushStatus("unsupported");
        throw new Error("Este navegador não suporta Service Worker.");
      }
      const allowed = await requestBrowserPermission();
      if (!allowed) {
        setWebPushStatus("permission_denied");
        return;
      }
      if (!VAPID_PUBLIC_KEY) {
        setWebPushStatus("missing_vapid_key");
        setToast({
          id: createId("push-missing"),
          ticker: safeSelectedAsset.ticker,
          severity: "medium",
          type: "Sistema",
          title: "Web Push ainda não configurado",
          text: "Falta VITE_VAPID_PUBLIC_KEY. Configure VAPID e backend para push real.",
          time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
          read: false,
        });
        return;
      }
      const registration = await navigator.serviceWorker.register("/sw.js");
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) });
      const response = await fetch(`${API_BASE_URL}/api/push/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription, watchlist: WATCHLIST, createdAt: new Date().toISOString() }),
      });
      if (!response.ok) throw new Error("Backend de Web Push não respondeu corretamente.");
      setWebPushStatus("subscribed");
      setToast({ id: createId("push-ok"), ticker: safeSelectedAsset.ticker, severity: "low", type: "Sistema", title: "Web Push real ativado", text: "Subscription criada e enviada ao backend.", time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }), read: false });
    } catch (err) {
      setWebPushStatus("error");
      setError(err && err.message ? err.message : "Falha ao registrar Web Push.");
    }
  }

  async function sendTelegramAlert(alert) {
    if (!alert) return;
    setTelegramStatus("sending");
    try {
      const response = await fetch(`${API_BASE_URL}/api/telegram/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: TELEGRAM_CHAT_ID, alert, asset: safeSelectedAsset }),
      });
      if (!response.ok) throw new Error("Backend do Telegram não respondeu corretamente.");
      setTelegramStatus("sent");
      setToast({ id: createId("telegram-ok"), ticker: safeSelectedAsset.ticker, severity: "low", type: "Telegram", title: "Alerta enviado ao Telegram", text: `${alert.title} foi enviado para o chat configurado.`, time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }), read: false });
    } catch (err) {
      setTelegramStatus("error");
      setError(err && err.message ? err.message : "Falha ao enviar alerta para Telegram.");
    }
  }

  async function loadMarketData() {
    setLoading(true);
    setError("");
    try {
      const data = await fetchMarketData(WATCHLIST);
      if (!data.length) throw new Error("Nenhum ativo retornado pelo provedor.");
      const enrichedData = data.map(enrichAsset);
      setAssets(enrichedData);
      registerAlerts(enrichedData);
      setConnectionStatus(USE_BACKEND ? "online" : "mock");
    } catch (err) {
      const fallbackAssets = fallbackRawAssets.map(enrichAsset);
      setConnectionStatus("offline");
      setError(err && err.message ? err.message : "Falha ao buscar dados do mercado.");
      setAssets(fallbackAssets);
      registerAlerts(fallbackAssets);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMarketData();
    const interval = setInterval(loadMarketData, 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = setTimeout(() => setToast(null), 7000);
    return () => clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    const interval = setInterval(() => setMarketStatus(getSaoPauloMarketStatus()), 30_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let ignore = false;
    fetch("news.json")
      .then((response) => {
        if (!response.ok) throw new Error(`News feed HTTP ${response.status}`);
        return response.json();
      })
      .then((payload) => {
        if (!ignore && Array.isArray(payload.items) && payload.items.length) setMarketNews(payload);
      })
      .catch(() => {
        if (!ignore) setMarketNews({ updatedAt: new Date().toISOString(), items: FALLBACK_NEWS });
      });

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    writeStoredJson(STORAGE_KEYS.favorites, favoriteTickers);
  }, [favoriteTickers]);

  useEffect(() => {
    writeStoredText(STORAGE_KEYS.profile, profile);
  }, [profile]);

  useEffect(() => {
    writeStoredText(STORAGE_KEYS.selectedTicker, selectedTicker);
  }, [selectedTicker]);

  const filteredAssets = useMemo(() => {
    return enrichedAssets.filter((asset) => {
      const matchesProfile = profile === "Todos" || asset.profile === profile;
      const matchesFavorite = !showFavoritesOnly || favoriteSet.has(asset.ticker);
      const text = `${asset.ticker} ${asset.name} ${asset.category}`.toLowerCase();
      return matchesProfile && matchesFavorite && text.includes(query.toLowerCase());
    });
  }, [enrichedAssets, favoriteSet, profile, query, showFavoritesOnly]);

  const unreadAlerts = alerts.filter((alert) => !alert.read).length;
  const providerName = USE_BACKEND ? "Backend API" : "Mock local";

  function markAlertsAsRead() {
    setAlerts((current) => current.map((alert) => ({ ...alert, read: true })));
  }

  async function handleChatPrompt(rawPrompt) {
    const prompt = String(rawPrompt || "").trim();
    if (!prompt) return;

    setChatMessages((current) => [...current, { id: createId("user"), role: "user", text: prompt }]);
    setChatInput("");

    try {
      let answer;

      if (USE_BACKEND) {
        answer = await sendChatToBackend({ message: prompt, profile, symbols: WATCHLIST });
      } else {
        const normalized = normalizeText(prompt);
        const mentionedAsset = assets.map(enrichAsset).find((asset) => normalized.includes(asset.ticker.toLowerCase()));
        answer = mentionedAsset ? { focusTicker: mentionedAsset.ticker, text: explainAssetForChat(mentionedAsset) } : buildInvestmentAnswer(prompt, assets, profile);
      }

      if (answer.profileSuggestion) setProfile(answer.profileSuggestion);
      if (answer.focusTicker) setSelectedTicker(answer.focusTicker);

      setChatMessages((current) => [...current, { id: createId("assistant"), role: "assistant", text: answer.text || "Não consegui montar uma resposta agora." }]);
    } catch (err) {
      const normalized = normalizeText(prompt);
      const mentionedAsset = assets.map(enrichAsset).find((asset) => normalized.includes(asset.ticker.toLowerCase()));
      const fallbackAnswer = mentionedAsset ? { focusTicker: mentionedAsset.ticker, text: explainAssetForChat(mentionedAsset) } : buildInvestmentAnswer(prompt, assets, profile);

      if (fallbackAnswer.profileSuggestion) setProfile(fallbackAnswer.profileSuggestion);
      if (fallbackAnswer.focusTicker) setSelectedTicker(fallbackAnswer.focusTicker);

      setChatMessages((current) => [
        ...current,
        {
          id: createId("assistant"),
          role: "assistant",
          text: `${fallbackAnswer.text}\n\nObs.: respondi pelo modo local porque o backend não respondeu agora.`,
        },
      ]);
    }
  }

  function handleChatSubmit(event) {
    event.preventDefault();
    handleChatPrompt(chatInput);
  }

  return (
    <div className="min-h-screen bg-[#070B16] pb-16 text-slate-100">
      {toast && <Toast alert={toast} onClose={() => setToast(null)} onOpen={() => { setSelectedTicker(toast.ticker); setToast(null); }} />}

      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 left-20 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute right-10 top-32 h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl" />
      </div>

      <main className="relative mx-auto max-w-7xl px-5 py-8 lg:px-8">
        <header className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-sm text-cyan-200"><Icon name="brain" size={16} /> Agente Trader com IA</div>
              <MarketStatusBadge status={marketStatus} />
            </div>
            <h1 className="mt-5 text-4xl font-black tracking-tight text-white md:text-6xl">Alertas internos em <span className="text-cyan-300">tempo real</span></h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">Versão limpa, com fallback seguro, backend opcional e sem dependências externas de ícones/gráficos.</p>
          </div>

          <div className="grid gap-3 rounded-3xl border border-white/10 bg-white/[0.06] p-4 shadow-2xl shadow-black/20 sm:grid-cols-3 lg:min-w-[500px]">
            <MetricHeader icon="database" label="Fonte" value={providerName} />
            <MetricHeader icon={connectionStatus === "offline" ? "offline" : connectionStatus === "online" ? "wifi" : "server"} label="Status" value={connectionStatus === "online" ? "Online" : connectionStatus === "offline" ? "Fallback" : "Simulado"} />
            <MetricHeader icon="bell" label="Alertas" value={`${unreadAlerts} novos`} />
          </div>
        </header>

        <section className="mt-8 grid gap-4 rounded-3xl border border-white/10 bg-white/[0.05] p-4 lg:grid-cols-[1fr_auto_auto_auto_auto]">
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
            <Icon name="search" className="text-slate-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar ativo, exemplo: PETR4, ETF, FII..." className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500" />
          </div>

          <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
            <Icon name="filter" className="text-slate-400" />
            <select value={profile} onChange={(event) => setProfile(event.target.value)} className="bg-transparent text-sm text-white outline-none">
              <option className="bg-slate-900">Todos</option>
              <option className="bg-slate-900">Conservador</option>
              <option className="bg-slate-900">Moderado</option>
              <option className="bg-slate-900">Agressivo</option>
            </select>
          </div>

          <button onClick={loadMarketData} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-300/30 bg-cyan-300/10 px-5 py-3 text-sm font-bold text-cyan-100 transition hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-60"><Icon name="refresh" className={loading ? "animate-spin" : ""} /> Atualizar</button>
          <button onClick={() => setShowFavoritesOnly((current) => !current)} className={`inline-flex items-center justify-center gap-2 rounded-2xl border px-5 py-3 text-sm font-bold transition ${showFavoritesOnly ? "border-amber-300/50 bg-amber-300/20 text-amber-100" : "border-white/10 bg-black/20 text-slate-200 hover:bg-white/10"}`}><Icon name="star" /> Favoritos</button>
          <button onClick={registerWebPush} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-300/30 bg-amber-300/10 px-5 py-3 text-sm font-bold text-amber-100 transition hover:bg-amber-300/20"><Icon name="monitor" /> {webPushStatus === "subscribed" ? "Web Push ativo" : browserPermission === "denied" ? "Push bloqueado" : "Ativar Web Push"}</button>
          <button onClick={() => sendTelegramAlert(selectedAssetAlerts[0] || alerts[0])} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-300/30 bg-emerald-300/10 px-5 py-3 text-sm font-bold text-emerald-100 transition hover:bg-emerald-300/20"><Icon name="send" /> {telegramStatus === "sending" ? "Enviando..." : telegramStatus === "sent" ? "Telegram OK" : "Testar Telegram"}</button>
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-3">
          <RadarSummaryCard icon="spark" label="Melhor estudo" title={radarSummary.best?.ticker || "--"} detail={`${radarSummary.best?.signal || "Sem sinal"} com score ${radarSummary.best?.score ?? "--"}/100 para perfil ${profile}.`} color="emerald" />
          <RadarSummaryCard icon="alert" label="Maior atenção" title={radarSummary.riskiest?.ticker || "--"} detail={`${radarSummary.riskiest?.risk || "Risco não calculado"} e RSI ${radarSummary.riskiest?.rsi?.toFixed ? radarSummary.riskiest.rsi.toFixed(1) : "--"}.`} color="red" />
          <RadarSummaryCard icon="star" label="Favoritos" title={`${favoriteTickers.length} ativos`} detail={favoriteTickers.length ? favoriteTickers.join(", ") : "Nenhum favorito marcado ainda."} color="amber" />
        </section>

        <section className="mt-6">
          <DecisionSemaphore decision={safeSelectedAsset.decision} />
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-3">
          <TradeIdeaCard icon="check" title="Estudar compra" assets={buyCandidates} emptyText="Sem compra clara no radar agora." color="emerald" onAsk={handleChatPrompt} />
          <TradeIdeaCard icon="shield" title="Reduzir ou vender" assets={sellCandidates} emptyText="Nenhum ativo exigindo venda imediata pelo score." color="red" onAsk={handleChatPrompt} />
          <TradeIdeaCard icon="eye" title="Só observar" assets={watchCandidates} emptyText="Nada neutro no filtro atual." color="cyan" onAsk={handleChatPrompt} />
        </section>

        <section className="mt-8">
          <AgentChat messages={chatMessages} input={chatInput} onInputChange={setChatInput} onSend={handleChatSubmit} onQuickAsk={handleChatPrompt} />
        </section>

        <MarketNewsPanel news={marketNews.items} updatedAt={marketNews.updatedAt} />

        {error && <section className="mt-4 rounded-3xl border border-red-300/20 bg-red-300/10 p-4 text-sm text-red-100"><div className="flex items-start gap-3"><Icon name="alert" /><p>{error}. O painel voltou para dados simulados para não quebrar a experiência.</p></div></section>}

        <section className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.9fr]">
          <div className="space-y-6">
            <AlertCenter alerts={alerts} selectedAssetAlerts={selectedAssetAlerts} onMarkRead={markAlertsAsRead} onSelectTicker={setSelectedTicker} />

            <div>
            <div className="mb-4 flex items-center justify-between"><h2 className="text-2xl font-bold text-white">Watchlist</h2><p className="text-sm text-slate-400">{filteredAssets.length} ativos encontrados</p></div>
            {filteredAssets.length === 0 && <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 text-sm text-slate-300">Nenhum ativo encontrado com os filtros atuais.</div>}
            <div className="grid gap-4 md:grid-cols-2">{filteredAssets.map((asset) => <AssetCard key={asset.ticker} asset={asset} favorite={favoriteSet.has(asset.ticker)} selected={selectedTicker === asset.ticker} onClick={() => setSelectedTicker(asset.ticker)} />)}</div>
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/[0.07] p-6 shadow-2xl shadow-black/20">
              <div className="flex items-start justify-between gap-4">
                <div><p className="text-sm text-slate-400">Análise técnica do ativo</p><h2 className="mt-1 text-3xl font-black text-white">{safeSelectedAsset.ticker}</h2><p className="text-sm text-slate-400">{safeSelectedAsset.name}</p></div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${badgeClass(safeSelectedAsset.signal)}`}>{safeSelectedAsset.signal}</span>
                  <button onClick={toggleSelectedFavorite} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold transition ${selectedIsFavorite ? "border-amber-300/40 bg-amber-300/15 text-amber-200" : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"}`}><Icon name="star" size={14} /> {selectedIsFavorite ? "Favorito" : "Favoritar"}</button>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <MetricCard icon="gauge" label="Score" value={`${safeSelectedAsset.score}/100`} helper="Força técnica" />
                <MetricCard icon="sigma" label="RSI 14" value={safeSelectedAsset.rsi.toFixed(1)} helper={safeSelectedAsset.rsi > 70 ? "Sobrecompra" : safeSelectedAsset.rsi < 30 ? "Sobrevenda" : "Neutro"} />
                <MetricCard icon="activity" label="Volume" value={safeSelectedAsset.volumeLabel} helper="Liquidez" />
                <MetricCard icon="database" label="Fonte" value={safeSelectedAsset.source} helper="Dados" />
              </div>

              <div className="mt-6 h-56 rounded-3xl border border-white/10 bg-black/20 p-4"><MiniChart data={safeSelectedAsset.data} positive={safeSelectedAsset.change >= 0} /></div>

              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <MetricCard icon="chart" label="SMA 9" value={formatCurrencyBRL(safeSelectedAsset.sma9)} />
                <MetricCard icon="chart" label="SMA 21" value={formatCurrencyBRL(safeSelectedAsset.sma21)} />
                <MetricCard icon="support" label="Suporte" value={formatCurrencyBRL(safeSelectedAsset.support)} />
                <MetricCard icon="resistance" label="Resistência" value={formatCurrencyBRL(safeSelectedAsset.resistance)} />
              </div>

              <div className="mt-6 rounded-3xl border border-white/10 bg-black/20 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Icon name="scale" className="bg-cyan-300/10 text-cyan-300" />
                    <h3 className="font-bold text-white">Indicadores avançados</h3>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs font-bold ${indicatorClass(defineIndicatorSignal(safeSelectedAsset) === "Confirma compra" ? "bullish" : defineIndicatorSignal(safeSelectedAsset) === "Defensivo" ? "bearish" : "neutral")}`}>{defineIndicatorSignal(safeSelectedAsset)}</span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <IndicatorBox label="Tendência" value={safeSelectedAsset.trend} helper={`Preço ${safeSelectedAsset.price > safeSelectedAsset.sma21 ? "acima" : "abaixo"} da média de 21.`} signal={safeSelectedAsset.trend === "Alta" ? "bullish" : safeSelectedAsset.trend === "Baixa" ? "bearish" : "neutral"} />
                  <IndicatorBox label="MACD" value={safeSelectedAsset.macdHistogram.toFixed(2)} helper={safeSelectedAsset.macdHistogram >= 0 ? "Momentum favorece compradores." : "Momentum perdeu força."} signal={safeSelectedAsset.macdHistogram >= 0 ? "bullish" : "bearish"} />
                  <IndicatorBox label="Bollinger" value={`${formatCurrencyBRL(safeSelectedAsset.bollingerLower)} - ${formatCurrencyBRL(safeSelectedAsset.bollingerUpper)}`} helper={safeSelectedAsset.price > safeSelectedAsset.bollingerUpper ? "Preço esticado acima da banda." : safeSelectedAsset.price < safeSelectedAsset.bollingerLower ? "Preço abaixo da banda inferior." : "Preço dentro da faixa normal."} signal={safeSelectedAsset.price > safeSelectedAsset.bollingerUpper ? "bearish" : safeSelectedAsset.price < safeSelectedAsset.bollingerLower ? "neutral" : "bullish"} />
                  <IndicatorBox label="Volume relativo" value={`${safeSelectedAsset.relativeVolume.toFixed(2)}x`} helper={safeSelectedAsset.relativeVolume >= 1 ? "Volume confirma liquidez." : "Volume abaixo da referência."} signal={safeSelectedAsset.relativeVolume >= 1 ? "bullish" : "neutral"} />
                </div>
              </div>

              <div className="mt-6 grid grid-cols-3 gap-3">
                <SmallBox label="Entrada" value={safeSelectedAsset.entry} />
                <SmallBox label="Stop" value={safeSelectedAsset.stop} color="text-red-300" />
                <SmallBox label="Alvo" value={safeSelectedAsset.target} color="text-emerald-300" />
              </div>

              <div className="mt-6 rounded-3xl border border-white/10 bg-black/20 p-5">
                <div className="flex items-center gap-2"><Icon name="brain" className="bg-cyan-300/10 text-cyan-300" /><h3 className="font-bold text-white">Explicação da IA</h3></div>
                <p className="mt-3 text-sm leading-6 text-slate-300">{safeSelectedAsset.reason}</p>
                <p className="mt-3 text-xs text-slate-500">Atualizado em: {safeSelectedAsset.updatedAt}</p>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-sm text-slate-400">Confiança do sinal</p><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-cyan-300" style={{ width: `${safeSelectedAsset.confidence}%` }} /></div><p className="mt-2 text-sm font-bold text-white">{safeSelectedAsset.confidence}%</p></div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-sm text-slate-400">Risco</p><p className={`mt-2 text-xl font-black ${riskClass(safeSelectedAsset.risk)}`}>{safeSelectedAsset.risk}</p><p className="mt-1 text-xs text-slate-500">Perfil: {safeSelectedAsset.profile}</p></div>
              </div>
            </div>

          </aside>
        </section>

        <section className="mt-8 grid gap-4 lg:grid-cols-4">
          <InfoBox icon="bell" title="Alerta interno" text="O painel cria alertas automáticos e mostra um toast quando surge oportunidade ou risco novo." />
          <InfoBox icon="radio" title="Web Push real" text="Registra /sw.js, cria subscription com VAPID e envia para /api/push/subscribe no backend." />
          <InfoBox icon="bot" title="Telegram Bot" text="O botão Testar Telegram envia o alerta selecionado para /api/telegram/send. O token fica no servidor." color="emerald" />
          <InfoBox icon="alert" title="Aviso importante" text="Os alertas são apoio à decisão e não recomendação financeira personalizada." color="amber" />
        </section>
      </main>
      <NewsTicker news={marketNews.items} />
    </div>
  );
}

export default App;
