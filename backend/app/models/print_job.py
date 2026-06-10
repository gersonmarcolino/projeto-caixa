import uuid
from datetime import datetime, timezone
from enum import Enum

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class PrintJobStatus(str, Enum):
    pending = "pending"
    done = "done"
    error = "error"


class PrintJob(Base):
    __tablename__ = "print_jobs"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id: Mapped[str] = mapped_column(String, ForeignKey("tenants.id"), nullable=False)
    sale_id: Mapped[str] = mapped_column(String, ForeignKey("sales.id"), nullable=False)
    payload: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[PrintJobStatus] = mapped_column(String(10), default=PrintJobStatus.pending)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    sale: Mapped["Sale"] = relationship("Sale", back_populates="print_job")
