import os
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.config import settings
from app.models.user import User
from app.models.document import Document, DocumentChunk
from app.schemas.document import DocumentResponse, DocumentDetailResponse
from app.services.auth_service import get_current_user
from app.services.document_service import extract_text_from_file_bytes, split_text_into_chunks

router = APIRouter(prefix="/documents", tags=["Documents"])

@router.get("", response_model=List[DocumentResponse])
def list_documents(
    subject: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Document).filter(Document.user_id == current_user.id)
    if subject:
        query = query.filter(Document.subject.ilike(f"%{subject}%"))
    if search:
        query = query.filter(
            (Document.title.ilike(f"%{search}%")) | (Document.file_name.ilike(f"%{search}%"))
        )
    docs = query.order_by(Document.created_at.desc()).all()
    
    # Enrich with chunks count
    results = []
    for d in docs:
        c_count = db.query(DocumentChunk).filter(DocumentChunk.document_id == d.id).count()
        results.append(DocumentResponse(
            id=d.id,
            title=d.title,
            subject=d.subject,
            file_name=d.file_name,
            file_type=d.file_type,
            file_size=d.file_size,
            status=d.status,
            chunks_count=c_count,
            created_at=d.created_at
        ))
    return results

@router.post("/upload", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    subject: Optional[str] = Form("Chung"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    file_bytes = await file.read()
    file_ext = os.path.splitext(file.filename)[1].lower().replace(".", "")

    if file_ext not in ["pdf", "docx", "txt"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Chỉ hỗ trợ tải lên các tệp .pdf, .docx, .txt."
        )

    doc_title = title if title and title.strip() else os.path.splitext(file.filename)[0]
    
    # Save file on disk
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    file_path = os.path.join(settings.UPLOAD_DIR, f"{current_user.id}_{file.filename}")
    with open(file_path, "wb") as f:
        f.write(file_bytes)

    # Ingestion & Chunking
    raw_text = extract_text_from_file_bytes(file_bytes, file_ext)
    chunks_data = split_text_into_chunks(raw_text, 600, 100)

    new_doc = Document(
        user_id=current_user.id,
        title=doc_title,
        subject=subject or "Chung",
        file_name=file.filename,
        file_type=file_ext,
        file_size=len(file_bytes),
        file_path=file_path,
        status="ready"
    )
    db.add(new_doc)
    db.commit()
    db.refresh(new_doc)

    # Save chunks
    for ch in chunks_data:
        chunk_obj = DocumentChunk(
            document_id=new_doc.id,
            chunk_index=ch["chunk_index"],
            content=ch["content"],
            char_count=ch["char_count"]
        )
        db.add(chunk_obj)
    db.commit()

    return DocumentResponse(
        id=new_doc.id,
        title=new_doc.title,
        subject=new_doc.subject,
        file_name=new_doc.file_name,
        file_type=new_doc.file_type,
        file_size=new_doc.file_size,
        status=new_doc.status,
        chunks_count=len(chunks_data),
        created_at=new_doc.created_at
    )

@router.delete("/{document_id}")
def delete_document(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    doc = db.query(Document).filter(Document.id == document_id, Document.user_id == current_user.id).first()
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tài liệu không tồn tại hoặc bạn không có quyền xóa."
        )
    
    if os.path.exists(doc.file_path):
        try:
            os.remove(doc.file_path)
        except OSError:
            pass

    db.delete(doc)
    db.commit()
    return {"status": "success", "message": "Đã xóa tài liệu và các đoạn chunks thành công."}
