import jpeg from 'jpeg-js';
import { decode as decodePng } from 'fast-png';
import { imageSize } from 'image-size';
import { validateImageContainer } from './image-format';

export function validateReportImage(bytes:Uint8Array,format:string,maxBytes=25*1024*1024) {
  if(!bytes.length||bytes.length>maxBytes)throw new Error('Choose an image within the upload size limit.');
  validateImageContainer(bytes,format);
  const size=imageSize(bytes);
  if(!size.width||!size.height||size.width*size.height>20_000_000||size.width>12000||size.height>12000)throw new Error('Photo dimensions exceed the safe processing limit (20 megapixels).');
  const expected=format==='jpg'?'jpeg':format;
  if(size.type!==expected)throw new Error('Photo type does not match its contents.');
  try {
    if(expected==='jpeg')jpeg.decode(bytes,{useTArray:true,tolerantDecoding:false,maxResolutionInMP:20,maxMemoryUsageInMB:128});
    else if(expected==='png')decodePng(bytes,{checkCrc:true});
    else throw new Error('Please use a JPG or PNG original for verified submission.');
  } catch {throw new Error('Photo could not be safely decoded. Choose a valid JPG or PNG.');}
  return size;
}