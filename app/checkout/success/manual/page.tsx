import Link from "next/link"
import { CheckCircle, Info } from "lucide-react"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

export default function ManualSuccessPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center mt-10">
      <CheckCircle className="w-20 h-20 text-success mb-6" />
      <h1 className="text-4xl font-extrabold text-foreground mb-4">
        ¡Pedido Registrado con Éxito!
      </h1>
      <p className="text-lg text-muted-foreground mb-8 max-w-2xl">
        Tu pedido ha sido recibido y tus productos ya están apartados para preparación y despacho.
      </p>

      <Alert className="mb-10 max-w-2xl bg-card border-border text-left shadow-sm">
        <Info className="h-5 w-5 text-primary" />
        <AlertTitle className="text-card-foreground text-lg ml-2">¿Qué sigue ahora?</AlertTitle>
        <AlertDescription className="text-muted-foreground mt-3 text-base ml-2">
          Nos pondremos en contacto contigo vía telefónica o WhatsApp para confirmar tus datos de entrega.
          <br /><br />
          <strong className="text-foreground">Recuerda:</strong> Realizarás el pago en efectivo o transferencia directamente al recibir tus productos.
        </AlertDescription>
      </Alert>

      <Button asChild size="lg" className="font-bold px-10">
        <Link href="/" aria-label="Volver a la tienda, Ir a la tienda" data-testid="back-to-store-btn">
          Volver a la tienda
        </Link>
      </Button>
    </div>
  )
}
