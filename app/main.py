import random
import string
from contextlib import asynccontextmanager
from datetime import date, datetime
from email.message import EmailMessage


import aiosmtplib
from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy.ext.asyncio import AsyncSession

from . import crud, schemas
from .auth import (
    change_reg_token,
    create_register_token,
    create_token,
    get_info_from_log_token,
    get_user_by_token,
)
from .database import get_db, session_maker
from .config import settings


# -------------------------
# Чистка мертвых записей
# -------------------------
@asynccontextmanager
async def lifespan(api: FastAPI):
    print("Запуск проекта и чистка бд от записей")
    async with session_maker() as db:
        await crud.clear_db(db=db)

    yield

    print("Завершение работы проекта")


app = FastAPI(lifespan=lifespan)

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")


async def send_code_to_email(email_to: str, code: int):
    try:
        message = EmailMessage()
        message["From"] =settings.EMAIL
        message["To"] = email_to
        message["Subject"] = "Код подтверждения WorkFlow"
        message.set_content(f"Ваш код подтверждения: {code}. Он действует 10 минут.")
        print(message)

        await aiosmtplib.send(
            message,
            hostname="smtp.gmail.com",
            port=465,
            use_tls=True,
            username=settings.EMAIL,
            password=settings.EMAIL_PASSWORD,
        )
        print("Письмо отправилось")

        return {"status": True}
    except Exception as e:
        print(f"Ошибка: {e}")
        return {"status": False}


# -------------------------
# Страница регистрации в WorkFlow
# -------------------------
@app.get("/workflow/register")
async def get_register_page():
    return FileResponse("templates/register.html")


@app.post("/api/register")
async def create_user(
    new_user: schemas.CreateUser,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    check_user_exist = await crud.get_user_by_name_or_email(
        user_name=new_user.user_name, user_email=new_user.user_email, db=db
    )

    if check_user_exist and check_user_exist.user_is_active:
        print("ТАКОГО ПОЛЬЗОВАТЕЛЯ НЕТ")
        raise HTTPException(
            status_code=401, detail="Пользователь с такой почтой или именем существует"
        )
    elif check_user_exist and not check_user_exist.user_is_active:
        print("ТАКОЙ ПОЛЬЗОВАТЕЛЬ ЕСТЬ")
        try:
            get_reg_token = request.cookies["reg_token"]

            if get_reg_token != check_user_exist.user_reg_token:
                raise HTTPException(
                    status_code=401,
                    detail="Пользователь с такой почтой или именем существует",
                )
            elif get_reg_token == check_user_exist.user_reg_token:
                change_name = await crud.change_user(
                    user_id=check_user_exist.user_id,
                    user_name=new_user.user_name,
                    password=new_user.user_password,
                    user_email=new_user.user_email,
                    db=db,
                )
                if change_name:
                    reg_token = create_register_token(
                        data={"user_name": new_user.user_name}
                    )
                    response.set_cookie("reg_token", value=reg_token, httponly=True)
                    changed_reg_token = await change_reg_token(
                        user_id=check_user_exist.user_id, reg_token=reg_token, db=db
                    )

                    if changed_reg_token:
                        code_work = await crud.check_code_expire(
                            user_id=check_user_exist.user_id, db=db
                        )

                        if code_work["status"]:
                            print("Код еще действует")
                            return {"status": "ok"}
                        elif not code_work["status"]:
                            code = random.randint(100000, 999999)
                            send_email = await send_code_to_email(
                                email_to=check_user_exist.user_email, code=code
                            )

                            check_user_update = await crud.change_check_code(
                                user_id=check_user_exist.user_id, code=code, db=db
                            )

                            if check_user_update:
                                return {"status": "ok"}

        except KeyError:
            print("reg_token не существует")
            raise HTTPException(
                status_code=401,
                detail="Пользователь с такой почтой или именем существует",
            )

    reg_token = create_register_token(data={"user_name": new_user.user_name})
    response.set_cookie("reg_token", value=reg_token, httponly=True)

    user = await crud.create_user(new_user=new_user, reg_token=reg_token, db=db)

    code = random.randint(100000, 999999)
    send_email = await send_code_to_email(email_to=new_user.user_email, code=code)
    print(send_email)

    if send_email["status"]:
        result = await crud.add_user_to_check_user(
            user_id=user.user_id, code=code, db=db
        )

        if result["status"]:
            token = create_token(
                data={"user_name": user.user_name, "user_id": user.user_id}
            )
            response.set_cookie("access_token", value=token, httponly=True)

            return {"status": "ok"}
        else:
            return {"status": False}
    else:
        return {"status": False}


@app.post("/api/confirm_email")
async def confirm_email(
    response: Response,
    request: Request,
    confirm_info: schemas.ConfirmEmail,
    db: AsyncSession = Depends(get_db),
):
    confirm_at = datetime.now()

    log_token = request.cookies.get("log_token")
    if log_token:
        user = await get_info_from_log_token(encode_log_token=log_token, db=db)
        if user.user_log_token != log_token:
            return HTTPException(
                status_code=401, detail="Вы пытаетесь войти не в свой аккаунт"
            )
        if user.user_log_token == log_token:
            print(
                "log_token пользователя и log_token из бд совпали, это тот пользователь"
            )
    elif not log_token:
        token = request.cookies.get("access_token")
        if not token:
            return RedirectResponse("/workflow/login")

        user = await get_user_by_token(encode_token=token, db=db)

        if not user:
            return RedirectResponse("/workflow/login")

    is_confirm = await crud.check_user_email(
        user_id=user.user_id, confirm_at=confirm_at, code=confirm_info.code, db=db
    )
    print("Почта подтверждена")
    print(is_confirm)

    if not is_confirm:
        raise HTTPException(
            status_code=401, detail="Произошла ошибка. Попробуйте войти снова!"
        )
    elif not is_confirm["status"]:
        raise HTTPException(status_code=401, detail="Неправильный код!")
    else:
        if not request.cookies.get("access_token"):
            token = create_token(
                data={"user_name": user.user_name, "user_id": user.user_id}
            )
            response.set_cookie("access_token", value=token, httponly=True)
            response.delete_cookie(key="log_token")
        return {"status": True}


# -------------------------
# Страница логина в WorkFlow
# -------------------------
@app.get("/workflow/login")
async def get_login_page():
    return FileResponse("templates/login.html")


@app.post("/api/login")
async def login_user(
    user: schemas.GetUser,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    user = await crud.get_user(user=user, db=db)

    if not user:
        raise HTTPException(
            status_code=401, detail="Пользователь не найден или пароль не верный"
        )
    elif not user.user_is_active:
        raise HTTPException(
            status_code=401, detail="Регистрация не завершена. Зарегистрируйтесь снова"
        )
    elif user.user_tfa_enabled:
        code_work = await crud.check_code_expire(user_id=user.user_id, db=db)

        if code_work["status"]:
            print("Код для логирования все еще действует, можно использовать")
        elif not code_work["status"]:
            await crud.delete_from_check_user(user_id=user.user_id, db=db)
            code = random.randint(100000, 999999)
            send_code = await send_code_to_email(email_to=user.user_email, code=code)  # noqa: F841
            add_to_check_user = await crud.add_user_to_check_user(  # noqa: F841
                user_id=user.user_id,
                code=code,  # noqa: F841
                db=db,
            )

        log_token = request.cookies.get("log_token")

        if not log_token:
            log_token = create_register_token(
                data={"user_name": user.user_name, "user_id": user.user_id}
            )
            response.set_cookie("log_token", value=log_token, httponly=True)
            add_log_token = await crud.add_log_token(
                user_id=user.user_id, log_token=log_token, db=db
            )
            if add_log_token:
                return {"status": "ok", "long_check": True}
            elif not add_log_token:
                raise HTTPException(
                    status_code=422, detail="Произошла ошибка с добавлением log_token"
                )
        elif log_token:
            return {"status": "ok", "long_check": True}

    token = create_token(data={"user_name": user.user_name, "user_id": user.user_id})
    response.set_cookie("access_token", value=token, httponly=True)

    return {"status": "ok", "long_check": False}


# -------------------------
# Главная форма WorkFlow
# -------------------------
@app.get("/workflow")
async def get_work_flow_page(request: Request, db: AsyncSession = Depends(get_db)):
    token = request.cookies.get("access_token")
    if not token:
        return RedirectResponse("/workflow/login")

    user = await get_user_by_token(encode_token=token, db=db)
    if not user or not user.user_is_active:
        return RedirectResponse("/workflow/login")

    categories = await crud.get_categories(user_id=user.user_id, db=db)
    tasks = await crud.get_tasks(user_id=user.user_id, db=db)

    return templates.TemplateResponse(
        "workflow.html", {"request": request, "categories": categories, "tasks": tasks}
    )


# Работа с тасками
@app.post("/api/create_task")
async def create_task(
    request: Request, task: schemas.CreateTask, db: AsyncSession = Depends(get_db)
):
    token = request.cookies.get("access_token")
    user = await get_user_by_token(encode_token=token, db=db)

    new_task = task.model_dump()
    new_task.update({"task_user_id": user.user_id})

    created_task = await crud.create_task(new_task=new_task, db=db)

    if not created_task:
        raise HTTPException(status_code=402, detail="Таска не была создана")

    return {"task": created_task}


@app.get("/api/get_tasks")
async def get_all_tasks(request: Request, db: AsyncSession = Depends(get_db)):
    token = request.cookies.get("access_token")

    if not token:
        raise HTTPException(status_code=401, detail="Unauthorized")

    user = await get_user_by_token(encode_token=token, db=db)

    if not user or not user.user_is_active:
        raise HTTPException(status_code=401, detail="Unauthorized")

    tasks = await crud.get_tasks(user_id=user.user_id, db=db)

    return {"tasks": tasks}


@app.get("/api/today_tasks")
async def get_all_today_tasks(
    request: Request, task_date: date = date.today(), db: AsyncSession = Depends(get_db)
):
    token = request.cookies.get("access_token")

    if not token:
        raise HTTPException(status_code=401, detail="Unauthorized")

    user = await get_user_by_token(encode_token=token, db=db)

    if not user or not user.user_is_active:
        raise HTTPException(status_code=401, detail="Unauthorized")

    tasks = await crud.get_all_today_tasks(
        user_id=user.user_id, task_date=task_date, db=db
    )

    return tasks


@app.get("/api/special_tasks")
async def get_all_special_tasks(request: Request, db: AsyncSession = Depends(get_db)):
    token = request.cookies.get("access_token")

    if not token:
        raise HTTPException(status_code=401, detail="Unauthorized")

    user = await get_user_by_token(encode_token=token, db=db)

    if not user or not user.user_is_active:
        raise HTTPException(status_code=401, detail="Unauthorized")

    tasks = await crud.get_all_special_tasks(user_id=user.user_id, db=db)

    return tasks


@app.get("/api/completed_tasks")
async def get_all_completed_tasks(request: Request, db: AsyncSession = Depends(get_db)):
    token = request.cookies.get("access_token")

    if not token:
        raise HTTPException(status_code=401, detail="Unauthorized")

    user = await get_user_by_token(encode_token=token, db=db)

    if not user or not user.user_is_active:
        raise HTTPException(status_code=401, detail="Unauthorized")

    tasks = await crud.get_all_completed_tasks(user_id=user.user_id, db=db)

    return tasks


@app.delete("/api/delete_task/{task_id}")
async def delete_task(task_id: int, db: AsyncSession = Depends(get_db)):
    result = await crud.delete_task(task_id=task_id, db=db)

    if not result:
        raise HTTPException(status_code=402, detail="Таска не была удалена")

    return result


@app.get("/api/tasks_by_category/{category_id}")
async def get_tasks_by_category(
    request: Request, category_id: int, db: AsyncSession = Depends(get_db)
):
    token = request.cookies.get("access_token")

    if not token:
        raise HTTPException(status_code=401, detail="Unauthorized")

    user = await get_user_by_token(encode_token=token, db=db)

    if not user or not user.user_is_active:
        raise HTTPException(status_code=401, detail="Unauthorized")

    tasks = await crud.get_tasks_by_category(
        user_id=user.user_id, category_id=category_id, db=db
    )

    return {"tasks": tasks}


@app.post("/api/special_task/{task_id}")
async def special_task(task_id: int, db: AsyncSession = Depends(get_db)):
    task = await crud.change_task_is_special(task_id=task_id, db=db)
    print(task)

    return {"task": task}


@app.post("/api/completed_task/{task_id}")
async def completed_task(task_id: int, db: AsyncSession = Depends(get_db)):
    task = await crud.change_task_completed(task_id=task_id, db=db)

    return {"task": task}


@app.get("/api/stats")
async def get_stats(request: Request, db: AsyncSession = Depends(get_db)):
    token = request.cookies.get("access_token")

    if not token:
        raise HTTPException(status_code=401, detail="Unauthorized")

    user = await get_user_by_token(encode_token=token, db=db)

    if not user or not user.user_is_active:
        raise HTTPException(status_code=401, detail="Unauthorized")

    results = await crud.get_stats(today_date=date.today(), user_id=user.user_id, db=db)

    return results


# Работа с категориями
@app.post("/api/create_category")
async def create_category(
    request: Request,
    category: schemas.CreateCategory,
    db: AsyncSession = Depends(get_db),
):
    token = request.cookies.get("access_token")

    if not token:
        raise HTTPException(status_code=401, detail="Unauthorized")

    user = await get_user_by_token(encode_token=token, db=db)

    if not user or not user.user_is_active:
        raise HTTPException(status_code=401, detail="Unauthorized")

    category.category_user_id = user.user_id
    category = await crud.create_category(new_category=category, db=db)
    if not category:
        raise HTTPException(status_code=402, detail="Категория не была создана")
    return {"category": category}


@app.delete("/api/delete_category/{category_id}")
async def delete_category(category_id: int, db: AsyncSession = Depends(get_db)):
    delete_category = await crud.delete_category(category_id=category_id, db=db)

    if not delete_category:
        return None

    return {"status": "ok"}


# -------------------------
# Страница личного профиля в WorkFlow
# -------------------------
@app.get("/workflow/profile")
async def get_profile_page(request: Request, db: AsyncSession = Depends(get_db)):
    token = request.cookies.get("access_token")

    if not token:
        return RedirectResponse("/workflow/login")

    user = await get_user_by_token(encode_token=token, db=db)

    if not user or not user.user_is_active:
        return RedirectResponse("/workflow/login")

    return FileResponse("templates/profile.html")


@app.get("/api/get_user")
async def get_user_by_id(request: Request, db: AsyncSession = Depends(get_db)):
    token = request.cookies.get("access_token")

    if not token:
        raise HTTPException(status_code=401, detail="Unauthorized")

    user = await get_user_by_token(encode_token=token, db=db)

    if not user or not user.user_is_active:
        raise HTTPException(status_code=401, detail="Unauthorized")

    db_user = await crud.get_user_by_id(user_id=user.user_id, db=db)

    if not db_user:
        raise HTTPException(status_code=401, detail="Not authorized")

    return db_user


@app.patch("/api/change_name_email")
async def change_name_email(
    request: Request, for_change: dict, db: AsyncSession = Depends(get_db)
):
    token = request.cookies.get("access_token")

    if not token:
        raise HTTPException(status_code=401, detail="Unauthorized")

    user = await get_user_by_token(encode_token=token, db=db)

    if not user or not user.user_is_active:
        raise HTTPException(status_code=401, detail="Unauthorized")

    after_change = await crud.change_name_email(
        user_id=user.user_id, for_change=for_change, db=db
    )
    print(after_change)
    return after_change


@app.get("/api/streak")
async def get_streak(request: Request, db: AsyncSession = Depends(get_db)):
    token = request.cookies.get("access_token")

    if not token:
        raise HTTPException(status_code=401, detail="Unathorized")

    user = await get_user_by_token(encode_token=token, db=db)

    if not user or not user.user_is_active:
        raise HTTPException(status_code=401, detail="Unathorized")

    print("Начинаем искать длительность стрика")
    streak = await crud.get_streak_info(user_id=user.user_id, db=db)

    return streak


@app.get("/api/total")
async def get_total_tasks(request: Request, db: AsyncSession = Depends(get_db)):
    token = request.cookies.get("access_token")

    if not token:
        raise HTTPException(status_code=401, detail="Unathorized")

    user = await get_user_by_token(encode_token=token, db=db)

    if not user or not user.user_is_active:
        raise HTTPException(status_code=401, detail="Unathorized")

    total_tasks = await crud.get_total_tasks_info(user_id=user.user_id, db=db)
    print(total_tasks)
    return {"total": total_tasks}


# -------------------------
# Страница безопасности профиля в WorkFlow
# -------------------------
@app.get("/workflow/profile/safety")
async def get_profile_safety_page(request: Request, db: AsyncSession = Depends(get_db)):
    token = request.cookies.get("access_token")

    if not token:
        return RedirectResponse("/workflow/login")

    user = await get_user_by_token(encode_token=token, db=db)

    if not user or not user.user_is_active:
        return RedirectResponse("/workflow/login")

    return FileResponse("templates/profile_safety.html")


@app.patch("/api/change_password")
async def change_user_password(
    request: Request,
    passwords: schemas.PasswordChange,
    db: AsyncSession = Depends(get_db),
):
    token = request.cookies.get("access_token")

    if not token:
        return RedirectResponse("/workflow/login")

    user = await get_user_by_token(encode_token=token, db=db)

    if not user or not user.user_is_active:
        return RedirectResponse("/workflow/login")

    has_digit = any(char.isdigit() for char in passwords.new_password)
    has_lower = any(char.lower() for char in passwords.new_password)
    has_upper = any(char.upper() for char in passwords.new_password)
    has_spec = any(char in string.punctuation for char in passwords.new_password)

    if has_digit and has_lower and has_upper and has_spec:
        password_strong = True
    else:
        password_strong = False

    change_password = await crud.change_password(
        user_id=user.user_id,
        old_password=passwords.old_password,
        new_password=passwords.new_password,
        password_strong=password_strong,
        db=db,
    )

    if (not change_password) or ("error" in change_password):
        raise HTTPException(status_code=422, detail="Unproccesible values")

    return change_password


@app.post("/api/change_user_tfa_enabled")
async def change_user_tfa_enabled(request: Request, db: AsyncSession = Depends(get_db)):
    token = request.cookies.get("access_token")

    if not token:
        raise HTTPException(status_code=401, detail="Unathorized")

    user = await get_user_by_token(encode_token=token, db=db)

    if not user or not user.user_is_active:
        raise HTTPException(status_code=401, detail="Unathorized")

    user = await crud.get_user_by_id(user_id=user.user_id, db=db)

    if not user or not user.user_is_active:
        raise HTTPException(status_code=401, detail="Unathorized")
    print("Идем менять статус tfa_enabled")
    change_user_tfa = await crud.change_user_tfa_enabled(
        user_id=user.user_id, tfa_enabled=user.user_tfa_enabled, db=db
    )
    print("Поменяли")
    if change_user_tfa["status"]:
        return {"status": True}
    elif not change_user_tfa["status"]:
        return {"status": False}


@app.get("/api/security_level")
async def get_security_level(request: Request, db: AsyncSession = Depends(get_db)):
    token = request.cookies.get("access_token")

    if not token:
        raise HTTPException(status_code=401, detail="Unathorized")

    user = await get_user_by_token(encode_token=token, db=db)

    if not user or not user.user_is_active:
        raise HTTPException(status_code=401, detail="Unathorized")

    user = await crud.get_user_by_id(user_id=user.user_id, db=db)

    if not user or not user.user_is_active:
        raise HTTPException(status_code=401, detail="Unathorized")

    response = {
        "email_confirmed": user.user_email_is_confirm,
        "tfa_enabled": user.user_tfa_enabled,
        "password_strong": user.user_password_is_safe,
    }

    return response


@app.post("/api/exit")
async def exit_from_account(response: Response):
    response.delete_cookie(key="access_token")

    return True
