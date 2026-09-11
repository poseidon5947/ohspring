"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type InitialPhase = "loading" | "leaving" | "done";
type TransitionPhase = "idle" | "loading" | "leaving";

/** Uses the supplied film on first load and the original AB loader between pages. */
export default function WebsiteLoader({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [initialPhase, setInitialPhase] = useState<InitialPhase>("loading");
  const [transitionPhase, setTransitionPhase] =
    useState<TransitionPhase>("idle");
  const [label, setLabel] = useState("Cargando / Loading");
  const content = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const initialPhaseRef = useRef<InitialPhase>("loading");
  const transitionPhaseRef = useRef<TransitionPhase>("idle");
  const transitionStarted = useRef(0);
  const previousPath = useRef(pathname);
  const previousOverflow = useRef("");
  const transitionTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const lockPage = useCallback(() => {
    previousOverflow.current = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (content.current) content.current.inert = true;
  }, []);

  const unlockPage = useCallback(() => {
    document.body.style.overflow = previousOverflow.current;
    if (content.current) content.current.inert = false;
  }, []);

  const finishTransition = useCallback(() => {
    if (transitionPhaseRef.current !== "loading") return;
    const elapsed = performance.now() - transitionStarted.current;
    transitionTimers.current.push(
      setTimeout(
        () => {
          transitionPhaseRef.current = "leaving";
          setTransitionPhase("leaving");
          unlockPage();
          transitionTimers.current.push(
            setTimeout(() => {
              transitionPhaseRef.current = "idle";
              setTransitionPhase("idle");
            }, 420),
          );
        },
        Math.max(0, 620 - elapsed),
      ),
    );
  }, [unlockPage]);

  const beginTransition = useCallback(() => {
    if (
      initialPhaseRef.current !== "done" ||
      transitionPhaseRef.current !== "idle"
    )
      return;
    transitionPhaseRef.current = "loading";
    transitionStarted.current = performance.now();
    setTransitionPhase("loading");
    setLabel(
      location.pathname.startsWith("/en")
        ? "Connecting your next page"
        : "Conectando tu próxima página",
    );
    lockPage();
    transitionTimers.current.push(setTimeout(finishTransition, 5000));
  }, [finishTransition, lockPage]);

  useEffect(() => {
    let cancelled = false;
    let pageReady = false;
    let videoFinished = false;
    let finished = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const started = performance.now();
    lockPage();
    setLabel(
      location.pathname.startsWith("/en")
        ? "Loading your experience"
        : "Cargando tu experiencia",
    );

    const finish = () => {
      if (cancelled || finished || !pageReady || !videoFinished) return;
      finished = true;
      timers.push(
        setTimeout(
          () => {
            if (cancelled) return;
            initialPhaseRef.current = "leaving";
            setInitialPhase("leaving");
            unlockPage();
            timers.push(
              setTimeout(
                () => {
                  if (cancelled) return;
                  initialPhaseRef.current = "done";
                  setInitialPhase("done");
                },
                reduced ? 0 : 280,
              ),
            );
          },
          reduced ? 0 : Math.max(0, 900 - (performance.now() - started)),
        ),
      );
    };

    const markVideoFinished = () => {
      videoFinished = true;
      finish();
    };
    const movie = video.current;
    if (reduced) {
      videoFinished = true;
    } else if (movie) {
      movie.playbackRate = 1;
      movie.addEventListener("ended", markVideoFinished, { once: true });
      movie.addEventListener("error", markVideoFinished, { once: true });
      movie.play().catch(markVideoFinished);
    } else {
      videoFinished = true;
    }

    let removeLoad = () => {};
    const browserReady =
      document.readyState === "complete"
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            const resolveLoad = () => resolve();
            window.addEventListener("load", resolveLoad, { once: true });
            removeLoad = () => window.removeEventListener("load", resolveLoad);
          });
    Promise.allSettled([browserReady, document.fonts.ready]).then(() => {
      pageReady = true;
      finish();
    });
    timers.push(
      setTimeout(() => {
        videoFinished = true;
        finish();
      }, 1600),
    );
    timers.push(
      setTimeout(() => {
        videoFinished = true;
        pageReady = true;
        finish();
      }, 2400),
    );

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      removeLoad();
      movie?.removeEventListener("ended", markVideoFinished);
      movie?.removeEventListener("error", markVideoFinished);
      unlockPage();
    };
  }, [lockPage, unlockPage]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (
        !anchor ||
        anchor.target === "_blank" ||
        anchor.hasAttribute("download")
      )
        return;
      const destination = new URL(anchor.href, location.href);
      if (destination.origin !== location.origin) return;
      if (
        destination.pathname === location.pathname &&
        destination.search === location.search
      )
        return;
      beginTransition();
    };
    const handleNavigationStart = () => beginTransition();
    document.addEventListener("click", handleClick, true);
    window.addEventListener("popstate", handleNavigationStart);
    window.addEventListener("ab:navigation-start", handleNavigationStart);
    return () => {
      document.removeEventListener("click", handleClick, true);
      window.removeEventListener("popstate", handleNavigationStart);
      window.removeEventListener("ab:navigation-start", handleNavigationStart);
    };
  }, [beginTransition]);

  useEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    if (transitionPhaseRef.current === "idle") beginTransition();
    requestAnimationFrame(finishTransition);
  }, [pathname, beginTransition, finishTransition]);

  useEffect(() => () => transitionTimers.current.forEach(clearTimeout), []);

  return (
    <>
      {initialPhase !== "done" && (
        <div
          className={`website-loader website-loader-video ${
            initialPhase === "leaving" ? "is-leaving" : ""
          }`}
          role="status"
          aria-live="polite"
          aria-label={label}
        >
          <video
            ref={video}
            src="/brand/website_loading_animation.mp4"
            autoPlay
            muted
            playsInline
            preload="auto"
            aria-hidden="true"
          />
          <div className="website-loader-video-label">
            <span>AB SYSTEMS TECH</span>
            <small>{label}</small>
          </div>
        </div>
      )}
      {transitionPhase !== "idle" && (
        <div
          className={`website-loader website-loader-transition ${
            transitionPhase === "leaving" ? "is-leaving" : ""
          }`}
          role="status"
          aria-live="polite"
          aria-label={label}
        >
          <div className="website-loader-inner">
            <div className="website-loader-orbit" aria-hidden="true">
              <span />
              <span />
            </div>
            <div className="website-loader-logo">
              <img
                src="/brand/logo.webp"
                alt="AB Systems Tech"
                width={192}
                height={192}
              />
            </div>
            <p className="website-loader-brand">AB SYSTEMS TECH</p>
            <div className="website-loader-track" aria-hidden="true">
              <span />
            </div>
            <p className="website-loader-label">
              {label}
              <span aria-hidden="true">…</span>
            </p>
          </div>
        </div>
      )}
      <div
        ref={content}
        className={`site-content ${
          transitionPhase === "loading" ? "is-transitioning" : ""
        }`}
      >
        {children}
      </div>
      <noscript>
        <style>{`.website-loader{display:none!important}`}</style>
      </noscript>
    </>
  );
}
