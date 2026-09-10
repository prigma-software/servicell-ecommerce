#!/usr/bin/env bash
set -e

# ==============================================================================
# Script de Auditoría de Ciberseguridad con Strix para Marca Blanca
# ==============================================================================

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${GREEN}==> Verificando entorno para Strix Pentest...${NC}"

# 1. Verificar si Docker está corriendo
if ! docker info >/dev/null 2>&1; then
  echo -e "${RED}[ERROR] Docker no está en ejecución o no responde al socket.${NC}"
  echo -e "${YELLOW}Por favor, abre la aplicación 'Docker Desktop' y espera a que el servicio esté activo.${NC}"
  exit 1
fi
echo -e "${GREEN}✔ Docker está activo.${NC}"

# 2. Configurar proveedor LLM (Ollama por defecto o variables de entorno)
if [ -z "$STRIX_LLM" ]; then
  # Verificar si Ollama local está respondiendo
  if curl -s http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
    export STRIX_LLM="ollama/qwen2.5-coder:14b"
    export LLM_API_BASE="http://localhost:11434"
    echo -e "${GREEN}✔ Conectado a Ollama local (Modelo: ${STRIX_LLM})${NC}"
  elif [ -n "$GROQ_API_KEY" ]; then
    export STRIX_LLM="groq/llama-3.1-8b-instant"
    export LLM_API_KEY="$GROQ_API_KEY"
    echo -e "${GREEN}✔ Proveedor configurado con Groq: ${STRIX_LLM}${NC}"
  elif [ -n "$GEMINI_API_KEY" ]; then
    export STRIX_LLM="gemini/gemini-2.0-flash"
    export LLM_API_KEY="$GEMINI_API_KEY"
    echo -e "${GREEN}✔ Proveedor configurado con Gemini: ${STRIX_LLM}${NC}"
  else
    # Fallback predeterminado a Ollama
    export STRIX_LLM="ollama/qwen2.5-coder:14b"
    export LLM_API_BASE="http://localhost:11434"
    echo -e "${CYAN}ℹ Usando configuración predeterminada: Ollama local (${STRIX_LLM})${NC}"
  fi
else
  echo -e "${GREEN}✔ Proveedor personalizado configurado: ${STRIX_LLM}${NC}"
fi

# 3. Localizar el ejecutable de Strix
STRIX_BIN=""
if [ -f "$HOME/.strix-venv/bin/strix" ]; then
  STRIX_BIN="$HOME/.strix-venv/bin/strix"
elif command -v strix >/dev/null 2>&1; then
  STRIX_BIN="$(command -v strix)"
else
  echo -e "${RED}[ERROR] Strix no está instalado.${NC}"
  echo -e "${YELLOW}Ejecuta: python3 -m venv ~/.strix-venv && ~/.strix-venv/bin/pip install strix-agent${NC}"
  exit 1
fi

# 4. Procesar argumentos y lanzar Strix
if [ $# -eq 0 ]; then
  echo -e "${GREEN}==> Iniciando auditoría con Strix en el código base (./)${NC}"
  echo -e "${YELLOW}Nota: Las pruebas se ejecutan en un contenedor Docker aislado.${NC}"
  "$STRIX_BIN" -t ./
elif [[ "$1" == -* ]]; then
  "$STRIX_BIN" "$@"
else
  TARGET="$1"
  shift
  echo -e "${GREEN}==> Iniciando auditoría con Strix en: ${TARGET}${NC}"
  echo -e "${YELLOW}Nota: Las pruebas se ejecutan en un contenedor Docker aislado.${NC}"
  "$STRIX_BIN" -t "$TARGET" "$@"
fi
