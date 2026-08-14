"use client"

import Image from "next/image"
import { storeBranding } from "@/lib/constants/branding-store"

type StoreLogoProps = {
  src?: string
  alt?: string
  size?: "sm" | "md" | "lg"
  className?: string
}

const sizes = { 
  sm: { width: 100, height: 28 }, 
  md: { width: 160, height: 40 }, 
  lg: { width: 280, height: 80 } 
} as const

export function StoreLogo({ src, alt, size = "md", className = "" }: StoreLogoProps) {
  const { width, height } = sizes[size]
  const logoSrc = src ?? storeBranding.assets.logo
  const logoAlt = alt ?? storeBranding.name

  return (
    <div className={`flex items-center justify-center ${className}`} style={{ width, height, maxWidth: '100%', maxHeight: '90%' }}>
      <Image
        src={logoSrc}
        alt={logoAlt}
        width={width}
        height={height}
        className="object-contain w-auto h-auto max-w-full max-h-full"
      />
    </div>
  )
}
