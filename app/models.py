from datetime import date, datetime

from sqlalchemy import DateTime, ForeignKey, UniqueConstraint, func, text
from sqlalchemy.ext.asyncio import AsyncAttrs
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase, AsyncAttrs):
    pass


class User(Base):
    __tablename__ = "users"

    user_id: Mapped[int] = mapped_column(primary_key=True)
    user_name: Mapped[str] = mapped_column(unique=True, nullable=False)
    user_password: Mapped[str] = mapped_column(nullable=False)
    user_email: Mapped[str] = mapped_column(unique=True, nullable=False)
    user_password_is_safe: Mapped[bool] = mapped_column(server_default="false")
    user_email_is_confirm: Mapped[bool] = mapped_column(server_default="false")
    user_tfa_enabled: Mapped[bool] = mapped_column(server_default="false")
    user_is_active: Mapped[bool] = mapped_column(server_default="false")
    user_created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), server_default=func.now(), nullable=True
    )
    user_reg_token: Mapped[str] = mapped_column(nullable=True)
    user_log_token: Mapped[str] = mapped_column(nullable=True)

    tasks: Mapped[list["Task"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    categories: Mapped[list["Category"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class Task(Base):
    __tablename__ = "tasks"

    task_id: Mapped[int] = mapped_column(primary_key=True)
    task_name: Mapped[str] = mapped_column(nullable=False)
    task_text: Mapped[str]
    task_important: Mapped[int] = mapped_column(nullable=False)
    task_date: Mapped[date] = mapped_column(nullable=True)
    task_is_completed: Mapped[str] = mapped_column(
        nullable=False, server_default="false"
    )
    task_is_completed_at: Mapped[date] = mapped_column(nullable=True)
    task_is_special: Mapped[str] = mapped_column(nullable=False, server_default="false")
    task_category_id: Mapped[int] = mapped_column(
        ForeignKey("categories.category_id", ondelete="CASCADE"), nullable=True
    )
    task_user_id: Mapped[int] = mapped_column(ForeignKey("users.user_id"))

    user: Mapped["User"] = relationship(back_populates="tasks")
    category: Mapped["Category"] = relationship(back_populates="tasks")

    __table_args__ = (
        UniqueConstraint("task_name", "task_user_id", name="task_name_user_uc"),
    )


class Category(Base):
    __tablename__ = "categories"

    category_id: Mapped[int] = mapped_column(primary_key=True)
    category_name: Mapped[str] = mapped_column(nullable=False)
    category_color: Mapped[str] = mapped_column(
        nullable=False, server_default="#ef4444"
    )
    category_user_id: Mapped[int] = mapped_column(ForeignKey("users.user_id"))

    user: Mapped["User"] = relationship(back_populates="categories")
    tasks: Mapped[list["Task"]] = relationship(
        back_populates="category", cascade="all, delete"
    )

    __table_args__ = (
        UniqueConstraint(
            "category_name", "category_user_id", name="category_name_user_uc"
        ),
    )


class CheckUser(Base):
    __tablename__ = "check_users"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.user_id"), primary_key=True)
    code: Mapped[int] = mapped_column(nullable=False)
    time_expire: Mapped[datetime] = mapped_column(
        DateTime(timezone=False),
        nullable=False,
        server_default=text("now() + interval '10 minutes'"),
    )
