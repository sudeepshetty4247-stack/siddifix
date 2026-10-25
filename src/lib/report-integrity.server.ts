import { getCookie, setCookie, getRequestHeader } from '@tanstack/react-start/server';

export async function digest(value:string,secret?:string) {
  const bytes=new TextEncoder().encode(value);
  const result=secret?await crypto.subtle.sign('HMAC',await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']),bytes):await crypto.subtle.digest('SHA-256',bytes);
  return Array.from(new Uint8Array(result),b=>b.toString(16).padStart(2,'0')).join('');
}
export async function integrityIdentity(secret:string) {
  let session=getCookie('siddhi-report-session');
  if(!session||! /^[a-f0-9-]{36}$/.test(session)){session=crypto.randomUUID();setCookie('siddhi-report-session',session,{httpOnly:true,sameSite:'lax',secure:getRequestHeader('x-forwarded-proto')==='https',path:'/',maxAge:86400});}
  // Never trust caller-supplied x-forwarded-for. Missing trusted ingress metadata shares a generous fallback bucket.
  const ip=getRequestHeader('cf-connecting-ip')??'unknown-ingress';
  const day=new Date().toISOString().slice(0,10);
  return {session:await digest(`session:${session}`,secret),network:await digest(`network:${day}:${ip}`,secret)};
}