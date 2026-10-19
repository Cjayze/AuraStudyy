/** Decode UTF-8 filenames that multipart parsers expose as Latin-1. */
export function normalizeUploadedFilename(filename: string): string {
  if (!/[^\x00-\x7F]/.test(filename)) return filename;

  const decoded = Buffer.from(filename, 'latin1').toString('utf8');
  return decoded.includes('\uFFFD') ? filename : decoded;
}
