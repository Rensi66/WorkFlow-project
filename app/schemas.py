from datetime import date
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field


# -------------------------
# Схемы для пользователей
# -------------------------
class CreateUser(BaseModel):
    user_name: str = Field(min_length=2, max_length=32)
    user_password: str = Field(min_length=8)
    user_email: EmailStr

    model_config = ConfigDict(from_attributes=True)


class GetUser(BaseModel):
    user_email: EmailStr
    user_password: str

    model_config = ConfigDict(from_attributes=True)


class PasswordChange(BaseModel):
    old_password: str
    new_password: str


class ConfirmEmail(BaseModel):
    code: int


# -------------------------
# Схемы для таск
# -------------------------
class CreateTask(BaseModel):
    task_name: str
    task_text: str | None
    task_important: int
    task_date: Optional[date] | None = None
    task_category_id: Optional[int] | None = None


# -------------------------
# Схемы для категорий
# -------------------------
class CreateCategory(BaseModel):
    category_name: str
    category_user_id: int | None = None
    category_color: str | None = None
