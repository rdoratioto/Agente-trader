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

Suba o repositório para o GitHub e importe o projeto `frontend` na Vercel.

Configurações:

```txt
Framework: Vite
Build command: npm run build
Output directory: dist
```

Environment Variable:

```env
VITE_USE_BACKEND=false
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
