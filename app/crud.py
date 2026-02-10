import string
from datetime import date, datetime, timedelta

from sqlalchemy import delete, func, or_, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from . import schemas
from .models import Category, CheckUser, Task, User


# -------------------------
# Работа с пользователями
# -------------------------
async def create_user(new_user: schemas.CreateUser, reg_token: str, db: AsyncSession):
    has_digit = any(char.isdigit() for char in new_user.user_password)
    has_lower = any(char.lower() for char in new_user.user_password)
    has_upper = any(char.upper() for char in new_user.user_password)
    has_spec = any(char in string.punctuation for char in new_user.user_password)

    if has_digit and has_lower and has_upper and has_spec:
        password_strong = True
    else:
        password_strong = False

    stmt = User(
        user_name=new_user.user_name,
        user_password=new_user.user_password,
        user_email=new_user.user_email,
        user_password_is_safe=password_strong,
        user_reg_token=reg_token,
    )
    db.add(stmt)
    await db.commit()
    await db.refresh(stmt)
    return stmt


async def get_user(user: schemas.GetUser, db: AsyncSession):
    stmt = select(User).where(
        User.user_email == user.user_email, User.user_password == user.user_password
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def get_user_by_name_or_email(user_name: str, user_email: str, db: AsyncSession):
    # Ищем юзера, у которого совпадает ИЛИ имя, ИЛИ почта
    stmt = select(User).where(
        or_(User.user_name == user_name, User.user_email == user_email)
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def get_user_by_id(user_id: int, db: AsyncSession):
    stmt = select(User).where(User.user_id == user_id)
    result = await db.execute(stmt)
    if not result:
        return None
    else:
        return result.scalar()


async def change_user(
    user_id: str, user_name: str, user_email: str, password: str, db: AsyncSession
):
    stmt = (
        update(User)
        .where(User.user_id == user_id)
        .values(user_name=user_name, user_email=user_email, user_password=password)
    )
    await db.execute(stmt)
    await db.commit()

    return True


async def change_name_email(user_id: int, for_change: dict, db: AsyncSession):
    stmt_check_similar = select(User).where(
        User.user_id != user_id,
        or_(
            User.user_name == for_change["user_name"],
            User.user_email == for_change["user_email"],
        ),
    )
    similar_user = await db.execute(stmt_check_similar)
    similar_user = similar_user.first()
    if similar_user:
        return {"status": False}
    elif not similar_user:
        stmt = (
            update(User)
            .where(User.user_id == user_id)
            .values(
                user_name=for_change["user_name"], user_email=for_change["user_email"]
            )
        )
        await db.execute(stmt)
        await db.commit()

        return {"status": True}


async def change_user_tfa_enabled(user_id: int, tfa_enabled: bool, db: AsyncSession):
    print(f"Передаем {tfa_enabled}")
    if tfa_enabled:
        stmt = (
            update(User).where(User.user_id == user_id).values(user_tfa_enabled=False)
        )
    elif not tfa_enabled:
        stmt = update(User).where(User.user_id == user_id).values(user_tfa_enabled=True)

    print(f"Будет выполняться {stmt}")
    await db.execute(stmt)
    await db.commit()

    return {"status": True}


async def add_log_token(user_id: int, log_token: str, db: AsyncSession):
    stmt = update(User).where(User.user_id == user_id).values(user_log_token=log_token)
    try:
        await db.execute(stmt)
        await db.commit()
        return True
    except Exception:
        print("Произошла ошибка на моменте добавления log_token")
        return False


# -------------------------
# Работа с тасками
# -------------------------
async def create_task(new_task: schemas.CreateTask, db: AsyncSession):
    stmt = Task(**new_task)
    db.add(stmt)
    await db.commit()
    await db.refresh(stmt, attribute_names=["category"])

    return stmt


async def get_tasks(user_id: int, db: AsyncSession):
    stmt = (
        select(Task)
        .options(selectinload(Task.category))
        .where(Task.task_user_id == user_id)
        .order_by(
            Task.task_is_completed, Task.task_is_special.desc(), Task.task_id.desc()
        )
    )
    tasks = await db.execute(stmt)

    return tasks.scalars().all()


# Получение инфы о тасках для боковых системных категорий
async def get_all_today_tasks(user_id: int, task_date: date, db: AsyncSession):
    stmt = (
        select(Task)
        .options(selectinload(Task.category))
        .where(Task.task_date == task_date, Task.task_user_id == user_id)
        .order_by(
            Task.task_is_completed, Task.task_is_special.desc(), Task.task_id.desc()
        )
    )
    tasks = await db.execute(stmt)

    return tasks.scalars().all()


async def get_all_special_tasks(user_id: int, db: AsyncSession):
    stmt = (
        select(Task)
        .options(selectinload(Task.category))
        .where(Task.task_is_special == "true", Task.task_user_id == user_id)
        .order_by(Task.task_is_completed, Task.task_id.desc())
    )
    tasks = await db.execute(stmt)

    return tasks.scalars().all()


async def get_all_completed_tasks(user_id: int, db: AsyncSession):
    stmt = (
        select(Task)
        .options(selectinload(Task.category))
        .where(Task.task_user_id == user_id, Task.task_is_completed == "true")
        .order_by(Task.task_is_special.desc(), Task.task_id.desc())
    )
    tasks = await db.execute(stmt)

    return tasks.scalars().all()


async def get_tasks_by_category(user_id: int, category_id: int, db: AsyncSession):
    stmt = (
        select(Task)
        .options(selectinload(Task.category))
        .where(Task.task_category_id == category_id, Task.task_user_id == user_id)
        .order_by(
            Task.task_is_completed, Task.task_is_special.desc(), Task.task_id.desc()
        )
    )
    tasks = await db.execute(stmt)

    return tasks.scalars().all()


# Получение статистики о тасках для отрисовки табличек информации
async def get_stats(today_date: date, user_id: int, db: AsyncSession):
    stmt_all_tasks = select(func.count(Task.task_id)).where(
        Task.task_user_id == user_id
    )
    stmt_not_completed_tasks = select(func.count(Task.task_id)).where(
        Task.task_user_id == user_id, Task.task_is_completed == "false"
    )
    stmt_special_tasks = select(func.count(Task.task_id)).where(
        Task.task_user_id == user_id, Task.task_is_special == "true"
    )
    stmt_completed_tasks = select(func.count(Task.task_id)).where(
        Task.task_user_id == user_id, Task.task_is_completed == "true"
    )
    stmt_all_today_tasks = select(func.count(Task.task_id)).where(
        Task.task_user_id == user_id, Task.task_date == today_date
    )

    all_tasks = await db.execute(stmt_all_tasks)
    not_completed_tasks = await db.execute(stmt_not_completed_tasks)
    special_tasks = await db.execute(stmt_special_tasks)
    completed_tasks = await db.execute(stmt_completed_tasks)
    all_today_tasks = await db.execute(stmt_all_today_tasks)

    return {
        "total": all_tasks.scalar(),
        "in_progress": not_completed_tasks.scalar(),
        "important": special_tasks.scalar(),
        "completed": completed_tasks.scalar(),
        "today": all_today_tasks.scalar(),
    }


# Работа с тасками на прямую
async def change_task_completed(task_id: int, db: AsyncSession):
    stmt = select(Task).where(Task.task_id == task_id)
    task = await db.execute(stmt)
    task = task.scalar()

    if task.task_is_completed == "false":
        task.task_is_completed = "true"
        task.task_is_completed_at = date.today()
        await db.commit()
        await db.refresh(task)
    elif task.task_is_completed == "true":
        task.task_is_completed = "false"
        task.task_is_completed_at = None
        await db.commit()
        await db.refresh(task)

    return task


async def change_task_is_special(task_id: int, db: AsyncSession):
    stmt = select(Task).where(Task.task_id == task_id)
    task = await db.execute(stmt)
    task = task.scalar()

    if task.task_is_special == "false":
        task.task_is_special = "true"
        await db.commit()
        await db.refresh(task)
    elif task.task_is_special == "true":
        task.task_is_special = "false"
        await db.commit()
        await db.refresh(task)

    return task


async def delete_task(task_id: int, db: AsyncSession):
    stmt = delete(Task).where(Task.task_id == task_id)
    await db.execute(stmt)
    await db.commit()

    return {"status": "ok"}


# Получение инфы о тасках для личного кабинета
async def get_streak_info(user_id: int, db: AsyncSession):
    stmt = (
        select(Task)
        .where(Task.task_user_id == user_id, Task.task_is_completed == "true")
        .distinct()
        .order_by(Task.task_is_completed_at.desc())
    )
    tasks = await db.execute(stmt)
    tasks = tasks.scalars().all()

    completed_dates = [task.task_is_completed_at for task in tasks]

    if not completed_dates:
        return 0

    today = date.today()
    yesterday = date.today() - timedelta(days=1)
    print(f"Сегодняшняя дата: {today}")
    print(f"Вчерашняя дата: {yesterday}")
    print(f"Список дат: {completed_dates}")
    if completed_dates[0] not in [today, yesterday]:
        print("Нет сегодняшних и вчерашних выполненных таск")
        return 0

    streak = 0
    current_check = completed_dates[0]

    for d in completed_dates:
        if d == current_check:
            streak += 1
            current_check -= timedelta(days=1)
        else:
            break

    return streak


async def get_total_tasks_info(user_id: int, db: AsyncSession):
    stmt = select(func.count(Task.task_id)).where(
        Task.task_user_id == user_id, Task.task_is_completed == "true"
    )
    count = await db.execute(stmt)

    return count.scalar()


# -------------------------
# Работа с категориями
# -------------------------
async def create_category(new_category: schemas.CreateCategory, db: AsyncSession):
    stmt = Category(
        category_name=new_category.category_name,
        category_user_id=new_category.category_user_id,
        category_color=new_category.category_color,
    )
    db.add(stmt)
    await db.commit()
    await db.refresh(stmt)

    return stmt


async def get_categories(user_id: int, db: AsyncSession):
    stmt = select(Category).where(Category.category_user_id == user_id)
    categories = await db.execute(stmt)

    return categories.scalars().all()


async def delete_category(category_id: int, db: AsyncSession):
    stmt = delete(Category).where(Category.category_id == category_id)

    try:
        await db.execute(stmt)
        await db.commit()
    except Exception as e:
        print(f"ОШИБКА БАЗЫ: {e}")  # Посмотри, что напишет в консоль
        await db.rollback()  # Обязательно откатываем, если что-то пошло не так
        return {"status": "error", "detail": str(e)}

    return {"status": "ok"}


# -------------------------
# Работа с паролями и почтой
# -------------------------
async def change_password(
    user_id: int,
    old_password: str,
    new_password: str,
    password_strong: bool,
    db: AsyncSession,
):
    stmt = select(User).where(
        User.user_id == user_id, User.user_password == old_password
    )
    check_user_password = await db.execute(stmt)
    check_user_password = check_user_password.scalar_one_or_none()

    if not check_user_password:
        return {"error": "Uncorrect old password"}

    stmt_change_password = (
        update(User)
        .where(User.user_id == user_id, User.user_password == old_password)
        .values(user_password=new_password, user_password_is_safe=password_strong)
    )
    await db.execute(stmt_change_password)
    await db.commit()

    return {"status": "ok"}


async def add_user_to_check_user(user_id: int, code: int, db: AsyncSession):
    stmt = CheckUser(user_id=user_id, code=code)

    db.add(stmt)
    await db.commit()
    print("Пользователь был добавлен в CheckUser")
    return {"status": True}


async def change_check_code(user_id: int, code: int, db: AsyncSession):
    stmt = (
        update(CheckUser)
        .where(CheckUser.user_id == user_id)
        .values(code=code, time_expire=func.now() + text("interval '10 minutes'"))
    )
    await db.execute(stmt)
    await db.commit()

    return True


async def check_user_email(
    user_id: int, confirm_at: datetime, code: int, db: AsyncSession
):
    stmt = select(CheckUser).where(CheckUser.user_id == user_id)
    user = await db.execute(stmt)
    user = user.scalar()

    if not user:
        return False

    if (user.code == code) and (user.time_expire > confirm_at):
        stmt_update = (
            update(User)
            .where(CheckUser.user_id == user_id)
            .values(user_email_is_confirm=True, user_is_active=True)
        )
        stmt_delete_from_check_user = delete(CheckUser).where(
            CheckUser.user_id == user_id
        )

        await db.execute(stmt_update)
        await db.execute(stmt_delete_from_check_user)

        await db.commit()

        return {"status": True}
    else:
        print("Непонятно что случилось")
        print(f"Время выхода работы кода: {user.time_expire}")
        print(f"Наше время: {confirm_at}")
        return {"status": False}


async def check_code_expire(user_id: int, db: AsyncSession):
    stmt = select(CheckUser).where(user_id == user_id)
    check_code = await db.execute(stmt)
    check_code = check_code.scalar()

    if check_code and check_code.time_expire > datetime.now():
        return {"status": True}
    elif check_code and check_code.time_expire < datetime.now():
        return {"status": False}
    else:
        return {"status": False}


async def delete_from_check_user(user_id: int, db: AsyncSession):
    stmt = delete(CheckUser).where(CheckUser.user_id == user_id)

    await db.execute(stmt)
    await db.commit()

    return True


# -------------------------
# Чистка мертвых записей
# -------------------------
async def clear_db(db: AsyncSession):
    present_time = datetime.now()
    print(present_time)
    delete_clear_check_user = delete(CheckUser).where(
        CheckUser.time_expire + timedelta(days=1) <= present_time
    )

    await db.execute(delete_clear_check_user)
    await db.commit()

    delete_clear_user = delete(User).where(
        User.user_created_at + timedelta(days=1) <= present_time,
        User.user_is_active == False,  # noqa: E712
    )

    await db.execute(delete_clear_user)
    await db.commit()
