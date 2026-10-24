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
import { BENGALURU, CATEGORIES, isInIndia, categoryById } from '@/lib/civic';
import { saveTracked } from '@/lib/tracking';
import { supabase } from '@/integrations/supabase/client';
import { useLiveGps } from '@/lib/live-gps';
import { describeLiveFix, corporationShort } from '@/lib/map-location';

export const Route = createFileRoute('/_citizen/report')({
  head:()=>({meta:[{title:'Photo report — Siddi'},{name:'description',content:'Take or upload a photo, confirm the problem location when needed and submit without a long form.'},{property:'og:title',content:'Photo report — Siddi'},{property:'og:description',content:'Anonymous photo reporting with private originals, automatic suggestions and public case tracking.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),
  component:ReportPage,
});
const fallback = {category:'other',subcategory:'Other',title:'Civic issue reported',summary:'Photo awaiting staff review.',severity:'medium' as const,confidence:0,safety_warning:null as string|null};
type Suggestion = {category:string;subcategory:string;title:string;summary:string;severity:'low'|'medium'|'high'|'critical';confidence:number;safety_warning:string|null};
type Point = {lat:number;lng:number};

function ReportPage(){
  const camera=useRef<HTMLInputElement>(null);const gallery=useRef<HTMLInputElement>(null);
  const [key]=useState(()=>crypto.randomUUID());const [file,setFile]=useState<File|null>(null);const [image,setImage]=useState<string|null>(null);
  const [meta,setMeta]=useState<PhotoMetadata>({source:'gallery',capturedAt:null,captureTimeSource:'unknown',gps:null});
  const captureGps=useRef<PhotoMetadata['gps']>(null);const run=useRef(0);
  const [point,setPoint]=useState<Point|null>(null);const [confirmed,setConfirmed]=useState(false);const [editingLocation,setEditingLocation]=useState(false);
  const [description,setDescription]=useState('');const [analysis,setAnalysis]=useState<Suggestion>(fallback);const [aiState,setAiState]=useState('idle');
  const [notice,setNotice]=useState('');const [preparing,setPreparing]=useState(false);const [busy,setBusy]=useState(false);
  const [address,setAddress]=useState<string|null>(null);const [addressNotice,setAddressNotice]=useState('');
  const [search,setSearch]=useState('');const [results,setResults]=useState<{lat:number;lng:number;label:string}[]>([]);const [searching,setSearching]=useState(false);const [locating,setLocating]=useState(false);
  const [matches,setMatches]=useState<{id:string;title:string;ref_code:string;distance_m:number}[]>([]);const [candidate,setCandidate]=useState<string|null>(null);
  const [originalPath,setOriginalPath]=useState<string|null>(null);const [done,setDone]=useState<{ref:string;token:string|null;annotated:boolean}|null>(null);
  const analyze=useServerFn(analyzeIssue);const submit=useServerFn(submitIssue);const prepare=useServerFn(prepareOriginalUpload);const annotate=useServerFn(saveAnnotatedPhoto);
  const demoMode=useLocation().location?.method==='demo';
  const geocode=useServerFn(reverseGeocode);const findAddress=useServerFn(searchAddress);
  const dirQ=useQuery({queryKey:['civic-directory'],queryFn:()=>getDirectory(),staleTime:300000});
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
    setPreparing(true);setOriginalPath(null);setConfirmed(false);setPoint(null);setAddress(null);setCandidate(null);setMatches([]);setAnalysis(fallback);
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
    if(!confirmed||!point)return;let cancelled=false;setAddressNotice('Finding the place name…');
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
    if(!file||!image||!point||!confirmed||busy)return;
    if(demoMode){toast.info('Demo mode: this run stopped before saving. Nothing was submitted and public numbers are unchanged.');return;}
    setBusy(true);
    try{
      let path=originalPath;
      if(!path){const upload=await prepare({data:{key,mime:file.type,size:file.size}});const stored=await supabase.storage.from('issue-photos').uploadToSignedUrl(upload.path,upload.token,file,{contentType:file.type});if(stored.error)throw new Error('Original photo upload failed. Try again.');path=upload.path;setOriginalPath(path);}
      const suggestion=aiState==='done'?analysis:{...analysis,title:analysis.title.trim()||fallback.title,summary:description||analysis.summary};
      const res=await submit({data:{idempotencyKey:key,imageDataUrl:image,originalPath:path,photoMetadata:meta,description:description||null,title:suggestion.title.trim()||fallback.title,summary:suggestion.summary,category:suggestion.category,subcategory:suggestion.subcategory,severity:suggestion.severity,aiConfidence:aiState==='done'?suggestion.confidence:null,safetyWarning:suggestion.safety_warning,needsClassification:aiState!=='done'||suggestion.confidence<0.4,lat:point.lat,lng:point.lng,landmark:address?.slice(0,200)??null,duplicateOf:candidate}});
      saveTracked({ref:res.ref,token:res.token??undefined,title:suggestion.title,savedAt:new Date().toISOString()});
      let annotated=false;
      if(res.token){try{const output=await annotatedPhoto(image,annotationLines(meta,point,address,res.ref));await annotate({data:{ref:res.ref,token:res.token,imageDataUrl:output}});annotated=true;}catch{toast.warning('Report saved. Its annotated copy could not be saved; the original is retained.');}}
      setDone({ref:res.ref,token:res.token,annotated});window.scrollTo({top:0});
    }catch(e){toast.error(e instanceof Error?e.message:'Report could not be saved.');}finally{setBusy(false);}
  }
  if(done)return <div className="mx-auto max-w-xl px-4 py-12"><CheckCircle2 className="h-12 w-12 text-success"/><h1 className="mt-4 text-3xl font-bold">Report received</h1><p className="mt-3 font-mono text-2xl">{done.ref}</p><p className="mt-3 text-sm text-muted-foreground">Your original photo is retained privately.{done.annotated?' A separate annotated copy is ready.':''} No government delivery has been recorded.</p>{done.token&&<div className="mt-6 border-y py-5"><p className="text-sm font-semibold">Keep your private tracking link safe</p><Button variant="outline" className="mt-3" onClick={()=>{navigator.clipboard.writeText(`${window.location.origin}/issues/${done.ref}#t=${done.token}`);toast.success('Private link copied');}}><Copy className="h-4 w-4"/>Copy private link</Button></div>}<Button asChild className="mt-6"><Link to="/issues/$ref" params={{ref:done.ref}} {...(done.token?{hash:`t=${done.token}`}:{})}>Track report<ArrowRight className="h-4 w-4"/></Link></Button></div>;
  return <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6"><h1 className="text-3xl font-bold">Report a problem</h1><p className="mt-2 text-sm text-muted-foreground">A photo. The problem location. Your voice.</p>{demoMode&&<p role="status" className="mt-4 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm">Bengaluru demo mode — try every step; the final submit is simulated and nothing is saved.</p>}
    <input ref={camera} aria-label="Camera photo" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" onChange={e=>chooseFile(e.target.files?.[0],'camera')}/>
    <input ref={gallery} aria-label="Gallery photo" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={e=>chooseFile(e.target.files?.[0],'gallery')}/>
    {!image?<div className="mt-8 overflow-hidden rounded-3xl bg-ink px-6 py-10 text-center text-ink-foreground">
      <div className="mx-auto mb-6 max-w-sm rounded-2xl bg-card px-4 py-3 text-left text-card-foreground shadow-lift" role="status">
        {live.fix&&livePlace?.kind==='ward'?<>
          <p className={`flex items-center gap-1.5 text-[11px] font-bold tracking-wider ${livePlace.precise?'text-success':'text-warning-foreground'}`}><span className={`inline-block h-2 w-2 rounded-full ${livePlace.precise?'bg-success':'bg-warning'}`}/>{livePlace.precise?'LOCATION LOCKED':'APPROXIMATE LOCATION'} · ±{Math.round(live.fix.accuracy)} m</p>
          <p className="mt-0.5 font-display text-xl font-bold">{livePlace.ward.name}</p>
          <p className="text-sm text-muted-foreground">{corporationShort(livePlace.ward.corporation)} #{livePlace.ward.ward_number}{livePlace.ward.zone?` · ${livePlace.ward.zone}`:''}</p>
          {!livePlace.precise&&<p className="mt-1 text-xs text-muted-foreground">Move closer to open sky, or you'll confirm the spot on a map.</p>}
        </>:live.fix&&livePlace?.kind==='boundary'?<><p className="text-[11px] font-bold tracking-wider text-warning-foreground">ON A WARD BORDER · ±{Math.round(live.fix.accuracy)} m</p><p className="mt-0.5 text-sm">{livePlace.wards.map(w=>w.name).join(' / ')} — staff will confirm the ward.</p></>
        :live.fix&&livePlace?.kind==='outside'?<><p className="text-[11px] font-bold tracking-wider text-warning-foreground">OUTSIDE BENGALURU</p><p className="mt-0.5 text-sm">You can still report; pick the spot in Bengaluru after the photo.</p></>
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
    </div>:<div className="mt-6 space-y-5">
      <div className="relative"><img src={image} alt="Your report photo" className="max-h-96 w-full rounded-lg object-contain bg-muted"/>
        {confirmed&&point&&<div className="absolute left-3 top-3 max-w-[70%] rounded-xl bg-card/95 px-4 py-2.5 shadow-lift backdrop-blur">
          <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-success"><span className="inline-block h-2 w-2 rounded-full bg-success"/>LOCATION LOCKED{meta.gps?.accuracy?` · ±${Math.round(meta.gps.accuracy)} m`:''}</p>
          <p className="truncate text-sm font-semibold">{lockWard?lockWard.name:(address??'Report location')}</p>
          {lockWard&&<p className="text-xs text-muted-foreground">{lockWard.corporation.replace('Bengaluru ','').replace(' City Corporation','')}{lockWard.ward_number?` #${lockWard.ward_number}`:''}</p>}
        </div>}
        <Button variant="secondary" size="sm" className="absolute right-3 top-3" disabled={busy} onClick={()=>gallery.current?.click()}><ImagePlus className="h-4 w-4"/>Change photo</Button></div>
      <div className="border-y py-4"><div className="flex items-start justify-between gap-3"><div><p className="flex items-center gap-2 text-sm font-semibold"><MapPin className="h-4 w-4 text-primary"/>{address??(confirmed?'Selected report location':'Where is the problem?')}</p>{point&&<p className="mt-1 font-mono text-xs text-muted-foreground">{point.lat.toFixed(5)}, {point.lng.toFixed(5)}</p>}</div><Button size="sm" variant="outline" onClick={()=>setEditingLocation(!editingLocation)}><Pencil className="h-3 w-3"/>Change</Button></div><p role="status" className="mt-2 text-xs text-muted-foreground">{notice}</p>
      {editingLocation&&<div className="mt-4 space-y-3"><form className="flex gap-2" onSubmit={e=>{e.preventDefault();if(search.trim().length>=3)searchPlace();}}><input aria-label="Search problem address" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search a place, e.g. Kudlu Gate" className="h-10 min-w-0 flex-1 rounded-lg border bg-card px-3 text-sm"/><Button type="submit" variant="outline" size="icon" aria-label="Search address" disabled={search.trim().length<3||searching}>{searching?<Loader2 className="h-4 w-4 animate-spin"/>:<Search className="h-4 w-4"/>}</Button></form><Button type="button" variant="ghost" size="sm" disabled={locating} onClick={locateMe}>{locating?<Loader2 className="h-4 w-4 animate-spin"/>:<LocateFixed className="h-4 w-4"/>}Use my current location</Button>{results.length>0&&<div className="divide-y rounded-lg border bg-card">{results.map(r=><button type="button" key={`${r.lat}-${r.lng}`} className="flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm hover:bg-secondary" onClick={()=>{setPoint({lat:r.lat,lng:r.lng});setAddress(null);setResults([]);setConfirmed(true);setEditingLocation(false);setNotice('Location set from your search. Change it if the problem is elsewhere.');}}><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary"/><span>{r.label}</span></button>)}</div>}<div className="h-64 overflow-hidden rounded-lg border"><LazyMap center={point??BENGALURU} picked={point} recenter={point?{...point,zoom:16}:null} zoom={point?16:12} onPick={(lat,lng)=>{setPoint({lat,lng});setConfirmed(false);setAddress(null);}}/></div><Button disabled={!point||!isInIndia(point.lat,point.lng)} onClick={()=>{setConfirmed(true);setEditingLocation(false);}}><CheckCircle2 className="h-4 w-4"/>Confirm problem location</Button>{point&&!isInIndia(point.lat,point.lng)&&<p className="text-sm text-destructive">Choose a problem location within India.</p>}</div>}{addressNotice&&<p className="mt-2 text-xs text-muted-foreground">{addressNotice}</p>}</div>
      <label className="block text-sm font-medium">Anything to add? <span className="text-muted-foreground">(optional)</span><textarea aria-label="Optional description" value={description} maxLength={1000} onChange={e=>setDescription(e.target.value)} rows={2} className="mt-2 w-full rounded-lg border bg-card p-3 font-normal"/></label>
      <div><p role="status" className="text-sm">{aiState==='running'?'Reading your photo… You can submit now for staff review.':aiState==='done'?`${categoryById(analysis.category).label} · AI suggestion, not an official assessment`:'Staff will review the category.'}</p>{analysis.safety_warning&&<p className="mt-2 text-sm text-destructive">{analysis.safety_warning}</p>}<details className="mt-3"><summary className="cursor-pointer text-sm font-medium text-primary">Edit suggested details</summary><div className="mt-3 space-y-3"><input aria-label="Problem title" value={analysis.title} maxLength={120} onChange={e=>setAnalysis({...analysis,title:e.target.value})} className="h-10 w-full rounded-lg border bg-card px-3 text-sm"/><select aria-label="Suggested category" value={analysis.category} onChange={e=>setAnalysis({...analysis,category:e.target.value,subcategory:categoryById(e.target.value).subs[0]})} className="h-10 w-full rounded-lg border bg-card px-3 text-sm">{CATEGORIES.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></div></details></div>
      {matches.length>0&&<details><summary className="cursor-pointer text-sm font-semibold">Nearby reports that may match</summary><div className="mt-3 space-y-2">{matches.map(n=><label key={n.id} className="flex gap-2 text-sm"><input type="radio" name="candidate" checked={candidate===n.id} onChange={()=>setCandidate(n.id)}/><span>{n.title} · {Math.round(n.distance_m)} m · {n.ref_code}</span></label>)}<label className="flex gap-2 text-sm"><input type="radio" name="candidate" checked={!candidate} onChange={()=>setCandidate(null)}/>Different problem</label><p className="text-xs text-muted-foreground">Your report stays separate. Staff decide whether it matches.</p></div></details>}
      {confirmed&&point&&<CivicInfo lat={point.lat} lng={point.lng} category={analysis.category}/>}
      <p className="text-xs text-muted-foreground">The display photo, report location and description are public. Avoid faces and personal details; the untouched original is private.</p><Button className="h-12 w-full" disabled={!confirmed||!point||busy||preparing} onClick={submitReport}>{busy?<><Loader2 className="h-4 w-4 animate-spin"/>Saving report…</>:<><CheckCircle2 className="h-4 w-4"/>Submit report</>}</Button>
    </div>}
  </div>;
}
