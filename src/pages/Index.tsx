import { useNavigate } from "react-router-dom";
import { ArrowRight, Briefcase, ShieldCheck, Users } from "lucide-react";

const accessCards = [
  {
    title: "Worker Portal",
    href: "/login/worker",
    icon: Users,
    tone: "from-sky-600/15 via-sky-500/10 to-transparent",
  },
  {
    title: "Employee Portal",
    href: "/login/employee",
    icon: Briefcase,
    tone: "from-emerald-600/15 via-emerald-500/10 to-transparent",
  },
  {
    title: "Admin Portal",
    href: "/srcadminpanel",
    icon: ShieldCheck,
    tone: "from-rose-600/15 via-rose-500/10 to-transparent",
  },
];

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen overflow-hidden bg-[linear-gradient(180deg,_#f5f9fc_0%,_#edf3f6_46%,_#f8fafc_100%)]">
      <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="absolute -left-24 top-16 h-64 w-64 rounded-full bg-sky-400/20 blur-3xl" />
        <div className="absolute right-0 top-0 h-72 w-72 rounded-full bg-emerald-300/20 blur-3xl" />

        <section className="relative rounded-[2.25rem] border border-white/70 bg-slate-950 px-6 py-8 text-white shadow-[0_28px_100px_rgba(15,23,42,0.18)] sm:px-10 sm:py-12">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.28em] text-slate-200">
              Embrace Connect Network
            </div>
            <h1 className="mt-6 text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">Select a portal</h1>
          </div>
        </section>

        <section className="relative mt-8 grid gap-5 lg:grid-cols-3">
          {accessCards.map((card, index) => {
            const Icon = card.icon;

            return (
              <button
                key={card.title}
                onClick={() => navigate(card.href)}
                className="group animate-fade-up rounded-[1.75rem] border border-border/70 bg-card/95 p-6 text-left shadow-[0_20px_50px_rgba(15,23,42,0.08)] transition-transform duration-200 hover:-translate-y-1"
                style={{ animationDelay: `${index * 90}ms` }}
              >
                <div className={`rounded-2xl bg-gradient-to-br ${card.tone} p-4`}>
                  <Icon className="h-7 w-7 text-foreground" />
                </div>
                <h2 className="mt-6 text-2xl font-semibold text-card-foreground">{card.title}</h2>
                <div className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary">
                  Open portal
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </button>
            );
          })}
        </section>
      </div>
    </div>
  );
};

export default Index;
