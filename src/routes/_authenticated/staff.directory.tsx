import { createFileRoute, redirect } from '@tanstack/react-router';
export const Route=createFileRoute('/_authenticated/staff/directory')({beforeLoad:()=>{throw redirect({to:'/admin/directory',replace:true});}});
