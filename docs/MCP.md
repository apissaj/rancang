# Rancang MCP — dari PRD ke eksekusi agent

MCP server yang bikin blueprint Rancang (prd/spec/plan/tasks) bisa langsung
dikonsumsi AI coding agent. Setelah PRD selesai di web app, agent tinggal
panggil tool-nya dan dapat **execution prompt** siap jalan + task queue yang
bisa di-tick satu per satu.

## Kenapa ada MCP, bukan cuma export file

Export `AGENTS.md` / `.cursorrules` itu sekali-jalan: agent dapat contekan tapi
nggak tahu sudah sampai mana. MCP bikin loop-nya hidup:

```
rancang_execution_prompt  → prompt + dokumen inline (awal kerja)
rancang_next_task         → task berikutnya yang belum selesai
   ...agent kerja, verifikasi...
rancang_task_complete     → tick T001 di tasks.md
rancang_next_task         → T002, dst.
```

Progress tersimpan di `~/.rancang/blueprints/<id>.json`, jadi sesi agent bisa
putus-nyambung tanpa kehilangan posisi.

## Store

| Hal | Nilai |
|---|---|
| Root | `~/.rancang/` (override: env `RANCANG_HOME`) |
| Blueprint | `~/.rancang/blueprints/<id>.json` — 1 file per blueprint, berisi 4 dokumen |
| Penulis | web app (`POST /api/mcp/blueprint`) **dan** MCP (`rancang_save_blueprint`) |
| Format | JSON plain — bisa di-`cat`, di-diff, di-commit sendiri |

Web app menulis ke folder yang sama lewat bridge `POST /api/mcp/blueprint`,
jadi yang dibaca agent = persis yang baru kamu generate.

## Tools

| Tool | Fungsi |
|---|---|
| `rancang_list_blueprints` | Daftar blueprint (terbaru dulu) + progres task |
| `rancang_read_blueprint` | Baca dokumen (`docs: ["spec","tasks"]` buat hemat context) |
| `rancang_execution_prompt` | **Utama.** Prompt eksekusi siap-tempel: instruksi kerja + dokumen inline + working dir |
| `rancang_next_task` | Task berikutnya yang belum selesai + sisa antrean + progres |
| `rancang_task_complete` | Tick task (`T001`) setelah beneran diimplementasi & diverifikasi |
| `rancang_save_blueprint` | Agent menulis revisi balik ke Rancang |
| `rancang_status` | Health check: folder store, jumlah blueprint, blueprint terakhir |

Semua tool nerima `id` opsional (id penuh, prefix, atau boleh dikosongin =
blueprint terbaru).

## Menjalankan

```bash
# HTTP (Streamable) — buat Hermes, agent remote, atau web app lintas origin
node mcp-server.mjs                 # → http://127.0.0.1:3110/mcp  (health: /health)

# stdio — buat Claude Code / Cursor / Codex
node mcp-server.mjs --stdio
```

Port bisa diganti: `RANCANG_MCP_PORT=3120 node mcp-server.mjs`.

## Menyambungkan ke agent

**Hermes**

```bash
hermes mcp add rancang --url http://127.0.0.1:3110/mcp
hermes mcp test rancang
```

**Claude Code**

```bash
# ganti <path-ke-rancang> dengan folder tempat kamu clone repo ini
claude mcp add rancang -- node "<path-ke-rancang>/mcp-server.mjs" --stdio
```

**Cursor / Codex / klien lain** (config JSON yang sama bentuknya):

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

## Alur pakai

1. Generate blueprint di `http://localhost:3100/plan` (4 dokumen).
2. Klik **Kirim ke MCP** di toolbar preview → blueprint masuk ke `~/.rancang/blueprints`
   (juga otomatis terkirim tiap kali generate sukses).
3. Klik **Salin Prompt MCP** → tempel ke agent kamu.
4. Agent jalan: ambil execution prompt → kerjakan task → tick → ambil berikutnya.

Agent yang sudah punya MCP-nya nggak butuh langkah 3 — cukup bilang
"pakai MCP rancang, kerjakan blueprint terakhir".

## Catatan operasional

- Tool MCP ini **local-first**: satu user, satu mesin, tanpa auth. Jangan
  diekspos ke internet apa adanya (transport HTTP hanya listen di `127.0.0.1`).
- `RANCANG_HOME` perlu di-set konsisten antar proses kalau kamu pindahkan store.
- `rancang_task_complete` sengaja tidak auto-jalan dari agent tanpa verifikasi —
  dia cuma mengubah `- [ ]` jadi `- [x]` di tasks.md, bukan menandai kerja selesai.
