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
  if((size.type==='jpg'?'jpeg':size.type)!==expected)throw new Error('Photo type does not match its contents.');
  try {
    if(expected==='jpeg')jpeg.decode(bytes,{useTArray:true,tolerantDecoding:false,maxResolutionInMP:20,maxMemoryUsageInMB:128});
    else if(expected==='png')decodePng(bytes,{checkCrc:true});
    else if(expected==='webp') {
      // Bound and inspect every RIFF chunk. WebP pixel decoding still needs an edge-compatible codec.
      let offset=12;let imageChunk=false;
      while(offset+8<=bytes.length){const type=String.fromCharCode(...bytes.slice(offset,offset+4));const length=new DataView(bytes.buffer,bytes.byteOffset+offset+4,4).getUint32(0,true);if(offset+8+length>bytes.length)throw new Error('Truncated WebP chunk');if(type==='VP8 '||type==='VP8L')imageChunk=true;offset+=8+length+(length%2);}
      if(!imageChunk||offset!==bytes.length)throw new Error('Invalid WebP framing');
    } else throw new Error('Unsupported image');
  } catch {throw new Error('Photo could not be safely decoded. Choose a valid image.');}
  return size;
}