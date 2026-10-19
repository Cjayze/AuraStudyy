import os
import re
from typing import List, Dict, Any
import pypdf
import docx

def clean_text(text: str) -> str:
    if not text:
        return ""
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()

def split_text_into_chunks(text: str, chunk_size: int = 600, overlap: int = 100) -> List[Dict[str, Any]]:
    cleaned = clean_text(text)
    if not cleaned:
        return []
    
    chunks = []
    start = 0
    idx = 0
    total_len = len(cleaned)

    while start < total_len:
        end = min(start + chunk_size, total_len)
        if end < total_len:
            # Try to break on punctuation
            last_period = max(cleaned.rfind(". ", start, end), cleaned.rfind("\n", start, end))
            if last_period > start + chunk_size - 150:
                end = last_period + 1
        
        chunk_content = cleaned[start:end].strip()
        if len(chunk_content) > 20:
            chunks.append({
                "chunk_index": idx,
                "content": chunk_content,
                "char_count": len(chunk_content)
            })
            idx += 1
        
        if end >= total_len:
            break
        start = max(end - overlap, start + 1)
        
    return chunks

def extract_text_from_file_bytes(file_bytes: bytes, file_ext: str) -> str:
    ext = file_ext.lower().replace(".", "")
    if ext == "pdf":
        import io
        reader = pypdf.PdfReader(io.BytesIO(file_bytes))
        pages_text = [page.extract_text() or "" for page in reader.pages]
        return "\n\n".join(pages_text)
    elif ext == "docx":
        import io
        doc = docx.Document(io.BytesIO(file_bytes))
        paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
        return "\n\n".join(paragraphs)
    else:
        return file_bytes.decode("utf-8", errors="ignore")
