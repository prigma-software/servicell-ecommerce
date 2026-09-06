import type { NextConfig } from "next";
import type { Configuration, RuleSetRule } from "webpack";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

if (process.env.NODE_ENV === "development") {
  initOpenNextCloudflareForDev();
}

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
  async headers() {
    const isProd = process.env.NODE_ENV === "production";

    const securityHeaders = [
      {
        key: "X-Content-Type-Options",
        value: "nosniff",
      },
      {
        key: "X-Frame-Options",
        value: "DENY",
      },
      {
        key: "Referrer-Policy",
        value: "strict-origin-when-cross-origin",
      },
      {
        key: "Permissions-Policy",
        value: 'camera=(), microphone=(), geolocation=(), payment=(self "https://checkout.wompi.co")',
      },
      {
        key: "Content-Security-Policy",
        value: [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.wompi.co https://static.cloudflareinsights.com",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob: https: *.supabase.co",
          "font-src 'self' data:",
          "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://checkout.wompi.co https://production.wompi.co https://sandbox.wompi.co https://*.cloudflare.com https://cloudflareinsights.com",
          "frame-src 'self' https://checkout.wompi.co",
          "frame-ancestors 'none'",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self'",
        ].join("; "),
      },
    ];

    if (isProd) {
      securityHeaders.push({
        key: "Strict-Transport-Security",
        value: "max-age=31536000; includeSubDomains; preload",
      });
    }

    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  serverExternalPackages: ["@cf-wasm/photon"],
  webpack: (config: Configuration) => {
    // Remove default webpack WASM rule
    const existingRules = config.module?.rules as RuleSetRule[] | undefined;
    if (existingRules) {
      const wasmRuleIndex = existingRules.findIndex(
        (rule) => rule.test instanceof RegExp && rule.test.test(".wasm")
      );
      if (wasmRuleIndex !== -1) {
        existingRules.splice(wasmRuleIndex, 1);
      }
    }

    return config;
  },
};

export default nextConfig;