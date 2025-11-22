# Base image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Copy requirements first
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy project files
COPY . .

# Collect static files
RUN python manage.py collectstatic --noinput

# Expose port 8000
EXPOSE 8000

# Start server (Option A: use --chdir)
CMD ["gunicorn", "UMAP.wsgi:application", "--chdir", "UMAP", "--bind", "0.0.0.0:8000"]
