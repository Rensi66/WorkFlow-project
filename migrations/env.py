from logging.config import fileConfig

from sqlalchemy import pool
from app.models import Base
import asyncio
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# add your model's MetaData object here
# for 'autogenerate' support
# from myapp import mymodel
# target_metadata = mymodel.Base.metadata
target_metadata = Base.metadata

# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"}
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    # 1. Создаем движок через асинхронную версию функции
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    # 2. Оборачиваем синхронный запуск алембика в асинхронную обертку
    async def run_async_migrations():
        async with connectable.connect() as connection:
            # Магия здесь: мы заставляем асинхронное соединение
            # выполнить синхронные действия алембика
            await connection.run_sync(do_run_migrations)
        await connectable.dispose()

    # 3. Запускаем всё это дело
    asyncio.run(run_async_migrations())

def do_run_migrations(connection):
    # Эта функция делает то же самое, что и стандартная run_migrations_online раньше
    context.configure(connection=connection, target_metadata=target_metadata, compare_server_default=True)
    with context.begin_transaction():
        context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
