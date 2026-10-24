import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { feedbackState, submitFeedback } from '@/lib/issues.functions';

const RATINGS = [[5, 'Very satisfied'], [4, 'Satisfied'], [3, 'Neutral'], [2, 'Dissatisfied'], [1, 'Very dissatisfied']] as const;
const RESOLUTION = [['complete', 'Completely resolved'], ['partial', 'Partially resolved'], ['not_resolved', 'Not resolved']] as const;
const SPEED = [['excellent', 'Excellent'], ['good', 'Good'], ['average', 'Average'], ['poor', 'Poor']] as const;

function Choice<T extends string | number>({ legend, options, value, onChange }: { legend: string; options: readonly (readonly [T, string])[]; value: T | null; onChange: (v: T) => void }) {
  return <fieldset className="mt-4"><legend className="text-sm font-medium">{legend}</legend>
    <div className="mt-2 flex flex-wrap gap-2">{options.map(([v, l]) => <button type="button" key={String(v)} aria-pressed={value === v} onClick={() => onChange(v)} className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${value === v ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:border-primary'}`}>{l}</button>)}</div>
  </fieldset>;
}

export function FeedbackSurvey({ caseRef, token, onReopened }: { caseRef: string; token: string; onReopened: () => void }) {
  const getState = useServerFn(feedbackState); const send = useServerFn(submitFeedback); const qc = useQueryClient();
  const state = useQuery({ queryKey: ['feedback-state', caseRef], queryFn: () => getState({ data: { ref: caseRef, token } }) });
  const [rating, setRating] = useState<number | null>(null); const [resolution, setResolution] = useState<string | null>(null); const [speed, setSpeed] = useState<string | null>(null); const [comment, setComment] = useState(''); const [busy, setBusy] = useState(false);
  if (!state.data?.allowed) return null;
  if (state.data.submitted) return <div className="flex gap-3 rounded-2xl border bg-card p-5 text-sm"><CheckCircle2 className="h-5 w-5 shrink-0 text-success" /><div><p className="font-semibold">Thanks for your feedback</p><p className="text-muted-foreground">Your response was saved{state.data.submitted_at ? ` on ${new Date(state.data.submitted_at).toLocaleDateString('en-IN', { dateStyle: 'medium' })}` : ''}.</p></div></div>;
  async function submit() {
    if (!rating || !resolution || !speed) return;
    setBusy(true);
    try {
      const r = await send({ data: { ref: caseRef, token, rating, resolution, responseTime: speed, comment: comment || undefined } });
      toast.success(r.reopened ? 'Feedback saved. The case was reopened for staff review.' : 'Thank you — your feedback was saved.');
      await qc.invalidateQueries({ queryKey: ['feedback-state', caseRef] });
      if (r.reopened) onReopened();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Feedback could not be saved'); } finally { setBusy(false); }
  }
  return <section aria-labelledby="fb-title" className="rounded-2xl border bg-card p-5">
    <h2 id="fb-title" className="font-semibold">Rate how this was handled</h2>
    <p className="mt-1 text-xs text-muted-foreground">Takes 30 seconds. Only the original reporter can answer, once per case.</p>
    <Choice legend="How satisfied are you with the resolution?" options={RATINGS} value={rating} onChange={setRating} />
    <Choice legend="Was the issue resolved?" options={RESOLUTION} value={resolution} onChange={setResolution} />
    {resolution === 'not_resolved' && <p className="mt-2 rounded-lg bg-warning-soft p-2 text-xs text-warning-foreground">If the case is marked resolved, submitting this will reopen it for staff review.</p>}
    <Choice legend="How would you rate the response time?" options={SPEED} value={speed} onChange={setSpeed} />
    <label className="mt-4 block text-sm font-medium">What could we improve? <span className="font-normal text-muted-foreground">(optional)</span>
      <textarea value={comment} maxLength={1000} onChange={e => setComment(e.target.value)} className="mt-1 w-full rounded-lg border bg-background p-2 text-sm" rows={3} /></label>
    <Button className="mt-4 w-full" disabled={busy || !rating || !resolution || !speed} onClick={submit}>{busy ? 'Saving…' : 'Submit feedback'}</Button>
  </section>;
}
