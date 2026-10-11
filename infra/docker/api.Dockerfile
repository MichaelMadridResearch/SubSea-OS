FROM python:3.12-slim-bookworm
WORKDIR /repo
COPY apps/api /repo/apps/api
COPY infra/migrations /repo/infra/migrations
COPY packages/demo-data /repo/packages/demo-data
RUN pip install --no-cache-dir "/repo/apps/api[dev]"
ENV PYTHONPATH=/repo/apps/api
EXPOSE 8000
CMD ["sh", "-c", "alembic -c /repo/apps/api/alembic.ini upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
