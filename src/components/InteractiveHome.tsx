"use client";

import { motion } from "framer-motion";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useTheme } from "next-themes";
import { useUser } from "@/components/UserContext";

function InkTrail() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let points: { x: number; y: number; life: number }[] = [];
    let animationFrameId: number;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", resize);
    resize();

    const handleMouseMove = (e: MouseEvent) => {
      points.push({ x: e.clientX, y: e.clientY, life: 1.0 });
    };
    window.addEventListener("mousemove", handleMouseMove);

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const isDark = resolvedTheme === "dark";
      const rgb = isDark ? "255, 255, 255" : "0, 0, 0"; // White ink in dark mode, black in light mode

      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = 4;

      if (points.length > 1) {
        for (let i = 0; i < points.length - 1; i++) {
          const p1 = points[i];
          const p2 = points[i + 1];
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = `rgba(${rgb}, ${p1.life})`;
          ctx.stroke();
          p1.life -= 0.02; // Fade speed
        }
      }

      if (points.length > 0) {
        points[points.length - 1].life -= 0.02;
      }

      points = points.filter((p) => p.life > 0);

      animationFrameId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, [resolvedTheme]);

  return <canvas ref={canvasRef} className="absolute inset-0 z-0 pointer-events-none" />;
}

export function InteractiveHome() {
  const { displayName } = useUser();

  return (
    <div
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden transition-colors duration-300 notebook-bg dark:notebook-bg-dark"
    >
      <InkTrail />
      
      <div className="z-10 max-w-5xl w-full items-center justify-center flex flex-col font-sans text-sm leading-7 space-y-8 relative pointer-events-none">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="flex flex-col items-center space-y-6 pointer-events-auto"
        >
          
          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter text-zinc-900 dark:text-white text-center bg-clip-text">
            Intrusive Thoughts?
          </h1>
          
          <p className="text-lg md:text-xl text-zinc-600 dark:text-zinc-400 text-center max-w-2xl leading-relaxed">
            Get them out of your head
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="flex flex-col sm:flex-row items-center gap-4 pointer-events-auto"
        >
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Link 
              href="/chat" 
              className="group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full bg-black dark:bg-white px-8 py-4 text-base font-semibold text-white dark:text-black transition-all hover:bg-zinc-800 dark:hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2"
            >
              <span className="relative z-10 flex items-center gap-2">
                BEGIN
                <ArrowRight className="w-4 h-4" />
              </span>
            </Link>
          </motion.div>
        </motion.div>

        {/* Identity display */}
        {displayName && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.8 }}
            className="pointer-events-auto"
          >
            <p className="text-xs text-zinc-400 dark:text-zinc-600">
              You are <span className="font-medium text-zinc-500 dark:text-zinc-500">{displayName}</span>
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
