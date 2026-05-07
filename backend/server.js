import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import webpush from "web-push";

dotenv.config();

const app = express();

const PORT = Number(process.env.PORT || 3001);
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const BRAPI_TOKEN = process.env.BRAPI_TOKEN || "";
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@example.com";

app.use(cors({ origin: FRONTEND_URL }));
app.use(express.json({ limit: "2mb" }));

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

const DEFAULT_WATCHLIST = ["PETR4", "VALE3", "BOVA11", "HASH11", "MXRF11"];

const db = {
  alerts: [],
  chatMessages: [],
  pushSubscriptions: [],
  watchlists: new Map(),
};

const fallbackRawAssets = [
  {
    ticker: "PETR4",
    name: "Petrobras PN",
    category: "Ação",
    price: 38.72,
    change: 1.84,
    volume: 42100000,
    source: "Backend Simulado",
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
    source: "Backend Simulado",
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
    source: "Backend Simulado",
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
    source: "Backend Simulado",
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
    source: "Backend Simulado",
    updatedAt: "--",
    closes: [10.12, 10.14, 10.18, 10.2, 10.19, 10.22, 10.21, 10.23, 10.24, 10.26, 10.28, 10.25, 10.27, 10.29, 10.3, 10.28, 10.31, 10.3, 10.32, 10.31],
  },
];

function createId(prefix = "id") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeText(text) {
  return String(text || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
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

function average(values) {
  if (!Array.isArray(values) || values.length === 0) return 0;
  return values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length;
}

function calculateSMA(values, period) {
  return average(Array.isArray(values) ? values.slice(-period) : []);
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
  const recent = values.slice(-20).map(Number).filter(Number.isFinite);
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

  if (price > sma9) { score += 8; reasons.push("preço acima da média de 9 períodos"); }
  else { score -= 8; reasons.push("preço abaixo da média de 9 períodos"); }

  if (sma9 > sma21) { score += 12; reasons.push("média curta acima da média de 21 períodos"); }
  else { score -= 10; reasons.push("média curta abaixo da média de 21 períodos"); }

  if (sma200 && price > sma200) { score += 10; reasons.push("preço acima da tendência principal"); }
  else if (sma200) { score -= 10; reasons.push("preço abaixo da tendência principal"); }

  if (rsi >= 45 && rsi <= 65) { score += 8; reasons.push("RSI saudável"); }
  else if (rsi > 70) { score -= 8; reasons.push("RSI em sobrecompra"); }
  else if (rsi < 30) { score += 5; reasons.push("RSI em sobrevenda"); }
  else { score -= 2; reasons.push("RSI sem vantagem clara"); }

  if (Number(change) > 1) { score += 8; reasons.push("variação positiva no período"); }
  else if (Number(change) < -1) { score -= 8; reasons.push("variação negativa no período"); }

  if (Number(volume) > 1_000_000) { score += 4; reasons.push("volume relevante"); }

  const distanceToResistance = resistance && price ? ((resistance - price) / price) * 100 : 0;
  const distanceToSupport = support && price ? ((price - support) / price) * 100 : 0;

  if (distanceToResistance < 1 && distanceToResistance >= 0) { score -= 5; reasons.push("preço perto da resistência"); }
  if (distanceToSupport < 1.5 && distanceToSupport >= 0) { score += 4; reasons.push("preço perto do suporte"); }

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
  const { support, resistance } = calculateSupportResistance(closes);
  const technical = calculateTechnicalScore({ price, change, volume, sma9, sma21, sma200, rsi, support, resistance });
  const signal = rawAsset.signal || defineSignal(technical.score, rsi, price, resistance, support);
  const riskData = defineRiskAndProfile({ category, change, rsi, score: technical.score });
  const stop = support ? support * 0.992 : price * 0.97;
  const target = resistance && resistance > price ? resistance : price * 1.06;
  const entry = signal === "Comprar" ? price * 1.002 : resistance ? resistance * 1.003 : price * 1.01;

  const reason = rawAsset.reason || `Score técnico ${technical.score}/100. O agente identificou ${technical.reasons.slice(0, 4).join(", ")}. ${
    signal === "Comprar" ? "Sinal forte, mas respeite stop e tamanho de posição."
    : signal === "Comprar com cautela" ? "Existe oportunidade, mas falta confirmação mais limpa."
    : signal === "Vender" ? "Cenário técnico fraco; prioridade é proteger capital."
    : signal === "Manter" ? "Cenário positivo, mas sem grande assimetria para nova entrada."
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
  const time = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
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
  return assets.map((asset) => createAlertFromAsset(enrichAsset(asset))).filter(Boolean).sort((a, b) => severityWeight[b.severity] - severityWeight[a.severity]);
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
  return assets.map(enrichAsset).map((asset) => {
    const distanceToResistance = asset.resistance && asset.price ? ((asset.resistance - asset.price) / asset.price) * 100 : 0;
    const resistancePenalty = distanceToResistance >= 0 && distanceToResistance < 1 ? 8 : 0;
    const totalScore = asset.score + getAssetBias(asset) + getProfileFitScore(asset, profile) - resistancePenalty;
    return { ...asset, conversationalScore: Math.round(totalScore) };
  }).sort((a, b) => b.conversationalScore - a.conversationalScore);
}

function buildInvestmentAnswer(message, assets, profile) {
  const text = normalizeText(message);
  const safeAssets = assets.map(enrichAsset);
  const ranked = rankAssetsForConversation(safeAssets, profile);
  const best = ranked.filter((asset) => asset.signal !== "Vender").slice(0, 3);
  const weak = [...safeAssets].sort((a, b) => a.score - b.score).slice(0, 2);
  const strong = best[0];

  if (text.includes("conservador")) {
    const conservative = rankAssetsForConversation(safeAssets, "Conservador").filter((asset) => !asset.risk.includes("Muito")).slice(0, 3);
    return { profileSuggestion: "Conservador", text: `Entendi, mano. Para um perfil conservador, eu evitaria ativos de risco muito alto e olharia primeiro para ${conservative.map((asset) => asset.ticker).join(", ")}. Hoje, o melhor encaixe parece ${conservative[0]?.ticker || "nenhum ativo"}, porque tem risco ${conservative[0]?.risk || "menor"}, score ${conservative[0]?.score || "--"}/100 e sinal ${conservative[0]?.signal || "neutro"}. Mesmo assim, eu não entraria sem validar prazo, reserva de emergência e tamanho da posição.` };
  }

  if (text.includes("agressivo")) {
    const aggressive = rankAssetsForConversation(safeAssets, "Agressivo").slice(0, 3);
    return { profileSuggestion: "Agressivo", text: `Fechado. Para perfil agressivo, o radar está puxando mais para ${aggressive.map((asset) => asset.ticker).join(", ")}. O destaque é ${aggressive[0]?.ticker || "nenhum ativo"}, com score ${aggressive[0]?.score || "--"}/100 e sinal ${aggressive[0]?.signal || "neutro"}. Eu trataria como operação com stop obrigatório, porque risco alto pode virar prejuízo rápido.` };
  }

  if (text.includes("moderado")) {
    const moderate = rankAssetsForConversation(safeAssets, "Moderado").slice(0, 3);
    return { profileSuggestion: "Moderado", text: `Boa. Para perfil moderado, eu buscaria equilíbrio entre tendência e risco. No radar agora: ${moderate.map((asset) => `${asset.ticker} (${asset.score}/100)`).join(", ")}. O mais interessante parece ${moderate[0]?.ticker || "nenhum ativo"}, mas eu esperaria confirmação se estiver perto de resistência.` };
  }

  if (text.includes("vender") || text.includes("sair") || text.includes("realizar")) {
    return { text: `Olhando o radar, os ativos que exigem mais cuidado são ${weak.map((asset) => `${asset.ticker} com score ${asset.score}/100 e sinal ${asset.signal}`).join("; ")}. Eu não venderia no automático, mas revisaria stop, suporte e exposição. Se perdeu suporte ou o score continuar caindo, a prioridade vira proteger capital.` };
  }

  if (text.includes("risco") || text.includes("perigoso") || text.includes("evitar")) {
    const risky = [...safeAssets].sort((a, b) => {
      const aRisk = a.risk.includes("Muito") ? 3 : a.risk === "Alto" ? 2 : 1;
      const bRisk = b.risk.includes("Muito") ? 3 : b.risk === "Alto" ? 2 : 1;
      return bRisk - aRisk || a.score - b.score;
    }).slice(0, 3);
    return { text: `Os pontos mais perigosos agora são ${risky.map((asset) => `${asset.ticker} (${asset.risk}, score ${asset.score}/100)`).join(", ")}. Eu teria mais cautela principalmente quando RSI está alto, preço está perto da resistência ou o ativo já subiu muito no curto prazo.` };
  }

  if (text.includes("onde") || text.includes("investir") || text.includes("comprar") || text.includes("melhor") || text.includes("oportunidade")) {
    return { focusTicker: strong?.ticker, text: `Mano, olhando apenas este radar técnico, meu top 3 agora seria: ${best.map((asset, index) => `${index + 1}) ${asset.ticker} — score ${asset.score}/100, sinal ${asset.signal}, risco ${asset.risk}`).join("; ")}. Se fosse para escolher um para estudar primeiro, eu olharia ${strong?.ticker || "nenhum ativo"}. Entrada sugerida: ${strong?.entry || "--"}, stop: ${strong?.stop || "--"}, alvo: ${strong?.target || "--"}. Isso não é ordem de compra; é um radar para você decidir com gestão de risco.` };
  }

  return { text: `Tô contigo, mano. Posso te responder como um copiloto de investimentos. Pelos dados atuais, o ativo mais interessante para estudar é ${strong?.ticker || "nenhum"}, com score ${strong?.score || "--"}/100, sinal ${strong?.signal || "neutro"} e risco ${strong?.risk || "--"}. Você pode me perguntar: “onde investir?”, “o que vender?”, “sou conservador”, “qual ativo está mais arriscado?” ou “explique ${strong?.ticker || "um ativo"}”.` };
}

function explainAssetForChat(asset) {
  const safeAsset = enrichAsset(asset);
  return `${safeAsset.ticker}: preço ${formatCurrencyBRL(safeAsset.price)}, score ${safeAsset.score}/100, RSI ${safeAsset.rsi.toFixed(1)}, sinal ${safeAsset.signal}, risco ${safeAsset.risk}. Entrada de estudo: ${safeAsset.entry}, stop: ${safeAsset.stop}, alvo: ${safeAsset.target}. ${safeAsset.reason}`;
}

async function fetchBrapiQuotes(symbols) {
  const joinedSymbols = symbols.join(",");
  const url = `https://brapi.dev/api/quote/${joinedSymbols}?range=3mo&interval=1d${BRAPI_TOKEN ? `&token=${BRAPI_TOKEN}` : ""}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Erro ao consultar brapi: ${response.status}`);
  const payload = await response.json();
  const results = Array.isArray(payload.results) ? payload.results : [];

  return results.map((item) => {
    const closes = Array.isArray(item.historicalDataPrice)
      ? item.historicalDataPrice.map((candle) => Number(candle.close || candle.open || 0)).filter(Boolean)
      : [];

    return {
      ticker: item.symbol,
      name: item.longName || item.shortName || item.symbol,
      category: detectCategory(item.symbol, item.longName || item.shortName || ""),
      price: Number(item.regularMarketPrice || closes[closes.length - 1] || 0),
      change: Number(item.regularMarketChangePercent || 0),
      volume: Number(item.regularMarketVolume || 0),
      source: "brapi.dev",
      updatedAt: new Date().toLocaleString("pt-BR"),
      closes: closes.length ? closes : [Number(item.regularMarketPrice || 0)],
    };
  });
}

async function fetchMarketData(symbols) {
  if (BRAPI_TOKEN) {
    const raw = await fetchBrapiQuotes(symbols);
    return raw.map(enrichAsset);
  }
  return fallbackRawAssets.map((asset) => enrichAsset({ ...asset, updatedAt: new Date().toLocaleString("pt-BR") }));
}

function buildChatResponse({ message, assets, profile }) {
  const normalized = normalizeText(message);
  const mentionedAsset = assets.map(enrichAsset).find((asset) => normalized.includes(asset.ticker.toLowerCase()));
  const answer = mentionedAsset ? { focusTicker: mentionedAsset.ticker, text: explainAssetForChat(mentionedAsset) } : buildInvestmentAnswer(message, assets, profile);
  return { id: createId("assistant"), role: "assistant", createdAt: new Date().toISOString(), ...answer };
}

function createAlertFromAssets(assets) {
  return generateAlerts(assets);
}

async function sendTelegramMessage({ chatId, text }) {
  if (!TELEGRAM_BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN não configurado.");
  const targetChatId = chatId || TELEGRAM_CHAT_ID;
  if (!targetChatId) throw new Error("TELEGRAM_CHAT_ID não configurado.");

  const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: targetChatId,
      parse_mode: "HTML",
      text,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Erro Telegram: ${response.status} ${detail}`);
  }

  return response.json();
}

function buildTelegramAlertText({ alert, asset }) {
  const safeAsset = asset ? enrichAsset(asset) : null;

  return [
    "🚨 <b>Agente Trader</b>",
    "",
    `<b>${alert.title}</b>`,
    alert.text,
    "",
    safeAsset
      ? `Ativo: <b>${safeAsset.ticker}</b>\nPreço: ${formatCurrencyBRL(safeAsset.price)}\nScore: ${safeAsset.score}/100\nRSI: ${safeAsset.rsi.toFixed(1)}\nSinal: ${safeAsset.signal}\nRisco: ${safeAsset.risk}\nEntrada: ${safeAsset.entry}\nStop: ${safeAsset.stop}\nAlvo: ${safeAsset.target}`
      : "",
    "",
    "⚠️ Não é recomendação financeira. Use gestão de risco.",
  ].filter(Boolean).join("\n");
}

async function sendWebPushToAll(payload) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) throw new Error("Chaves VAPID não configuradas.");
  const results = [];

  for (const subscription of db.pushSubscriptions) {
    try {
      await webpush.sendNotification(subscription, JSON.stringify(payload));
      results.push({ ok: true, endpoint: subscription.endpoint });
    } catch (error) {
      results.push({ ok: false, endpoint: subscription.endpoint, error: error.message });
    }
  }

  return results;
}

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "agente-trader-backend",
    time: new Date().toISOString(),
    integrations: {
      brapi: Boolean(BRAPI_TOKEN),
      telegram: Boolean(TELEGRAM_BOT_TOKEN),
      webPush: Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY),
    },
  });
});

app.get("/api/market/quotes", async (req, res) => {
  try {
    const symbols = String(req.query.symbols || DEFAULT_WATCHLIST.join(",")).split(",").map((symbol) => symbol.trim().toUpperCase()).filter(Boolean);
    const assets = await fetchMarketData(symbols);
    const alerts = createAlertFromAssets(assets);

    db.alerts.unshift(...alerts.map((alert) => ({ ...alert, createdAt: new Date().toISOString() })));
    db.alerts = db.alerts.slice(0, 100);

    res.json({
      ok: true,
      source: BRAPI_TOKEN ? "brapi.dev" : "fallback",
      assets,
      alerts,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.get("/api/alerts", (req, res) => {
  res.json({ ok: true, alerts: db.alerts.slice(0, 50) });
});

app.post("/api/chat", async (req, res) => {
  try {
    const { message, profile = "Todos", symbols = DEFAULT_WATCHLIST } = req.body || {};
    if (!message || typeof message !== "string") {
      return res.status(400).json({ ok: false, error: "Campo message é obrigatório." });
    }

    const assets = await fetchMarketData(Array.isArray(symbols) ? symbols : DEFAULT_WATCHLIST);
    const response = buildChatResponse({ message, assets, profile });

    db.chatMessages.push(
      { id: createId("user"), role: "user", text: message, createdAt: new Date().toISOString() },
      response,
    );

    res.json({ ok: true, response, assets });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.get("/api/chat/history", (req, res) => {
  res.json({ ok: true, messages: db.chatMessages.slice(-50) });
});

app.post("/api/push/subscribe", (req, res) => {
  const { subscription, watchlist = DEFAULT_WATCHLIST } = req.body || {};
  if (!subscription || !subscription.endpoint) return res.status(400).json({ ok: false, error: "Subscription inválida." });

  const exists = db.pushSubscriptions.some((item) => item.endpoint === subscription.endpoint);
  if (!exists) db.pushSubscriptions.push({ ...subscription, watchlist, createdAt: new Date().toISOString() });

  res.json({ ok: true, totalSubscriptions: db.pushSubscriptions.length });
});

app.post("/api/push/send", async (req, res) => {
  try {
    const { title = "Agente Trader", body = "Novo alerta disponível.", url = "/" } = req.body || {};
    const results = await sendWebPushToAll({ title, body, url, createdAt: new Date().toISOString() });
    res.json({ ok: true, results });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.post("/api/telegram/send", async (req, res) => {
  try {
    const { chatId, alert, asset } = req.body || {};
    if (!alert || !alert.title) return res.status(400).json({ ok: false, error: "Alerta inválido." });

    const text = buildTelegramAlertText({ alert, asset });
    const result = await sendTelegramMessage({ chatId, text });

    res.json({ ok: true, result });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.post("/api/watchlist", (req, res) => {
  const { userId = "default", symbols = DEFAULT_WATCHLIST } = req.body || {};
  const normalizedSymbols = symbols.map((symbol) => String(symbol).trim().toUpperCase()).filter(Boolean);
  db.watchlists.set(userId, normalizedSymbols);
  res.json({ ok: true, userId, symbols: normalizedSymbols });
});

app.get("/api/watchlist/:userId", (req, res) => {
  const userId = req.params.userId || "default";
  const symbols = db.watchlists.get(userId) || DEFAULT_WATCHLIST;
  res.json({ ok: true, userId, symbols });
});

app.use((req, res) => {
  res.status(404).json({ ok: false, error: "Rota não encontrada." });
});

app.listen(PORT, () => {
  console.log(`Agente Trader backend rodando em http://localhost:${PORT}`);
  console.log(`Frontend permitido via CORS: ${FRONTEND_URL}`);
  console.log(`Brapi: ${BRAPI_TOKEN ? "configurado" : "fallback simulado"}`);
  console.log(`Telegram: ${TELEGRAM_BOT_TOKEN ? "configurado" : "não configurado"}`);
  console.log(`Web Push: ${VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY ? "configurado" : "não configurado"}`);
});
