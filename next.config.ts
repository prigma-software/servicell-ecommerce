import type { NextConfig } from "next";
import type { Configuration, RuleSetRule } from "webpack";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

if (process.env.NODE_ENV === "development") {
  initOpenNextCloudflareForDev();
}

const nextConfig: NextConfig = {
  output: "standalone",
  eslint: {
    ignoreDuringBuilds: true,
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