<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

- Gunakan `ast-grep -p '<pola>'` untuk pencarian/refactor struktural, bukan regex.

- Untuk API Next.js/library lain, cek dokumentasi terkini via MCP context7 sebelum menulis kode.

- Untuk navigasi kode (cari simbol, referensi, struktur), gunakan tool serena (find_symbol, find_referencing_symbols, get_symbols_overview) sebelum grep.

## Anti-tebakan

- Dilarang menebak. Jika tidak yakin: baca file terkait dengan serena/rg, cek `node_modules/next/dist/docs/`, atau tanya saya.
- Sebelum memakai API/komponen yang tidak 100% yakin ada, verifikasi dulu via context7 atau baca kode sumbernya, lalu sebutkan sumber verifikasinya di jawaban.
- Jika informasi yang dibutuhkan tidak ada, katakan terus terang: "saya perlu cek X dulu" — jangan mengarang isi file, nama fungsi, atau respons API.
- Sebelum mengklaim "sudah beres", buktikan dengan perintah (build/test/analyze yang benar-benar dijalankan), bukan asumsi.

<!-- END:nextjs-agent-rules -->

## Orkestrasi subagent (WAJIB)

- Mulai fitur baru → panggil **@spec-writer** untuk menulis/update SPEC di docs/ sebelum menulis kode.
- Selesai implementasi fitur → panggil **@qa** untuk menguji alurnya di localhost (playwright) dan lapor hasilnya.
- Sebelum klaim selesai → panggil **@reviewer** untuk code review (temuan P0/P1/P2).
- Perubahan menyentuh auth/firestore.rules → panggil **@security-auditor**. Jangan edit firestore.rules tanpa audit dulu.
- Error yang mentok setelah 2 percobaan → delegasi ke **@debugger** sebelum mencoba lagi.
- API/fitur publik baru → panggil **@docs-writer** untuk update README/docs.