import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StoreLogo } from "@/components/branding/store-logo";
import { StoreName } from "@/components/branding/store-name";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { formatPrice } from "@/lib/format";
import { Dialog, DialogContent, DialogTrigger, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { X } from "lucide-react";

const METADATA_TRANSLATIONS: Record<string, string> = {
  device_model: "Modelo del Dispositivo",
  issue_description: "Descripción del Problema",
  email: "Correo Electrónico"
};

const SENSITIVE_METADATA_KEYS = new Set([
  "password",
  "contraseña",
  "pin",
  "clave",
  "pass",
  "secret",
  "token",
]);

const STATUS_TRANSLATIONS: Record<string, string> = {
  DRAFT: "Borrador",
  RECEIVED: "Recibido",
  IN_PROGRESS: "En Progreso",
  ON_HOLD: "En Pausa",
  COMPLETED: "Completado",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado"
};

export default async function TrackingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ phone?: string }>;
}) {
  const { id } = await params;
  const { phone } = await searchParams;

  if (!phone) {
    redirect("/tracking");
  }

  const supabase = await createClient();

  // Call the secure RPC function to get the work order
  const { data: workOrders, error: woError } = await supabase
    .rpc("get_work_order_public", {
      p_tracking_id: id,
      p_phone: phone,
    });

  if (woError || !workOrders || workOrders.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md text-center py-12">
          <CardTitle className="text-destructive mb-2">Orden no encontrada</CardTitle>
          <p className="text-muted-foreground mb-6">
            No encontramos ninguna orden con ese ID o el número de teléfono es incorrecto.
          </p>
          <a href="/tracking" className="text-primary hover:underline">
            Volver a intentar
          </a>
        </Card>
      </div>
    );
  }

  const workOrder = workOrders[0];

  // Call the secure RPC function for evidence
  const { data: evidence } = await supabase
    .rpc("get_work_order_evidence_public", {
      p_work_order_id: workOrder.id,
      p_tracking_id: id,
      p_phone: phone,
    });

  return (
    <div className="min-h-screen bg-muted/30 pb-12">
      <header className="bg-background border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StoreLogo size="sm" />
          <StoreName className="font-semibold" />
        </div>
        <a href="/tracking" className="text-sm text-muted-foreground hover:text-foreground">
          Salir
        </a>
      </header>

      <main className="max-w-3xl mx-auto px-4 pt-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Rastreo de Servicio</h1>
          <p className="text-muted-foreground">ID: {workOrder.tracking_id}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Estado Actual</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <Badge className="w-fit text-lg py-1 px-4">{STATUS_TRANSLATIONS[workOrder.status] || workOrder.status}</Badge>
              <div className="text-sm text-muted-foreground">
                Última actualización: {format(new Date(workOrder.updated_at), "PPP", { locale: es })}
              </div>
            </div>
            
            <div className="mt-8 grid grid-cols-2 gap-4 border-t pt-6">
              <div>
                <span className="block text-sm text-muted-foreground">Costo Estimado</span>
                <span className="font-medium">
                  {workOrder.estimated_cost ? formatPrice(workOrder.estimated_cost) : "Pendiente"}
                </span>
              </div>
              
              {workOrder.custom_metadata && Object.keys(workOrder.custom_metadata).length > 0 && (
                <div className="col-span-2 mt-4 space-y-4">
                  <span className="block text-sm text-muted-foreground font-semibold">Detalles de la Orden</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {Object.entries(workOrder.custom_metadata)
                      .filter(([key]) => !SENSITIVE_METADATA_KEYS.has(key.toLowerCase().trim()))
                      .map(([key, value]) => (
                        <div key={key} className="bg-muted/30 p-3 rounded-md border">
                          <span className="block text-xs text-muted-foreground capitalize mb-1">
                            {METADATA_TRANSLATIONS[key] || key.replace(/_/g, " ")}
                          </span>
                          <span className="font-medium text-sm break-words">{String(value)}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {evidence && evidence.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Fotos del Proceso</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {evidence.map((item: any) => (
                  <div key={item.id} className="relative rounded-md overflow-hidden border">
                    <Dialog>
                      <DialogTrigger asChild>
                        <div className="aspect-square relative bg-muted cursor-pointer hover:opacity-90 transition-opacity">
                          <Image
                            src={item.image_url}
                            alt="Evidencia"
                            fill
                            className="object-cover"
                          />
                        </div>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl p-1 bg-transparent border-none shadow-none" showCloseButton={false}>
                        <DialogTitle className="sr-only">Evidencia Ampliada</DialogTitle>
                        <div className="relative w-full h-[80vh]">
                          <Image
                            src={item.image_url}
                            alt="Evidencia Ampliada"
                            fill
                            className="object-contain"
                          />
                        </div>
                        <DialogClose className="absolute top-2 right-2 md:-right-12 md:-top-12 md:text-white bg-background/80 hover:bg-background md:bg-transparent md:hover:bg-white/20 p-2 md:p-3 rounded-full md:border-none border shadow-sm transition-colors z-50">
                          <X className="w-5 h-5 md:w-8 md:h-8" />
                        </DialogClose>
                      </DialogContent>
                    </Dialog>
                    <div className="p-3 bg-background">
                      <span className="font-medium text-sm block">{STATUS_TRANSLATIONS[item.stage] || item.stage}</span>
                      {item.notes && <p className="text-xs text-muted-foreground mt-1">{item.notes}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
