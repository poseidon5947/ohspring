"use client";

import { useEffect, useRef } from "react";

/** Original portfolio atmosphere, with React lifecycle and reduced-motion support. */
export default function PortfolioAtmosphere() {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const element = canvas.current,
      ctx = element?.getContext("2d");
    if (!element || !ctx) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let width = 0,
      height = 0,
      frame = 0,
      last = 0,
      elapsed = 0;
    let stars: {
      x: number;
      y: number;
      radius: number;
      speed: number;
      phase: number;
    }[] = [];
    const resize = () => {
      width = innerWidth;
      height = innerHeight;
      const ratio = Math.min(devicePixelRatio || 1, 2);
      element.width = width * ratio;
      element.height = height * ratio;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      stars = Array.from({ length: width < 768 ? 43 : 85 }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 1.4 + 0.4,
        speed: Math.random() * 7 + 3,
        phase: Math.random() * Math.PI * 2,
      }));
    };
    const draw = (time: number) => {
      const delta = last ? Math.min((time - last) / 1000, 0.05) : 0;
      last = time;
      elapsed += delta;
      ctx.clearRect(0, 0, width, height);
      for (const star of stars) {
        if (!reduced.matches)
          star.y = (star.y - star.speed * delta + height) % height;
        ctx.globalAlpha =
          0.2 + (Math.sin(elapsed * 0.7 + star.phase) + 1) * 0.22;
        ctx.fillStyle = "#faebd7";
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      const meteor = elapsed % 11;
      if (!reduced.matches && meteor < 1.4) {
        const x = width * 0.72 - meteor * 300,
          y = height * 0.12 + meteor * 180;
        const trail = ctx.createLinearGradient(x, y, x + 100, y - 60);
        trail.addColorStop(0, "rgba(222,184,135,.8)");
        trail.addColorStop(1, "rgba(222,184,135,0)");
        ctx.globalAlpha = Math.sin((meteor / 1.4) * Math.PI);
        ctx.strokeStyle = trail;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 100, y - 60);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      if (!reduced.matches && !document.hidden)
        frame = requestAnimationFrame(draw);
    };
    const restart = () => {
      cancelAnimationFrame(frame);
      last = 0;
      draw(performance.now());
    };
    resize();
    restart();
    const onResize = () => {
      resize();
      restart();
    };
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", restart);
    reduced.addEventListener("change", restart);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", restart);
      reduced.removeEventListener("change", restart);
    };
  }, []);
  return (
    <div className="portfolio-atmosphere" aria-hidden="true">
      <div className="portfolio-clouds" />
      <canvas ref={canvas} />
    </div>
  );
}
