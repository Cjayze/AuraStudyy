import * as pdfParseModule from 'pdf-parse';
import mammoth from 'mammoth';
import JSZip from 'jszip';

export interface ChunkResult {
  chunk_index: number;
  content: string;
  char_count: number;
}

/**
 * Clean and normalize text extracted from document
 */
export function cleanText(text: string): string {
  if (!text) return '';
  return text
    // Remove Unicode replacement characters (caused by corrupted binary decode)
    .replace(/\uFFFD/g, ' ')
    // Remove unprintable control characters (keep \n, \r, \t)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Remove repeated spaces
    .replace(/[ \t]+/g, ' ')
    // Remove excessive line breaks (keep max 2 for paragraph separation)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Split text into overlapping chunks for Vector DB / RAG
 */
export function splitIntoChunks(
  text: string,
  chunkSize: number = 600,
  overlap: number = 100
): ChunkResult[] {
  const cleaned = cleanText(text);
  if (!cleaned) return [];

  const chunks: ChunkResult[] = [];
  let startIndex = 0;
  let chunkIndex = 0;

  while (startIndex < cleaned.length) {
    let endIndex = startIndex + chunkSize;

    if (endIndex >= cleaned.length) {
      endIndex = cleaned.length;
    } else {
      // Try to break at sentence or newline boundary
      const boundary = Math.max(
        cleaned.lastIndexOf('. ', endIndex),
        cleaned.lastIndexOf('\n', endIndex),
        cleaned.lastIndexOf('? ', endIndex),
        cleaned.lastIndexOf('! ', endIndex)
      );

      // If boundary found within the last 150 chars, use it
      if (boundary > startIndex + chunkSize - 150) {
        endIndex = boundary + 1;
      }
    }

    const chunkContent = cleaned.substring(startIndex, endIndex).trim();
    if (chunkContent.length > 20) {
      chunks.push({
        chunk_index: chunkIndex++,
        content: chunkContent,
        char_count: chunkContent.length
      });
    }

    if (endIndex >= cleaned.length) break;
    startIndex = Math.max(endIndex - overlap, startIndex + 1);
  }

  return chunks;
}

/**
 * Helper to decode XML entities
 */
function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * Extract slide text from PPTX (Office Open XML PowerPoint)
 */
async function extractPptxText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const slideFiles: { name: string; num: number }[] = [];

  zip.forEach((relativePath) => {
    const match = relativePath.match(/^ppt\/slides\/slide(\d+)\.xml$/i);
    if (match) {
      slideFiles.push({ name: relativePath, num: parseInt(match[1], 10) });
    }
  });

  slideFiles.sort((a, b) => a.num - b.num);
  const slideTexts: string[] = [];

  for (const slide of slideFiles) {
    const fileData = zip.file(slide.name);
    if (fileData) {
      const xml = await fileData.async('text');
      const matches = xml.match(/<a:t[^>]*>([\s\S]*?)<\/a:t>/gi) || [];
      const textPieces = matches
        .map((m) => m.replace(/<[^>]+>/g, ''))
        .map((t) => decodeXmlEntities(t).trim())
        .filter(Boolean);

      if (textPieces.length > 0) {
        slideTexts.push(`[Slide ${slide.num}]:\n${textPieces.join(' ')}`);
      }
    }
  }

  return slideTexts.join('\n\n');
}

/**
 * Extract text from PDF using PDFParse class (pdf-parse v2) or fallback v1
 */
async function extractPdfText(buffer: Buffer): Promise<string> {
  const anyModule = pdfParseModule as any;

  // Check if PDFParse class is present (pdf-parse v2)
  if (anyModule && typeof anyModule.PDFParse === 'function') {
    const ParserClass = anyModule.PDFParse;
    const parser = new ParserClass({ data: buffer });
    await parser.load();
    const result = await parser.getText();
    if (result && typeof result.text === 'string' && result.text.trim()) {
      return result.text;
    }
    if (result && Array.isArray(result.pages)) {
      const combined = result.pages.map((p: any) => p.text || '').join('\n\n');
      if (combined.trim()) return combined;
    }
  }

  // Fallback if pdf-parse is a function directly (v1)
  if (typeof anyModule === 'function') {
    const data = await anyModule(buffer);
    if (data && data.text) return data.text;
  }

  if (anyModule && typeof anyModule.default === 'function') {
    const data = await anyModule.default(buffer);
    if (data && data.text) return data.text;
  }

  throw new Error('Không thể phân tích định dạng PDF hoặc tệp là dạng ảnh quét.');
}

/**
 * Extract raw text from file buffer based on extension
 */
export async function extractTextFromFile(
  buffer: Buffer,
  fileType: string
): Promise<string> {
  const normalizedType = fileType.toLowerCase().replace('.', '').trim();
  let raw = '';

  if (normalizedType === 'pdf') {
    try {
      raw = await extractPdfText(buffer);
    } catch (err: any) {
      console.warn('PDF extraction failed:', err);
      throw new Error(`Không thể trích xuất văn bản từ tệp PDF: ${err?.message || 'Tệp có thể bị khóa hoặc là ảnh quét.'}`);
    }
  } else if (normalizedType === 'docx') {
    try {
      const result = await mammoth.extractRawText({ buffer });
      raw = result.value || '';
    } catch (err: any) {
      console.warn('DOCX extraction failed:', err);
      throw new Error(`Không thể trích xuất văn bản từ tệp DOCX: ${err?.message || 'Tệp không hợp lệ.'}`);
    }
  } else if (normalizedType === 'pptx') {
    try {
      raw = await extractPptxText(buffer);
    } catch (err: any) {
      console.warn('PPTX extraction failed:', err);
      throw new Error(`Không thể trích xuất slide từ tệp PowerPoint (.pptx): ${err?.message || 'Tệp không hợp lệ.'}`);
    }
  } else {
    // Plain text files (.txt, .md, .csv, etc.)
    raw = buffer.toString('utf-8');
  }

  const cleaned = cleanText(raw);
  if (!cleaned || cleaned.length < 10) {
    throw new Error('Nội dung tài liệu trống hoặc không chứa văn bản có thể nhận diện.');
  }

  return cleaned;
}
