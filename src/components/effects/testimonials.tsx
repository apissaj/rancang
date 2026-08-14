import Reveal from "@/components/effects/reveal";

const testimonials = [
  {
    name: "Rizky Ramadhan",
    role: "Frontend Engineer",
    text: "Dulu PRD satu halaman makan waktu setengah hari. Sekarang cukup tulis idenya, 30 detik kemudian dapat PRD lengkap plus task breakdown. Langsung saya lempar ke Claude Code.",
  },
  {
    name: "Sinta Puspita",
    role: "Product Designer",
    text: "Yang paling saya suka, output-nya markdown murni. Nggak terkunci di satu platform — bisa saya pindah ke tool apa pun. Rancang bikin kerjaan lintas tim jadi rapi.",
  },
  {
    name: "Bagas Wirawan",
    role: "Indie Hacker",
    text: "Saya bangun 2 side project sebulan. Rancang jadi langkah pertama di setiap project: ide → PRD → tasks, tinggal eksekusi. Tanpa akun, data di browser, nggak ada yang bocor.",
  },
  {
    name: "Dewi Anggraini",
    role: "Tech Lead",
    text: "Task-nya bernomor dan terstruktur, cocok banget buat onboarding developer baru. Tim saya nggak perlu nanya 'mulai dari mana' lagi — tinggal jalanin task satu per satu.",
  },
  {
    name: "Fajar Nugroho",
    role: "Full-stack Developer",
    text: "Mode banding di chat multi-model itu underrated. Jalanin prompt yang sama di 2-3 model, lihat mana yang paling masuk akal buat arsitektur project saya.",
  },
  {
    name: "Laras Widya",
    role: "Startup Founder",
    text: "Sebagai non-technical founder, Rancang bantu saya ngomong bahasa yang sama dengan tim engineering. PRD-nya langsung bisa dieksekusi, nggak cuma jadi dokumen pajangan.",
  },
];

export default function Testimonials() {
  return (
    <section className="mt-20 sm:mt-28">
      <Reveal>
        <div className="mb-8 border-b border-border pb-4">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            Kata mereka yang pakai
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Dari developer solo sampai tim produk
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((t) => (
            <figure
              key={t.name}
              className="flex flex-col justify-between rounded-sm border border-border bg-card/60 p-5 transition-colors hover:bg-muted/60"
            >
              <blockquote className="text-sm leading-relaxed text-foreground">
                &ldquo;{t.text}&rdquo;
              </blockquote>
              <figcaption className="mt-4 flex items-center gap-3 border-t border-border pt-4">
                <div className="flex size-9 items-center justify-center rounded-full border border-border bg-muted text-xs font-semibold text-foreground">
                  {t.name.split(" ").map((w) => w[0]).join("")}
                </div>
                <div>
                  <div className="text-sm font-medium text-foreground">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.role}</div>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </Reveal>
    </section>
  );
}