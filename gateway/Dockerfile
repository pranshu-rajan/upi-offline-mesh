# Dockerfile for FastAPI Edge Bridge Gateway
FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy gateway source
COPY main.py .

EXPOSE 8000
ENV PORT=8000
ENV BACKEND_URL="http://backend:8080"

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
