# Setup con UV - Guía de Portabilidad

Este documento explica cómo configurar el proyecto AI Talent Matcher usando UV para máxima portabilidad.

## Resumen del Proceso

### 1. ✅ Verificación del Entorno Virtual

**Estado Actual:**
- Python 3.11.5 detectado
- Entorno virtual existe en `.venv/` pero no está activo
- Para activarlo: `.\.venv\Scripts\Activate.ps1` (PowerShell) o `source .venv/bin/activate` (Bash)

### 2. ✅ Verificación de requirements.txt

**Estado:**
- ✅ `requirements.txt` existe
- Dependencias principales identificadas y limpiadas
- Archivo actualizado con versiones específicas para reproducibilidad

**Dependencias principales:**
- FastAPI (framework web)
- Uvicorn (servidor ASGI)
- Supabase (base de datos)
- Pydantic (validación de datos)
- LangChain & OpenAI (IA/LLM)

### 3. ✅ Generación de pyproject.toml

**Archivo creado con:**
- PEP 621 compliance (`[project]` section)
- Dependencias principales definidas
- Configuración para UV
- Herramientas de desarrollo opcionales (pytest, black, ruff)
- Compatibilidad con Python 3.10+

### 4. ✅ Scripts de Setup

**Scripts generados:**
- `setup.sh` - Para sistemas Unix/Linux/macOS
- `setup.ps1` - Para Windows PowerShell

Ambos scripts:
- Verifican Python
- Instalan UV si no está presente
- Crean entorno virtual con UV
- Instalan dependencias desde `pyproject.toml`
- Verifican la instalación

## Uso Rápido

### En Windows (PowerShell):
```powershell
.\setup.ps1
```

### En Linux/macOS (Bash):
```bash
chmod +x setup.sh
./setup.sh
```

### Manualmente con UV:

```bash
# Instalar UV (si no está instalado)
curl -LsSf https://astral.sh/uv/install.sh | sh

# Crear entorno virtual
uv venv

# Activar entorno virtual
# Windows: .\.venv\Scripts\Activate.ps1
# Unix:    source .venv/bin/activate

# Instalar dependencias
uv pip install -e .
```

## Estructura de Archivos Generados

```
.
├── requirements.txt          # Dependencias con versiones específicas
├── pyproject.toml            # Configuración moderna PEP 621 + UV
├── setup.sh                  # Script de setup para Unix/Linux/macOS
└── setup.ps1                 # Script de setup para Windows
```

## Ventajas de UV

- ⚡ **Velocidad**: 10-100x más rápido que pip
- 🔒 **Reproducibilidad**: Lock files automáticos
- 📦 **Gestión moderna**: Compatible con PEP 621
- 🎯 **Simplicidad**: Un solo comando para todo

## Próximos Pasos

1. Ejecutar el script de setup apropiado para tu sistema
2. Configurar variables de entorno (`.env`)
3. Ejecutar la aplicación: `uvicorn app.main:app --reload`
