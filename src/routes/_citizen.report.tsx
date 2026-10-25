import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useQuery } from '@tanstack/react-query';
import { Camera, ImagePlus, MapPin, Loader2, CheckCircle2, Copy, Pencil, Search, ArrowRight, LocateFixed } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { LazyMap } from '@/components/civic/LazyMap';
import { CivicInfo } from '@/components/civic/CivicInfo';
import { getDirectory } from '@/lib/directory.functions';
import { resolveCivicRouting } from '@/lib/directory';
import { analyzeIssue, submitIssue } from '@/lib/issues.functions';
import { prepareOriginalUpload, saveAnnotatedPhoto } from '@/lib/report-media.functions';
import { reverseGeocode, searchAddress } from '@/lib/geocoding.functions';
import { annotationLines, annotatedPhoto, embeddedPhotoMetadata, processedPhoto, type PhotoMetadata } from '@/lib/report-photo';
import { coverageScaleM, evaluateLocationConsistency } from '@/lib/location-consistency';
import { BENGALURU, CATEGORIES, isInIndia, categoryById } from '@/lib/civic';
import { saveTracked } from '@/lib/tracking';
import { supabase } from '@/integrations/supabase/client';
import { useLiveGps } from '@/lib/live-gps';
import { AddressEntry, type IncidentSelection } from '@/components/civic/AddressEntry';
import { OutsideArea } from '@/components/civic/OutsideArea';
import { describeLiveFix, corporationShort } from '@/lib/map-location';
import { reportChallenge } from '@/lib/integrity.functions';
import {useLocation} from '@/lib/location';
import {areaCenter} from '@/lib/service-area';
import {useI18n} from '@/lib/i18n';
import { reportInputSchema } from '@/lib/report-input';

export const Route = createFileRoute('/_citizen/report')({
  head:()=>({meta:[{title:'Photo report — Siddhi'},{name:'description',content:'Take or upload a photo, confirm the problem location when needed and submit without a long form.'},{property:'og:title',content:'Photo report — Siddhi'},{property:'og:description',content:'Anonymous photo reporting with private originals, automatic suggestions and public case tracking.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),
  component:ReportPage,
});
const fallback = {category:'other',subcategory:'Other',title:'Civic issue reported',summary:'Photo awaiting staff review.',severity:'medium' as const,confidence:0,safety_warning:null as string|null};
type Suggestion = {category:string;subcategory:string;title:string;summary:string;severity:'low'|'medium'|'high'|'critical';confidence:number;safety_warning:string|null};
type Point = {lat:number;lng:number};

function ReportPage(){
  const {activeArea}=useLocation();const {tx}=useI18n();
  const camera=useRef<HTMLInputElement>(null);const gallery=useRef<HTMLInputElement>(null);
  const [key]=useState(()=>crypto.randomUUID());const [file,setFile]=useState<File|null>(null);const [image,setImage]=useState<string|null>(null);
  const [meta,setMeta]=useState<PhotoMetadata>({source:'gallery',capturedAt:null,captureTimeSource:'unknown',gps:null});
  const captureGps=useRef<PhotoMetadata['gps']>(null);const run=useRef(0);
  const [point,setPoint]=useState<Point|null>(null);const [confirmed,setConfirmed]=useState(false);const [editingLocation,setEditingLocation]=useState(false);
  const [description,setDescription]=useState('');const [analysis,setAnalysis]=useState<Suggestion>(fallback);const [aiState,setAiState]=useState('idle');
  const [notice,setNotice]=useState('');const [preparing,setPreparing]=useState(false);const [busy,setBusy]=useState(false);
  const [address,setAddress]=useState<string|null>(null);const [addressNotice,setAddressNotice]=useState('');
  const [search,setSearch]=useState('');const [results,setResults]=useState<{lat:number;lng:number;label:string}[]>([]);const [searching,setSearching]=useState(false);const [locating,setLocating]=useState(false);
  const [incident,setIncident]=useState<IncidentSelection|null>(null);
  const [matches,setMatches]=useState<{id:string;title:string;ref_code:string;distance_m:number}[]>([]);const [candidate,setCandidate]=useState<string|null>(null);
  const [originalPath,setOriginalPath]=useState<string|null>(null);const [done,setDone]=useState<{ref:string;token:string|null;annotated:boolean}|null>(null);
  const [textOnly,setTextOnly]=useState(false);const [reviewing,setReviewing]=useState(false);
  const [locationAcked,setLocationAcked]=useState(false);
  const [challenge,setChallenge]=useState<{question:string;token:string}|null>(null);const [answer,setAnswer]=useState('');
  const getChallenge=useServerFn(reportChallenge);
  const analyze=useServerFn(analyzeIssue);const submit=useServerFn(submitIssue);const prepare=useServerFn(prepareOriginalUpload);const annotate=useServerFn(saveAnnotatedPhoto);
  const geocode=useServerFn(reverseGeocode);const findAddress=useServerFn(searchAddress);
  const dirQ=useQuery({queryKey:['civic-directory'],queryFn:()=>getDirectory(),staleTime:300000});
  const currentRouting=point&&dirQ.data?resolveCivicRouting(dirQ.data,point.lat,point.lng):null;
  const supported=!!currentRouting?.ward&&!!currentRouting?.coverage;
  const consistency=point&&confirmed&&image?evaluateLocationConsistency({photoGps:meta.gps,reportLat:point.lat,reportLng:point.lng,supported,areaScaleM:coverageScaleM(currentRouting?.coverage?.bounds)}):null;
  const locationWarning=consistency&&(consistency.status==='mismatch'||consistency.status==='needs_review')&&!locationAcked;
  const ambiguous=currentRouting?.reviewReason?.startsWith('This pin touches');
  const lockWard=confirmed&&point&&dirQ.data?resolveCivicRouting(dirQ.data,point.lat,point.lng).ward:null;
  const live=useLiveGps(!done&&!image);const livePlace=describeLiveFix(dirQ.data,live.fix);

  async function freshGps():Promise<PhotoMetadata['gps']>{
    if(!navigator.geolocation)return null;
    return new Promise(resolve=>navigator.geolocation.getCurrentPosition(p=>resolve({lat:p.coords.latitude,lng:p.coords.longitude,accuracy:p.coords.accuracy,acquiredAt:new Date(p.timestamp).toISOString(),source:'device-session'}),()=>resolve(null),{enableHighAccuracy:true,maximumAge:0,timeout:10000}));
  }
  function liveGps():PhotoMetadata['gps']{const f=live.fix;return f&&Date.now()-f.at<60000?{lat:f.lat,lng:f.lng,accuracy:f.accuracy,acquiredAt:new Date(f.at).toISOString(),source:'device-session'}:null;}
  async function takePhoto(){const now=liveGps();if(now&&(now.accuracy??Infinity)<=100){captureGps.current=now;camera.current?.click();return;}setPreparing(true);captureGps.current=(await freshGps())??now;setPreparing(false);camera.current?.click();}
  async function chooseFile(next?:File,source:'camera'|'gallery'='gallery'){
    if(!next)return;
    if(!['image/jpeg','image/png','image/webp'].includes(next.type)||next.size>25*1024*1024){toast.error('Choose a JPG, PNG or WebP photo up to 25 MB.');return;}
    setPreparing(true);setOriginalPath(null);setConfirmed(false);setPoint(null);setAddress(null);setCandidate(null);setMatches([]);setAnalysis(fallback);setLocationAcked(false);
    const sequence=++run.current;
    try{
      const exifr=await import('exifr');let embedded:unknown=null;try{embedded=await exifr.parse(next);}catch{/* no metadata */}
      let metadata=embeddedPhotoMetadata(embedded);
      if(source==='camera')metadata={...metadata,source:'camera',capturedAt:metadata.capturedAt??new Date().toISOString(),captureTimeSource:metadata.capturedAt?'embedded':'camera-session',gps:captureGps.current??metadata.gps};
      const preview=await processedPhoto(next);if(sequence!==run.current)return;
      setFile(next);setImage(preview);setMeta(metadata);
      if(metadata.gps&&isInIndia(metadata.gps.lat,metadata.gps.lng)&&(metadata.gps.source==='embedded'||(metadata.gps.accuracy??Infinity)<=100)){
        setPoint({lat:metadata.gps.lat,lng:metadata.gps.lng});setConfirmed(source==='camera');setEditingLocation(source!=='camera');
        setNotice(source==='camera'?'Device GPS near capture is the suggested report location. Change it if the problem is elsewhere.':'Embedded photo GPS is a suggestion. Confirm where the problem is.');
      }else{setEditingLocation(true);setNotice('Where is the problem? This photo has no reliable location. Place a pin or search for an address.');}
      setAiState('running');
      analyze({data:{imageDataUrl:preview,description:description||null}}).then(result=>{
        if(sequence!==run.current)return;setAnalysis(result.analysis);setAiState(result.ok?'done':'fallback');if(!result.ok)setNotice(result.notice);
      }).catch(()=>{if(sequence===run.current){setAiState('fallback');setAnalysis({...fallback,summary:description||fallback.summary});}});
    }catch{toast.error('This photo could not be read. Please try another image.');}finally{setPreparing(false);}
  }
  useEffect(()=>{
    if(!confirmed||!point||incident)return;let cancelled=false;setAddressNotice('Finding the place name…');
    geocode({data:point}).then(r=>{if(!cancelled){setAddress(r.address);setAddressNotice(r.notice??'');}}).catch(()=>{if(!cancelled)setAddressNotice('Place lookup unavailable; your confirmed pin remains usable.');});
    return()=>{cancelled=true;};
  },[confirmed,point?.lat,point?.lng]);
  useEffect(()=>{
    setMatches([]);if(!confirmed||!point||analysis.category==='other')return;let cancelled=false;
    supabase.rpc('nearby_issues',{_lat:point.lat,_lng:point.lng,_radius_m:120,_category:analysis.category}).then(r=>{if(!cancelled)setMatches(r.data??[]);});return()=>{cancelled=true;};
  },[confirmed,point?.lat,point?.lng,analysis.category]);
  async function searchPlace(){setSearching(true);try{const r=await findAddress({data:{query:search}});setResults(r.results);setAddressNotice(r.notice??'');}catch{setAddressNotice('Address search unavailable. Place a pin instead.');}finally{setSearching(false);}}
  async function locateMe(){setLocating(true);const gps=liveGps()??await freshGps();setLocating(false);if(!gps){setNotice('Location permission was denied or unavailable. Search a place or tap the map.');return;}if((gps.accuracy??Infinity)>150){setPoint({lat:gps.lat,lng:gps.lng});setConfirmed(false);setNotice(`Your location is approximate (±${Math.round(gps.accuracy??0)} m). Drag the map pin to the exact spot, then confirm.`);return;}setPoint({lat:gps.lat,lng:gps.lng});setAddress(null);setConfirmed(true);setEditingLocation(false);setNotice(`Using your current location (±${Math.round(gps.accuracy??0)} m). Change it if the problem is elsewhere.`);}
  async function submitReport(){
    if((!textOnly&&(!file||!image))||!point||!confirmed||!supported||busy)return;
    setBusy(true);
    try{
      let path=originalPath;
      const proof=challenge?{token:challenge.token,answer}:undefined;
      if(!path&&file&&image){const upload=await prepare({data:{key,mime:file.type,size:file.size,...(proof?{challenge:proof}:{})}});const stored=await supabase.storage.from('issue-photos').uploadToSignedUrl(upload.path,upload.token,file,{contentType:file.type});if(stored.error)throw new Error('Original photo upload failed. Try again.');path=upload.path;setOriginalPath(path);
        if(proof){setChallenge(await getChallenge());setAnswer('');toast.info('Photo uploaded. Please answer the new verification question to submit.');return;}}
      const suggestion=aiState==='done'?analysis:{...analysis,title:analysis.title.trim()||fallback.title,summary:description||analysis.summary};
      const payload=reportInputSchema.parse({idempotencyKey:key,imageDataUrl:image,...(path?{originalPath:path,photoMetadata:meta}:{}),description:description||null,title:suggestion.title.trim()||fallback.title,summary:suggestion.summary,category:suggestion.category,subcategory:suggestion.subcategory,severity:suggestion.severity,aiConfidence:aiState==='done'?suggestion.confidence:null,safetyWarning:suggestion.safety_warning,needsClassification:aiState!=='done'||suggestion.confidence<0.4,lat:point.lat,lng:point.lng,landmark:address?.slice(0,200)??null,...(incident?{incidentLocation:{originalAddress:incident.originalAddress,normalizedAddress:incident.label,source:incident.source,city:incident.enteredCity,state:incident.enteredState,pin:incident.enteredPin,directions:incident.directions}}:{}),duplicateOf:candidate,...(proof?{challenge:proof}:{})});
      const res=await submit({data:payload});
      saveTracked({ref:res.ref,token:res.token??undefined,title:suggestion.title,savedAt:new Date().toISOString()});
      let annotated=false;
      if(res.token&&image){try{const output=await annotatedPhoto(image,annotationLines(meta,point,address,res.ref));await annotate({data:{ref:res.ref,token:res.token,imageDataUrl:output}});annotated=true;}catch{toast.warning('Report saved. Its annotated copy could not be saved; the original is retained.');}}
      setDone({ref:res.ref,token:res.token,annotated});window.scrollTo({top:0});
    }catch(e){if(e instanceof Error&&e.message.includes('VERIFICATION_REQUIRED')){try{setChallenge(await getChallenge());setAnswer('');toast.info('Please answer the verification question. Your draft is retained.');}catch{toast.error('Verification unavailable. Please wait and retry.');}}else toast.error(e instanceof Error?e.message:'Report could not be saved.');}finally{setBusy(false);}
  }
  if(done)return <div className="mx-auto max-w-xl px-4 py-12"><CheckCircle2 className="h-12 w-12 text-success"/><h1 className="mt-4 text-3xl font-bold">Report received</h1><p className="mt-3 font-mono text-2xl">{done.ref}</p><p className="mt-3 text-sm text-muted-foreground">{image?'Your original photo is retained privately.':'Your incident details are saved.'}{done.annotated?' A separate annotated copy is ready.':''} No government delivery has been recorded.</p>{done.token&&<div className="mt-6 border-y py-5"><p className="text-sm font-semibold">Keep your private tracking link safe</p><Button variant="outline" className="mt-3" onClick={()=>{navigator.clipboard.writeText(`${window.location.origin}/issues/${done.ref}#t=${done.token}`);toast.success('Private link copied');}}><Copy className="h-4 w-4"/>Copy private link</Button></div>}<Button asChild className="mt-6"><Link to="/issues/$ref" params={{ref:done.ref}} {...(done.token?{hash:`t=${done.token}`}:{})}>Track report<ArrowRight className="h-4 w-4"/></Link></Button></div>;
  return <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6"><h1 className="text-3xl font-bold">Report a problem</h1><p className="mt-2 text-sm text-muted-foreground">A photo. The problem location. Your voice.</p>
    <input ref={camera} aria-label="Camera photo" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" onChange={e=>chooseFile(e.target.files?.[0],'camera')}/>
    <input ref={gallery} aria-label="Gallery photo" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={e=>chooseFile(e.target.files?.[0],'gallery')}/>
    {!image&&!textOnly?<div className="mt-8 overflow-hidden rounded-3xl bg-ink px-6 py-10 text-center text-ink-foreground">
      <div className="mx-auto mb-6 max-w-sm rounded-2xl bg-card px-4 py-3 text-left text-card-foreground shadow-lift" role="status">
        {live.fix&&livePlace?.kind==='ward'?<>
          <p className={`flex items-center gap-1.5 text-[11px] font-bold tracking-wider ${livePlace.precise?'text-success':'text-warning-foreground'}`}><span className={`inline-block h-2 w-2 rounded-full ${livePlace.precise?'bg-success':'bg-warning'}`}/>{livePlace.precise?'LOCATION LOCKED':'APPROXIMATE LOCATION'} · ±{Math.round(live.fix.accuracy)} m</p>
          <p className="mt-0.5 font-display text-xl font-bold">{livePlace.ward.name}</p>
          <p className="text-sm text-muted-foreground">{corporationShort(livePlace.ward.corporation)} #{livePlace.ward.ward_number}{livePlace.ward.zone?` · ${livePlace.ward.zone}`:''}</p>
          {!livePlace.precise&&<p className="mt-1 text-xs text-muted-foreground">Move closer to open sky, or you'll confirm the spot on a map.</p>}
        </>:live.fix&&livePlace?.kind==='boundary'?<><p className="text-[11px] font-bold tracking-wider text-warning-foreground">ON A WARD BORDER · ±{Math.round(live.fix.accuracy)} m</p><p className="mt-0.5 text-sm">{livePlace.wards.map(w=>w.name).join(' / ')} — staff will confirm the ward.</p></>
        :live.fix&&livePlace?.kind==='outside'?<><p className="text-[11px] font-bold tracking-wider text-warning-foreground">OUTSIDE VERIFIED REPORTING AREA</p><p className="mt-0.5 text-sm">Choose a problem location inside a verified reporting area after the photo.</p></>
        :live.state==='denied'?<><p className="text-[11px] font-bold tracking-wider text-warning-foreground">LOCATION OFF</p><p className="mt-0.5 text-sm">Allow location in your browser, or place a pin after the photo.</p></>
        :live.state==='unavailable'?<><p className="text-[11px] font-bold tracking-wider text-warning-foreground">LOCATION UNAVAILABLE</p><p className="mt-0.5 text-sm">You'll place a pin after the photo.</p><button className="mt-1 text-xs font-semibold text-primary" onClick={live.start}>Try again</button></>
        :<p className="flex items-center gap-2 text-sm font-medium"><Loader2 className="h-4 w-4 animate-spin text-primary"/>Finding your location…</p>}
      </div>
      <p className="text-sm text-ink-foreground/70">Stand close to the spot</p>
      <button aria-label="Take a photo" disabled={preparing} onClick={takePhoto} className="mx-auto mt-8 grid h-24 w-24 place-items-center rounded-full border-4 border-ink-foreground/80 bg-ink-foreground text-ink shadow-lift transition hover:scale-105 disabled:opacity-60">
        {preparing?<Loader2 className="h-9 w-9 animate-spin"/>:<Camera className="h-9 w-9"/>}
      </button>
      <p className="mt-6 text-lg font-semibold">Take a photo</p>
      <p className="mt-1 text-sm text-ink-foreground/70">We read your location automatically — no forms.</p>
      <button onClick={()=>gallery.current?.click()} disabled={preparing} className="mx-auto mt-6 inline-flex items-center gap-2 rounded-full border border-ink-foreground/30 px-4 py-2 text-sm font-medium text-ink-foreground/90 hover:bg-ink-foreground/10"><ImagePlus className="h-4 w-4"/>Upload from gallery instead</button>
      <Button variant="ghost" className="mt-4 text-ink-foreground" onClick={()=>{setTextOnly(true);setEditingLocation(true);setReviewing(false);}}>Report without a photo</Button>
    </div>:<div className="mt-6 space-y-5">
      {image&&<div className="relative"><img src={image} alt="Your report photo" className="max-h-96 w-full rounded-lg object-contain bg-muted"/>
        {confirmed&&point&&<div className="absolute left-3 top-3 max-w-[70%] rounded-xl bg-card/95 px-4 py-2.5 shadow-lift backdrop-blur">
          <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-success"><span className="inline-block h-2 w-2 rounded-full bg-success"/>LOCATION LOCKED{meta.gps?.accuracy?` · ±${Math.round(meta.gps.accuracy)} m`:''}</p>
          <p className="truncate text-sm font-semibold">{lockWard?lockWard.name:(address??'Report location')}</p>
          {lockWard&&<p className="text-xs text-muted-foreground">{lockWard.corporation.replace('Bengaluru ','').replace(' City Corporation','')}{lockWard.ward_number?` #${lockWard.ward_number}`:''}</p>}
        </div>}
        <Button variant="secondary" size="sm" className="absolute right-3 top-3" disabled={busy} onClick={()=>gallery.current?.click()}><ImagePlus className="h-4 w-4"/>Change photo</Button></div>}
      <div className="border-y py-4"><div className="flex items-start justify-between gap-3"><div><p className="flex items-center gap-2 text-sm font-semibold"><MapPin className="h-4 w-4 text-primary"/>{address??(confirmed?'Selected report location':'Where is the problem?')}</p>{point&&<p className="mt-1 font-mono text-xs text-muted-foreground">{point.lat.toFixed(5)}, {point.lng.toFixed(5)}</p>}</div><Button size="sm" variant="outline" onClick={()=>setEditingLocation(!editingLocation)}><Pencil className="h-3 w-3"/>Change</Button></div><p role="status" className="mt-2 text-xs text-muted-foreground">{notice}</p>
      {editingLocation&&<div className="mt-4 space-y-3"><AddressEntry draftKey="siddi-report-incident-draft" onDraft={()=>{setConfirmed(false);setPoint(null);setIncident(null);}} onSelect={r=>{setIncident(r);setPoint({lat:r.lat,lng:r.lng});setAddress(r.originalAddress);setConfirmed(r.verification==='supported');}}/><Button type="button" variant="ghost" size="sm" disabled={locating} onClick={()=>{setIncident(null);void locateMe();}}>Use my current location</Button><div className="h-64 overflow-hidden rounded-lg border"><LazyMap center={point??areaCenter(activeArea)} picked={point} recenter={point?{...point,zoom:16}:null} zoom={point?16:12} onPick={(lat,lng)=>{setIncident(null);setPoint({lat,lng});setConfirmed(false);setAddress(null);}}/></div><Button disabled={!point||!isInIndia(point.lat,point.lng)} onClick={()=>{setConfirmed(true);setEditingLocation(false);}}><CheckCircle2 className="h-4 w-4"/>{tx('confirmLocation')}</Button>{point&&!isInIndia(point.lat,point.lng)&&<p className="text-sm text-destructive">Choose a problem location within India.</p>}</div>}{addressNotice&&<p className="mt-2 text-xs text-muted-foreground">{addressNotice}</p>}</div>
      <label className="block text-sm font-medium">{textOnly?'Describe the incident':'Anything to add?'} <span className="text-muted-foreground">{textOnly?'(at least 10 characters)':'(optional)'}</span><textarea aria-label="Optional description" value={description} maxLength={1000} onChange={e=>setDescription(e.target.value)} rows={2} className="mt-2 w-full rounded-lg border bg-card p-3 font-normal"/></label>
      <div><p role="status" className="text-sm">{aiState==='running'?'Reading your photo… You can submit now for staff review.':aiState==='done'?`${categoryById(analysis.category).label} · AI suggestion, not an official assessment`:'Staff will review the category.'}</p>{analysis.safety_warning&&<p className="mt-2 text-sm text-destructive">{analysis.safety_warning}</p>}<details className="mt-3"><summary className="cursor-pointer text-sm font-medium text-primary">Edit suggested details</summary><div className="mt-3 space-y-3"><input aria-label="Problem title" value={analysis.title} maxLength={120} onChange={e=>setAnalysis({...analysis,title:e.target.value})} className="h-10 w-full rounded-lg border bg-card px-3 text-sm"/><select aria-label="Suggested category" value={analysis.category} onChange={e=>setAnalysis({...analysis,category:e.target.value,subcategory:categoryById(e.target.value).subs[0]})} className="h-10 w-full rounded-lg border bg-card px-3 text-sm">{CATEGORIES.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></div></details></div>
      {matches.length>0&&<details open><summary className="cursor-pointer text-sm font-semibold">Nearby reports that may match</summary><div className="mt-3 space-y-2">{matches.map(n=><div key={n.id} className="space-y-1"><label className="flex gap-2 text-sm"><input type="radio" name="candidate" checked={candidate===n.id} onChange={()=>setCandidate(n.id)}/><span>{n.title} · {Math.round(n.distance_m)} m · {n.ref_code}</span></label><Link to="/issues/$ref" params={{ref:n.ref_code}} target="_blank" className="ml-5 text-xs text-primary underline">View or track this report</Link></div>)}<label className="flex gap-2 text-sm"><input type="radio" name="candidate" checked={!candidate} onChange={()=>setCandidate(null)}/>Different problem</label><p className="text-xs text-muted-foreground">Your report stays separate. Staff decide whether it matches.</p></div></details>}
      {ambiguous&&<p role="status">We couldn't verify this location yet. Choose a point within one ward.</p>}{point&&currentRouting&&!supported&&!ambiguous&&<OutsideArea address={address??'Selected map location'} onChange={()=>{setEditingLocation(true);setConfirmed(false);}}/>}{confirmed&&point&&supported&&<CivicInfo lat={point.lat} lng={point.lng} category={analysis.category}/>}
      <p className="text-xs text-muted-foreground">The display photo, report location and description are public. Avoid faces and personal details; the untouched original is private.</p>
      {reviewing&&point&&<section className="space-y-3 border-y py-5"><h2 className="text-xl font-bold">Confirm your report</h2><p className="font-semibold">{analysis.title}</p><p className="text-sm">{categoryById(analysis.category).label} · {analysis.severity}</p><p className="text-sm">{address??'Confirmed map point'} · {point.lat.toFixed(5)}, {point.lng.toFixed(5)}</p><div className="h-52 overflow-hidden rounded-md border"><LazyMap center={point} picked={point} zoom={16}/></div><p className="whitespace-pre-wrap text-sm">{description||analysis.summary}</p><p className="text-xs text-muted-foreground">{image?'Photo attached':'No photo — staff may request clarification'}. {candidate?'Possible duplicate flagged; your report remains separate.':'Separate incident.'}</p></section>}
      {challenge&&<section className="space-y-3 border-y py-4"><label className="block text-sm font-semibold">Quick verification: {challenge.question}<input aria-label="Verification answer" inputMode="numeric" autoComplete="off" maxLength={3} value={answer} onChange={e=>setAnswer(e.target.value)} className="mt-2 block w-24 rounded-md border bg-background p-2"/></label><Button variant="ghost" size="sm" onClick={async()=>{try{setChallenge(await getChallenge());setAnswer('');}catch{toast.error('Please wait before requesting another question.');}}}>New question</Button></section>}
      <Button className="h-12 w-full" disabled={!confirmed||!point||!supported||busy||preparing||(textOnly&&description.trim().length<10)||(!!challenge&&!answer.trim())} onClick={()=>reviewing?submitReport():setReviewing(true)}>{busy?<><Loader2 className="h-4 w-4 animate-spin"/>Saving report…</>:<><CheckCircle2 className="h-4 w-4"/>{reviewing?'Confirm and submit':'Review report'}</>}</Button>
    </div>}
  </div>;
}
