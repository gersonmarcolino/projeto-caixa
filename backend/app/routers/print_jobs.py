from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.print_job import PrintJob, PrintJobStatus
from app.models.user import User
from pydantic import BaseModel

router = APIRouter(prefix="/print-jobs", tags=["print-jobs"])


class PrintJobOut(BaseModel):
    id: str
    sale_id: str
    payload: str
    status: PrintJobStatus

    model_config = {"from_attributes": True}


@router.get("/pending", response_model=list[PrintJobOut])
def list_pending(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(PrintJob).filter(
        PrintJob.tenant_id == current_user.tenant_id,
        PrintJob.status == PrintJobStatus.pending,
    ).all()


@router.patch("/{job_id}/done", status_code=204)
def mark_done(job_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    job = db.query(PrintJob).filter(
        PrintJob.id == job_id,
        PrintJob.tenant_id == current_user.tenant_id,
    ).first()
    if job:
        job.status = PrintJobStatus.done
        db.commit()
