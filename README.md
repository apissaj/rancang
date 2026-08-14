# Rancang

**Ubah ide jadi blueprint, siap dikerjakan AI.**

Rancang adalah platform self-hosted yang mengubah ide kasar menjadi dokumen teknis lengkap — PRD, spesifikasi, rencana, dan tasks — siap dikerjakan oleh coding agent mana pun (Cursor, Claude Code, OpenCode, dll).

Dua alat utama dalam satu aplikasi, tanpa auth dan tanpa database:

- **`/chat`** — chat multi-model dengan mode banding (jalankan prompt yang sama di 2–3 model sekaligus).
- **`/plan`** — ubah ide kasar menjadi PRD terstruktur (Markdown), streaming langsung.
- **`/design`** — ubah ide menjadi spesifikasi token DESIGN.md plus prototipe wireframe yang bisa diklik.

## Fitur

| Fitur | Keterangan |
|---|---|
| 🛠️ Generator PRD | Ide kasar → PRD lengkap: tujuan, user story, kebutuhan, task bernomor |
| 💬 Chat multi-model | Bandingkan 2–3 model sekaligus, streaming berdampingan |
| 🎨 Generator desain | Spesifikasi token DESIGN.md + wireframe prototipe |
| 🔐 Tanpa akun | Semua data tersimpan di browser (localStorage) |
| 🌐 Gateway sendiri | Semua LLM call lewat OpenAI-compatible gateway milikmu |

## Stack

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS v4 + shadcn/ui (Radix primitives), dark theme by default
- Tanpa database, tanpa auth — semua route langsung jalan
- Semua LLM call melalui Route Handlers ke gateway OpenAI-compatible

## Cara mulai

### Persiapan

```bash
npm install
cp .env.example .env   # isi dengan detail gateway-mu
```

### Environment variables

```bash
LLM_BASE_URL=http://localhost:20128/v1
LLM_API_KEY=your-key-here
LLM_MODELS=cx/gpt-5.5,cx/gpt-5.4,cx/gpt-5.3-codex,cx/gpt-5.2,cx/gpt-5.1,auto
LLM_DEFAULT_MODEL=auto
NODE_ENV=production
```

- `LLM_BASE_URL` / `LLM_API_KEY` — gateway OpenAI-compatible milikmu. Tidak pernah diekspos ke browser, hanya dibaca server-side.
- `LLM_MODELS` — daftar model yang ditampilkan di model picker.
- `LLM_DEFAULT_MODEL` — model default untuk chat & generator PRD.

### Run locally

```bash
npm run dev
```

### Build production (standalone)

```bash
npm run build
# output: .next/standalone — jalankan dengan:
PORT=3100 HOSTNAME=0.0.0.0 node .next/standalone/server.js
```

## Opsional: Google Sign-In + Firestore sync

Keduanya opsional penuh. Tanpa env vars tersebut, aplikasi jalan persis seperti dijelaskan — anonim, localStorage saja. Menambahkan `NEXT_PUBLIC_FIREBASE_*` mengaktifkan tombol "Sign in" di top nav; pengguna yang login bisa sinkronisasi history antar perangkat.

Lihat `.env.example` untuk daftar lengkap variabel.

## Kontribusi

Pull request dipersilakan. Untuk perubahan besar, buka issue dulu untuk diskusi.

## Lisensi

[MIT](./LICENSE)
