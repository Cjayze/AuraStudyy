import math
import re
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.config import settings
from app.models.document import Document, DocumentChunk

# Initialize Gemini Client for Python if google-genai is installed and key is set
gemini_client = None
try:
    if settings.GEMINI_API_KEY:
        from google import genai
        gemini_client = genai.Client(api_key=settings.GEMINI_API_KEY)
except Exception:
    pass

def tokenize(text: str) -> List[str]:
    cleaned = re.sub(r"[^\w\s]", " ", text.lower())
    return [w for w in cleaned.split() if len(w) > 1]

def search_relevant_chunks(
    db: Session,
    query: str,
    document_id: Optional[str] = None,
    user_id: Optional[str] = None,
    top_k: int = 4
) -> List[Dict[str, Any]]:
    query_db = db.query(DocumentChunk).join(Document)
    if document_id:
        query_db = query_db.filter(DocumentChunk.document_id == document_id)
    elif user_id:
        query_db = query_db.filter(Document.user_id == user_id)
    
    chunks = query_db.all()
    if not chunks:
        return []

    q_tokens = tokenize(query)
    q_set = set(q_tokens)

    scored = []
    for c in chunks:
        c_tokens = tokenize(c.content)
        if not c_tokens:
            continue
        c_set = set(c_tokens)

        # Token overlap ratio
        intersection = q_set.intersection(c_set)
        score = len(intersection) / (len(q_set) + 1e-5)

        # Exact substring boost
        if query.lower() in c.content.lower():
            score += 0.35

        if score > 0.05:
            doc = db.query(Document).filter(Document.id == c.document_id).first()
            scored.append({
                "chunk_id": c.id,
                "document_id": c.document_id,
                "document_title": doc.title if doc else "Tài liệu",
                "chunk_index": c.chunk_index,
                "content": c.content,
                "score": round(min(score, 1.0), 2)
            })

    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:top_k]

def generate_rag_answer(
    db: Session,
    question: str,
    document_id: Optional[str] = None,
    user_id: Optional[str] = None
) -> Dict[str, Any]:
    relevant_chunks = search_relevant_chunks(db, query=question, document_id=document_id, user_id=user_id, top_k=4)

    context_parts = []
    for idx, c in enumerate(relevant_chunks):
        context_parts.append(
            f"--- [NGUỒN #{idx+1} | {c['document_title']} | Đoạn {c['chunk_index']+1}] ---\n{c['content']}"
        )
    context_text = "\n\n".join(context_parts) if context_parts else "Không tìm thấy đoạn trích xuất phù hợp."

    system_instruction = (
        "Bạn là Aura AI – Trợ lý học tập thông minh thuộc hệ sinh thái giáo dục AuraStudy.\n"
        "QUY TẮC CỐT LÕI (CHỐNG ẢO GIÁC):\n"
        "1. Chỉ trả lời dựa vào các đoạn trích dẫn (Context) được cung cấp. Không tự ý bịa đặt thông tin.\n"
        "2. Nếu tài liệu không chứa câu trả lời, hãy thông báo: 'Xin lỗi bạn, nội dung tài liệu hiện tại không đề cập đến thông tin này.'\n"
        "3. Trích dẫn rõ nguồn từ [Đoạn X] hoặc [Tài liệu: ...] để sinh viên đối chiếu.\n"
        "4. Trình bày thân thiện, mạch lạc, dùng Markdown."
    )

    prompt = f"CÂU HỎI: {question}\n\nCONTEXT:\n{context_text}\n\nHãy trả lời câu hỏi trên."

    answer = ""
    if gemini_client:
        try:
            res = gemini_client.models.generate_content(
                model="gemini-3.8-flash",
                contents=prompt,
                config={"system_instruction": system_instruction, "temperature": 0.3}
            )
            answer = res.text or ""
        except Exception:
            pass

    if not answer:
        if relevant_chunks:
            best = relevant_chunks[0]
            answer = f"Dựa trên tài liệu **{best['document_title']}** (Đoạn {best['chunk_index']+1}):\n\n{best['content']}"
        else:
            answer = f"Xin lỗi bạn, tài liệu hiện tại không tìm thấy thông tin phù hợp với câu hỏi '{question}'."

    return {
        "answer": answer,
        "sources": relevant_chunks
    }
