'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Play, Pause, RotateCcw, CheckCircle2, ArrowRight,
  Inbox, Send, Bot, Gauge, CalendarClock, Flame, Zap,
  Volume2, VolumeX,
} from 'lucide-react';
import { coasterAudio } from '@/lib/coaster-audio';

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
  coasterFeature: string;
}

export const PIPELINE_STEPS: StepData[] = [
  {
    step: 1,
    id: 'capture',
    title: 'Capture',
    tagline: 'Launch Hill • Deduplication',
    body: 'Leads arrive from Meta Lead Ads, your website, portals and walk-ins into one pipeline, deduplicated on arrival.',
    icon: Inbox,
    badge: 'Station 1 • Ingestion',
    coasterFeature: 'Initial Launch Hill',
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
    tagline: 'High-speed First Drop',
    body: 'An automated first response goes out immediately through approved business messaging — before the lead contacts a competitor.',
    icon: Send,
    badge: 'Station 2 • First Touch',
    coasterFeature: 'Steep Speed Drop',
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
    tagline: 'Ascent & Banking Curve',
    body: 'The assistant collects location, configuration, budget, timeline and intent, answering only from your approved knowledge base.',
    icon: Bot,
    badge: 'Station 3 • AI Qualification',
    coasterFeature: 'High-G Banked Turn',
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
    tagline: 'Apex Camelback Crest',
    body: 'Each lead is scored on configurable signals and assigned to a salesperson, who is notified straight away.',
    icon: Gauge,
    badge: 'Station 4 • Routing',
    coasterFeature: 'Camelback Airtime Hill',
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
    tagline: 'Skyline Horseshoe Curve',
    body: 'A configurable cadence runs until the lead replies or books a visit. Overdue human follow-ups escalate to the manager.',
    icon: CalendarClock,
    badge: 'Station 5 • Cadence',
    coasterFeature: 'Skyline Overbanked Turn',
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
    tagline: 'Loop-de-loop Recovery Climb',
    body: 'Uncontacted, overdue, dormant, unowned and high-intent-inactive leads are surfaced as ranked alerts with the action attached.',
    icon: Flame,
    badge: 'Station 6 • Recovery Loop',
    coasterFeature: 'The Inversion Loop',
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

// Rollercoaster track waypoints (viewBox: 0 0 1000 360)
// Defines the rollercoaster path with hills, drops, curves and loops
const COASTER_WAYPOINTS = [
  { x: 90,  y: 120, station: 0 },  // Station 1: Capture (Launch hill)
  { x: 180, y: 60 },               // First lift hill peak
  { x: 260, y: 240, station: 1 },  // Station 2: Respond (Steep valley drop)
  { x: 350, y: 190 },              // Dip exit
  { x: 440, y: 90,  station: 2 },  // Station 3: Qualify (Banking crest)
  { x: 540, y: 170 },              // Descent
  { x: 640, y: 250, station: 3 },  // Station 4: Score & Route (Low speed curve)
  { x: 740, y: 160 },              // Rise
  { x: 840, y: 80,  station: 4 },  // Station 5: Follow up (High turnaround)
  { x: 920, y: 180 },              // Outer helix drop
  { x: 880, y: 290 },              // Bottom sweep
  { x: 670, y: 320, station: 5 },  // Station 6: Recover (Loop recovery)
  { x: 430, y: 300 },              // Return sweep
  { x: 230, y: 280 },              // Upward return rise
  { x: 120, y: 220 },              // Curve leading back into Station 1
];

/** Convert waypoints to an organic, continuous closed Catmull-Rom cubic bezier SVG path */
function generateClosedSplinePath(points: { x: number; y: number }[]): string {
  const n = points.length;
  if (n < 3) return '';

  let path = `M ${points[0].x} ${points[0].y}`;
  const tension = 0.85;

  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];

    const cp1x = p1.x + ((p2.x - p0.x) / 6) * tension;
    const cp1y = p1.y + ((p2.y - p0.y) / 6) * tension;
    const cp2x = p2.x - ((p3.x - p1.x) / 6) * tension;
    const cp2y = p2.y - ((p3.y - p1.y) / 6) * tension;

    path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }

  path += ' Z';
  return path;
}

// Support struts from track points down to ground base line (y=340)
const SUPPORT_STRUTS = [
  { x: 180, topY: 60 },
  { x: 350, topY: 190 },
  { x: 440, topY: 90 },
  { x: 540, topY: 170 },
  { x: 740, topY: 160 },
  { x: 840, topY: 80 },
  { x: 920, topY: 180 },
  { x: 230, topY: 280 },
];

const TOTAL_LOOP_DURATION_MS = 22000; // 22 seconds for a complete thrilling rollercoaster lap

export function HowItWorksLoop() {
  const [activeStation, setActiveStation] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [ballPos, setBallPos] = useState({ x: 90, y: 120, angle: 0 });
  const [progressPercent, setProgressPercent] = useState(0);
  const [isSoundEnabled, setIsSoundEnabled] = useState(false);

  const pathRef = useRef<SVGPathElement>(null);
  const animRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const elapsedOffsetRef = useRef<number>(0);
  const totalLengthRef = useRef<number>(0);
  const lastStationSoundRef = useRef<number>(-1);

  // Generate the rollercoaster spline path once
  const trackPathD = useMemo(() => generateClosedSplinePath(COASTER_WAYPOINTS), []);

  // Compute station positions along the path on mount
  const stationDistancesRef = useRef<number[]>([]);

  useEffect(() => {
    const path = pathRef.current;
    if (!path) return;

    const totalLen = path.getTotalLength();
    totalLengthRef.current = totalLen;

    // Find closest distance on path for each station waypoint
    const stationCoords = [
      COASTER_WAYPOINTS[0],
      COASTER_WAYPOINTS[2],
      COASTER_WAYPOINTS[4],
      COASTER_WAYPOINTS[6],
      COASTER_WAYPOINTS[8],
      COASTER_WAYPOINTS[11],
    ];

    // Sample path to map each station to path distance
    const samples = 400;
    const distances: number[] = [0, 0, 0, 0, 0, 0];

    stationCoords.forEach((st, stIdx) => {
      let minDist = Infinity;
      let bestLen = 0;
      for (let s = 0; s <= samples; s++) {
        const d = (s / samples) * totalLen;
        const pt = path.getPointAtLength(d);
        const distSq = (pt.x - st.x) ** 2 + (pt.y - st.y) ** 2;
        if (distSq < minDist) {
          minDist = distSq;
          bestLen = d;
        }
      }
      distances[stIdx] = bestLen;
    });

    stationDistancesRef.current = distances;
  }, [trackPathD]);

  // Main continuous rollercoaster animation loop: PLAYS ON ITS OWN PERPETUALLY
  useEffect(() => {
    if (!isPlaying) {
      startTimeRef.current = null;
      return;
    }

    const animateCoaster = (timestamp: number) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = timestamp - elapsedOffsetRef.current;
      }

      const totalElapsed = (timestamp - startTimeRef.current) % TOTAL_LOOP_DURATION_MS;
      elapsedOffsetRef.current = totalElapsed;

      const progress = totalElapsed / TOTAL_LOOP_DURATION_MS;
      setProgressPercent(progress * 100);

      const path = pathRef.current;
      if (path && totalLengthRef.current > 0) {
        const currentDist = progress * totalLengthRef.current;
        const pt = path.getPointAtLength(currentDist);

        // Calculate tangent angle for head orientation
        const aheadDist = (currentDist + 3) % totalLengthRef.current;
        const ptAhead = path.getPointAtLength(aheadDist);
        const angle = Math.atan2(ptAhead.y - pt.y, ptAhead.x - pt.x) * (180 / Math.PI);

        setBallPos({ x: pt.x, y: pt.y, angle });

        // Determine which station is active based on proximity
        const distances = stationDistancesRef.current;
        if (distances.length === 6) {
          let closestIdx = 0;
          let minDelta = Infinity;

          distances.forEach((stDist, idx) => {
            // Circular distance on path
            const diff = Math.abs(currentDist - stDist);
            const wrappedDiff = Math.min(diff, totalLengthRef.current - diff);
            if (wrappedDiff < minDelta) {
              minDelta = wrappedDiff;
              closestIdx = idx;
            }
          });

          if (closestIdx !== lastStationSoundRef.current) {
            lastStationSoundRef.current = closestIdx;
            if (isSoundEnabled) {
              coasterAudio.playStationArrival(closestIdx);
            }
          }

          setActiveStation(closestIdx);
        }

        // Modulate coaster track rumble & lift clicks if sound is enabled
        if (isSoundEnabled) {
          const isLiftHill = pt.x >= 70 && pt.x <= 190 && pt.y <= 130;
          const isDiving = ptAhead.y > pt.y + 0.3;
          const speed = isDiving ? 0.9 : 0.25;
          coasterAudio.updatePhysics(speed, isLiftHill);
        }
      }

      animRef.current = requestAnimationFrame(animateCoaster);
    };

    animRef.current = requestAnimationFrame(animateCoaster);

    return () => {
      if (animRef.current !== null) {
        cancelAnimationFrame(animRef.current);
      }
    };
  }, [isPlaying, isSoundEnabled]);

  const handleToggleSound = () => {
    if (!isSoundEnabled) {
      const ok = coasterAudio.init();
      if (ok) {
        coasterAudio.unmute();
        setIsSoundEnabled(true);
        coasterAudio.playStationArrival(activeStation);
      }
    } else {
      coasterAudio.mute();
      setIsSoundEnabled(false);
    }
  };

  // Jump coaster directly to a station when clicked
  const handleJumpToStation = (stationIdx: number) => {
    const distances = stationDistancesRef.current;
    if (distances.length === 6 && totalLengthRef.current > 0) {
      const targetDist = distances[stationIdx];
      const targetProgress = targetDist / totalLengthRef.current;
      elapsedOffsetRef.current = targetProgress * TOTAL_LOOP_DURATION_MS;
      startTimeRef.current = null;
      setActiveStation(stationIdx);
      if (isSoundEnabled) {
        lastStationSoundRef.current = stationIdx;
        coasterAudio.playStationArrival(stationIdx);
      }
    }
  };

  const currentStep = PIPELINE_STEPS[activeStation];

  return (
    <div className="relative mt-8">
      {/* ── ROLLERCOASTER HUD & FLUID SVG CIRCUIT ──────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl border border-brand-500/30 bg-gradient-to-b from-[#130328] via-[#090117] to-[#060010] p-4 shadow-2xl shadow-brand-950/70 sm:p-6">
        {/* Background ambient stars and aurora rays */}
        <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
          <div className="aurora-blob -left-20 top-0 h-64 w-64 bg-brand-500/20 blur-3xl" />
          <div className="aurora-blob -right-20 bottom-0 h-64 w-64 bg-[#e879f9]/15 blur-3xl" />
          {/* Subtle grid mesh */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#5b21b615_1px,transparent_1px),linear-gradient(to_bottom,#5b21b615_1px,transparent_1px)] bg-[size:32px_32px]" />
        </div>

        {/* Rollercoaster Header Strip */}
        <div className="relative z-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3.5 w-3.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-[#e879f9] opacity-75 animate-ping" />
              <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-brand-400 shadow-glow" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold tracking-wider uppercase text-white">
                  Leadloop Rollercoaster Circuit
                </span>
                <span className="rounded-full border border-brand-400/40 bg-brand-950/80 px-2 py-0.5 text-[10px] font-semibold text-[#e879f9] shadow-glow">
                  Auto-Playing Loop
                </span>
              </div>
              <p className="text-xs text-ink-500">
                Current Feature: <span className="font-semibold text-brand-300">{currentStep.coasterFeature}</span>
                {' • '}
                Lead in transit: <span className="font-medium text-white">Rahul Sharma (#LD-9042)</span>
              </p>
            </div>
          </div>

          {/* Interactive loop controls */}
          <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto">
            {/* Sound Toggle Button */}
            <button
              type="button"
              onClick={handleToggleSound}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all shadow-glow ${
                isSoundEnabled
                  ? 'border-[#e879f9]/70 bg-brand-950/90 text-[#e879f9] shadow-brand-500/30'
                  : 'border-ink-200/80 bg-ink-100/90 text-ink-500 hover:text-white hover:border-brand-500/50'
              }`}
              title={isSoundEnabled ? 'Mute coaster audio' : 'Enable live rollercoaster audio'}
            >
              {isSoundEnabled ? (
                <>
                  <Volume2 className="h-3.5 w-3.5 text-[#e879f9] animate-pulse" />
                  <span>Sound ON</span>
                  <span className="flex items-end gap-0.5 h-3 ml-0.5">
                    <span className="w-0.5 bg-[#e879f9] rounded-full animate-bounce h-2" />
                    <span className="w-0.5 bg-brand-400 rounded-full animate-bounce h-3 delay-75" />
                    <span className="w-0.5 bg-[#e879f9] rounded-full animate-bounce h-1.5 delay-150" />
                  </span>
                </>
              ) : (
                <>
                  <VolumeX className="h-3.5 w-3.5 text-ink-500" />
                  <span>Turn ON Sound</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleJumpToStation(0)}
              className="flex items-center gap-1 rounded-lg border border-ink-200/80 bg-ink-100/90 px-2.5 py-1.5 text-xs text-ink-600 transition-colors hover:border-brand-500/50 hover:bg-brand-950/60 hover:text-white"
            >
              <RotateCcw className="h-3 w-3" />
              <span className="hidden sm:inline">Reset</span>
            </button>
            <button
              type="button"
              onClick={() => setIsPlaying((p) => !p)}
              className="flex items-center gap-1.5 rounded-lg border border-brand-500/40 bg-brand-950/90 px-3 py-1.5 text-xs font-semibold text-brand-200 transition-all hover:border-brand-400 hover:bg-brand-900/80 hover:text-white shadow-glow"
            >
              {isPlaying ? (
                <>
                  <Pause className="h-3.5 w-3.5 text-[#e879f9]" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5 fill-current text-brand-400" />
                  <span>Resume Ride</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* ── THE ROLLERCOASTER SVG CANVAS ──────────────────────────────── */}
        <div className="relative z-10 mt-4 h-64 w-full sm:h-80 md:h-96">
          <svg
            viewBox="0 0 1000 360"
            className="h-full w-full overflow-visible select-none"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              {/* Neon Glow Filters */}
              <filter id="coasterGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              <filter id="ballSuperGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="8" result="blur1" />
                <feGaussianBlur stdDeviation="16" result="blur2" />
                <feMerge>
                  <feMergeNode in="blur2" />
                  <feMergeNode in="blur1" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              {/* Rollercoaster track tie pattern */}
              <linearGradient id="railGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#5B21B6" />
                <stop offset="30%" stopColor="#A855F7" />
                <stop offset="70%" stopColor="#E879F9" />
                <stop offset="100%" stopColor="#5B21B6" />
              </linearGradient>

              {/* Station Active Glow Gradient */}
              <radialGradient id="stationFlare" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#e879f9" stopOpacity="0.8" />
                <stop offset="60%" stopColor="#a855f7" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#5b21b6" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* 1. GROUND FOUNDATION & GRID HORIZON */}
            <line x1="50" y1="340" x2="950" y2="340" stroke="#5B21B6" strokeWidth="2" strokeOpacity="0.4" strokeDasharray="6 6" />

            {/* 2. ROLLERCOASTER STEEL TRUSS SUPPORT STRUTS */}
            {SUPPORT_STRUTS.map((strut, i) => (
              <g key={i} opacity="0.35">
                {/* Main vertical pylon */}
                <line x1={strut.x} y1={strut.topY} x2={strut.x} y2="340" stroke="#7C3AED" strokeWidth="2.5" />
                {/* Diagonal lattice truss cross-braces */}
                <line x1={strut.x - 12} y1={strut.topY + 30} x2={strut.x + 12} y2={strut.topY + 60} stroke="#5B21B6" strokeWidth="1" />
                <line x1={strut.x + 12} y1={strut.topY + 30} x2={strut.x - 12} y2={strut.topY + 60} stroke="#5B21B6" strokeWidth="1" />
                <line x1={strut.x - 12} y1={strut.topY + 90} x2={strut.x + 12} y2={strut.topY + 130} stroke="#5B21B6" strokeWidth="1" />
                <line x1={strut.x + 12} y1={strut.topY + 90} x2={strut.x - 12} y2={strut.topY + 130} stroke="#5B21B6" strokeWidth="1" />
                {/* Concrete footing anchor */}
                <rect x={strut.x - 8} y="335" width="16" height="6" rx="2" fill="#3B0764" stroke="#7C3AED" strokeWidth="1" />
              </g>
            ))}

            {/* 3. ROLLERCOASTER TRACK LAYER 1: Deep ambient purple backlight */}
            <path
              d={trackPathD}
              fill="none"
              stroke="#5B21B6"
              strokeWidth="24"
              strokeOpacity="0.25"
              filter="url(#coasterGlow)"
            />

            {/* 4. ROLLERCOASTER TRACK LAYER 2: Ladder Sleepers / Ties (Crossbars) */}
            <path
              d={trackPathD}
              fill="none"
              stroke="#4C1D95"
              strokeWidth="14"
              strokeDasharray="3 14"
              strokeLinecap="round"
              strokeOpacity="0.85"
            />

            {/* 5. ROLLERCOASTER TRACK LAYER 3: Dual Tubular Steel Steel Rails */}
            {/* Top/Outer rail */}
            <path
              d={trackPathD}
              fill="none"
              stroke="#2E1065"
              strokeWidth="8"
            />
            {/* 6. ROLLERCOASTER TRACK LAYER 4: Glowing Electric Guide Rail */}
            <path
              ref={pathRef}
              d={trackPathD}
              fill="none"
              stroke="url(#railGrad)"
              strokeWidth="3"
              strokeLinecap="round"
              filter="url(#coasterGlow)"
            />

            {/* 7. THE 6 ROLLERCOASTER STATIONS (GANTRY TOWERS & GATES) */}
            {[
              { x: 90,  y: 120, num: 1, name: 'Capture' },
              { x: 260, y: 240, num: 2, name: 'Respond' },
              { x: 440, y: 90,  num: 3, name: 'Qualify' },
              { x: 640, y: 250, num: 4, name: 'Score & Route' },
              { x: 840, y: 80,  num: 5, name: 'Follow up' },
              { x: 670, y: 320, num: 6, name: 'Recover' },
            ].map((st, idx) => {
              const isStationActive = idx === activeStation;

              return (
                <g
                  key={st.num}
                  className="cursor-pointer transition-transform duration-200"
                  onClick={() => handleJumpToStation(idx)}
                >
                  {/* Station active radiating flare */}
                  {isStationActive && (
                    <circle
                      cx={st.x}
                      cy={st.y}
                      r="40"
                      fill="url(#stationFlare)"
                      className="animate-pulse"
                    />
                  )}

                  {/* Station base platform ring */}
                  <circle
                    cx={st.x}
                    cy={st.y}
                    r={isStationActive ? 22 : 16}
                    fill={isStationActive ? '#1e053a' : '#0c0218'}
                    stroke={isStationActive ? '#E879F9' : '#5B21B6'}
                    strokeWidth={isStationActive ? 2.5 : 1.5}
                    className="transition-all duration-300"
                    filter={isStationActive ? 'url(#coasterGlow)' : undefined}
                  />

                  {/* Station Number Badge */}
                  <circle
                    cx={st.x}
                    cy={st.y}
                    r={isStationActive ? 14 : 11}
                    fill={isStationActive ? 'url(#railGrad)' : '#1e0b38'}
                  />
                  <text
                    x={st.x}
                    y={st.y + 4}
                    textAnchor="middle"
                    fontSize={isStationActive ? '11' : '9'}
                    fontWeight="bold"
                    fill="#FFFFFF"
                    className="select-none pointer-events-none"
                  >
                    {st.num}
                  </text>

                  {/* Station Name Label Pill */}
                  <rect
                    x={st.x - 38}
                    y={st.y > 220 ? st.y - 36 : st.y + 24}
                    width="76"
                    height="18"
                    rx="9"
                    fill={isStationActive ? '#2c0b52' : '#0c0218'}
                    stroke={isStationActive ? '#E879F9' : '#4C1D95'}
                    strokeWidth="1"
                    className="transition-all"
                  />
                  <text
                    x={st.x}
                    y={st.y > 220 ? st.y - 24 : st.y + 36}
                    textAnchor="middle"
                    fontSize="9"
                    fontWeight={isStationActive ? 'bold' : 'normal'}
                    fill={isStationActive ? '#E879F9' : '#C4B5FD'}
                    className="select-none pointer-events-none"
                  >
                    {st.name}
                  </text>
                </g>
              );
            })}

            {/* 8. THE ROLLERCOASTER TRAVELING BALL (ORB VEHICLE) */}
            <g
              transform={`translate(${ballPos.x}, ${ballPos.y}) rotate(${ballPos.angle})`}
              className="pointer-events-none"
            >
              {/* Forward coaster headlight beam */}
              <polygon
                points="10,0 60,-18 60,18"
                fill="url(#stationFlare)"
                opacity="0.5"
              />

              {/* Trailing coaster sparks / speed particles */}
              <circle cx="-16" cy="0" r="4" fill="#A855F7" opacity="0.6" />
              <circle cx="-26" cy="-2" r="2.5" fill="#E879F9" opacity="0.4" />
              <circle cx="-34" cy="2" r="1.5" fill="#C084FC" opacity="0.2" />

              {/* Outer Energy Aura */}
              <circle
                cx="0"
                cy="0"
                r="18"
                fill="#E879F9"
                opacity="0.35"
                filter="url(#ballSuperGlow)"
              />

              {/* Pulsing Core Ring */}
              <circle
                cx="0"
                cy="0"
                r="12"
                fill="none"
                stroke="#E879F9"
                strokeWidth="2"
                strokeDasharray="4 2"
              />

              {/* Rollercoaster Orb Shell */}
              <circle
                cx="0"
                cy="0"
                r="9"
                fill="url(#railGrad)"
                stroke="#FFFFFF"
                strokeWidth="2"
                filter="url(#ballSuperGlow)"
              />

              {/* Bright Visor Center */}
              <circle cx="2" cy="0" r="3.5" fill="#FFFFFF" />
            </g>

            {/* 9. WOHOOO! CELEBRATION BURST OVER RECOVERED LEAD */}
            {activeStation === 5 && (
              <g
                transform={`translate(${ballPos.x}, ${ballPos.y - 42})`}
                className="pointer-events-none select-none transition-all duration-300"
              >
                {/* Glowing drop shadow backdrop */}
                <rect
                  x="-75"
                  y="-16"
                  width="150"
                  height="30"
                  rx="15"
                  fill="#2c054e"
                  stroke="#E879F9"
                  strokeWidth="2.5"
                  filter="url(#ballSuperGlow)"
                  className="animate-pulse"
                />
                {/* Downward triangle pointer to orb */}
                <polygon
                  points="-6,14 6,14 0,22"
                  fill="#2c054e"
                  stroke="#E879F9"
                  strokeWidth="1.5"
                />
                <text
                  x="0"
                  y="4"
                  textAnchor="middle"
                  fontSize="12"
                  fontWeight="900"
                  letterSpacing="1"
                  fill="#FFFFFF"
                >
                  🎉 WOHOOO! 🚀
                </text>
              </g>
            )}
          </svg>
        </div>

        {/* Rollercoaster Circuit Live Status Ticker */}
        <div className="relative z-10 mt-3 flex items-center justify-between rounded-2xl border border-brand-500/20 bg-[#080014]/90 px-4 py-2.5 text-xs backdrop-blur-md">
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="flex h-2.5 w-2.5 shrink-0 rounded-full bg-[#e879f9] shadow-glow animate-ping" />
            <span className="font-semibold text-white">
              Station {currentStep.step}: {currentStep.title} ({currentStep.coasterFeature})
            </span>
            <span className="hidden text-ink-600 md:inline">—</span>
            <span className="hidden truncate text-ink-400 md:inline">
              {currentStep.simulatedEvent.detail}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="rounded-md border border-brand-500/30 bg-brand-950/80 px-2 py-0.5 text-[11px] font-mono text-brand-300">
              {currentStep.metrics.value}
            </span>
            <span className="hidden font-mono text-[10px] text-brand-400 sm:inline">
              Lap: {progressPercent.toFixed(0)}%
            </span>
          </div>
        </div>
      </div>

      {/* ── THE 6 STEP CARDS SYNCHRONIZED WITH THE ROLLERCOASTER ─────────── */}
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {PIPELINE_STEPS.map((step, index) => {
          const isActive = index === activeStation;
          const Icon = step.icon;

          return (
            <div
              key={step.id}
              onClick={() => handleJumpToStation(index)}
              className={`lift group relative flex flex-col justify-between overflow-hidden rounded-2xl border p-5 transition-all duration-300 cursor-pointer ${
                isActive
                  ? 'border-brand-400 bg-gradient-to-br from-[#1d063d] via-[#100324] to-[#0a0118] shadow-[0_0_40px_rgba(168,85,247,0.4)] ring-1 ring-brand-400/60 scale-[1.02]'
                  : 'border-ink-200 bg-ink-100 hover:border-brand-500/40 hover:bg-[#0f0322]'
              }`}
            >
              {/* Coaster station illuminated header line */}
              {isActive && (
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-[#e879f9] to-brand-500 animate-pulse" />
              )}

              <div>
                {/* Header: Station number, feature & live badge */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="relative">
                      {isActive && (
                        <span className="absolute -inset-1 rounded-xl bg-[#e879f9]/40 animate-ping" />
                      )}
                      <span
                        className={`relative flex h-8 w-8 items-center justify-center rounded-xl text-xs font-bold transition-all ${
                          isActive
                            ? 'bg-gradient-to-br from-[#e879f9] via-brand-500 to-brand-700 text-white shadow-glow shadow-brand-500/60 ring-2 ring-white/60'
                            : 'bg-ink-200/70 text-ink-500'
                        }`}
                      >
                        {step.step}
                      </span>
                    </div>

                    <div>
                      <span
                        className={`block text-xs font-semibold tracking-wider uppercase transition-colors ${
                          isActive ? 'text-[#e879f9]' : 'text-ink-500'
                        }`}
                      >
                        {step.coasterFeature}
                      </span>
                      <span className="text-[10px] text-ink-600">
                        {step.tagline}
                      </span>
                    </div>
                  </div>

                  {isActive ? (
                    step.step === 6 ? (
                      <span className="flex items-center gap-1.5 rounded-full border border-[#e879f9] bg-gradient-to-r from-brand-900 to-[#2e0854] px-2.5 py-1 text-[11px] font-bold text-white shadow-glow animate-bounce">
                        🎉 WOHOOO! Recovered
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 rounded-full border border-brand-400/50 bg-brand-950/90 px-2.5 py-1 text-[11px] font-semibold text-[#e879f9] shadow-glow">
                        <Zap className="h-3 w-3 fill-current text-[#e879f9]" />
                        At Station
                      </span>
                    )
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

                {/* Key capability checklist */}
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
                      ? 'border border-brand-500/40 bg-[#0c021a] text-brand-200 shadow-inner'
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
                  className="pointer-events-none absolute -bottom-10 -right-10 h-32 w-32 rounded-full bg-brand-500/25 blur-2xl"
                />
              )}
            </div>
          );
        })}
      </div>

      {/* ── LOOP RETURN FOOTER BANNER ───────────────────────────────────── */}
      <div className="mt-6 flex flex-col items-center justify-between gap-3 rounded-2xl border border-brand-500/20 bg-gradient-to-r from-brand-950/40 via-ink-100 to-brand-950/40 px-5 py-3 text-xs sm:flex-row">
        <div className="flex items-center gap-2.5 text-ink-400">
          <RotateCcw className="h-4 w-4 text-[#e879f9] animate-spin-slow" />
          <span>
            <strong className="text-white font-semibold">Continuous Rollercoaster Circuit:</strong> When a lead finishes Station 6 (Recovery), the loop swoops back to Station 1 (Capture) — an infinite, closed recovery pipeline.
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-brand-300 font-medium">
          <span>Perpetual Motion • Zero Dropped Leads</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </div>
      </div>
    </div>
  );
}
