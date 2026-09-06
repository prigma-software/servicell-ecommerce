export const notificationsConfig = {
  channels: {
    email:
      process.env.ENABLE_EMAIL_NOTIFICATIONS !== "false" &&
      process.env.NEXT_PUBLIC_ENABLE_EMAIL_NOTIFICATIONS !== "false",
    whatsapp:
      process.env.ENABLE_WHATSAPP_NOTIFICATIONS === "true" ||
      process.env.NEXT_PUBLIC_ENABLE_WHATSAPP_NOTIFICATIONS === "true",
  },
  whatsapp: {
    defaultCountryCode: process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || "57",
    defaultLanguageCode: process.env.WHATSAPP_TEMPLATE_LANGUAGE || "es",
    useTemplates: process.env.WHATSAPP_USE_TEMPLATES === "true",
    templates: {
      orderConfirmation:
        process.env.WHATSAPP_TEMPLATE_ORDER_CONFIRMATION || "order_confirmation",
      manualOrderPending:
        process.env.WHATSAPP_TEMPLATE_MANUAL_ORDER || "manual_order_pending",
      workOrderCreated:
        process.env.WHATSAPP_TEMPLATE_WORK_ORDER_CREATED || "work_order_created",
      workOrderStatusChange:
        process.env.WHATSAPP_TEMPLATE_WORK_ORDER_STATUS ||
        "work_order_status_update",
    },
  },
};
