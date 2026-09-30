FROM python:3.12-slim AS builder
ENV POETRY_VIRTUALENVS_IN_PROJECT=true POETRY_NO_INTERACTION=1
WORKDIR /app
RUN pip install --no-cache-dir poetry==2.2.1
COPY pyproject.toml poetry.lock ./
RUN poetry install --only main --no-root --no-ansi
COPY src ./src
RUN poetry install --only main --no-ansi

FROM builder AS tests
RUN poetry install --no-ansi
COPY tests ./tests
COPY main.py ./main.py
CMD ["poetry", "run", "pytest", "-q"]

FROM python:3.12-slim AS runtime
ENV PATH="/app/.venv/bin:$PATH" PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
WORKDIR /app
RUN useradd --create-home --uid 10001 poker
COPY --from=builder /app/.venv ./.venv
COPY --from=builder /app/src ./src
USER poker
EXPOSE 8000
CMD ["uvicorn", "poker.api:app", "--host", "0.0.0.0", "--port", "8000"]
