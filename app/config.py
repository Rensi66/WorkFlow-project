from dotenv import load_dotenv
import os

load_dotenv()


class Settings:
    SECRET_KEY: str = os.getenv("SECRET_KEY")
    ALGORITHM: str = os.getenv("ALGORIHTM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 30)
    EMAIL: str = os.getenv('EMAIL')
    EMAIL_PASSWORD: str = os.getenv('EMAIL_PASSWORD')


settings = Settings()
