# Rancang

<p align="center">
  <b>Ubah ide jadi blueprint, siap dikerjakan AI.</b>
</p>

<p align="center">
  <a href="#fitur"><img src="https://img.shields.io/badge/PRD-Spec--Plan--Tasks-8b5cf6?style=flat-square" alt="Blueprint"></a>
  <a href="#stack"><img src="https://img.shields.io/badge/Next.js_15-000000?style=flat-square&logo=next.js" alt="Next.js 15"></a>
  <a href="#stack"><img src="https://img.shields.io/badge/Tailwind_v4-06B6D4?style=flat-square&logo=tailwindcss" alt="Tailwind v4"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="MIT"></a>
  <a href="https://github.com/apissaj/rancang"><img src="https://img.shields.io/github/stars/apissaj/rancang?style=flat-square" alt="Stars"></a>
</p>

---

**Rancang** adalah platform self-hosted yang mengubah satu kalimat ide menjadi dokumen teknis lengkap — PRD, spesifikasi, rencana, dan tasks — siap dikerjakan coding agent manapun.

Tanpa akun. Tanpa database. Tanpa registrasi. Semua data tetap di browser kamu.

---

## Daftar Isi

- [Fitur](#fitur)
- [Sekilas](#sekilas)
- [Stack](#stack)
- [Arsitektur](#arsitektur)
- [MCP — Eksekusi Agent](#mcp--eksekusi-agent)
- [Cara Mulai](#cara-mulai)
- [Konfigurasi](#konfigurasi)
- [API Routes](#api-routes)
- [Deployment](#deployment)
- [Firebase Sync (Opsional)](#firebase-sync-opsional)
- [Panduan Kontribusi](#panduan-kontribusi)
- [FAQ](#faq)
- [Lisensi](#lisensi)

---

## Fitur

| Fitur | Deskripsi |
|---|---|
| **🛠️ Generator PRD** | Satu kalimat ide → PRD lengkap dengan tujuan, user story, kebutuhan, task breakdown bernomor. Streaming langsung ke editor. |
| **💬 Chat Multi-Model** | Ngobrol dengan model apa pun dari gateway kamu. Aktifkan mode **banding** untuk menjalankan prompt yang sama di 2–3 model sekaligus dan lihat responsnya streaming berdampingan. |
| **🎨 Generator Desain** | Ide → spesifikasi token `DESIGN.md` (format Google DESIGN.md) + prototipe wireframe (screenshot visual) yang bisa diklik. |
| **📦 Unduh Semua (.zip)** | Ekspor blueprint sebagai satu file ZIP berisi `prd.md`, `spec.md`, `plan.md`, `tasks.md` — siap dilempar ke coding agent. |
| **🔌 MCP Server** | Blueprint bisa ditarik langsung oleh Claude Code / Cursor / Codex / Hermes lewat MCP — agent ambil execution prompt sendiri, kerjakan task satu per satu, progres tersimpan dan bisa putus-nyambung. |
| **🔐 Tanpa Akun** | Data tersimpan di `localStorage`. Tidak ada server-side database, tidak ada registrasi. Buka, pakai, tutup — selesai. |
| **🌐 Gateway Sendiri** | Semua LLM call lewat Route Handler server-side ke OpenAI-compatible gateway milikmu. API key tidak pernah ke browser. |
| **📝 Riwayat & Versi** | Setiap blueprint tersimpan otomatis. Bisa diedit, dihapus, atau dipulihkan ke versi sebelumnya. |
| **🌙 Dark Theme** | Tema gelap default dengan Tailwind v4 + shadcn/ui. Mudah dikustomisasi via CSS variables. |

---

## Sekilas

### Halaman `/plan` — Generator PRD

1. **Input ide** — tulis kalimat kasar (misal: "Buat aplikasi todo list dengan fitur kolaborasi real-time")
2. **Klarifikasi** (opsional) — Rancang mengajukan 5 pertanyaan singkat buat memperkaya konteks. Bisa dilewati.
3. **Streaming PRD** — PRD, spesifikasi, rencana teknis, dan task breakdown streaming langsung ke editor Markdown.
4. **Multi-model** — aktifkan mode banding, jalankan di 2–3 model sekaligus, lihat hasilnya berdampingan.
5. **Unduh** — satu file `.md` per dokumen, atau satu ZIP semua dokumen.

### Halaman `/chat` — Chat Multi-Model

Chat biasa dengan model dari gateway kamu. Aktifkan **mode banding** untuk membandingkan respons beberapa model secara real-time dalam satu layar terpisah.

### Halaman `/design` — Generator Desain

Ide → spesifikasi `DESIGN.md` (YAML frontmatter + token spec) + wireframe visual yang bisa diklik. Output sesuai format [Google DESIGN.md](https://google.github.io/design-doc-formatter/).

---

## Stack

| Layer | Teknologi |
|---|---|
| **Framework** | [Next.js 15](https://nextjs.org/) (App Router, `dynamic = "force-dynamic"`) |
| **Bahasa** | TypeScript 5 (strict mode) |
| **Styling** | Tailwind CSS v4 + [shadcn/ui](https://ui.shadcn.com/) (Radix primitives) + `tw-animate-css` |
| **State** | React `useState` / `useEffect` + `localStorage` via `@/lib/storage.ts` |
| **LLM Client** | OpenAI-compatible streaming via `@/lib/llm.ts` (fetch-based, tanpa SDK) |
| **Markdown** | `react-markdown` + `remark-gfm` + `rehype-highlight` |
| **ZIP Export** | `jszip` (client-side, tanpa server) |
| **Auth (opsional)** | Firebase Client SDK + Firebase Admin SDK (Google Sign-In) |
| **Sync (opsional)** | Firestore (per-user session sync antar perangkat) |

> **Tanpa database, tanpa ORM, tanpa auth wajib.** Semua data bisa jalan 100% di browser. Firebase opsional penuh.

---

## Arsitektur

```
src/
├── app/
│   ├── page.tsx              # Landing page (hero, fitur, harga, testimoni)
│   ├── layout.tsx            # Root layout (theme provider, nav, footer)
│   ├── globals.css           # CSS variables tema dark/light
│   ├── chat/
│   │   └── page.tsx          # Chat multi-model
│   ├── plan/
│   │   └── page.tsx          # Generator PRD (full pipeline)
│   ├── design/
│   │   └── page.tsx          # Generator desain
│   └── api/
│       ├── chat/route.ts     # POST — streaming chat completion
│       ├── models/route.ts   # GET — daftar model & default dari env
│       ├── plan/
│       │   ├── route.ts      # POST — generate PRD (streaming)
│       │   ├── clarify/route.ts  # POST — generate pertanyaan klariﬁkasi
│       │   └── full/route.ts # POST — generate full spec+plan+tasks (streaming, multi-doc)
│       ├── design/
│       │   ├── route.ts      # POST — generate DESIGN.md + wireframe spec
│       │   └── image/route.ts# POST — generate screenshot wireframe (optional)
│       ├── images/[designId]/route.ts  # GET — serve generated images
│       └── sync/
│           ├── plans/route.ts     # Firestore sync (opsional)
│           ├── chats/route.ts     # Firestore sync (opsional)
│           └── designs/route.ts   # Firestore sync (opsional)
├── components/
│   ├── ui/                   # shadcn/ui components (button, dialog, switch, dll)
│   ├── effects/              # Landing page sections (hero, testimonials, pricing, faq, dll)
│   ├── chat/                 # Chat UI components
│   ├── plan/                 # Plan UI (clarify questions, editor, downloads)
│   ├── design/               # Design UI (wireframe canvas, export)
│   └── layout/               # Navbar, footer, auth gate
└── lib/
    ├── llm.ts                # OpenAI-compatible streaming client
    ├── models.ts             # Parsing & fallback model dari env
    ├── storage.ts            # localStorage CRUD + migrasi
    ├── use-sync.ts           # React hook untuk Firestore sync
    ├── sync-auth.ts          # Firebase auth wrapper
    ├── firebase-admin.ts     # Admin SDK init (server-side)
    ├── firebase-client.ts    # Client SDK init
    ├── design-yaml.ts        # DESIGN.md parser & validator
    ├── design-export.ts      # Export design ke format lain
    ├── image-gen.ts          # Image generation (wireframe screenshots)
    ├── image-storage.ts      # Serve/mirror generated images
    ├── clarify-types.ts      # Types untuk klariﬁkasi
    └── utils.ts              # Helper utilities
```

### Alur Data

```
Browser (localStorage)          Server (Next.js)              Gateway (LLM)
      │                              │                           │
      │  POST /api/chat              │                           │
      │  { model, messages } ──────► │  fetch(baseURL/chat) ────►│
      │                              │  ◄── stream (SSE) ───────│
      │  ◄── text delta stream ─────│                           │
      │                              │                           │
      │  POST /api/plan              │                           │
      │  { idea, model } ──────────► │  fetch(baseURL/chat) ────►│
      │  ◄── PRD stream ────────────│  ◄── stream ──────────────│
      │                              │                           │
      │  localStorage ── plan ──►   │                           │
      │  ◄── restore ───────────────│                           │
```

---

## MCP — Eksekusi Agent

Blueprint Rancang bisa ditarik **langsung** oleh AI coding agent lewat [MCP](https://modelcontextprotocol.io) — tanpa ekspor manual. Agent ambil prompt eksekusi, kerjakan task satu per satu, dan progresnya tersimpan.

**Kenapa MCP, bukan cuma ekspor file?** Ekspor `AGENTS.md` itu sekali-jalan: agent dapat contekan tapi nggak tahu sudah sampai mana. MCP bikin loop-nya hidup:

```
rancang_execution_prompt  → prompt + dokumen inline (awal kerja)
rancang_next_task         → task berikutnya yang belum selesai
   ...agent kerja, verifikasi...
rancang_task_complete     → tick task di tasks.md
rancang_next_task         → task berikutnya, dst.
```

Progres disimpan di `~/.rancang/blueprints/<id>.json`, jadi sesi agent bisa **putus-nyambung** tanpa kehilangan posisi.

### 7 Tools

| Tool | Fungsi |
|---|---|
| `rancang_list_blueprints` | Daftar blueprint + progres task |
| `rancang_read_blueprint` | Baca dokumen (bisa pilih: `docs: ["spec","tasks"]`) |
| `rancang_execution_prompt` | **Utama.** Prompt siap-jalan: instruksi + dokumen inline + working dir |
| `rancang_next_task` | Task berikutnya yang belum selesai |
| `rancang_task_complete` | Tick task setelah beneran diimplementasi & diverifikasi |
| `rancang_save_blueprint` | Agent menulis revisi balik ke Rancang |
| `rancang_status` | Health check store + blueprint terakhir |

### Menjalankan

```bash
# stdio — buat Claude Code / Cursor / Codex
node mcp-server.mjs --stdio

# HTTP (Streamable) — buat Hermes, agent remote, atau lintas origin
node mcp-server.mjs              # → http://127.0.0.1:3110/mcp
```

### Menyambungkan ke agent

**Claude Code**

```bash
claude mcp add rancang -- node "<path-ke-rancang>/mcp-server.mjs" --stdio
```

**Hermes**

```bash
hermes mcp add rancang --url http://127.0.0.1:3110/mcp
```

**Cursor / Codex / klien lain:**

```json
{
  "mcpServers": {
    "rancang": {
      "command": "node",
      "args": ["<path-ke-rancang>/mcp-server.mjs", "--stdio"]
    }
  }
}
```

### Alur pakai

1. Generate blueprint di `/plan` (4 dokumen).
2. Klik **Kirim ke MCP** → blueprint masuk ke `~/.rancang/blueprints` (juga otomatis terkirim tiap generate sukses).
3. Agent jalan: ambil execution prompt → kerjakan task → tick → ambil berikutnya.

Agent yang sudah tersambung MCP nggak butuh langkah tempel — cukup bilang:

> Pakai MCP rancang. Ambil execution prompt blueprint terakhir, working dir `D:/projects/foo`, kerjakan task-nya satu per satu.

Dokumentasi lengkap: [`docs/MCP.md`](./docs/MCP.md)

> **Catatan:** MCP server ini local-first — satu user, satu mesin, tanpa auth. Jangan diekspos ke internet apa adanya (transport HTTP hanya listen di `127.0.0.1`).

---

## Cara Mulai

### Prasyarat

- **Node.js 18+** (direkomendasikan 20 LTS)
- **Gateway LLM** — OpenAI-compatible endpoint (bisa [9Router](https://github.com/apissaj/9router), Ollama, vLLM, atau provider langsung)

### Install

```bash
git clone https://github.com/apissaj/rancang.git
cd rancang
npm install
```

### Konfigurasi

```bash
cp .env.example .env
```

Edit `.env` — isi detail gateway LLM kamu:

```bash
# Wajib: base URL gateway OpenAI-compatible
LLM_BASE_URL=http://localhost:20128/v1

# Wajib: API key gateway
LLM_API_KEY=your-key-here

# Opsional: daftar model yang muncul di model picker
LLM_MODELS=cx/gpt-5.6-sol,cx/gpt-5.6-terra,cx/gpt-5.6-luna,ag/gemini-3.6-flash-high

# Opsional: model default
LLM_DEFAULT_MODEL=cx/gpt-5.6-sol

# Environment
NODE_ENV=production
```

### Development

```bash
npm run dev
# → http://localhost:3000
```

### Production Build

```bash
npm run build
```

Output ada di `.next/standalone/`. Jalankan:

```bash
PORT=3100 HOSTNAME=0.0.0.0 node .next/standalone/server.js
```

> **Catatan**: setelah build pertama, static assets perlu di-copy manual:
> ```bash
> mkdir -p .next/standalone/.next
> cp -r .next/static .next/standalone/.next/static
> mkdir -p .next/standalone/public
> cp -r public/brand-logos .next/standalone/public/brand-logos
> ```

---

## Konfigurasi

### Environment Variables

| Variable | Wajib | Default | Deskripsi |
|---|---|---|---|
| `LLM_BASE_URL` | ✅ | — | Base URL OpenAI-compatible gateway (contoh: `http://localhost:20128/v1`) |
| `LLM_API_KEY` | ✅ | — | API key untuk gateway. Tidak diekspos ke browser. |
| `LLM_MODELS` | ❌ | — | Daftar model dipisah koma. Muncul di model picker. |
| `LLM_DEFAULT_MODEL` | ❌ | — | Model default untuk chat & generator PRD. |
| `NODE_ENV` | ❌ | `production` | Environment mode. |
| `RANCANG_HOME` | ❌ | `~/.rancang` | Folder penyimpanan blueprint yang dibaca MCP server. |
| `RANCANG_MCP_PORT` | ❌ | `3110` | Port transport HTTP MCP. |
| `NEXT_PUBLIC_FIREBASE_*` | ❌ | — | 6 variabel Firebase Client SDK. Lihat `.env.example`. |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | ❌ | — | JSON string service account untuk server-side sync. |

### Model Picker

Model ditentukan oleh `LLM_MODELS` dan `LLM_DEFAULT_MODEL`. Format:

```
<prefix>/<model-name>
```

Prefix adalah identifier singkat untuk gateway/provider (misal `cx`, `ag`, `cc`). Nama model terserah — diteruskan apa adanya ke `LLM_BASE_URL` sebagai `model` dalam request.

Jika `LLM_DEFAULT_MODEL` tidak di-set, fallback ke model pertama dari `LLM_MODELS`.

---

## API Routes

Semua route menggunakan `dynamic = "force-dynamic"` — tidak ada caching, semua request langsung ke gateway.

### `POST /api/chat`
**Streaming chat completion**

```json
{
  "model": "cx/gpt-5.6-sol",
  "messages": [
    { "role": "user", "content": "Buatkan arsitektur untuk todo app" }
  ]
}
```
**Response**: `text/plain; charset=utf-8` — plain text delta stream (bukan SSE; token di-stream langsung sebagai teks mentah, tanpa parser sisi client).

### `POST /api/plan`
**Generate PRD streaming**

```json
{
  "idea": "Buat aplikasi todo list dengan fitur kolaborasi real-time",
  "model": "cx/gpt-5.6-sol"
}
```
**Response**: `text/plain; charset=utf-8` — streaming PRD markdown (plain text deltas).

### `POST /api/plan/clarify`
**Generate pertanyaan klariﬁkasi**

```json
{
  "idea": "Buat aplikasi todo list dengan fitur kolaborasi real-time",
  "model": "cx/gpt-5.6-sol"
}
```
**Response**: JSON dengan array 5 pertanyaan:
```json
{
  "questions": [
    { "id": "q1", "question": "Siapa target pengguna?", "type": "text" }
  ]
}
```

### `POST /api/plan/full`
**Generate PRD + spec + plan + tasks streaming (multi-dokumen)**

Menerima jawaban klariﬁkasi opsional. Output berupa satu stream teks yang diframing dengan marker inline `<!-- DOC:prd -->`, `<!-- DOC:spec -->`, dst. agar client bisa memisahkan dokumen.

### `GET /api/models`
**Daftar model yang tersedia**

```json
{
  "models": ["cx/gpt-5.6-sol", "cx/gpt-5.6-terra", "ag/gemini-3.6-flash-high"],
  "defaultModel": "cx/gpt-5.6-sol"
}
```

### `POST /api/design`
**Generate DESIGN.md + wireframe spec**

```json
{
  "idea": "Halaman login dengan Google OAuth",
  "model": "cx/gpt-5.6-sol"
}
```

### `POST /api/design/image`
**Generate screenshot wireframe** (opsional, `maxDuration: 120`)

---

## Deployment

### Standalone (self-host)

```bash
# Build
npm run build

# Copy static assets
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/static
mkdir -p .next/standalone/public
cp -r public/brand-logos .next/standalone/public/brand-logos

# Run
PORT=3100 HOSTNAME=0.0.0.0 node .next/standalone/server.js
```

Aplikasi siap di `http://localhost:3100`.

### Reverse Proxy (Nginx)

```nginx
server {
    listen 80;
    server_name rancang.domainkamu.com;

    location / {
        proxy_pass http://127.0.0.1:3100;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
        proxy_buffering off;  # penting untuk streaming
    }
}
```

### Docker (opsional)

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm install && npm run build && \
    mkdir -p .next/standalone/.next && cp -r .next/static .next/standalone/.next/static && \
    mkdir -p .next/standalone/public && cp -r public/brand-logos .next/standalone/public/brand-logos
EXPOSE 3100
CMD ["node", ".next/standalone/server.js"]
```

---

## Firebase Sync (Opsional)

Rancang bisa jalan tanpa Firebase. Tapi kalau mau sinkronisasi history antar perangkat, setel variabel `NEXT_PUBLIC_FIREBASE_*` di `.env`:

| Variable | Kegunaan |
|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Client SDK |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase Auth domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Project ID Firestore |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Storage bucket |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Sender ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | App ID |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Admin SDK JSON string (server-side) |

Tanpa variabel tersebut, aplikasi tetap 100% fungsional — anonim, localStorage saja.

---

## Panduan Kontribusi

1. **Fork** repo ini.
2. **Buat branch** fitur: `git checkout -b feat/fitur-keren`
3. **Commit** perubahan: `git commit -m "feat: tambah fitur keren"`
4. **Push** ke branch: `git push origin feat/fitur-keren`
5. **Buka Pull Request**.

### Panduan

- Untuk perubahan besar, buka **issue** dulu untuk diskusi.
- Ikuti konvensi commit [Conventional Commits](https://www.conventionalcommits.org/).
- Pastikan `npx tsc --noEmit` lulus sebelum commit.
- Jangan commit `.env` — file sudah di `.gitignore`.

---

## FAQ

### Butuh API key sendiri?
Ya. Rancang butuh gateway OpenAI-compatible. Bisa [9Router](https://github.com/apissaj/9router), Ollama, vLLM, atau provider langsung. API key tidak pernah ke browser — hanya server-side.

### Apa bedanya sama nulis PRD manual?
Rancang menyusun struktur PRD otomatis: executive summary, user stories, system scope, task breakdown. Output markdown murni — bisa diedit, diunduh, dan dipakai di coding agent mana pun.

### Data saya aman nggak?
Semua data tersimpan di `localStorage` browser kamu. Tidak ada server-side database. Tidak ada tracking. API key gateway hanya dipakai server-side, tidak pernah terekspos ke client.

### Hasilnya bisa dipakai di coding agent apa aja?
Dua jalur. **Ekspor file** — output markdown murni, kompatibel dengan Cursor, Claude Code, OpenCode, GitHub Copilot, Windsurf, n8n, dan agent manapun yang bisa membaca file `.md`. **MCP** — agent yang mendukung [MCP](https://modelcontextprotocol.io) (Claude Code, Cursor, Codex, Hermes) bisa menarik execution prompt sendiri, mengerjakan task satu per satu, dan progresnya tersimpan. Lihat [MCP — Eksekusi Agent](#mcp--eksekusi-agent).

---

## Lisensi

[MIT](./LICENSE) — © 2026 [Hafizh Muzani](https://github.com/apissaj)

---

<p align="center">
  Dibuat dengan ❤️ untuk developer yang males nulis PRD dari nol.
</p>