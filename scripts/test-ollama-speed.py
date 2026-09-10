#!/usr/bin/env python3
"""
Benchmark de Velocidad para Ollama (Tokens por segundo)
No requiere dependencias externas (usa solo la librería estándar de Python).
"""

import sys
import json
import time
import urllib.request
import urllib.error

# Configuración por defecto
DEFAULT_MODEL = "qwen3.5:9b"
OLLAMA_URL = "http://127.0.0.1:11434/api/generate"

def run_benchmark(model_name: str):
    print(f"\n==================================================")
    print(f"  BENCHMARK DE VELOCIDAD OLLAMA - TOKENS/SEGUNDO  ")
    print(f"==================================================")
    print(f"[*] Modelo objetivo : {model_name}")
    print(f"[*] Endpoint Ollama : {OLLAMA_URL}")
    print(f"[*] Enviando solicitud de prueba... (espera unos momentos)")

    payload = {
        "model": model_name,
        "prompt": "Write a detailed, technical explanation of how Web Application Firewalls (WAF) inspect HTTP traffic, including regex pattern matching, rate limiting, and anomaly detection.",
        "stream": False
    }

    req = urllib.request.Request(
        OLLAMA_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )

    start_wall = time.time()
    try:
        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode("utf-8"))
    except urllib.error.URLError as e:
        print(f"\n[ERROR] No se pudo conectar con Ollama en {OLLAMA_URL}")
        print(f"Detalle: {e.reason}")
        print("\nVerifica que Ollama esté abierto y corriendo en tu máquina con:")
        print("  ollama serve  (o abriendo la app de Ollama)")
        sys.exit(1)

    total_wall_time = time.time() - start_wall

    # Extraer métricas nativas calculadas por el motor de Ollama
    eval_count = result.get("eval_count", 0)                      # Tokens generados
    eval_duration_ns = result.get("eval_duration", 1)             # Nanosegundos de generación
    eval_duration_s = eval_duration_ns / 1e9
    tps = eval_count / eval_duration_s if eval_duration_s > 0 else 0

    prompt_count = result.get("prompt_eval_count", 0)             # Tokens en el prompt
    prompt_duration_ns = result.get("prompt_eval_duration", 1)   # Nanosegundos evaluando prompt
    prompt_duration_s = prompt_duration_ns / 1e9
    prompt_tps = prompt_count / prompt_duration_s if prompt_duration_s > 0 else 0

    print(f"\n---------------- RESULTADOS ----------------")
    print(f"✔ Modelo utilizado          : {result.get('model')}")
    print(f"✔ Tokens generados          : {eval_count} tokens")
    print(f"✔ Tiempo de generación      : {eval_duration_s:.2f} s")
    print(f"🚀 VELOCIDAD DE GENERACIÓN  : {tps:.2f} tokens/segundo")
    print(f"⚡ VELOCIDAD LECTURA PROMPT : {prompt_tps:.2f} tokens/segundo")
    print(f"⏱ Tiempo total de respuesta : {total_wall_time:.2f} s")
    print(f"--------------------------------------------\n")

if __name__ == "__main__":
    # Permite pasar otro modelo como argumento: python3 test-ollama-speed.py llama3.2:3b
    target_model = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_MODEL
    run_benchmark(target_model)
