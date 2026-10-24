import { createFileRoute, redirect } from '@tanstack/react-router';
export const Route=createFileRoute('/_authenticated/staff/targets')({beforeLoad:()=>{throw redirect({to:'/admin/targets',replace:true});}});
