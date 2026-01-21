FROM python:3.11-slim

# Evitar prompts interactivos
ENV DEBIAN_FRONTEND=noninteractive

# Dependencias del sistema (PDF + spaCy)
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    poppler-utils \
    libglib2.0-0 \
    libgl1 \
    && rm -rf /var/lib/apt/lists/*

# Directorio de trabajo
WORKDIR /app

# Copiamos requirements primero (mejor cache)
COPY requirements.txt .

# Instalar dependencias Python
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# Descargar modelo spaCy
RUN python -m spacy download en_core_web_sm

# Copiar el código
COPY app ./app

# Exponer puerto
EXPOSE 8000

# Comando de arranque (SIN reload)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--timeout-keep-alive", "5"]

