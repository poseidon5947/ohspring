"use client";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import Header from "./Header";
import { api } from "@/lib/api";
export default function Landing() {
  const t = useTranslations(),
    locale = useLocale();
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const services = ["software", "support", "hardware", "onsite"];
  const systemFeatures = [
    {
      key: "requests",
      tag: "01",
      image: "/brand/emblems/tracked-requests-v1.png",
    },
    {
      key: "remoteFlow",
      tag: "02",
      image: "/brand/emblems/remote-response-v1.png",
    },
    {
      key: "fieldService",
      tag: "03",
      image: "/brand/emblems/field-coordination-v1.png",
    },
    {
      key: "visibility",
      tag: "04",
      image: "/brand/emblems/visible-progress-v1.png",
    },
  ];
  const journeyStages = [
    {
      key: "journeyDiscover",
      image: "/brand/emblems/journey-understand-v1.png",
    },
    {
      key: "journeyDesign",
      image: "/brand/emblems/journey-plan-v1.png",
    },
    {
      key: "journeyDeliver",
      image: "/brand/emblems/journey-resolve-v1.png",
    },
    {
      key: "journeyCare",
      image: "/brand/emblems/journey-care-v1.png",
    },
  ];
  async function contact(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    setNotice("");
    try {
      await api("/contact", "POST", Object.fromEntries(new FormData(form)));
      setNotice("sent");
      form.reset();
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Header />
      <main>
        <section className="hero container">
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="red-dot" />
              {t("eyebrow")}
            </p>
            <h1>
              {t("heroA")}
              <br />
              <em>{t("heroB")}</em>
            </h1>
            <p className="lead">{t("heroText")}</p>
            <div className="actions">
              <a className="button" href="#contact">
                {t("start")} <span aria-hidden>↗</span>
              </a>
              <a className="text-link" href="#services">
                {t("explore")} <span aria-hidden>↓</span>
              </a>
            </div>
          </div>
          <div className="hero-art">
            <div className="art-label">
              <span className="red-dot" /> AB / {t("connected")}
            </div>
            <div className="hero-nexus-stage">
              <Image
                className="hero-nexus"
                src="/brand/emblems/hero-nexus-v1.png"
                alt={t("heroNexusAlt")}
                width={620}
                height={620}
                priority
              />
              <span className="hero-nexus-logo">
                <Image
                  src="/brand/logo.png"
                  alt="AB Systems Tech"
                  width={150}
                  height={150}
                  priority
                />
              </span>
            </div>
            <div className="art-bottom">
              <span>
                01 — {t("softwareLabel")}
                <br />
                02 — {t("hardwareLabel")}
                <br />
                03 — {t("supportLabel")}
              </span>
              <span className="hero-signal" aria-hidden>
                <i /> <i /> <i />
              </span>
            </div>
          </div>
        </section>
        <div className="trust-strip">
          <div className="container">
            {[
              ["remote", "/brand/emblems/remote-response-v1.png"],
              ["local", "/brand/emblems/field-coordination-v1.png"],
              ["human", "/brand/emblems/tracked-requests-v1.png"],
            ].map(([label, image]) => (
              <span className="trust-item" key={label}>
                <Image src={image} alt="" width={42} height={42} />
                {t(label)}
              </span>
            ))}
          </div>
        </div>
        <section className="section container" id="services">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{t("serviceEyebrow")}</p>
              <h2>{t("serviceTitle")}</h2>
            </div>
            <p>{t("serviceIntro")}</p>
          </div>
          <figure className="service-showcase">
            <img
              src="/brand/services-showcase-v1.png"
              alt={t("serviceShowcaseAlt")}
              width={1672}
              height={941}
              loading="lazy"
            />
            <figcaption>
              <span>AB SYSTEMS TECH / 01—04</span>
              <span>{t("serviceShowcaseCaption")}</span>
            </figcaption>
          </figure>
          <div className="service-grid">
            {services.map((s, i) => (
              <article className={`service-card service-card-${s}`} key={s}>
                <div className="card-top">
                  <span className="coverage-tag">
                    {t(i < 2 ? "global" : "colombia")}
                  </span>
                </div>
                <h3>{t(s)}</h3>
                <p>{t(s + "Text")}</p>
                <a className="text-link" href="#contact">
                  {t("discuss")} <span aria-hidden>↗</span>
                </a>
              </article>
            ))}
          </div>
        </section>
        <section className="systems-section" aria-labelledby="systems-title">
          <svg
            className="systems-circuit"
            viewBox="0 0 1440 760"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path d="M0 126H250C312 126 312 72 374 72H548" />
            <path d="M0 154H262C324 154 324 96 386 96H610" />
            <path d="M1440 608H1194C1132 608 1132 664 1070 664H836" />
            <path d="M1440 580H1182C1120 580 1120 636 1058 636H902" />
          </svg>
          <div className="container systems-inner">
            <div className="systems-heading">
              <div>
                <p className="eyebrow">{t("systemsEyebrow")}</p>
                <h2 id="systems-title">{t("systemsTitle")}</h2>
              </div>
              <p>{t("systemsIntro")}</p>
            </div>
            <div className="systems-grid">
              <article className="systems-core">
                <div className="systems-core-copy">
                  <span className="systems-kicker">
                    {t("systemsCoreKicker")}
                  </span>
                  <h3>{t("systemsCoreTitle")}</h3>
                  <p>{t("systemsCoreText")}</p>
                  <span className="systems-status">
                    <span aria-hidden /> {t("systemsOnline")}
                  </span>
                </div>
                <div className="systems-orbit" aria-hidden="true">
                  <span className="orbit-ring orbit-ring-one" />
                  <span className="orbit-ring orbit-ring-two" />
                  <span className="orbit-node orbit-node-one" />
                  <span className="orbit-node orbit-node-two" />
                  <span className="orbit-node orbit-node-three" />
                  <span className="systems-orbit-mark">
                    <Image
                      src="/brand/logo.png"
                      alt="AB Systems Tech"
                      width={92}
                      height={92}
                    />
                  </span>
                </div>
                <div className="systems-stream" aria-hidden="true">
                  {Array.from({ length: 12 }, (_, i) => (
                    <span key={i} />
                  ))}
                </div>
              </article>
              {systemFeatures.map((feature, index) => (
                <article
                  className={`systems-feature systems-feature-${index + 1}`}
                  key={feature.key}
                >
                  <div className="systems-feature-top">
                    <span
                      className={`systems-feature-icon systems-feature-icon-${feature.key}`}
                    >
                      <Image
                        src={feature.image}
                        alt={t(`${feature.key}Title`)}
                        width={88}
                        height={88}
                      />
                    </span>
                    <span className="systems-feature-tag">{feature.tag}</span>
                  </div>
                  <h3>{t(`${feature.key}Title`)}</h3>
                  <p>{t(`${feature.key}Text`)}</p>
                  <span className="systems-feature-link" aria-hidden>
                    <i />
                    <i />
                  </span>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section className="journey-section" aria-labelledby="journey-title">
          <div className="container">
            <div className="journey-heading">
              <div>
                <p className="eyebrow">{t("journeyEyebrow")}</p>
                <h2 id="journey-title">{t("journeyTitle")}</h2>
              </div>
              <p>{t("journeyIntro")}</p>
            </div>
            <div className="journey-console">
              <div className="journey-console-bar">
                <span>{t("journeySequence")}</span>
                <span className="journey-live">
                  <i aria-hidden /> {t("journeyLive")}
                </span>
              </div>
              <div className="journey-track">
                <span
                  className="journey-packet journey-packet-one"
                  aria-hidden
                />
                <span
                  className="journey-packet journey-packet-two"
                  aria-hidden
                />
                {journeyStages.map((stage, index) => (
                  <article className="journey-stage" key={stage.key}>
                    <div className="journey-node">
                      <Image
                        src={stage.image}
                        alt={t(`${stage.key}Title`)}
                        width={126}
                        height={126}
                      />
                    </div>
                    <span className="journey-index">0{index + 1}</span>
                    <span className="journey-state">
                      {t(`${stage.key}State`)}
                    </span>
                    <h3>{t(`${stage.key}Title`)}</h3>
                    <p>{t(`${stage.key}Text`)}</p>
                  </article>
                ))}
              </div>
              <div className="journey-rail" aria-hidden>
                <div>
                  {Array.from({ length: 4 }, (_, i) => (
                    <span key={i}>{t("journeyLoop")}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
        <section className="about-section" id="about">
          <div className="container about-grid">
            <div>
              <p className="eyebrow">{t("aboutEyebrow")}</p>
              <h2>{t("aboutTitle")}</h2>
              <p className="lead">{t("aboutText")}</p>
              <div className="values">
                {[
                  "professionalism",
                  "trust",
                  "dynamism",
                  "approachability",
                ].map((v, index) => (
                  <span key={v}>
                    <small>0{index + 1}</small>
                    {t(v)}
                  </span>
                ))}
              </div>
            </div>
            <div className="mission-cards">
              {["mission", "vision"].map((x, i) => (
                <article key={x}>
                  <span className="number">0{i + 1}</span>
                  <div>
                    <h3>{t(x)}</h3>
                    <p>{t(x + "Text")}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section className="section container portal-promo">
          <div>
            <p className="eyebrow">{t("portal")}</p>
            <h2>{t("portalTitle")}</h2>
            <p>{t("portalText")}</p>
            <Link className="button" href={`/${locale}/login`}>
              {t("portal")} ↗
            </Link>
          </div>
          <ol className="steps">
            {["step1", "step2", "step3"].map((s, i) => (
              <li key={s}>
                <Image
                  src={journeyStages[i].image}
                  alt=""
                  width={64}
                  height={64}
                />
                <div>
                  <span>0{i + 1}</span>
                  <h3>{t(s)}</h3>
                </div>
              </li>
            ))}
          </ol>
        </section>
        <section className="contact-section" id="contact">
          <div className="container contact-grid">
            <div>
              <p className="eyebrow">{t("contact")}</p>
              <h2>{t("contactTitle")}</h2>
              <p>{t("contactText")}</p>
              <div className="location">
                <Image
                  src="/brand/emblems/field-coordination-v1.png"
                  alt=""
                  width={74}
                  height={74}
                />
                <div>
                  <strong>{t("location")}</strong>
                  <p>{t("coverage")}</p>
                </div>
              </div>
            </div>
            <form onSubmit={contact} className="contact-form">
              <div className="form-grid">
                <label>
                  {t("name")}
                  <input
                    name="name"
                    autoComplete="name"
                    required
                    maxLength={120}
                  />
                </label>
                <label>
                  {t("email")}
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    maxLength={254}
                  />
                </label>
              </div>
              <label>
                {t("service")}
                <select name="service">
                  {services.map((s) => (
                    <option key={s} value={s}>
                      {t(s)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t("message")}
                <textarea name="message" rows={4} required maxLength={5000} />
              </label>
              <p className="fine-print">{t("privacy")}</p>
              <button className="button" disabled={busy}>
                {t(busy ? "saving" : "send")} ↗
              </button>
              {notice && (
                <p
                  role="status"
                  className={notice === "sent" ? "success" : "error"}
                >
                  {t.has(notice) ? t(notice) : t("requestFailed")}
                </p>
              )}
            </form>
          </div>
        </section>
      </main>
      <footer className="container footer">
        <strong>AB SYSTEMS TECH</strong>
        <span>
          © {new Date().getFullYear()} AB Systems Tech. {t("rights")}
        </span>
        <a href="#">↑ {t("home")}</a>
      </footer>
    </>
  );
}
