import Link from "next/link";
import { Button } from "@/shared/ui/components";

export default function HomePage() {
  return (
    <main className="min-h-screen gradient-wellness">
      <nav className="max-w-6xl mx-auto px-4 py-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text">
          Via<span className="text-primary">nda</span>
        </h1>
        <div className="flex gap-3">
          <Link href="/login"><Button variant="ghost" size="sm">Iniciar sesión</Button></Link>
          <Link href="/register"><Button size="sm">Registrarse</Button></Link>
        </div>
      </nav>

      <section className="max-w-6xl mx-auto px-4 py-20 md:py-32">
        <div className="max-w-2xl">
          <span className="inline-block px-3 py-1 rounded-full bg-primary-light text-primary text-sm font-medium mb-6">
            Gestión nutricional clínica
          </span>
          <h2 className="text-4xl md:text-6xl font-bold text-text leading-tight">
            Alimento pensado,{" "}
            <span className="text-primary">medido y personalizado</span>
          </h2>
          <p className="text-lg text-muted mt-6 max-w-lg">
            Vianda calcula, organiza y documenta. Tú validas, modificas y decides.
            No es un generador de dietas — es tu sistema clínico nutricional.
          </p>
          <div className="flex flex-wrap gap-4 mt-10">
            <Link href="/register"><Button size="lg">Comenzar gratis</Button></Link>
            <Link href="/login"><Button variant="outline" size="lg">Ya tengo cuenta</Button></Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-20">
          {[
            { icon: "📋", title: "Valoraciones clínicas", desc: "Antropometría, IMC, TMB y metas nutricionales calculadas automáticamente." },
            { icon: "🥗", title: "Planes alimentarios", desc: "Arma planes con catálogo ICBF y compara totales vs. objetivos del paciente." },
            { icon: "📊", title: "Seguimiento", desc: "Historial de valoraciones y evolución nutricional longitudinal." },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl bg-surface/80 backdrop-blur border border-border p-6 card-hover">
              <span className="text-3xl">{f.icon}</span>
              <h3 className="text-lg font-semibold text-text mt-4">{f.title}</h3>
              <p className="text-sm text-muted mt-2">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border bg-surface/50 mt-20">
        <div className="max-w-6xl mx-auto px-4 py-8 text-center text-sm text-muted">
          © {new Date().getFullYear()} Vianda. Todos los derechos reservados.
        </div>
      </footer>
    </main>
  );
}
