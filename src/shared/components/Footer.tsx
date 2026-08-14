"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  EnvelopeSimple,
  Phone,
  MapPin,
  FacebookLogo,
  InstagramLogo,
  TwitterLogo,
  YoutubeLogo,
} from "@phosphor-icons/react";
import { storeBranding } from "@/lib/constants/branding-store";
import { prigmaBranding } from "@/lib/constants/branding-prigma";
import { StoreLogo } from "@/components/branding/store-logo";
import { StoreName } from "@/components/branding/store-name";
import { PrigmaLogo } from "@/components/branding/prigma-logo";
import { ThemeSwitcher } from "@/components/theme-switcher";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <motion.footer
      className="bg-card border-t border-border mt-auto relative overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-secondary/50 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary/30 rounded-full blur-3xl" />
      </div>

      <div className="max-w-screen-2xl mx-auto px-6 pt-16 relative">
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 gap-8 lg:gap-12 max-w-[800px] mx-auto"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          <motion.div
            className="col-span-2 md:col-span-1 space-y-5"
            whileHover={{ scale: 1.02 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <Link href="/" className="flex items-center gap-2">
              <motion.div
                // whileHover={{ rotate: [0, -10, 10, 0] }}
                transition={{ duration: 0.5 }}
              >
                <StoreLogo size="md" />
              </motion.div>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {storeBranding.about.tagline}
            </p>
            <motion.div
              className="flex gap-3 pt-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              {[
                {
                  Icon: FacebookLogo,
                  href: storeBranding.social.facebook,
                  label: "Facebook",
                },
                {
                  Icon: InstagramLogo,
                  href: storeBranding.social.instagram,
                  label: "Instagram",
                },
                {
                  Icon: TwitterLogo,
                  href: storeBranding.social.twitter,
                  label: "Twitter",
                },
                {
                  Icon: YoutubeLogo,
                  href: storeBranding.social.youtube,
                  label: "Youtube",
                },
              ].map((social, i) => (
                <motion.a
                  key={i}
                  href={social.href}
                  aria-label={social.label}
                  className="w-11 h-11 rounded-xl bg-secondary flex items-center justify-center hover:bg-accent transition-all duration-300 hover:-translate-y-1 hover:shadow-lg border border-border"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <social.Icon className="w-5 h-5" weight="fill" />
                </motion.a>
              ))}
            </motion.div>
          </motion.div>
          <motion.div
            className="space-y-5"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <h3 className="font-bold text-card-foreground text-lg">Contacto</h3>
            <div className="flex flex-col gap-4">
              {[
                {
                  Icon: MapPin,
                  text: `${storeBranding.contact.address}, ${storeBranding.contact.city}, ${storeBranding.contact.country}`,
                },
                { Icon: Phone, text: storeBranding.contact.phone },
                { Icon: EnvelopeSimple, text: storeBranding.contact.email },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  className="flex items-start gap-3 text-sm text-muted-foreground group"
                  whileHover={{ x: 5 }}
                  transition={{ type: "spring", stiffness: 400 }}
                >
                  <motion.div
                    className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0 group-hover:bg-accent transition-colors duration-300 border border-border"
                    whileHover={{ rotate: [0, -10, 10, 0] }}
                    transition={{ duration: 0.5 }}
                  >
                    <item.Icon className="w-5 h-5" weight="duotone" />
                  </motion.div>
                  <span className="group-hover:text-card-foreground transition-colors duration-300">
                    {item.text}
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </motion.div>

        <motion.div
          className="border-t border-border mt-12 pt-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
        >
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <motion.p
              className="text-sm text-muted-foreground"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
            >
              © {currentYear} {storeBranding.legal.copyrightName}. Todos los
              derechos reservados.
            </motion.p>
            <motion.div
              className="flex gap-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9 }}
            >
              {[
                { href: "/terms", label: "Términos y Condiciones" },
              ].map((link) => (
                <motion.div
                  key={link.href}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-card-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </motion.div>
              ))}
              <div className="flex items-center ml-4 border-l border-border pl-4">
                <ThemeSwitcher />
              </div>
            </motion.div>
          </div>
        </motion.div>

        <motion.div
          className="border-t border-border mt-8 pt-6 flex items-center justify-center gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.0 }}
        >
          <a
            href={prigmaBranding.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 hover:opacity-80 transition-opacity"
          >
            <PrigmaLogo size="sm" />
            <span className="text-sm text-muted-foreground">
              Desarrollado por {prigmaBranding.company}
            </span>
          </a>
        </motion.div>
      </div>
    </motion.footer>
  );
}
