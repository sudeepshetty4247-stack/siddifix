/** Checks container framing, not full pixel decoding. Browser processing decodes pixels. */
export function validateImageContainer(bytes: Uint8Array, format: string) {
  const mime = format === 'jpg' ? 'jpeg' : format;
  if (mime === 'jpeg') {
    if (bytes.length < 12 || bytes[0] !== 255 || bytes[1] !== 216 || bytes[2] !== 255 || bytes[bytes.length - 2] !== 255 || bytes[bytes.length - 1] !== 217) throw new Error('Invalid or truncated JPEG image.');
  } else if (mime === 'png') {
    const signature = [137,80,78,71,13,10,26,10];
    const end = [0,0,0,0,73,69,78,68,174,66,96,130];
    if (bytes.length < 45 || !signature.every((value, index) => bytes[index] === value) || !end.every((value, index) => bytes[bytes.length - 12 + index] === value)) throw new Error('Invalid or truncated PNG image.');
  } else if (mime === 'webp') {
    const length = bytes.length >= 12 ? new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(4,true) : 0;
    if (bytes.length < 20 || String.fromCharCode(...bytes.slice(0,4)) !== 'RIFF' || String.fromCharCode(...bytes.slice(8,12)) !== 'WEBP' || length + 8 !== bytes.length) throw new Error('Invalid or truncated WebP image.');
  } else throw new Error('Unsupported image format.');
}