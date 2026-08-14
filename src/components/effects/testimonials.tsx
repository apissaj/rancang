import Reveal from "@/components/effects/reveal";
import { Star } from "lucide-react";

const testimonials = [
  {
    name: "Rizky Ramadhan",
    role: "Frontend Engineer",
    rating: 5,
    text: "Dulu PRD satu halaman makan waktu setengah hari. Sekarang cukup tulis idenya, 30 detik kemudian dapat PRD lengkap plus task breakdown. Langsung saya lempar ke Claude Code.",
  },
  {
    name: "Sinta Puspita",
    role: "Product Designer",
    rating: 5,
    text: "Yang paling saya suka, output-nya markdown murni. Nggak terkunci di satu platform — bisa saya pindah ke tool apa pun. Rancang bikin kerjaan lintas tim jadi rapi.",
  },
  {
    name: "Bagas Wirawan",
    role: "Indie Hacker",
    rating: 4,
    text: "Saya bangun 2 side project sebulan. Rancang jadi langkah pertama di setiap project: ide → PRD → tasks, tinggal eksekusi. Tanpa akun, data di browser, nggak ada yang bocor.",
  },
  {
    name: "Dewi Anggraini",
    role: "Tech Lead",
    rating: 5,
    text: "Task-nya bernomor dan terstruktur, cocok banget buat onboarding developer baru. Tim saya nggak perlu nanya 'mulai dari mana' lagi — tinggal jalanin task satu per satu.",
  },
  {
    name: "Fajar Nugroho",
    role: "Full-stack Developer",
    rating: 4,
    text: "Mode banding di chat multi-model itu underrated. Jalanin prompt yang sama di 2-3 model, lihat mana yang paling masuk akal buat arsitektur project saya.",
  },
  {
    name: "Laras Widya",
    role: "Startup Founder",
    rating: 5,
    text: "Sebagai non-technical founder, Rancang bantu saya ngomong bahasa yang sama dengan tim engineering. PRD-nya langsung bisa dieksekusi, nggak cuma jadi dokumen pajangan.",
  },
];

export default function Testimonials() {
  return (
    <section className="mt-20 sm:mt-28">
      <Reveal>
        <div className="mb-8 border-b border-border pb-4">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Testimoni
          </div>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            Dipercaya developer dan tim produk
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Dari developer solo sampai tim produk
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((t) => (
            <figure
              key={t.name}
              className="relative flex flex-col justify-between rounded-sm border border-border bg-card/60 p-5 transition-colors hover:border-foreground/40 hover:bg-muted/40"
            >
              {/* Decorative quote mark */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -top-1 right-3 select-none text-5xl font-serif leading-none text-foreground/10"
              >
                &rdquo;
              </span>

              {/* Star rating */}
              <div className="flex gap-0.5" aria-label={`Rating ${t.rating} dari 5`}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={
                      i < t.rating
                        ? "size-3.5 fill-foreground text-foreground"
                        : "size-3.5 text-muted-foreground/40"
                    }
                  />
                ))}
              </div>

              <blockquote className="mt-3 text-sm leading-relaxed text-foreground">
                &ldquo;{t.text}&rdquo;
              </blockquote>

              <figcaption className="mt-5 flex items-center gap-3 border-t border-border pt-4">
                <div className="flex size-10 items-center justify-center rounded-full border border-border bg-muted text-xs font-semibold text-foreground">
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