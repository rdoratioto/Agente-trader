import { mkdir, writeFile } from "node:fs/promises";
import { XMLParser } from "fast-xml-parser";

const sources = [
  {
    name: "Yahoo Finance",
    url: "https://finance.yahoo.com/news/rssindex",
  },
  {
    name: "MarketWatch",
    url: "https://feeds.content.dowjones.io/public/rss/mw_topstories",
  },
  {
    name: "Investing.com",
    url: "https://www.investing.com/rss/news.rss",
  },
];

const gdeltQueries = [
  "stock market OR equities OR central bank",
  "Ibovespa OR Petrobras OR Vale OR Brazil stocks",
  "interest rates OR inflation OR commodities",
];

const fallbackNews = [
  {
    title: "Radar de mercado em modo fallback",
    source: "Agente Trader",
    url: "https://www.bloomberg.com/markets",
    publishedAt: new Date().toISOString(),
    summary: "Não foi possível atualizar o feed durante o build. Abra Bloomberg Markets para acompanhar manchetes atuais.",
  },
];

function normalizeItems(payload, sourceName) {
  const channel = payload?.rss?.channel || payload?.feed || {};
  const rawItems = channel.item || channel.entry || [];
  const items = Array.isArray(rawItems) ? rawItems : [rawItems];

  return items
    .map((item) => ({
      title: cleanText(item.title),
      source: sourceName,
      url: String(item.link?.href || item.link || item.guid || "").trim(),
      publishedAt: new Date(item.pubDate || item.published || item.updated || Date.now()).toISOString(),
      summary: cleanText(item.description || item.summary),
    }))
    .filter((item) => item.title && item.url);
}

function cleanText(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, "")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchSource(source) {
  const response = await fetch(source.url, {
    headers: {
      "User-Agent": "AgenteTrader/1.0 (+https://github.com/rdoratioto/Agente-trader)",
      Accept: "application/rss+xml, application/xml, text/xml",
    },
  });

  if (!response.ok) throw new Error(`${source.name}: HTTP ${response.status}`);
  const xml = await response.text();
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "" });
  return normalizeItems(parser.parse(xml), source.name);
}

async function fetchGdelt(query) {
  const url = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
  url.searchParams.set("query", query);
  url.searchParams.set("mode", "ArtList");
  url.searchParams.set("format", "json");
  url.searchParams.set("maxrecords", "15");
  url.searchParams.set("sort", "DateDesc");

  const response = await fetch(url, {
    headers: {
      "User-Agent": "AgenteTrader/1.0 (+https://github.com/rdoratioto/Agente-trader)",
      Accept: "application/json",
    },
  });

  if (!response.ok) throw new Error(`GDELT: HTTP ${response.status}`);
  const payload = await response.json();
  const articles = Array.isArray(payload.articles) ? payload.articles : [];

  return articles
    .map((article) => ({
      title: cleanText(article.title),
      source: article.domain ? String(article.domain).replace(/^www\./, "") : "GDELT",
      url: String(article.url || "").trim(),
      publishedAt: article.seendate ? new Date(article.seendate.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/, "$1-$2-$3T$4:$5:$6Z")).toISOString() : new Date().toISOString(),
      summary: article.sourcecountry ? `Fonte: ${article.sourcecountry}. Idioma: ${article.language || "n/d"}.` : "Notícia rastreada por GDELT.",
    }))
    .filter((item) => item.title && item.url);
}

async function main() {
  const gdeltResults = await Promise.allSettled(gdeltQueries.map(fetchGdelt));
  const rssResults = await Promise.allSettled(sources.map(fetchSource));
  const news = [...gdeltResults, ...rssResults]
    .flatMap((result) => (result.status === "fulfilled" ? result.value : []))
    .filter((item, index, list) => list.findIndex((candidate) => candidate.url === item.url || candidate.title === item.title) === index)
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, 18);

  const payload = {
    updatedAt: new Date().toISOString(),
    items: news.length ? news : fallbackNews,
  };

  await mkdir(new URL("../public", import.meta.url), { recursive: true });
  await writeFile(new URL("../public/news.json", import.meta.url), `${JSON.stringify(payload, null, 2)}\n`);
}

main().catch(async (error) => {
  await mkdir(new URL("../public", import.meta.url), { recursive: true });
  await writeFile(
    new URL("../public/news.json", import.meta.url),
    `${JSON.stringify({ updatedAt: new Date().toISOString(), error: error.message, items: fallbackNews }, null, 2)}\n`,
  );
});
