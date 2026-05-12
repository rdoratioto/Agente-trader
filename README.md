# Agente Trader

Projeto completo com:

- Frontend React + Vite + Tailwind
- Backend Node.js + Express
- Modo demo com dados simulados
- Integração opcional com brapi
- Chat/copiloto local e via backend
- Alertas internos
- Estrutura para Telegram e Web Push

> Aviso: este projeto é educativo/técnico. Não é recomendação financeira e não executa ordens.

---

## Rodar apenas o frontend em modo demo

```bash
cd frontend
npm install
npm run dev
```

O projeto abre em:

```txt
http://localhost:5173
```

Por padrão, para publicar demo na Vercel, use:

```env
VITE_USE_BACKEND=false
```

---

## Rodar frontend + backend

### Terminal 1 — Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

Teste:

```bash
curl http://localhost:3001/health
```

### Terminal 2 — Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

No frontend, deixe:

```env
VITE_USE_BACKEND=true
VITE_API_BASE_URL=http://localhost:3001
```

---

## Deploy demo na Vercel

O repositório já inclui `vercel.json` na raiz para publicar apenas o frontend em modo demo.

Configurações:

```txt
Framework: Vite
Install command: cd frontend && npm ci
Build command: cd frontend && npm run build
Output directory: frontend/dist
```

Environment Variable opcional, já refletida em `frontend/.env.production`:

```env
VITE_USE_BACKEND=false
```

Na Vercel:

1. Importe `https://github.com/rdoratioto/Agente-trader`
2. Mantenha o Root Directory como a raiz do repositório
3. Faça o deploy

## Deploy demo no GitHub Pages

O repositório também inclui GitHub Actions para publicar o frontend estático no GitHub Pages.

URL esperada após o workflow rodar:

```txt
https://rdoratioto.github.io/Agente-trader/
```

Se o GitHub pedir configuração manual, vá em:

```txt
Settings > Pages > Build and deployment > Source: GitHub Actions
```

---

## Deploy completo

Recomendado:

```txt
Frontend: Vercel
Backend: Render/Railway
Banco futuro: Supabase/PostgreSQL
```

Quando o backend estiver publicado:

```env
VITE_USE_BACKEND=true
VITE_API_BASE_URL=https://seu-backend.onrender.com
```
