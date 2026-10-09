'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Play, Pause, ChevronRight, ChevronLeft, RotateCcw,
  Sparkles, CheckCircle2, ArrowRight, Zap, Flame, ShieldAlert,
  Send, Bot, Gauge, CalendarClock, UserCheck, Inbox,
} from 'lucide-react';

export interface StepData {
  step: number;
  id: string;
  title: string;
  tagline: string;
  body: string;
  details: string[];
  icon: typeof Inbox;
  badge: string;
  simulatedEvent: {
    label: string;
    detail: string;
    tag: string;
  };
  metrics: { value: string; label: string };
}

export const PIPELINE_STEPS: StepData[] = [
  {
    step: 1,
    id: 'capture',
    title: 'Capture',
    tagline: 'Instant Ingestion & Deduplication',
    body: 'Leads arrive from Meta Lead Ads, your website, portals and walk-ins into one pipeline, deduplicated on arrival.',
    icon: Inbox,
    badge: 'Step 1 • Ingestion',
    details: [
      'Meta Lead Ads webhook (< 1s sync)',
      'Phone & email deduplication check',
      'First-touch UTM attribution tagged',
    ],
    simulatedEvent: {
      label: 'Meta Lead Ad Received',
      detail: 'Phone & email verified • Deduplicated against CRM • ID #LD-9042',
      tag: '< 1s latency',
    },
    metrics: { value: '< 1 sec', label: 'to ingest & deduplicate' },
  },
  {
    step: 2,
    id: 'respond',
    title: 'Respond',
    tagline: 'Sub-minute WhatsApp Engagement',
    body: 'An automated first response goes out immediately through approved business messaging — before the lead contacts a competitor.',
    icon: Send,
    badge: 'Step 2 • First Touch',
    details: [
      'Official WhatsApp Business Platform',
      'Sub-60s speed-to-lead response',
      'Personalized greeting + project brochure',
    ],
    simulatedEvent: {
      label: 'WhatsApp Auto-Reply Delivered',
      detail: 'Personalized greeting + luxury 3BHK brochure sent to WhatsApp',
      tag: 'Delivered in 28s',
    },
    metrics: { value: '28 sec', label: 'average response time' },
  },
  {
    step: 3,
    id: 'qualify',
    title: 'Qualify',
    tagline: 'Guardrailed AI Fact Gathering',
    body: 'The assistant collects location, configuration, budget, timeline and intent, answering only from your approved knowledge base.',
    icon: Bot,
    badge: 'Step 3 • AI Qualification',
    details: [
      'Extracts 3BHK, budget ₹2.2 Cr, 30d decision',
      'Strictly grounded in approved facts',
      'Graceful handoff to rep when requested',
    ],
    simulatedEvent: {
      label: 'AI Buying Intent Extracted',
      detail: 'Parsed: 3BHK • ₹2.2 Cr Budget • DLF Phase 5 • 30-day decision',
      tag: '5 signals locked',
    },
    metrics: { value: '5 signals', label: 'captured automatically' },
  },
  {
    step: 4,
    id: 'score-route',
    title: 'Score and route',
    tagline: 'Intent Scoring & Instant Rep Notification',
    body: 'Each lead is scored on configurable signals and assigned to a salesperson, who is notified straight away.',
    icon: Gauge,
    badge: 'Step 4 • Routing',
    details: [
      '0–100 explainable buying intent score',
      'Capacity-aware rep routing',
      'Instant WhatsApp push alert to salesperson',
    ],
    simulatedEvent: {
      label: 'Intent Score Calculated: 94 (HOT)',
      detail: 'Auto-routed to Senior Rep Priya S. • WhatsApp alert pushed to rep',
      tag: 'Score 94 / 100',
    },
    metrics: { value: '0–100', label: 'explained intent score' },
  },
  {
    step: 5,
    id: 'follow-up',
    title: 'Follow up',
    tagline: 'Multi-touch Cadence & SLA Auditing',
    body: 'A configurable cadence runs until the lead replies or books a visit. Overdue human follow-ups escalate to the manager.',
    icon: CalendarClock,
    badge: 'Step 5 • Cadence',
    details: [
      'Automated site visit reminder sequence',
      'Missed callback timer tracks follow-through',
      'Manager alert if lead untouched > 4 hours',
    ],
    simulatedEvent: {
      label: 'Site Visit Follow-up Scheduled',
      detail: 'SLA countdown started • 4h silence trigger armed for escalation',
      tag: 'SLA monitored',
    },
    metrics: { value: '100%', label: 'follow-ups tracked' },
  },
  {
    step: 6,
    id: 'recover',
    title: 'Recover',
    tagline: 'Stalled Lead Salvage & Re-activation',
    body: 'Uncontacted, overdue, dormant, unowned and high-intent-inactive leads are surfaced as ranked alerts with the action attached.',
    icon: Flame,
    badge: 'Step 6 • Recovery Loop',
    details: [
      '5 continuous risk detection rules',
      'One-click WhatsApp salvage prompt',
      'Re-enters active pipeline (Closed loop)',
    ],
    simulatedEvent: {
      label: 'Dormant Lead Recovered',
      detail: 'One-click re-engagement sent • Site visit confirmed for Saturday! Re-enters active loop.',
      tag: 'Lead recovered',
    },
    metrics: { value: '42%', label: 'stalled leads recovered' },
  },
];

const STEP_DURATION_MS = 3800; // Time spent at each step before ball moves

export function HowItWorksLoop() {
  const [activeStep, setActiveStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  // Smooth progress bar and step advancing loop
  useEffect(() => {
    if (!isPlaying || isHovered) {
      lastTimeRef.current = null;
      return;
    }

    const updateTimer = (time: number) => {
      if (lastTimeRef.current === null) {
        lastTimeRef.current = time;
      }

      const elapsed = time - lastTimeRef.current;
      const stepPct = Math.min(100, (elapsed / STEP_DURATION_MS) * 100);
      setProgress(stepPct);

      if (elapsed >= STEP_DURATION_MS) {
        lastTimeRef.current = time;
        setProgress(0);
        setActiveStep((prev) => (prev + 1) % PIPELINE_STEPS.length);
      } else {
        animFrameRef.current = requestAnimationFrame(updateTimer);
      }
    };

    animFrameRef.current = requestAnimationFrame(updateTimer);

    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isPlaying, isHovered, activeStep]);

  const handleSelectStep = (index: number) => {
    setActiveStep(index);
    setProgress(0);
    lastTimeRef.current = null;
  };

  const handlePrev = () => {
    setActiveStep((prev) => (prev - 1 + PIPELINE_STEPS.length) % PIPELINE_STEPS.length);
    setProgress(0);
    lastTimeRef.current = null;
  };

  const handleNext = () => {
    setActiveStep((prev) => (prev + 1) % PIPELINE_STEPS.length);
    setProgress(0);
    lastTimeRef.current = null;
  };

  // Ball progress position across the continuous 6-station track (0 to 100%)
  const overallTrackPercent = ((activeStep + progress / 100) / PIPELINE_STEPS.length) * 100;
  const currentStepData = PIPELINE_STEPS[activeStep];

  return (
    <div
      className="relative mt-8"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* ── TOP PIPELINE CONTROL BAR & CLOSED-LOOP TRACK ────────────────── */}
      <div className="relative mb-8 overflow-hidden rounded-2xl border border-brand-500/20 bg-gradient-to-r from-[#120326] via-[#0d011d] to-[#120326] p-4 shadow-xl shadow-brand-950/40 backdrop-blur-md sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Loop status info */}
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className={`absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75 ${isPlaying && !isHovered ? 'animate-ping' : ''}`} />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-brand-500 shadow-glow" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-brand-300">
                  Continuous Leadloop Pipeline
                </span>
                <span className="hidden rounded-full border border-brand-500/30 bg-brand-950/60 px-2 py-0.5 text-[10px] font-medium text-brand-300 sm:inline-block">
                  Perpetual Cycle
                </span>
              </div>
              <p className="text-xs text-ink-500">
                Simulating live lead: <span className="font-medium text-ink-900">Rahul Sharma (Gurugram 3BHK)</span>
              </p>
            </div>
          </div>

          {/* Interactive controls: Play/Pause, Prev, Next */}
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={handlePrev}
              aria-label="Previous step"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-ink-200/80 bg-ink-100 text-ink-600 transition-colors hover:border-brand-500/50 hover:bg-brand-950/40 hover:text-white"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setIsPlaying((p) => !p)}
              className="flex items-center gap-1.5 rounded-lg border border-brand-500/30 bg-brand-950/60 px-3 py-1.5 text-xs font-medium text-brand-200 transition-all hover:border-brand-500/60 hover:bg-brand-900/60 hover:text-white"
            >
              {isPlaying && !isHovered ? (
                <>
                  <Pause className="h-3.5 w-3.5 text-brand-400" />
                  <span className="hidden sm:inline">Pause</span>
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5 fill-current text-brand-400" />
                  <span className="hidden sm:inline">Play Loop</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleNext}
              aria-label="Next step"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-ink-200/80 bg-ink-100 text-ink-600 transition-colors hover:border-brand-500/50 hover:bg-brand-950/40 hover:text-white"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── THE LOOP TRACK WITH GLOWING TRAVELING BALL ─────────────────── */}
        <div className="relative mt-5 pt-3 pb-2">
          {/* Base rail track */}
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-ink-200/60">
            {/* Illuminated trail behind the ball */}
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-600 via-brand-400 to-[#e879f9] transition-all duration-75"
              style={{ width: `${overallTrackPercent}%` }}
            />
          </div>

          {/* THE TRAVELING BALL (ORB) */}
          <div
            className="pointer-events-none absolute top-1.5 z-20 -translate-x-1/2 transition-all duration-75"
            style={{ left: `${overallTrackPercent}%` }}
          >
            <div className="relative flex items-center justify-center">
              {/* Outer soft glowing aura */}
              <div className="absolute h-9 w-9 rounded-full bg-brand-400/30 blur-md" />
              {/* Pulsing ring */}
              <div className="absolute h-6 w-6 animate-ping rounded-full bg-[#e879f9]/40" />
              {/* Solid core orb */}
              <div className="relative h-5 w-5 rounded-full border-2 border-white bg-gradient-to-br from-[#e879f9] via-brand-400 to-brand-600 shadow-[0_0_15px_#e879f9]" />
            </div>
          </div>

          {/* 6 Step Station Nodes along the track */}
          <div className="mt-3 grid grid-cols-6 gap-1">
            {PIPELINE_STEPS.map((s, idx) => {
              const isActive = idx === activeStep;
              const isPassed = idx < activeStep;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleSelectStep(idx)}
                  className="group relative flex flex-col items-center text-center transition-transform hover:scale-105"
                >
                  <div
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-all ${
                      isActive
                        ? 'border border-brand-300 bg-brand-500 text-white shadow-glow'
                        : isPassed
                        ? 'border border-brand-500/40 bg-brand-950/70 text-brand-300'
                        : 'border border-ink-200/80 bg-ink-100 text-ink-500 group-hover:border-brand-500/40 group-hover:text-ink-900'
                    }`}
                  >
                    {s.step}
                  </div>
                  <span
                    className={`mt-1.5 hidden text-[11px] font-medium transition-colors sm:block ${
                      isActive
                        ? 'text-brand-300 font-semibold'
                        : 'text-ink-500 group-hover:text-ink-800'
                    }`}
                  >
                    {s.title}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Live event notification banner inside the track header */}
        <div className="mt-3 flex items-center justify-between rounded-xl border border-brand-500/20 bg-[#090114]/90 px-3.5 py-2 text-xs">
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="flex h-2 w-2 shrink-0 rounded-full bg-[#e879f9] shadow-glow" />
            <span className="truncate font-semibold text-brand-200">
              Stage {currentStepData.step}: {currentStepData.simulatedEvent.label}
            </span>
            <span className="hidden text-ink-600 md:inline">—</span>
            <span className="hidden truncate text-ink-400 md:inline">
              {currentStepData.simulatedEvent.detail}
            </span>
          </div>
          <span className="shrink-0 rounded-md bg-brand-950/80 px-2 py-0.5 text-[11px] font-medium text-brand-300 border border-brand-500/30">
            {currentStepData.simulatedEvent.tag}
          </span>
        </div>
      </div>

      {/* ── THE 6 STEP CARDS (MATCHING 3x2 GRID WITH CLOSED-LOOP FLOW) ──── */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {PIPELINE_STEPS.map((step, index) => {
          const isActive = index === activeStep;
          const isPassed = index < activeStep;
          const Icon = step.icon;

          return (
            <div
              key={step.id}
              onClick={() => handleSelectStep(index)}
              className={`lift group relative flex flex-col justify-between overflow-hidden rounded-2xl border p-5 transition-all duration-300 cursor-pointer ${
                isActive
                  ? 'border-brand-400 bg-gradient-to-br from-[#1b0638] via-[#100324] to-[#0a0118] shadow-[0_0_35px_rgba(168,85,247,0.35)] ring-1 ring-brand-400/50 scale-[1.02]'
                  : 'border-ink-200 bg-ink-100 hover:border-brand-500/40 hover:bg-[#0f0322]'
              }`}
            >
              {/* Active Step Top Progress Bar filling up */}
              {isActive && (
                <div className="absolute inset-x-0 top-0 h-1 bg-ink-200/40">
                  <div
                    className="h-full bg-gradient-to-r from-brand-500 via-brand-400 to-[#e879f9] transition-all duration-75"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}

              {/* Card Header: Step badge and active indicator */}
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    {/* Step Number with Active Orb Glow */}
                    <div className="relative">
                      {isActive && (
                        <span className="absolute -inset-1 rounded-xl bg-brand-400/40 animate-ping" />
                      )}
                      <span
                        className={`relative flex h-8 w-8 items-center justify-center rounded-xl text-xs font-bold transition-all ${
                          isActive
                            ? 'bg-gradient-to-br from-brand-400 via-brand-500 to-brand-700 text-white shadow-glow shadow-brand-500/60 ring-2 ring-white/50'
                            : isPassed
                            ? 'bg-brand-950/80 text-brand-300 border border-brand-500/30'
                            : 'bg-ink-200/70 text-ink-500'
                        }`}
                      >
                        {step.step}
                      </span>
                    </div>

                    <span
                      className={`text-xs font-medium uppercase tracking-wider transition-colors ${
                        isActive ? 'text-brand-300' : 'text-ink-500'
                      }`}
                    >
                      {step.tagline}
                    </span>
                  </div>

                  {/* Active glowing indicator pill */}
                  {isActive ? (
                    <span className="flex items-center gap-1.5 rounded-full border border-brand-400/40 bg-brand-950/90 px-2.5 py-1 text-[11px] font-semibold text-[#e879f9] shadow-glow">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#e879f9] animate-pulse" />
                      Active
                    </span>
                  ) : (
                    <span className="text-[11px] text-ink-500 transition-colors group-hover:text-brand-300">
                      Step {step.step}
                    </span>
                  )}
                </div>

                {/* Step Title & Description */}
                <h3
                  className={`mt-4 text-base font-semibold tracking-tight transition-colors ${
                    isActive ? 'text-white' : 'text-ink-900 group-hover:text-white'
                  }`}
                >
                  {step.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-500">
                  {step.body}
                </p>

                {/* Key capability bullet points */}
                <ul className="mt-3.5 space-y-1.5">
                  {step.details.map((detail) => (
                    <li key={detail} className="flex items-center gap-2 text-xs text-ink-400">
                      <CheckCircle2
                        className={`h-3.5 w-3.5 shrink-0 transition-colors ${
                          isActive ? 'text-brand-400' : 'text-ink-600'
                        }`}
                      />
                      <span className={isActive ? 'text-ink-200 font-medium' : ''}>{detail}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Active Step simulated event tray */}
              <div className="mt-5 pt-3 border-t border-ink-200/60">
                <div
                  className={`rounded-xl p-3 text-xs transition-all ${
                    isActive
                      ? 'border border-brand-500/30 bg-[#0c021a] text-brand-200'
                      : 'border border-transparent bg-ink-200/30 text-ink-500'
                  }`}
                >
                  <div className="flex items-center justify-between font-medium">
                    <span className="flex items-center gap-1.5">
                      <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-[#e879f9]' : 'text-ink-500'}`} />
                      <span className={isActive ? 'text-white font-semibold' : ''}>
                        {step.simulatedEvent.label}
                      </span>
                    </span>
                    <span className={`text-[10px] font-mono ${isActive ? 'text-brand-300' : 'text-ink-500'}`}>
                      {step.metrics.value}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] leading-snug text-ink-500">
                    {step.simulatedEvent.detail}
                  </p>
                </div>
              </div>

              {/* Ambient purple spotlight on active card */}
              {isActive && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute -bottom-10 -right-10 h-32 w-32 rounded-full bg-brand-500/20 blur-2xl"
                />
              )}
            </div>
          );
        })}
      </div>

      {/* ── LOOP RETURN FOOTER BANNER ───────────────────────────────────── */}
      <div className="mt-6 flex flex-col items-center justify-between gap-3 rounded-2xl border border-brand-500/20 bg-gradient-to-r from-brand-950/40 via-ink-100 to-brand-950/40 px-5 py-3 text-xs sm:flex-row">
        <div className="flex items-center gap-2.5 text-ink-400">
          <RotateCcw className="h-4 w-4 text-brand-400 animate-spin-slow" />
          <span>
            <strong className="text-ink-900 font-semibold">Continuous Recovery Circuit:</strong> Leads that stall at Step 5 immediately route into Step 6 (Recovery), and re-enter Step 1 without dropping out.
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-brand-300 font-medium">
          <span>0 leads lost to silence</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </div>
      </div>
    </div>
  );
}
