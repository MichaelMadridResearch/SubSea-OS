FROM python:3.12-slim-bookworm
WORKDIR /repo
COPY apps/worker /repo/apps/worker
RUN pip install --no-cache-dir /repo/apps/worker
ENV PYTHONPATH=/repo/apps/worker
EXPOSE 8001
CMD ["python", "-m", "worker"]
