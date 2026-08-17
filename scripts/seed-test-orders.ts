import { createClient } from "@supabase/supabase-js"
import { readFileSync, existsSync } from "fs"

const envFile = existsSync(".env.local") ? ".env.local" : ".env"
const env = readFileSync(envFile, "utf8")
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)?.[1]?.trim()
const key = (env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)?.[1] || env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)?.[1])?.trim()

if (!url || !key) {
  console.error("Missing Supabase credentials")
  process.exit(1)
}

const supabase = createClient(url, key)

async function seed() {
  console.log("🌱 Iniciando siembra de datos de prueba para validación de órdenes...")

  const { data: products } = await supabase.from("products").select("id, name, price").limit(2)
  const { data: zones } = await supabase.from("shipping_zones").select("id, name, cost").limit(2)
  const { data: profiles } = await supabase.from("profiles").select("id, email").limit(1)

  if (!products || products.length === 0) {
    console.error("No se encontraron productos en la base de datos.")
    return
  }

  const user = profiles?.[0] || { id: null, email: "cliente.demo@prigma.net" }
  const productA = products[0]
  const productB = products[1] || products[0]
  const zoneA = zones?.[0] || { id: null, name: "Zona Central", cost: 10000 }

  const testCases = [
    {
      scenario: "1. Contra Entrega - Pendiente de Despacho",
      data: {
        user_id: user.id,
        status: "PENDING_MANUAL",
        payment_method: "manual",
        is_paid: false,
        customer_name: "1. Carlos Pérez (Contra Entrega - Pendiente Despacho)",
        customer_email: "carlos.perez@ejemplo.com",
        customer_phone: "+573001112233",
        shipping_address: "Calle 100 # 15-20, Apto 402, Bogotá",
        shipping_cost: zoneA.cost,
        shipping_zone_id: zoneA.id,
        total_amount: productA.price * 2 + zoneA.cost,
      },
      items: [
        { product_id: productA.id, quantity: 2, price_at_purchase: productA.price }
      ]
    },
    {
      scenario: "2. Contra Entrega - Despachada / Pendiente de Cobro",
      data: {
        user_id: user.id,
        status: "APPROVED",
        payment_method: "manual",
        is_paid: false,
        customer_name: "2. Andrea Gómez (Contra Entrega - En Camino / Por Cobrar)",
        customer_email: "andrea.gomez@ejemplo.com",
        customer_phone: "+573104445566",
        shipping_address: "Carrera 7 # 45-10, Medellín",
        shipping_cost: zoneA.cost,
        shipping_zone_id: zoneA.id,
        total_amount: productB.price + zoneA.cost,
      },
      items: [
        { product_id: productB.id, quantity: 1, price_at_purchase: productB.price }
      ]
    },
    {
      scenario: "3. Contra Entrega - Entregada y Dinero Cobrado",
      data: {
        user_id: user.id,
        status: "APPROVED",
        payment_method: "manual",
        is_paid: true,
        customer_name: "3. Juan Rodríguez (Contra Entrega - Pagado y Cobrado)",
        customer_email: "juan.rodriguez@ejemplo.com",
        customer_phone: "+573207778899",
        shipping_address: "Avenida 19 # 104-50, Cali",
        shipping_cost: zoneA.cost,
        shipping_zone_id: zoneA.id,
        total_amount: productA.price + productB.price + zoneA.cost,
      },
      items: [
        { product_id: productA.id, quantity: 1, price_at_purchase: productA.price },
        { product_id: productB.id, quantity: 1, price_at_purchase: productB.price }
      ]
    },
    {
      scenario: "4. Wompi - Pago Pendiente en línea",
      data: {
        user_id: user.id,
        status: "PENDING",
        payment_method: "wompi",
        is_paid: false,
        customer_name: "4. Mariana Torres (Wompi - Pendiente de Pago)",
        customer_email: "mariana.torres@ejemplo.com",
        customer_phone: "+573158889900",
        shipping_address: "Transversal 23 # 85-30, Bucaramanga",
        shipping_cost: zoneA.cost,
        shipping_zone_id: zoneA.id,
        total_amount: productA.price + zoneA.cost,
      },
      items: [
        { product_id: productA.id, quantity: 1, price_at_purchase: productA.price }
      ]
    },
    {
      scenario: "5. Wompi - Pago Aprobado en Línea",
      data: {
        user_id: user.id,
        status: "APPROVED",
        payment_method: "wompi",
        is_paid: true,
        wompi_transaction_id: "tx_demo_wompi_approved_" + Math.floor(Math.random() * 100000),
        customer_name: "5. Felipe Castro (Wompi - Aprobado y Pagado)",
        customer_email: "felipe.castro@ejemplo.com",
        customer_phone: "+573129990011",
        shipping_address: "Calle 45 # 12-08, Pereira",
        shipping_cost: zoneA.cost,
        shipping_zone_id: zoneA.id,
        total_amount: productB.price * 3 + zoneA.cost,
      },
      items: [
        { product_id: productB.id, quantity: 3, price_at_purchase: productB.price }
      ]
    },
    {
      scenario: "6. Contra Entrega - Cancelada por el Admin con motivo",
      data: {
        user_id: user.id,
        status: "DECLINED",
        payment_method: "manual",
        is_paid: false,
        stock_returned: true,
        cancellation_reason: "No se pudo cobrar el dinero (Cliente no pagó)",
        cancelled_at: new Date().toISOString(),
        customer_name: "6. Roberto Morales (Contra Entrega - Cancelada)",
        customer_email: "roberto.morales@ejemplo.com",
        customer_phone: "+573173332211",
        shipping_address: "Diagonal 50 # 30-12, Manizales",
        shipping_cost: zoneA.cost,
        shipping_zone_id: zoneA.id,
        total_amount: productA.price + zoneA.cost,
      },
      items: [
        { product_id: productA.id, quantity: 1, price_at_purchase: productA.price }
      ]
    },
    {
      scenario: "7. Wompi - Cancelada con Devolución de Stock",
      data: {
        user_id: user.id,
        status: "DECLINED",
        payment_method: "wompi",
        is_paid: false,
        stock_returned: true,
        cancellation_reason: "Solicitado por el cliente",
        cancelled_at: new Date().toISOString(),
        customer_name: "7. Diana Sánchez (Wompi - Cancelada)",
        customer_email: "diana.sanchez@ejemplo.com",
        customer_phone: "+573185556677",
        shipping_address: "Calle 70 # 9-40, Barranquilla",
        shipping_cost: zoneA.cost,
        shipping_zone_id: zoneA.id,
        total_amount: productB.price + zoneA.cost,
      },
      items: [
        { product_id: productB.id, quantity: 1, price_at_purchase: productB.price }
      ]
    },
    {
      scenario: "8. Orden con Error Técnico / Fallida",
      data: {
        user_id: user.id,
        status: "ERROR",
        payment_method: "wompi",
        is_paid: false,
        stock_returned: true,
        customer_name: "8. Camilo Vega (Wompi - Error en Pasarela)",
        customer_email: "camilo.vega@ejemplo.com",
        customer_phone: "+573196667788",
        shipping_address: "Carrera 15 # 60-20, Cartagena",
        shipping_cost: zoneA.cost,
        shipping_zone_id: zoneA.id,
        total_amount: productA.price + zoneA.cost,
      },
      items: [
        { product_id: productA.id, quantity: 1, price_at_purchase: productA.price }
      ]
    }
  ]

  for (const tc of testCases) {
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert([tc.data])
      .select()
      .single()

    if (orderErr) {
      console.error(`❌ Error insertando ${tc.scenario}:`, orderErr.message)
      continue
    }

    const itemsToInsert = tc.items.map(item => ({
      order_id: order.id,
      product_id: item.product_id,
      quantity: item.quantity,
      price_at_purchase: item.price_at_purchase,
    }))

    const { error: itemsErr } = await supabase.from("order_items").insert(itemsToInsert)
    if (itemsErr) {
      console.error(`❌ Error insertando items para ${tc.scenario}:`, itemsErr.message)
    } else {
      console.log(`✅ Creada: ${tc.scenario} -> ID: ${order.id}`)
    }
  }

  console.log("\n🎉 ¡Todas las órdenes de prueba fueron creadas con éxito!")
}

seed().catch(console.error)
