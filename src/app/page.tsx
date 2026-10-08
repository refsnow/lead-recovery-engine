import Link from 'next/link';
import {
  ArrowRight, PhoneOff, Clock, UserX, Moon, Check, Sparkles, BarChart3,
  ShieldCheck, Workflow, MessageSquare, Flame, Phone,
} from 'lucide-react';
import { Reveal } from '@/components/ui/reveal';

export const metadata = {
  title: 'Recover the leads you are already paying for',
  description:
    'Leadloop helps real-estate businesses automatically qualify, follow up with and route leads, while giving sales teams and management visibility from enquiry to conversion.',
};

const PROBLEMS = [
  { icon: PhoneOff, title: 'Nobody called back', body: 'An enquiry arrives, a salesperson is busy, and nobody notices the lead was never contacted at all.' },
  { icon: Clock, title: 'The follow-up was promised, not made', body: 'A callback is agreed, the day passes, and no system anywhere records that the commitment was missed.' },
  { icon: UserX, title: 'No one owned it', body: 'A lead sits unassigned. Everyone assumes someone else has it, so nobody does.' },
  { icon: Moon, title: 'It went quiet and stayed quiet', body: 'A high-intent buyer stops replying. Without a trigger, they are simply forgotten.' },
];

const STEPS = [
  { title: 'Capture', body: 'Leads arrive from Meta Lead Ads, your website, portals and walk-ins into one pipeline, deduplicated on arrival.' },
  { title: 'Respond', body: 'An automated first response goes out immediately through approved business messaging — before the lead contacts a competitor.' },
  { title: 'Qualify', body: 'The assistant collects location, configuration, budget, timeline and intent, answering only from your approved knowledge base.' },
  { title: 'Score and route', body: 'Each lead is scored on configurable signals and assigned to a salesperson, who is notified straight away.' },
  { title: 'Follow up', body: 'A configurable cadence runs until the lead replies or books a visit. Overdue human follow-ups escalate to the manager.' },
  { title: 'Recover', body: 'Uncontacted, overdue, dormant, unowned and high-intent-inactive leads are surfaced as ranked alerts with the action attached.' },
];

const FEATURES = [
  { icon: ShieldCheck, title: 'Lead recovery', body: 'Five detection rules run continuously: uncontacted, overdue, dormant, high-intent inactive and unassigned. Each alert names the leads and the action to take.' },
  { icon: Sparkles, title: 'Controlled AI qualification', body: 'The assistant can only state facts from your approved knowledge base. It never quotes prices it was not given, never promises discounts, never claims to be human, and escalates to a person when unsure.' },
  { icon: Workflow, title: 'Sales accountability', body: 'Every commitment made to a lead is recorded, and every missed one is visible — response times, follow-through rates and overdue workload per salesperson.' },
  { icon: BarChart3, title: 'Funnel and revenue analytics', body: 'See where leads stop moving, which campaigns produce leads worth working, cost per qualified lead, and revenue by source, campaign and salesperson.' },
  { icon: MessageSquare, title: 'Official messaging only', body: 'Built on the WhatsApp Business Platform behind a provider interface. No unofficial automation, and providers can be swapped without touching your data.' },
  { icon: Clock, title: 'Complete lead history', body: 'Every lead carries a timeline: created, messaged, replied, qualified, scored, assigned, followed up, booked, won or lost — with who did what and when.' },
];

const FAQS = [
  { q: 'What does the system actually do that a CRM does not?', a: 'A CRM stores leads. This detects the ones nobody is acting on. Its central question is not "what is in the pipeline" but "which leads are being lost right now, and who needs to know".' },
  { q: 'Do I need API keys to try it?', a: 'No. The application runs in demo mode with mock providers and a fully populated sample organization. Connect Meta, WhatsApp and an AI provider when you are ready; the interfaces do not change.' },
  { q: 'Can the AI say something it should not to my customers?', a: 'It is constrained to your approved knowledge base and is explicitly prohibited from inventing property details or prices, promising discounts, making financial or legal claims, negotiating, or claiming to be human. When confidence is low or a commercial topic comes up, it stops and hands the conversation to a salesperson.' },
  { q: 'Is WhatsApp messaging compliant?', a: 'Production messaging uses the official WhatsApp Business Platform and is subject to Meta’s template and opt-in requirements. No unofficial automation is used.' },
  { q: 'Can salespeople see each other’s leads?', a: 'No. Salespeople see only the leads assigned to them. Managers, admins and owners see the whole organization. Data is isolated per organization at the query layer.' },
  { q: 'How are leads scored?', a: 'On configurable signals — budget, location, property type, purchase timeline, engagement and appointment intent. You control the rules and the hot/warm/cold thresholds, and every lead can show exactly which signals produced its score.' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-ink-50 text-ink-700">
      <header className="sticky top-0 z-30 border-b border-ink-200 bg-ink-50/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-brand-400 via-brand-500 to-brand-700 text-xs font-bold text-white shadow-sm shadow-brand-500/30">LL</span>
            <span className="text-sm font-semibold tracking-tight text-ink-900">Leadloop</span>
          </Link>
          <nav className="flex items-center gap-2">
            <Link href="#how-it-works" className="hidden rounded-lg px-3 py-1.5 text-sm text-ink-400 hover:bg-ink-100 hover:text-ink-900 sm:inline-flex">How it works</Link>
            <Link href="#features" className="hidden rounded-lg px-3 py-1.5 text-sm text-ink-400 hover:bg-ink-100 hover:text-ink-900 sm:inline-flex">Features</Link>
            <Link href="#faq" className="hidden rounded-lg px-3 py-1.5 text-sm text-ink-400 hover:bg-ink-100 hover:text-ink-900 sm:inline-flex">FAQ</Link>
            <Link href="/login" className="press rounded-lg bg-brand-600 px-3.5 py-1.5 text-sm font-medium text-white shadow-glow transition-colors hover:bg-brand-700">
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden">
        {/* Ambient colour field. Purely decorative and pointer-transparent. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
          <div className="aurora-blob -left-32 -top-32 h-[32rem] w-[32rem] bg-brand-400/60" />
          <div className="aurora-blob -right-20 top-0 h-[28rem] w-[28rem] bg-brand-500/50" style={{ animationDelay: '-6s' }} />
          <div className="aurora-blob left-1/3 top-72 h-[24rem] w-[24rem] bg-brand-300/40" style={{ animationDelay: '-12s' }} />
          {/* Softens the field so text stays comfortably readable over it. */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-ink-50/70 to-ink-50" />
        </div>

        <div className="relative z-10 mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_1fr]">
            <div className="animate-fade-up">
              <p className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-brand-500/40 bg-brand-950/70 px-3 py-1 text-xs font-medium text-brand-300 shadow-sm backdrop-blur">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand-500" />
                </span>
                Built for Indian real-estate sales teams
              </p>

              <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight text-ink-900 sm:text-5xl lg:text-[3.4rem]">
                Recover the leads<br />you&rsquo;re <span className="text-gradient">already paying for.</span>
              </h1>

              <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-600">
                Automatically qualify, follow up and route your leads while giving your sales team
                complete visibility from enquiry to conversion.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/login"
                  className="press group inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-medium text-white shadow-glow transition-all hover:bg-brand-700"
                >
                  Start Lead Recovery
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </Link>
                <Link
                  href="/login"
                  className="press inline-flex items-center gap-2 rounded-xl border border-ink-200 bg-ink-100/70 px-5 py-3 text-sm font-medium text-ink-900 backdrop-blur transition-colors hover:bg-ink-100"
                >
                  View Demo
                </Link>
              </div>

              <p className="mt-4 text-xs text-ink-400">
                The demo runs on sample data with mock providers — no API keys, no setup.
              </p>
            </div>

            {/* A miniature of the alert panel — the product's actual point, not a stock image. */}
            <div className="animate-fade-up lg:animate-float" style={{ animationDelay: '0.15s' }}>
              <div className="rounded-2xl border border-ink-200 bg-ink-100/90 p-1.5 shadow-2xl shadow-ink-950 backdrop-blur">
                <div className="rounded-xl bg-ink-50">
                  <div className="flex items-center gap-1.5 border-b border-ink-200 px-4 py-2.5">
                    <span className="h-2 w-2 rounded-full bg-rose-400" />
                    <span className="h-2 w-2 rounded-full bg-amber-400" />
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    <span className="ml-2 text-[11px] font-medium text-ink-400">Lead recovery alerts</span>
                  </div>

                  <div className="space-y-2 p-3">
                    <MockAlert
                      icon={Flame}
                      tone="rose"
                      title="11 high-intent leads inactive for 48 hours"
                      body="Scoring 70+ with no interaction. Call immediately."
                      delay="0.35s"
                    />
                    <MockAlert
                      icon={PhoneOff}
                      tone="amber"
                      title="7 leads have not been contacted"
                      body="No first contact 30 minutes after the enquiry arrived."
                      delay="0.5s"
                    />

                    <div className="animate-fade-up rounded-lg border border-ink-200 bg-ink-100 p-2.5" style={{ animationDelay: '0.65s' }}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-ink-800">Rahul Kapoor</span>
                        <span className="flex items-center gap-1 rounded bg-rose-950/70 px-1.5 py-0.5 text-[10px] font-semibold text-rose-300 ring-1 ring-inset ring-rose-700/50">
                          <Flame className="h-2.5 w-2.5" aria-hidden />HOT
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-200">
                          <div className="animate-grow-width h-full rounded-full bg-gradient-to-r from-rose-500 to-orange-400"
                            style={{ ['--target' as string]: '100%', animationDelay: '0.8s' }} />
                        </div>
                        <span className="font-mono text-[10px] font-semibold text-ink-700">100</span>
                      </div>
                      <p className="mt-1.5 text-[10px] text-ink-400">Last activity 5d ago · Owner: Pooja Nair</p>
                      <div className="mt-2 flex gap-1.5">
                        <span className="inline-flex items-center gap-1 rounded-md bg-brand-600 px-2 py-1 text-[10px] font-medium text-white shadow-sm">
                          <Phone className="h-2.5 w-2.5" aria-hidden />Call
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-md border border-ink-200 bg-ink-50 px-2 py-1 text-[10px] font-medium text-ink-600">
                          <MessageSquare className="h-2.5 w-2.5" aria-hidden />WhatsApp
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Outcome strip */}
          <div className="mt-16 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-ink-200/70 bg-ink-200/70 sm:grid-cols-4">
            {[
              { value: '5', label: 'risk rules running continuously' },
              { value: '<1 min', label: 'to first automated response' },
              { value: '0–100', label: 'explained lead score' },
              { value: '100%', label: 'of follow-ups tracked' },
            ].map((stat, index) => (
              <Reveal key={stat.label} delayMs={index * 80}>
                <div className="h-full bg-ink-100/80 px-4 py-5 text-center backdrop-blur">
                  <p className="text-2xl font-semibold tracking-tight text-ink-900">{stat.value}</p>
                  <p className="mt-1 text-xs leading-snug text-ink-500">{stat.label}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* PROBLEM */}
      <section className="border-y border-ink-200 bg-ink-50">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <Reveal>
          <h2 className="text-3xl font-semibold tracking-tight text-ink-900">
            Leads are rarely lost to competitors.<br className="hidden sm:block" />
            <span className="text-ink-400">They&rsquo;re lost to silence.</span>
          </h2>
          <p className="mt-4 max-w-2xl text-ink-600">
            You pay for every enquiry. What happens between the enquiry arriving and someone acting on it is where
            the money goes — and in most businesses, nothing records that it happened at all.
          </p>
          </Reveal>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PROBLEMS.map((problem, index) => (
              <Reveal key={problem.title} delayMs={index * 90}>
                <div className="lift group h-full rounded-2xl border border-ink-200 bg-ink-100 p-5 hover:border-rose-500/40 hover:shadow-pop">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-rose-950/60 text-rose-400 border border-rose-900/50 transition-transform duration-200 group-hover:scale-110">
                    <problem.icon className="h-4.5 w-4.5" aria-hidden />
                  </span>
                  <h3 className="mt-4 text-sm font-semibold text-ink-900">{problem.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{problem.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <Reveal>
          <h2 className="text-3xl font-semibold tracking-tight text-ink-900">How it works</h2>
          <p className="mt-4 max-w-2xl text-ink-600">
            One pipeline from the advertisement to the booking, with a check at every stage for leads that have stalled.
          </p>
        </Reveal>

        <ol className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {STEPS.map((step, index) => (
            <Reveal key={step.title} delayMs={index * 80}>
              <li className="lift group relative h-full overflow-hidden rounded-2xl border border-ink-200 bg-ink-100 p-5 hover:border-brand-500/40 hover:shadow-pop">
                <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-400 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 via-brand-600 to-brand-800 text-xs font-bold text-white shadow-sm shadow-brand-500/30">
                  {index + 1}
                </span>
                <h3 className="mt-4 text-sm font-semibold text-ink-900">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{step.body}</p>
              </li>
            </Reveal>
          ))}
        </ol>
      </section>

      {/* FEATURES */}
      <section id="features" className="border-y border-ink-200 bg-ink-50">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <Reveal>
            <h2 className="text-3xl font-semibold tracking-tight text-ink-900">What you get</h2>
          </Reveal>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature, index) => (
              <Reveal key={feature.title} delayMs={index * 70}>
                <div className="lift group h-full rounded-2xl border border-ink-200 bg-ink-100 p-5 hover:border-brand-500/40 hover:shadow-pop">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-950/80 to-brand-900/40 text-brand-300 ring-1 ring-inset ring-brand-500/30 transition-transform duration-200 group-hover:scale-110">
                    <feature.icon className="h-4.5 w-4.5" aria-hidden />
                  </span>
                  <h3 className="mt-4 text-sm font-semibold text-ink-900">{feature.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{feature.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* USE CASE */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-2">
          <Reveal>
            <h2 className="text-3xl font-semibold tracking-tight text-ink-900">A typical Tuesday</h2>
            <p className="mt-3 text-ink-600">
              A developer running four campaigns across Gurugram receives sixty enquiries a week. The sales team of
              five is genuinely busy — which is exactly why leads slip.
            </p>
            <ul className="mt-6 space-y-3.5">
              {[
                'A 10:32 enquiry gets an automated response at 10:33, before anyone is free to call.',
                'By 10:41 the lead has stated a ₹2 Cr budget, Gurgaon, 3BHK, this month — scored 92 and routed to a salesperson.',
                'At 11:15 the manager sees that four leads from yesterday were never contacted at all.',
                'On Thursday, a lead scoring 88 that has been silent for two days appears at the top of the dashboard with a call button.',
                'At month end, the owner sees which campaign produced the qualified leads, not just the cheapest ones.',
              ].map((line) => (
                <li key={line} className="flex gap-2.5">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-950/80 ring-1 ring-emerald-500/30">
                    <Check className="h-2.5 w-2.5 text-emerald-400" aria-hidden />
                  </span>
                  <span className="text-sm leading-relaxed text-ink-700">{line}</span>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delayMs={120}>
          <div className="rounded-2xl border border-brand-500/20 bg-gradient-to-br from-[#120429] to-[#0a0118] p-6 shadow-xl shadow-brand-950/50">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-300">What the dashboard answers</p>
            <ul className="mt-5 space-y-2.5">
              {[
                'Did the lead arrive?', 'Was it contacted, and how quickly?', 'Did the lead respond?',
                'Was it qualified, and how valuable is it?', 'Who owns it, and were they told?',
                'Was the follow-up completed?', 'Is it going dormant — and can it be recovered?',
                'Did it become an appointment, a customer, and how much revenue?',
              ].map((question) => (
                <li key={question} className="flex gap-2.5 text-sm text-ink-600">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" aria-hidden />
                  {question}
                </li>
              ))}
            </ul>
          </div>
          </Reveal>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-t border-ink-200 bg-ink-50">
        <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
          <Reveal>
            <h2 className="text-3xl font-semibold tracking-tight text-ink-900">Questions</h2>
          </Reveal>
          <dl className="mt-8 space-y-3">
            {FAQS.map((faq, index) => (
              <Reveal key={faq.q} delayMs={index * 60}>
              <div className="lift rounded-2xl border border-ink-200 bg-ink-100 p-5 hover:border-brand-500/30 hover:shadow-card">
                <dt className="text-sm font-semibold text-ink-900">{faq.q}</dt>
                <dd className="mt-1.5 text-sm leading-relaxed text-ink-600">{faq.a}</dd>
              </div>
              </Reveal>
            ))}
          </dl>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
          <div className="aurora-blob left-1/4 top-0 h-[22rem] w-[22rem] bg-brand-600/30" />
          <div className="aurora-blob right-1/4 top-10 h-[20rem] w-[20rem] bg-brand-400/20" style={{ animationDelay: '-8s' }} />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-ink-50/70 to-ink-50" />
        </div>

        <div className="relative z-10 mx-auto max-w-6xl px-4 py-24 text-center sm:px-6">
          <Reveal>
            <h2 className="mx-auto max-w-2xl text-3xl font-semibold leading-tight tracking-tight text-ink-900 sm:text-4xl">
              Never let a valuable lead disappear<br className="hidden sm:block" />{' '}
              <span className="text-gradient">without someone knowing.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-ink-600">
              Open the demo and see exactly which leads are being lost right now.
            </p>
            <Link
              href="/login"
              className="press group mt-9 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3.5 text-sm font-medium text-white shadow-glow transition-all hover:bg-brand-500 hover:shadow-glow-lg"
            >
              Start Lead Recovery
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </Reveal>
        </div>
      </section>

      <footer className="border-t border-ink-200">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-xs text-ink-400 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>Leadloop — lead recovery for real-estate sales teams.</p>
          <p>Built for the WhatsApp Business Platform and Meta Lead Ads.</p>
        </div>
      </footer>
    </div>
  );
}

/** A static miniature of a real recovery alert, used in the hero mockup. */
function MockAlert({
  icon: Icon, tone, title, body, delay,
}: {
  icon: typeof Flame; tone: 'rose' | 'amber'; title: string; body: string; delay: string;
}) {
  const tones = {
    rose: 'border-rose-500/30 bg-gradient-to-r from-rose-950/60 to-transparent text-rose-400',
    amber: 'border-amber-500/30 bg-gradient-to-r from-amber-950/60 to-transparent text-amber-400',
  }[tone];

  return (
    <div className={`animate-fade-up flex gap-2.5 rounded-lg border p-2.5 ${tones}`} style={{ animationDelay: delay }}>
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-ink-100 ring-1 ring-inset ring-current/20">
        <Icon className="h-3 w-3" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-ink-900">{title}</p>
        <p className="mt-0.5 text-[10px] leading-snug text-ink-500">{body}</p>
      </div>
    </div>
  );
}
