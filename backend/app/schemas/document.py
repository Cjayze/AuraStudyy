from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel

class DocumentBase(BaseModel):
    title: str
    subject: str = "Chung"

class DocumentCreate(DocumentBase):
    pass

class ChunkResponse(BaseModel):
    id: str
    chunk_index: number = 0
    content: str
    char_count: int

    class Config:
        from_attributes = True

class DocumentResponse(DocumentBase):
    id: str
    file_name: str
    file_type: str
    file_size: int
    status: str
    chunks_count: Optional[int] = 0
    created_at: datetime

    class Config:
        from_attributes = True

class DocumentDetailResponse(DocumentResponse):
    sample_chunks: List[ChunkResponse] = []
