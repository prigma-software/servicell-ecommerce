#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "../.env");
const envLocalPath = path.resolve(__dirname, "../.env.local");

// Simple .env reader to avoid external dependencies
function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

loadEnv(envLocalPath);
loadEnv(envPath);

const args = process.argv.slice(2);
const envFlag = args.find((a) => a.startsWith("--env="));
const forcedEnv = envFlag ? envFlag.split("=")[1].toLowerCase() : null;
const targetPhoneArg = args.find((a) => !a.startsWith("--"));

const activeEnv = (forcedEnv || process.env.WHATSAPP_ENV || "test").toLowerCase();
let phoneNumberId;
if (activeEnv === "production" || activeEnv === "prod") {
  phoneNumberId =
    process.env.WHATSAPP_PHONE_NUMBER_ID_PROD ||
    process.env.WHATSAPP_PHONE_NUMBER_ID;
} else {
  phoneNumberId =
    process.env.WHATSAPP_PHONE_NUMBER_ID_TEST ||
    process.env.WHATSAPP_PHONE_NUMBER_ID;
}

const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
const apiVersion = process.env.WHATSAPP_API_VERSION || "v22.0";

console.log("=========================================");
console.log("🚀 WhatsApp Cloud API Test Runner");
console.log("=========================================");

if (!phoneNumberId || !accessToken) {
  console.error("❌ ERROR: Faltan credenciales de WhatsApp en .env o .env.local:");
  console.error(`- Phone Number ID (${activeEnv}): ${phoneNumberId ? "OK" : "FALTA"}`);
  console.error(`- WHATSAPP_ACCESS_TOKEN: ${accessToken ? "OK" : "FALTA"}`);
  console.log("\nPor favor verifica tus variables en .env y vuelve a ejecutar.");
  process.exit(1);
}

if (!targetPhoneArg) {
  console.error("❌ ERROR: Debes especificar el número de destino.");
  console.log("Uso: node scripts/test-whatsapp.mjs <NUMERO_TELEFONO> [--env=test|prod]");
  console.log("Ejemplo Test: node scripts/test-whatsapp.mjs 3178079672 --env=test");
  console.log("Ejemplo Prod: node scripts/test-whatsapp.mjs 3178079672 --env=prod");
  process.exit(1);
}

// Normalización básica E.164 para Colombia si tiene 10 dígitos
let formattedPhone = targetPhoneArg.replace(/\D/g, "");
if (formattedPhone.length === 10 && formattedPhone.startsWith("3")) {
  formattedPhone = "57" + formattedPhone;
}

console.log(`🌍 Ambiente:        ${activeEnv} (${activeEnv === "production" || activeEnv === "prod" ? "Producción" : "Sandbox Test"})`);
console.log(`📱 Phone Number ID: ${phoneNumberId}`);
console.log(`🌐 API Version:     ${apiVersion}`);
console.log(`🎯 Destinatario:    ${formattedPhone}`);
console.log("-----------------------------------------");

const endpoint = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;

const payload = {
  messaging_product: "whatsapp",
  recipient_type: "individual",
  to: formattedPhone,
  type: "text",
  text: {
    body: "👋 ¡Hola! Este es un mensaje de prueba desde tu E-commerce Marca Blanca usando WhatsApp Cloud API.",
  },
};

console.log("📡 Enviando petición a Meta Graph API...");

try {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (response.ok) {
    console.log("✅ ¡MENSAJE ENVIADO CON ÉXITO!");
    console.log(`🆔 Message ID (WAMID): ${data.messages?.[0]?.id}`);
    console.log("Revisa tu WhatsApp ahora mismo.");
  } else {
    console.error("❌ ERROR devuelto por Meta API:");
    console.error(JSON.stringify(data, null, 2));

    if (data.error?.code === 131047) {
      console.log("\n💡 NOTA: Meta indica que han pasado más de 24 horas desde la última respuesta de este número.");
      console.log("Para pruebas de texto libre en Sandbox:");
      console.log("1. Envía un 'Hola' desde tu WhatsApp al número de prueba de Meta.");
      console.log("2. Vuelve a ejecutar este script.");
    }
  }
} catch (err) {
  console.error("❌ Error de red o conexión:", err.message);
}
console.log("=========================================\n");
