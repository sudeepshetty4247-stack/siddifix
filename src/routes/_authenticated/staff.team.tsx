import { createFileRoute, redirect } from '@tanstack/react-router';
export const Route=createFileRoute('/_authenticated/staff/team')({beforeLoad:()=>{throw redirect({to:'/admin/staff',replace:true});}});
