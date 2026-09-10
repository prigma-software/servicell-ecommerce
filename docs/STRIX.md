# 🛡️ Guía de Auditoría de Ciberseguridad con Strix y Ollama

Esta guía documenta la configuración, ejecución y automatización de pruebas de penetración (pentesting) en la plataforma **Marca Blanca** utilizando [Strix](https://github.com/usestrix/strix) impulsado por modelos locales en **Ollama**.

---

## 📌 1. ¿Qué es Strix?

**Strix** es un framework de pruebas de penetración autónomo impulsado por Inteligencia Artificial. A diferencia de escáneres estáticos tradicionales:
* Utiliza un **sistema multiagente** que realiza reconocimiento, mapeo de rutas, prueba de lógica de negocio y validación de fallos en sandboxes de **Docker**.
* Genera **Pruebas de Concepto (PoC)** reales para evitar falsos positivos.
* Produce reportes estructurados en Markdown (`report.md`) y JSON/SARIF (`findings.json`).

---

## ⚙️ 2. Requisitos Previos

1. **Docker / Docker Desktop**: Debe estar instalado y en ejecución (Strix aísla los agentes y exploits en contenedores seguros).
2. **Python 3.12+**: Necesario para el CLI de Strix.
3. **Ollama**: Motor local de modelos de IA (evita depender de APIs de pago o límites de cuota `429 Too Many Requests`).

---

## 📥 3. Instalación Rápida

### A. Instalar Ollama y descargar el modelo recomendado
```bash
# 1. En Mac (vía Homebrew) o descarga desde https://ollama.com/download
brew install ollama

# 2. Descargar el modelo optimizado (Qwen 3.5 9B):
ollama pull qwen3.5:9b
```

### B. Probar la velocidad de inferencia de tu máquina
Antes de lanzar una auditoría, puedes medir la velocidad en tokens/segundo con el benchmark incluido:
```bash
./scripts/test-ollama-speed.sh
# o especificando otro modelo:
python3 scripts/test-ollama-speed.py qwen3.5:9b
```

### C. Instalar Strix (si no se ha instalado)
```bash
python3 -m venv ~/.strix-venv
~/.strix-venv/bin/pip install --upgrade pip strix-agent
```

---

## 🚀 4. Ejecución de Auditorías

Desde la raíz del repositorio `E-commerce`, ejecuta el script de automatización:

### A. Auditar el código fuente del Marca Blanca (Predeterminado)
```bash
./run-strix.sh
```
> Esto abre la interfaz visual interactiva (TUI) de Strix, conectándose automáticamente a tu Ollama local (`http://localhost:11434`) con el modelo `qwen3.5:9b`.

### B. Escaneo Rápido (Quick Scan)
Ideal para comprobaciones de alto impacto en menor tiempo:
```bash
./run-strix.sh -m quick
```

### C. Auditar una tienda o API en vivo (Local o Producción)
```bash
# Servidor local de desarrollo
./run-strix.sh http://localhost:3000

# Tienda o entorno de staging
./run-strix.sh https://staging.tutienda.com
```

### D. Auditorías con instrucciones específicas
```bash
./run-strix.sh --instruction "Enfócate en la API del carrito, reglas RLS de Supabase y validación de pagos"
```

---

## 📁 5. Resultados y Reportes

Al finalizar una auditoría, Strix crea una carpeta dentro de `strix_runs/<nombre-del-escaneo>/` con los siguientes archivos:

* `report.md`: Resumen ejecutivo y técnico de todas las vulnerabilidades detectadas, ordenadas por criticidad (Crítica, Alta, Media, Baja).
* `findings.json`: Todos los hallazgos en formato estructurado JSON.
* `proof-of-concepts/`: Scripts para reproducir y validar de forma controlada cada fallo encontrado.

---

## 🏢 6. Uso en Marca Blanca y Ecosistema de Clientes

1. **Blindaje de la Base:** Ejecutar Strix en el repositorio base `E-commerce` antes de sincronizar o hacer merge hacia las tiendas hijas (`servicell-ecommerce`, `VitaminasPaTi-E-commerce`).
2. **Generación de Reportes Comerciales:** El archivo `findings.json` puede convertirse en un informe en PDF con el branding, logotipo y sello de tu marca blanca para certificar auditorías a tus clientes.
3. **Privacidad Total:** Al correr con Ollama en local, **ninguna línea de código, endpoint o credencial sale de tu máquina hacia servidores de terceros**.
