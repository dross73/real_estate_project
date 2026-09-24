FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install Python dependencies before copying application code for better layer caching.
COPY requirements.txt .
RUN python -m pip install --no-cache-dir --upgrade pip \
    && python -m pip install --no-cache-dir -r requirements.txt

# Copy only the runtime application and migration files.
COPY alembic.ini .
COPY migrations ./migrations
COPY app ./app

# Run the application as a non-root user.
RUN useradd --create-home --shell /bin/sh appuser \
    && mkdir -p /home/appuser/.ssh \
    && chmod 0700 /home/appuser/.ssh \
    && chown -R appuser:appuser /app /home/appuser
USER appuser

EXPOSE 8000

# Deployment platforms such as Render provide PORT; local Docker defaults to 8000.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
