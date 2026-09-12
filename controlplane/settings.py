from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "AgentOS Control Plane"
    database_url: str = "sqlite:///./agentos.db"
    jwt_secret: str = "dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24
    runner_token: str = "dev-runner-token"
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    # Control plane never requires agent source or private payloads
    accept_sensitive_payloads: bool = False

    class Config:
        env_prefix = "AGENTOS_"


settings = Settings()
