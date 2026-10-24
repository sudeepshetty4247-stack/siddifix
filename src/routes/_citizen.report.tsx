import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Camera, ImagePlus, Mic, MicOff, LocateFixed, ArrowLeft, ArrowRight, Sparkles, Loader2, AlertTriangle, CheckCircle2, Copy, MapPin, RefreshCw, Link2,
} from "lucide-react";
import { analyzeIssue, submitIssue } from "@/lib/issues.functions";
import { CATEGORIES, SEVERITIES, SEVERITY_META, BENGALURU, isInBengaluru, isInIndia, categoryById, STATUS_META, type IssueStatus } from "@/lib/civic";
import { LazyMap } from "@/components/civic/LazyMap";
import { saveTracked } from "@/lib/tracking";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useLocation } from "@/lib/location";
import { CivicInfo } from "@/components/civic/CivicInfo";

export const Route = createFileRoute("/_citizen/report")({
  head: () => ({
    meta: [
      { title: "Report a civic issue — CivicFix" },
      { name: "description", content: "Report a pothole, streetlight, drainage or waste problem in under a minute. No sign-up needed." },
      { property: "og:title", content: "Report a civic issue — CivicFix" },
      { property: "og:description", content: "Snap a photo, pin the location, and CivicFix handles the rest." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReportPage,
});

type Analysis = {
  category: string; subcategory: string; title: string; summary: string; severity: (typeof SEVERITIES)[number];
  urgency: string; confidence: number; missing_info: string | null; safety_warning: string | null; clarification_question: string | null; is_civic_issue: boolean;
};
type Nearby = { id: string; ref_code: string; title: string; status: string; category: string; distance_m: number };

const STEPS = ["Photo", "Location", "Details", "Review"];

async function compressImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const max = 1600;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image processing unavailable");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.82); // re-encoding strips EXIF/GPS metadata
}

function ReportPage() {
  const { location } = useLocation();
  const [step, setStep] = useState(0);
  const [image, setImage] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [loc, setLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [recenter, setRecenter] = useState<{ lat: number; lng: number; zoom?: number } | null>(null);
  const [landmark, setLandmark] = useState("");
  const [locating, setLocating] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [aiState, setAiState] = useState<"idle" | "running" | "done" | "fallback">("idle");
  const [aiNotice, setAiNotice] = useState<string | null>(null);
  const [needsClass, setNeedsClass] = useState(false);
  const [nearby, setNearby] = useState<Nearby[]>([]);
  const [linkTo, setLinkTo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ ref: string; token: string | null } | null>(null);
  const idemKey = useMemo(() => crypto.randomUUID(), []);
  const analyze = useServerFn(analyzeIssue);
  const submit = useServerFn(submitIssue);
  const analysisRun = useRef(0);
  useEffect(() => { if (location && !loc) { setLoc({ lat: location.lat, lng: location.lng }); setLandmark(location.label === 'Current location' ? '' : location.label); } }, [location, loc]);

  async function runAnalysis(img: string | null, desc: string) {
    const run = ++analysisRun.current;
    setAiState("running");
    setAiNotice(null);
    try {
      const res = await analyze({ data: { imageDataUrl: img, description: desc || null } });
      if (run !== analysisRun.current) return;
      setAnalysis(res.analysis as Analysis);
      setAiState(res.ok ? "done" : "fallback");
      if (!res.ok) setAiNotice(res.notice);
      setNeedsClass(res.analysis.confidence < 0.4);
    } catch {
      if (run !== analysisRun.current) return;
      setAiState("fallback");
      setAiNotice("AI is unavailable. Please choose the category yourself.");
      setAnalysis({ category: "other", subcategory: "Other", title: "", summary: desc, severity: "medium", urgency: "Standard", confidence: 0, missing_info: null, safety_warning: null, clarification_question: null, is_civic_issue: true });
      setNeedsClass(true);
    }
  }

  async function onFile(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please choose an image file."); return; }
    if (file.size > 25 * 1024 * 1024) { toast.error("That image is too large (max 25 MB)."); return; }
    try {
      const url = await compressImage(file);
      setImage(url);
      runAnalysis(url, description);
    } catch {
      toast.error("We couldn't read that image. Try another photo.");
    }
  }

  function locate() {
    if (!("geolocation" in navigator)) { toast.error("Location isn't available on this device. Tap the map to place a pin."); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const next = { lat: p.coords.latitude, lng: p.coords.longitude };
        setLoc(next);
        setRecenter({ ...next, zoom: 17 });
        setLocating(false);
      },
      () => {
        setLocating(false);
        toast.error("We couldn't get your location. Tap the map to place a pin instead.");
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }

  // Duplicate check when entering review
  useEffect(() => {
    if (step !== 3 || !loc || !analysis) return;
    supabase
      .rpc("nearby_issues", { _lat: loc.lat, _lng: loc.lng, _radius_m: 120, _category: analysis.category })
      .then(({ data }) => setNearby((data as Nearby[]) ?? []));
  }, [step, loc, analysis]);

  const locValid = !!loc && isInIndia(loc.lat, loc.lng);
  const canNext = [!!image, locValid, !!analysis && (analysis.title?.trim().length ?? 0) >= 3, true][step];

  async function onSubmit() {
    if (submitting || !image || !loc || !analysis) return;
    setSubmitting(true);
    try {
      const res = await submit({
        data: {
          idempotencyKey: idemKey,
          imageDataUrl: image,
          description: description || null,
          title: analysis.title.trim(),
          summary: analysis.summary || null,
          category: analysis.category,
          subcategory: analysis.subcategory || null,
          severity: analysis.severity,
          aiConfidence: aiState === "done" ? analysis.confidence : null,
          safetyWarning: analysis.safety_warning,
          needsClassification: needsClass,
          lat: loc.lat,
          lng: loc.lng,
          landmark: landmark || null,
          duplicateOf: linkTo,
        },
      });
      saveTracked({ ref: res.ref, token: res.token ?? undefined, title: analysis.title, savedAt: new Date().toISOString() });
      setDone({ ref: res.ref, token: res.token });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      toast.error((e as Error).message || "Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done && loc) return <Confirmation done={done} title={analysis?.title ?? ""} loc={loc} needsClass={needsClass} />;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold sm:text-4xl">Report a problem</h1>
        <p className="mt-1 text-muted-foreground">Takes under a minute. No sign-up, no personal details.</p>
      </div>

      {/* Stepper */}
      <ol className="mb-8 grid grid-cols-4 gap-2">
        {STEPS.map((s, i) => (
          <li key={s} className="space-y-2">
            <div className={cn("h-1.5 rounded-full transition-colors", i <= step ? "bg-primary" : "bg-border")} />
            <p className={cn("text-xs font-medium sm:text-sm", i === step ? "text-foreground" : "text-muted-foreground")}>
              <span className="font-mono">{i + 1}.</span> {s}
            </p>
          </li>
        ))}
      </ol>

      <div className="rounded-3xl border bg-card p-5 shadow-soft sm:p-8">
        {step === 0 && (
          <div className="space-y-6">
            {image ? (
              <div className="relative overflow-hidden rounded-2xl">
                <img src={image} alt="Selected issue" className="max-h-[420px] w-full object-cover" />
                <label className="absolute bottom-3 right-3 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-card/95 px-3 py-2 text-sm font-medium shadow-soft backdrop-blur">
                  <RefreshCw className="h-4 w-4" /> Change photo
                  <input type="file" accept="image/*" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
                </label>
                {aiState === "running" && (
                  <span className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-full bg-ink/90 px-3 py-1 text-xs font-medium text-ink-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> AI is reading your photo…
                  </span>
                )}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="group flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-primary/40 bg-primary-soft px-6 py-12 text-center transition hover:border-primary">
                  <span className="rounded-2xl bg-primary p-4 text-primary-foreground shadow-lift transition group-hover:scale-105"><Camera className="h-7 w-7" /></span>
                  <span className="font-semibold">Take a photo</span>
                  <span className="text-xs text-muted-foreground">Opens your camera on mobile</span>
                  <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
                </label>
                <label className="group flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition hover:border-primary/50 hover:bg-secondary">
                  <span className="rounded-2xl bg-secondary p-4 text-foreground transition group-hover:scale-105"><ImagePlus className="h-7 w-7" /></span>
                  <span className="font-semibold">Upload from gallery</span>
                  <span className="text-xs text-muted-foreground">JPG, PNG or WebP</span>
                  <input type="file" accept="image/*" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
                </label>
              </div>
            )}
            <DescriptionInput value={description} onChange={setDescription} />
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold">Where is it?</h2>
                <p className="text-sm text-muted-foreground">We use the location only to place the report on the map. Tap the map or drag the pin to adjust.</p>
              </div>
              <button onClick={locate} disabled={locating} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-ink px-4 text-sm font-semibold text-ink-foreground disabled:opacity-60">
                {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />} Use my location
              </button>
            </div>
            <div className="h-[360px] overflow-hidden rounded-2xl border">
              <LazyMap center={loc ?? BENGALURU} zoom={loc ? 17 : 12} picked={loc} onPick={(lat, lng) => setLoc({ lat, lng })} recenter={recenter} />
            </div>
            {loc && (
              <p className={cn("flex items-center gap-2 text-sm", isInBengaluru(loc.lat, loc.lng) ? "text-success" : isInIndia(loc.lat, loc.lng) ? "text-warning-foreground" : "text-destructive")}>
                <MapPin className="h-4 w-4" />
                {isInBengaluru(loc.lat, loc.lng)
                  ? `Inside Bengaluru · ${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}`
                  : isInIndia(loc.lat, loc.lng)
                    ? "Outside Bengaluru — we'll accept it, but authority routing isn't configured for this area yet."
                    : "This location is outside India. Please place the pin where the problem is."}
              </p>
            )}
            <div>
              <label className="text-sm font-medium" htmlFor="landmark">Landmark (optional)</label>
              <input id="landmark" value={landmark} maxLength={200} onChange={(e) => setLandmark(e.target.value)} placeholder="e.g. Opposite Indiranagar Metro, near bus stop" className="mt-1.5 h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">Check the details</h2>
              {aiState === "done" && analysis && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
                  <Sparkles className="h-3.5 w-3.5" /> AI · {Math.round(analysis.confidence * 100)}% confident
                </span>
              )}
            </div>
            {aiState === "running" && (
              <div className="flex items-center gap-3 rounded-xl bg-secondary p-4 text-sm"><Loader2 className="h-4 w-4 animate-spin text-primary" /> AI is analysing your photo. This usually takes a few seconds…</div>
            )}
            {aiNotice && <div className="flex items-start gap-2 rounded-xl bg-warning-soft p-4 text-sm text-warning-foreground"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{aiNotice}</div>}
            {analysis?.safety_warning && <div className="flex items-start gap-2 rounded-xl bg-destructive-soft p-4 text-sm text-destructive"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span><strong>Safety:</strong> {analysis.safety_warning}</span></div>}
            {analysis?.clarification_question && (
              <div className="rounded-xl border border-primary/30 bg-primary-soft p-4 text-sm">
                <p className="font-medium">{analysis.clarification_question}</p>
                <p className="mt-1 text-muted-foreground">Add a short description below, or submit as "Needs classification" and staff will review it.</p>
                <button onClick={() => runAnalysis(image, description)} className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary"><RefreshCw className="h-3.5 w-3.5" /> Re-analyse with my description</button>
              </div>
            )}
            {analysis && (
              <>
                <Field label="Title">
                  <input value={analysis.title} maxLength={120} onChange={(e) => setAnalysis({ ...analysis, title: e.target.value })} placeholder="Short description of the problem" className="h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
                </Field>
                <Field label="Category">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {CATEGORIES.map((c) => (
                      <button key={c.id} type="button" onClick={() => setAnalysis({ ...analysis, category: c.id, subcategory: c.subs[0] })} className={cn("flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition", analysis.category === c.id ? "border-primary bg-primary-soft font-semibold text-primary" : "hover:bg-secondary")}>
                        <span>{c.emoji}</span><span className="truncate">{c.label}</span>
                      </button>
                    ))}
                  </div>
                </Field>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Type">
                    <select value={analysis.subcategory} onChange={(e) => setAnalysis({ ...analysis, subcategory: e.target.value })} className="h-11 w-full rounded-xl border bg-background px-3 text-sm">
                      {[...new Set([analysis.subcategory, ...categoryById(analysis.category).subs])].filter(Boolean).map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </Field>
                  <Field label="How serious is it?">
                    <div className="grid grid-cols-4 gap-1 rounded-xl bg-secondary p-1">
                      {SEVERITIES.map((s) => (
                        <button key={s} type="button" onClick={() => setAnalysis({ ...analysis, severity: s })} className={cn("rounded-lg py-2 text-xs font-semibold transition", analysis.severity === s ? (s === "critical" ? "bg-destructive text-destructive-foreground" : "bg-card shadow-soft") : "text-muted-foreground")}>
                          {SEVERITY_META[s].label}
                        </button>
                      ))}
                    </div>
                  </Field>
                </div>
                <Field label="Summary">
                  <textarea value={analysis.summary} maxLength={600} rows={3} onChange={(e) => setAnalysis({ ...analysis, summary: e.target.value })} className="w-full rounded-xl border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
                </Field>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={needsClass} onChange={(e) => setNeedsClass(e.target.checked)} className="h-4 w-4 accent-primary" />
                  I'm not sure about the category — ask staff to classify it
                </label>
              </>
            )}
          </div>
        )}

        {step === 3 && analysis && loc && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">Review and submit</h2>
            <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
              {image && <img src={image} alt="" className="aspect-square w-full rounded-2xl object-cover" />}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">{categoryById(analysis.category).emoji} {categoryById(analysis.category).label} · {analysis.subcategory}</p>
                <p className="text-lg font-semibold">{analysis.title}</p>
                <p className="text-sm text-muted-foreground">{analysis.summary}</p>
                <p className="text-sm"><span className="text-muted-foreground">Severity:</span> <strong>{SEVERITY_META[analysis.severity].label}</strong></p>
                <p className="text-sm"><span className="text-muted-foreground">Confirmed report location:</span> {loc.lat.toFixed(5)}, {loc.lng.toFixed(5)}</p>
                <p className="text-xs text-muted-foreground">Location attached during reporting; photo capture location and time are not verified.</p>
                {landmark && <p className="text-sm"><span className="text-muted-foreground">Landmark:</span> {landmark}</p>}
              </div>
            </div>
            <CivicInfo lat={loc.lat} lng={loc.lng} category={analysis.category} subcategory={analysis.subcategory} />
            {nearby.length > 0 && (
              <div className="rounded-2xl border border-warning/40 bg-warning-soft p-4">
                <p className="flex items-center gap-2 font-semibold text-warning-foreground"><Link2 className="h-4 w-4" /> This might already be reported</p>
                <p className="mt-1 text-sm text-warning-foreground/80">Linking adds your voice to the existing report. Your report is still saved separately.</p>
                <div className="mt-3 space-y-2">
                  {nearby.map((n) => (
                    <label key={n.id} className={cn("flex cursor-pointer items-center gap-3 rounded-xl border bg-card p-3 text-sm", linkTo === n.id && "border-primary ring-2 ring-primary/20")}>
                      <input type="radio" name="dup" checked={linkTo === n.id} onChange={() => setLinkTo(n.id)} className="accent-primary" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{n.title}</span>
                        <span className="text-xs text-muted-foreground">{n.ref_code} · {Math.round(n.distance_m)} m away · {STATUS_META[n.status as IssueStatus]?.label}</span>
                      </span>
                    </label>
                  ))}
                  <label className={cn("flex cursor-pointer items-center gap-3 rounded-xl border bg-card p-3 text-sm", linkTo === null && "border-primary ring-2 ring-primary/20")}>
                    <input type="radio" name="dup" checked={linkTo === null} onChange={() => setLinkTo(null)} className="accent-primary" />
                    It's a different problem
                  </label>
                </div>
              </div>
            )}
            <p className="text-xs text-muted-foreground">By submitting, your photo, location and description become publicly visible. Avoid including faces or personal information.</p>
          </div>
        )}

        <div className="mt-8 flex items-center justify-between border-t pt-6">
          <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} className="inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-muted-foreground transition hover:bg-secondary disabled:invisible">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          {step < 3 ? (
            <button
              onClick={() => {
                if (step === 0 && aiState === "idle") runAnalysis(image, description);
                setStep((s) => s + 1);
              }}
              disabled={!canNext}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-soft transition hover:bg-primary/90 disabled:opacity-40"
            >
              Continue <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button onClick={onSubmit} disabled={submitting} className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-lift transition hover:bg-primary/90 disabled:opacity-60">
              {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</> : <>Submit report <CheckCircle2 className="h-4 w-4" /></>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">{label}</p>
      {children}
    </div>
  );
}

type SpeechRec = { start: () => void; stop: () => void; lang: string; interimResults: boolean; onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void; onend: () => void };

function DescriptionInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recRef = useRef<SpeechRec | null>(null);
  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    setSupported(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);
  function toggle() {
    if (listening) { recRef.current?.stop(); return; }
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "en-IN";
    rec.interimResults = false;
    rec.onresult = (e) => onChange((value ? value + " " : "") + Array.from(e.results).map((r) => r[0]?.transcript ?? '').join(" "));
    rec.onend = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  }
  return (
    <div>
      <div className="flex items-center justify-between">
        <label htmlFor="desc" className="text-sm font-medium">Anything to add? <span className="font-normal text-muted-foreground">(optional)</span></label>
        {supported && (
          <button type="button" onClick={toggle} className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold", listening ? "bg-destructive text-destructive-foreground" : "bg-secondary")}>
            {listening ? <><MicOff className="h-3.5 w-3.5" /> Stop</> : <><Mic className="h-3.5 w-3.5" /> Speak</>}
          </button>
        )}
      </div>
      <textarea id="desc" value={value} onChange={(e) => onChange(e.target.value)} maxLength={1000} rows={3} placeholder="e.g. Pothole has been growing for 2 weeks, bikes are skidding at night" className="mt-1.5 w-full rounded-xl border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
    </div>
  );
}

function Confirmation({ done, title, loc, needsClass }: { done: { ref: string; token: string | null }; title: string; loc: { lat: number; lng: number }; needsClass: boolean }) {
  const privateLink = done.token ? `${typeof window !== "undefined" ? window.location.origin : ""}/issues/${done.ref}#t=${done.token}` : null;
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <div className="animate-rise rounded-3xl border bg-card p-6 text-center shadow-lift sm:p-10">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success-soft text-success"><CheckCircle2 className="h-9 w-9" /></span>
        <h1 className="mt-5 text-3xl font-bold">Report received</h1>
        <p className="mt-2 text-muted-foreground">Thank you for helping fix your city.</p>
        <div className="mt-6 inline-flex flex-col items-center rounded-2xl bg-secondary px-8 py-4">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Tracking reference</span>
          <span className="font-mono text-3xl font-semibold tracking-wider">{done.ref}</span>
        </div>
        <dl className="mt-6 grid grid-cols-2 gap-3 text-left text-sm">
          <div className="rounded-xl border p-3"><dt className="text-xs text-muted-foreground">Status</dt><dd className="font-semibold">{needsClass ? "Needs classification" : "Submitted"}</dd></div>
          <div className="rounded-xl border p-3"><dt className="text-xs text-muted-foreground">Submitted</dt><dd className="font-semibold">{new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</dd></div>
          <div className="col-span-2 rounded-xl border p-3"><dt className="text-xs text-muted-foreground">Issue</dt><dd className="font-semibold">{title}</dd><dd className="text-xs text-muted-foreground">{loc.lat.toFixed(5)}, {loc.lng.toFixed(5)}</dd></div>
        </dl>
        {privateLink && (
          <div className="mt-6 rounded-2xl border border-primary/30 bg-primary-soft p-4 text-left">
            <p className="text-sm font-semibold">Your private tracking link</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Keep this safe. It lets you confirm or dispute the fix later from any device. It's also saved on this device.</p>
            <div className="mt-3 flex gap-2">
              <input readOnly value={privateLink} className="h-10 min-w-0 flex-1 rounded-lg border bg-card px-3 font-mono text-xs" onFocus={(e) => e.target.select()} />
              <button onClick={() => { navigator.clipboard.writeText(privateLink); toast.success("Link copied"); }} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground"><Copy className="h-4 w-4" /> Copy</button>
            </div>
          </div>
        )}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link to="/issues/$ref" params={{ ref: done.ref }} {...(done.token ? { hash: `t=${done.token}` } : {})} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-ink px-5 text-sm font-semibold text-ink-foreground">View public issue <ArrowRight className="h-4 w-4" /></Link>
          <a href="/report" className="inline-flex h-11 items-center justify-center rounded-xl border px-5 text-sm font-semibold hover:bg-secondary">Report another</a>
        </div>
      </div>
    </div>
  );
}
