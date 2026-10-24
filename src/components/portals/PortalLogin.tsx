import { useEffect, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { getPortalAccess } from '@/lib/portal.functions';
import { canEnterPortal } from '@/lib/portal-access';
import { Logo } from '@/components/civic/Logo';
import { BackButton } from '@/components/civic/BackButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
export function PortalLogin({ portal }: { portal: 'admin' | 'staff' }) {
 const navigate=useNavigate(); const getAccess=useServerFn(getPortalAccess);
 const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [busy,setBusy]=useState(false); const [error,setError]=useState('');
 const admin=portal==='admin';
 async function proceed() { const a=await getAccess(); if(!canEnterPortal(a,portal)) { setError(!a.active ? 'Account inactive. Contact your administrator.' : `This account is not authorized for the ${admin ? 'Admin Control Centre' : 'Government Staff Portal'}.`); return; } await navigate({to:admin?'/admin':'/staff',replace:true}); }
 useEffect(()=>{void supabase.auth.getUser().then(async r=>{if(r.data.user) try{await proceed();}catch{setError('Could not verify account access.');}});},[]);
 async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');try{const r=await supabase.auth.signInWithPassword({email,password});if(r.error)throw new Error('Sign-in failed. Check your credentials or account status.');await proceed();}catch(e){setError(e instanceof Error?e.message:'Sign-in failed.');}finally{setBusy(false);}}
 async function reset(){if(!email){setError('Enter your work email first.');return;}const r=await supabase.auth.resetPasswordForEmail(email,{redirectTo:new URL('/reset-password',window.location.origin).toString()});if(r.error)toast.error('Recovery email could not be requested.');else toast.success('If this account can receive recovery mail, a reset link has been requested.');}
 return <main className="flex min-h-screen items-center justify-center bg-background p-6"><div className="w-full max-w-md space-y-7"><BackButton/><Logo/><div className="border-b pb-6"><ShieldCheck className="mb-4 h-9 w-9 text-primary"/><p className="mb-2 text-xs font-semibold uppercase text-primary">Authorized access</p><h1 className="text-3xl font-bold">{admin?'Admin Control Centre':'Government Staff Portal'}</h1><p className="mt-3 text-sm text-muted-foreground">{admin?'System ownership and approved administration.':'Your department’s cases, assignments and resolution work.'}</p></div><form onSubmit={submit} className="space-y-4"><label className="block space-y-2 text-sm font-medium">Work email<Input type="email" required autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)}/></label><label className="block space-y-2 text-sm font-medium">Password<Input type="password" required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>{error&&<p role="alert" className="text-sm text-destructive">{error}</p>}<Button disabled={busy} className="w-full">{busy&&<Loader2 className="h-4 w-4 animate-spin"/>}Sign in</Button></form><div className="flex flex-wrap justify-between gap-3"><Button variant="ghost" className="p-0" onClick={reset}>Forgot password?</Button><Link className="text-sm text-primary" to={admin?'/staff-login':'/admin-login'}>{admin?'Government staff sign in':'Administrator sign in'}</Link></div><p className="text-xs text-muted-foreground">Accounts are invitation-only. Citizens can <Link to="/report" className="text-primary">report without signing in</Link>.</p></div></main>;
}
