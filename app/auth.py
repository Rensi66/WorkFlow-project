import uuid
from datetime import datetime, timedelta, timezone

import jwt
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from .config import settings
from .models import User


def create_token(data: dict):
    to_encode = data.copy()

    expire = datetime.now(timezone.utc) + timedelta(
        minutes=int(settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})

    token = jwt.encode(to_encode, settings.SECRET_KEY, settings.ALGORITHM)
    token = f"Bearer {token}"
    return token


async def get_user_by_token(encode_token: str, db: AsyncSession):
    if not encode_token:
        return None

    try:
        clear_encode_token = encode_token.replace("Bearer", "").strip()
        payloads = jwt.decode(
            clear_encode_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )

        stmt = select(User).where(User.user_id == payloads["user_id"])
        user = await db.execute(stmt)

        return user.scalar()

    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None
    except Exception:
        return None


def create_register_token(data: dict):
    to_encode = data.copy()

    to_encode["uuid"] = str(uuid.uuid4())

    token = jwt.encode(to_encode, settings.SECRET_KEY, settings.ALGORITHM)
    token = f"Bearer {token}"

    return token


async def change_reg_token(user_id: int, reg_token: str, db: AsyncSession):
    stmt = update(User).where(User.user_id == user_id).values(user_reg_token=reg_token)
    await db.execute(stmt)
    await db.commit()

    return True


async def get_info_from_log_token(encode_log_token: str, db: AsyncSession):
    encode_log_token = encode_log_token.replace("Bearer", "").strip()
    print(encode_log_token)

    payload = jwt.decode(
        encode_log_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
    )

    stmt = select(User).where(User.user_id == payload["user_id"])

    user = await db.execute(stmt)

    return user.scalar()
