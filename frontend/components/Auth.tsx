"use client";
import Header from "./Header";
import Image from "next/image";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
export default function Auth() {
  const t = useTranslations(),
    locale = useLocale(),
    router = useRouter();
  const [register, setRegister] = useState(false),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setNotice("");
    const data = Object.fromEntries(new FormData(e.currentTarget)) as Record<
      string,
      string
    >;
    try {
      if (register) {
        await api("/auth/register", "POST", data);
        setRegister(false);
        setNotice("registered");
      } else {
        await api(
          "/auth/login",
          "POST",
          new URLSearchParams({
            username: data.email.toLowerCase(),
            password: data.password,
          }),
        );
        window.dispatchEvent(new Event("ab:navigation-start"));
        router.push(`/${locale}/workspace`);
      }
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Header />
      <main className="auth-layout container">
        <div className="auth-intro">
          <p className="eyebrow">AB SYSTEMS TECH</p>
          <h1>{t("portalTitle")}</h1>
          <p className="lead">{t("authText")}</p>
          <div className="auth-nexus-stage">
            <Image
              className="auth-nexus"
              src="/brand/emblems/hero-nexus-v1.webp"
              width={440}
              height={440}
              alt={t("heroNexusAlt")}
              priority
            />
            <Image
              className="auth-nexus-logo"
              src="/brand/logo.webp"
              width={106}
              height={106}
              alt="AB Systems Tech"
              priority
            />
          </div>
        </div>
        <form className="auth-card" onSubmit={submit}>
          <p className="eyebrow">{t("portal")}</p>
          <h2>{t(register ? "register" : "welcome")}</h2>
          {register && (
            <label>
              {t("name")}
              <input name="name" required maxLength={120} autoComplete="name" />
            </label>
          )}
          <label>
            {t("email")}
            <input
              type="email"
              name="email"
              required
              maxLength={254}
              autoComplete="email"
            />
          </label>
          <label>
            {t("password")}
            <input
              type="password"
              name="password"
              required
              minLength={12}
              maxLength={72}
              autoComplete={register ? "new-password" : "current-password"}
            />
          </label>
          <button className="button" disabled={busy}>
            {t(busy ? "saving" : register ? "register" : "login")} ↗
          </button>
          {notice && (
            <p
              role="status"
              className={notice === "registered" ? "success" : "error"}
            >
              {t.has(notice) ? t(notice) : t("requestFailed")}
            </p>
          )}
          <p>
            {t(register ? "existing" : "newCustomer")}{" "}
            <button
              type="button"
              className="link-button"
              onClick={() => {
                setRegister(!register);
                setNotice("");
              }}
            >
              {t(register ? "login" : "register")}
            </button>
          </p>
        </form>
      </main>
    </>
  );
}
