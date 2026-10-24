import { z } from 'zod';

export const photoMetadataSchema = z.object({
  source:z.enum(['camera','gallery']), capturedAt:z.string().max(80).nullable(),
  captureTimeSource:z.enum(['embedded','camera-session','unknown']),
  gps:z.object({lat:z.number().min(-90).max(90),lng:z.number().min(-180).max(180),accuracy:z.number().min(0).nullable(),acquiredAt:z.string().max(80).nullable(),source:z.enum(['embedded','device-session'])}).nullable(),
});
export type PhotoMetadata = z.infer<typeof photoMetadataSchema>;
export function embeddedPhotoMetadata(value: unknown): PhotoMetadata {
  const v=value as {latitude?:number;longitude?:number;DateTimeOriginal?:Date;OffsetTimeOriginal?:string} | null;
  const gps=v && typeof v.latitude==='number' && typeof v.longitude==='number' && Number.isFinite(v.latitude) && Number.isFinite(v.longitude) && Math.abs(v.latitude)<=90 && Math.abs(v.longitude)<=180 ? {lat:v.latitude,lng:v.longitude,accuracy:null,acquiredAt:null,source:'embedded' as const} : null;
  // EXIF timestamps often have no timezone. Preserve their wall time without inventing a UTC offset.
  const date=v?.DateTimeOriginal;
  const capturedAt=date instanceof Date && Number.isFinite(date.getTime()) ? `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')} ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}:${String(date.getSeconds()).padStart(2,'0')}${v?.OffsetTimeOriginal ? ` ${v.OffsetTimeOriginal}` : ' (timezone unknown)'}` : null;
  return {source:'gallery',gps,capturedAt,captureTimeSource:capturedAt?'embedded':'unknown'};
}
export function annotationLines(meta:PhotoMetadata, point:{lat:number;lng:number}, address?:string|null, ref?:string) {
  return [ref ? `Siddhi · ${ref}` : 'Siddhi · Report evidence', `Report location: ${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`, ...(address?[address]:[]),
    meta.capturedAt ? `${meta.captureTimeSource==='embedded'?'Photo metadata time':'Camera-session received time'}: ${meta.capturedAt}` : 'Photo capture time unavailable',
    meta.gps ? `${meta.gps.source==='embedded'?'Embedded photo GPS (unverified)':'Device GPS near capture (suggested)'}: ${meta.gps.lat.toFixed(5)}, ${meta.gps.lng.toFixed(5)}${meta.gps.accuracy!==null?` ±${Math.round(meta.gps.accuracy)} m`:''}` : 'Photo capture location unavailable'];
}

export async function processedPhoto(file:File) {
  const bitmap=await createImageBitmap(file);const scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));
  const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Image processing unavailable');ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();return canvas.toDataURL('image/jpeg',0.82);
}
export async function annotatedPhoto(image:string,lines:string[]) {
  const bitmap=await createImageBitmap(await (await fetch(image)).blob());const canvas=document.createElement('canvas');
  canvas.width=Math.max(640,bitmap.width);const font=22,lineHeight=32;
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Image annotation unavailable');ctx.font=`${font}px sans-serif`;
  const wrapped:string[]=[];for(const line of lines){let row='';for(const word of line.split(' ')){if(ctx.measureText(`${row} ${word}`).width>canvas.width-40&&row){wrapped.push(row);row=word;}else row=row?`${row} ${word}`:word;}if(row)wrapped.push(row);}
  const imageHeight=Math.round(bitmap.height*canvas.width/bitmap.width);canvas.height=imageHeight+wrapped.length*lineHeight+32;
  ctx.drawImage(bitmap,0,0,canvas.width,imageHeight);bitmap.close();
  // Evidence bitmap palette, not app UI; neutral high contrast for readable export.
  ctx.fillStyle='#10202a';ctx.fillRect(0,imageHeight,canvas.width,canvas.height-imageHeight);ctx.fillStyle='#ffffff';ctx.font=`${font}px sans-serif`;
  wrapped.forEach((line,i)=>ctx.fillText(line,20,imageHeight+30+i*lineHeight));return canvas.toDataURL('image/jpeg',0.86);
}