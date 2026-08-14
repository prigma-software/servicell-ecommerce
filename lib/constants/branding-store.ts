export const storeBranding = {
  // Core identity
  name: "Servicell",
  description:
    "Reparación de dispositivos móviles y computadores. Tecnología en buenas manos.",
  url: "https://servicell-sogamoso.com",
  locale: "es_CO" as const,

  // Theme
  theme: {
    defaultTheme: "dark", // Can be "light", "dark", or "system"
  },

  // Contact
  contact: {
    phone: "+57 320 2340616",
    email: "contacto@servicell-sogamoso.com",
    address: "Calle 11 No. 12-27 San Andresito ASOPEC Local 213",
    city: "Sogamoso",
    country: "Colombia",
    schedule: "Lunes a Sábado 9am - 7pm",
  },
  whatsapp: "573202340616",

  // Social
  social: {
    facebook: "#",
    instagram: "#",
    twitter: "#",
    youtube: "#",
  },

  // Legal
  legal: {
    copyrightName: "Servicell",
  },

  // Assets
  assets: {
    logo: "/images/brandClient/servicell_logo.png",
    logoIcon: "/images/brandClient/servicell_icon.png",
    logoText: "/images/brandClient/servicell_logo.png",
    logoFull: "/images/brandClient/servicell_logo.png",
    favicon: "/favicon.ico",
    ogImage: "/images/brandClient/servicell_og.png",
    aboutHero: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1200&h=400&fit=crop", // Development/Laptop
    aboutTeam: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&h=200&fit=crop", // Team working on software
    aboutWarehouse: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=600&h=200&fit=crop", // Servers/Cloud
  },

  // About page content
  about: {
    heroTitle: "Tecnología en Buenas Manos",
    heroDescription:
      "Somos especialistas en la reparación y mantenimiento de dispositivos móviles y computadores. Tu equipo seguro y con garantía.",
    storyTitle: "Sobre Servicell",
    storySubtitle: "Calidad, Confianza y Garantía",
    storyText:
      "En Servicell nos dedicamos a brindar el mejor servicio técnico para tus dispositivos. Manejamos todas las marcas (Sony, Huawei, Samsung, LG, Apple, Alcatel) y contamos con el conocimiento técnico para solucionar problemas de hardware y software.",
    mission:
      "Ofrecer un servicio de reparación técnico transparente, rápido y confiable, garantizando que los equipos de nuestros clientes funcionen a la perfección.",
    vision:
      "Ser el centro de servicio técnico líder en Sogamoso, reconocido por nuestra calidad, honestidad y la excelencia en reparación de tecnología.",
    tagline:
      "Tecnología en buenas manos.",
    teamText:
      "Contamos con técnicos certificados y con experiencia en reparación de dispositivos.",
    warehouseText:
      "Laboratorio técnico equipado con herramientas de precisión para diagnósticos exactos.",
    stats: {
      clients: "1000+",
      products: "Multi-marca",
      years: "10+",
      secure: "100%",
    } as const,
  },

  // Features flags
  features: {
    workOrders: true,
    payments: {
      wompi: true,
      manual: true,
    }
  },
} as const;
