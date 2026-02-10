from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker


engine = create_async_engine(
    "postgresql+asyncpg://postgres:1234@localhost:5432/workflow"
)
session_maker = async_sessionmaker(bind=engine, expire_on_commit=False)


async def get_db():
    async with session_maker() as session:
        yield session
