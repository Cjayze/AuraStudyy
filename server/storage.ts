import path from 'path';

export const getDataDir = () => path.resolve(process.env.DATA_DIR || path.join(process.cwd(), 'data'));
export const getUploadsDir = () => path.resolve(process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads'));

// Document file paths are stored as public /uploads URLs; resolve their filename
// under the configured upload directory so a persistent mount can be used.
export const resolveUploadPath = (storedPath: string) => path.join(getUploadsDir(), path.basename(storedPath));
