from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.document import Document
from app.models.quiz import Quiz, Question, QuizAttempt, QuizAnswer
from app.schemas.quiz import (
    QuizGenerateRequest, QuizItem, QuizDetailResponse,
    QuizSubmitRequest, QuizSubmitResponse, QuizAttemptItem, QuestionItem
)
from app.services.auth_service import get_current_user
from app.services.quiz_service import generate_quiz_with_ai

router = APIRouter(prefix="/quizzes", tags=["Quiz Engine"])

@router.post("/generate", status_code=status.HTTP_201_CREATED)
def generate_quiz(
    payload: QuizGenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        res = generate_quiz_with_ai(
            db=db,
            document_id=payload.document_id,
            user_id=current_user.id,
            difficulty=payload.difficulty or "medium",
            question_count=payload.question_count or 5,
            custom_topic=payload.custom_topic
        )
        return {
            "status": "success",
            "message": f"Tạo thành công bộ đề trắc nghiệm với {len(res['questions'])} câu hỏi!",
            "data": {
                "quiz": res["quiz"],
                "questions": res["questions"]
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("", response_model=List[QuizItem])
def list_quizzes(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    quizzes = db.query(Quiz).filter(Quiz.user_id == current_user.id).order_by(Quiz.created_at.desc()).all()
    results = []
    for q in quizzes:
        doc = db.query(Document).filter(Document.id == q.document_id).first()
        attempts = db.query(QuizAttempt).filter(QuizAttempt.quiz_id == q.id, QuizAttempt.user_id == current_user.id).all()
        best_score = max([a.score for a in attempts]) if attempts else None
        last_attempt = max([a.completed_at for a in attempts]) if attempts else None
        
        results.append(QuizItem(
            id=q.id,
            document_id=q.document_id,
            title=q.title,
            difficulty=q.difficulty,
            total_questions=q.total_questions,
            created_at=q.created_at,
            document_title=doc.title if doc else None,
            subject=doc.subject if doc else None,
            attempts_count=len(attempts),
            best_score=best_score,
            last_attempt_at=last_attempt
        ))
    return results

@router.get("/{quiz_id}")
def get_quiz_detail(
    quiz_id: str,
    mode: Optional[str] = Query("take"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id, Quiz.user_id == current_user.id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài quiz.")

    doc = db.query(Document).filter(Document.id == quiz.document_id).first()
    questions = db.query(Question).filter(Question.quiz_id == quiz_id).all()
    is_review = mode == "review"

    question_list = []
    for q in questions:
        item = {
            "id": q.id,
            "quiz_id": q.quiz_id,
            "question_text": q.question_text,
            "option_a": q.option_a,
            "option_b": q.option_b,
            "option_c": q.option_c,
            "option_d": q.option_d,
        }
        if is_review:
            item["correct_ans"] = q.correct_ans
            item["explanation"] = q.explanation
        question_list.append(item)

    attempts_count = db.query(QuizAttempt).filter(QuizAttempt.quiz_id == quiz_id, QuizAttempt.user_id == current_user.id).count()

    return {
        "status": "success",
        "data": {
            "quiz": {
                "id": quiz.id,
                "document_id": quiz.document_id,
                "title": quiz.title,
                "difficulty": quiz.difficulty,
                "total_questions": quiz.total_questions,
                "created_at": quiz.created_at,
                "document_title": doc.title if doc else None,
                "subject": doc.subject if doc else None
            },
            "questions": question_list,
            "previous_attempts_count": attempts_count
        }
    }

@router.post("/{quiz_id}/submit")
def submit_quiz(
    quiz_id: str,
    payload: QuizSubmitRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id, Quiz.user_id == current_user.id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài quiz.")

    questions = db.query(Question).filter(Question.quiz_id == quiz_id).all()
    ans_map = {a.question_id: a.selected_option.upper() for a in payload.answers}

    correct_count = 0
    results = []

    for q in questions:
        selected = ans_map.get(q.id, "")
        is_correct = selected == q.correct_ans.upper()
        if is_correct:
            correct_count += 1
        results.append({
            "question_id": q.id,
            "question_text": q.question_text,
            "option_a": q.option_a,
            "option_b": q.option_b,
            "option_c": q.option_c,
            "option_d": q.option_d,
            "selected_option": selected,
            "correct_ans": q.correct_ans,
            "is_correct": is_correct,
            "explanation": q.explanation
        })

    score = round((correct_count / len(questions)) * 100, 1) if questions else 0.0

    attempt = QuizAttempt(
        quiz_id=quiz.id,
        user_id=current_user.id,
        score=score,
        correct_count=correct_count,
        total_questions=len(questions),
        time_spent_sec=payload.time_spent_sec or 0
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)

    for r in results:
        qa = QuizAnswer(
            attempt_id=attempt.id,
            question_id=r["question_id"],
            selected_option=r["selected_option"],
            is_correct=r["is_correct"]
        )
        db.add(qa)
    db.commit()

    rank = "Xuất sắc" if score >= 90 else ("Giỏi" if score >= 80 else ("Khá" if score >= 65 else "Cần nỗ lực"))

    return {
        "status": "success",
        "data": {
            "attempt": {
                "id": attempt.id,
                "quiz_id": attempt.quiz_id,
                "score": attempt.score,
                "correct_count": attempt.correct_count,
                "total_questions": attempt.total_questions,
                "time_spent_sec": attempt.time_spent_sec,
                "completed_at": attempt.completed_at,
                "rank": rank
            },
            "weakness_analysis": {
                "weakness_summary": f"Đúng {correct_count}/{len(questions)} câu.",
                "recommended_review_topics": [r["question_text"][:50] for r in results if not r["is_correct"]],
                "encouragement": "Tiếp tục phát huy phong độ học tập nhé!"
            },
            "results": results
        }
    }
