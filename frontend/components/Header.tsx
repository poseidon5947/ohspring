"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
export default function Header() {
  const t = useTranslations(),
    locale = useLocale(),
    path = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <header className="site-header">
      <div className="header-inner">
        <Link className="brand" href={`/${locale}`}>
          <img src="/brand/icon.png" alt="" width="64" height="64" />
          <span>
            AB SYSTEMS TECH<small>{t("brandLine")}</small>
          </span>
        </Link>
        <button
          className="menu-toggle"
          aria-expanded={open}
          aria-label="Menu"
          onClick={() => setOpen(!open)}
        >
          ☰
        </button>
        <nav className={open ? "nav open" : "nav"} aria-label={t("home")}>
          <Link href={`/${locale}#services`} onClick={() => setOpen(false)}>
            {t("services")}
          </Link>
          <Link href={`/${locale}#about`} onClick={() => setOpen(false)}>
            {t("about")}
          </Link>
          <Link href={`/${locale}#contact`} onClick={() => setOpen(false)}>
            {t("contact")}
          </Link>
          <div className="languages">
            <Link
              lang="es"
              aria-current={locale === "es" ? "page" : undefined}
              href={path.replace(/^\/(en|es)/, "/es")}
            >
              ES
            </Link>
            <span>/</span>
            <Link
              lang="en"
              aria-current={locale === "en" ? "page" : undefined}
              href={path.replace(/^\/(en|es)/, "/en")}
            >
              EN
            </Link>
          </div>
          <Link className="button outline small" href={`/${locale}/login`}>
            {t("portal")} <span aria-hidden>↗</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
