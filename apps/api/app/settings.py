from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://subsea:subsea@localhost:5432/subsea"
    redis_url: str = "redis://localhost:6379/0"
    s3_endpoint: str = "http://localhost:9000"
    demo_user_email: str = "operator@demo.invalid"
    demo_user_password: str = "demo-only-not-a-secret"
    demo_data_dir: str = "packages/demo-data/fixtures"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
