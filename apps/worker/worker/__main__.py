import os

from worker.health import serve

if __name__ == "__main__":
    serve(os.environ.get("REDIS_URL", "redis://localhost:6379/0"))
