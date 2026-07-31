"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import { useTheme } from 'next-themes';

export type GraphNode = {
  id: string;
  userId: string;
  parentId: string | null;
  title: string;
  displayName: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
  // Physics properties (added at runtime)
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
};

type Edge = {
  source: string;
  target: string;
};

type Props = {
  nodes: GraphNode[];
  onNodeClick: (node: GraphNode) => void;
};

// Generate a stable HSL color from a user ID
function userColor(userId: string, isDark: boolean): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  const sat = 70 + (Math.abs(hash >> 8) % 20);
  const light = isDark ? 60 : 45;
  return `hsl(${hue}, ${sat}%, ${light}%)`;
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export default function NetworkGraph({ nodes: rawNodes, onNodeClick }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  // State refs for animation loop
  const nodesRef = useRef<GraphNode[]>([]);
  const edgesRef = useRef<Edge[]>([]);
  const hoveredRef = useRef<GraphNode | null>(null);
  const dragRef = useRef<{ node: GraphNode; offsetX: number; offsetY: number } | null>(null);
  const panRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const isPanningRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });
  const animFrameRef = useRef<number>(0);

  // Initialize nodes with physics properties
  useEffect(() => {
    const centerX = (canvasRef.current?.width || 800) / 2;
    const centerY = (canvasRef.current?.height || 600) / 2;

    const existingPositions = new Map<string, { x: number; y: number }>();
    for (const n of nodesRef.current) {
      existingPositions.set(n.id, { x: n.x, y: n.y });
    }

    const initialized: GraphNode[] = rawNodes.map((n, i) => {
      const existing = existingPositions.get(n.id);
      const angle = (i / rawNodes.length) * Math.PI * 2;
      const spread = 150 + Math.random() * 200;
      return {
        ...n,
        x: existing?.x ?? centerX + Math.cos(angle) * spread,
        y: existing?.y ?? centerY + Math.sin(angle) * spread,
        vx: 0,
        vy: 0,
        radius: Math.max(12, Math.min(35, 8 + n.messageCount * 3)),
        color: userColor(n.userId, isDark),
      };
    });

    nodesRef.current = initialized;

    // Build edges from parent relationships
    const edges: Edge[] = [];
    const nodeIds = new Set(initialized.map(n => n.id));
    for (const node of initialized) {
      if (node.parentId && nodeIds.has(node.parentId)) {
        edges.push({ source: node.parentId, target: node.id });
      }
    }

    // Connect same-user nodes with weaker links
    const userGroups = new Map<string, string[]>();
    for (const node of initialized) {
      if (!userGroups.has(node.userId)) userGroups.set(node.userId, []);
      userGroups.get(node.userId)!.push(node.id);
    }
    for (const [, ids] of userGroups) {
      for (let i = 1; i < ids.length; i++) {
        // Only add if not already connected via parent
        const exists = edges.some(e =>
          (e.source === ids[i - 1] && e.target === ids[i]) ||
          (e.source === ids[i] && e.target === ids[i - 1])
        );
        if (!exists) {
          edges.push({ source: ids[i - 1], target: ids[i] });
        }
      }
    }

    edgesRef.current = edges;
  }, [rawNodes, isDark]);

  // Screen to world coordinates
  const screenToWorld = useCallback((sx: number, sy: number) => {
    return {
      x: (sx - panRef.current.x) / zoomRef.current,
      y: (sy - panRef.current.y) / zoomRef.current,
    };
  }, []);

  // Find node under cursor
  const findNodeAt = useCallback((wx: number, wy: number): GraphNode | null => {
    // Iterate in reverse so top-rendered nodes are hit first
    for (let i = nodesRef.current.length - 1; i >= 0; i--) {
      const n = nodesRef.current[i];
      const dx = wx - n.x;
      const dy = wy - n.y;
      if (dx * dx + dy * dy <= n.radius * n.radius) return n;
    }
    return null;
  }, []);

  // Physics simulation + render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.parentElement?.clientWidth || window.innerWidth;
      canvas.height = canvas.parentElement?.clientHeight || window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Physics constants
    const REPULSION = 8000;
    const SPRING_K = 0.005;
    const SPRING_REST = 120;
    const DAMPING = 0.92;
    const CENTER_GRAVITY = 0.0003;

    let particleTime = 0;

    const tick = () => {
      const nodes = nodesRef.current;
      const edges = edgesRef.current;
      const W = canvas.width;
      const H = canvas.height;

      // --- Physics ---
      const centerX = W / 2 / zoomRef.current - panRef.current.x / zoomRef.current;
      const centerY = H / 2 / zoomRef.current - panRef.current.y / zoomRef.current;

      // Repulsion between all node pairs
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          let dx = nodes[j].x - nodes[i].x;
          let dy = nodes[j].y - nodes[i].y;
          let dist = Math.sqrt(dx * dx + dy * dy) || 1;
          let force = REPULSION / (dist * dist);
          let fx = (dx / dist) * force;
          let fy = (dy / dist) * force;
          nodes[i].vx -= fx;
          nodes[i].vy -= fy;
          nodes[j].vx += fx;
          nodes[j].vy += fy;
        }
      }

      // Spring forces along edges
      for (const edge of edges) {
        const a = nodes.find(n => n.id === edge.source);
        const b = nodes.find(n => n.id === edge.target);
        if (!a || !b) continue;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let dist = Math.sqrt(dx * dx + dy * dy) || 1;
        let displacement = dist - SPRING_REST;
        let force = SPRING_K * displacement;
        let fx = (dx / dist) * force;
        let fy = (dy / dist) * force;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }

      // Gentle gravity toward center
      for (const node of nodes) {
        node.vx += (centerX - node.x) * CENTER_GRAVITY;
        node.vy += (centerY - node.y) * CENTER_GRAVITY;
      }

      // Apply velocity + damping
      for (const node of nodes) {
        if (dragRef.current && dragRef.current.node.id === node.id) continue;
        node.vx *= DAMPING;
        node.vy *= DAMPING;
        node.x += node.vx;
        node.y += node.vy;
      }

      // --- Render ---
      ctx.save();
      ctx.clearRect(0, 0, W, H);

      // Background
      ctx.fillStyle = isDark ? '#09090b' : '#fafafa';
      ctx.fillRect(0, 0, W, H);

      // Subtle grid
      ctx.save();
      ctx.translate(panRef.current.x, panRef.current.y);
      ctx.scale(zoomRef.current, zoomRef.current);

      const gridSize = 50;
      ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)';
      ctx.lineWidth = 0.5 / zoomRef.current;
      const startX = Math.floor(-panRef.current.x / zoomRef.current / gridSize) * gridSize - gridSize;
      const startY = Math.floor(-panRef.current.y / zoomRef.current / gridSize) * gridSize - gridSize;
      const endX = startX + W / zoomRef.current + gridSize * 2;
      const endY = startY + H / zoomRef.current + gridSize * 2;
      for (let x = startX; x <= endX; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, startY);
        ctx.lineTo(x, endY);
        ctx.stroke();
      }
      for (let y = startY; y <= endY; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(startX, y);
        ctx.lineTo(endX, y);
        ctx.stroke();
      }

      particleTime += 0.02;

      // Draw edges with particle effects
      for (const edge of edges) {
        const a = nodes.find(n => n.id === edge.source);
        const b = nodes.find(n => n.id === edge.target);
        if (!a || !b) continue;

        // Edge line
        const gradient = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
        gradient.addColorStop(0, a.color.replace(')', ', 0.3)').replace('hsl', 'hsla'));
        gradient.addColorStop(1, b.color.replace(')', ', 0.3)').replace('hsl', 'hsla'));
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 1.5 / zoomRef.current;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();

        // Moving particle along edge
        const t = (Math.sin(particleTime + a.x * 0.01) + 1) / 2;
        const px = a.x + (b.x - a.x) * t;
        const py = a.y + (b.y - a.y) * t;
        ctx.beginPath();
        ctx.arc(px, py, 2 / zoomRef.current, 0, Math.PI * 2);
        ctx.fillStyle = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.4)';
        ctx.fill();
      }

      // Draw nodes
      for (const node of nodes) {
        const isHovered = hoveredRef.current?.id === node.id;

        // Glow
        if (isHovered || node.messageCount > 4) {
          const glowRadius = node.radius * (isHovered ? 3 : 2);
          const glow = ctx.createRadialGradient(node.x, node.y, node.radius * 0.5, node.x, node.y, glowRadius);
          glow.addColorStop(0, node.color.replace(')', ', 0.3)').replace('hsl', 'hsla'));
          glow.addColorStop(1, 'transparent');
          ctx.beginPath();
          ctx.arc(node.x, node.y, glowRadius, 0, Math.PI * 2);
          ctx.fillStyle = glow;
          ctx.fill();
        }

        // Node body
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);

        // Fill with gradient
        const bodyGrad = ctx.createRadialGradient(
          node.x - node.radius * 0.3, node.y - node.radius * 0.3, 0,
          node.x, node.y, node.radius
        );
        bodyGrad.addColorStop(0, node.color.replace(')', ', 0.9)').replace('hsl', 'hsla'));
        bodyGrad.addColorStop(1, node.color.replace(')', ', 0.6)').replace('hsl', 'hsla'));
        ctx.fillStyle = bodyGrad;
        ctx.fill();

        // Border
        ctx.strokeStyle = isHovered
          ? (isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.7)')
          : node.color.replace(')', ', 0.5)').replace('hsl', 'hsla');
        ctx.lineWidth = isHovered ? 2.5 / zoomRef.current : 1.5 / zoomRef.current;
        ctx.stroke();

        // Message count text inside node
        if (node.radius > 15) {
          ctx.fillStyle = isDark ? '#fff' : '#000';
          ctx.font = `bold ${Math.max(9, node.radius * 0.5) / zoomRef.current}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(node.messageCount), node.x, node.y);
        }
      }

      ctx.restore();

      // Draw tooltip for hovered node (in screen space)
      const hovered = hoveredRef.current;
      if (hovered) {
        const sx = hovered.x * zoomRef.current + panRef.current.x;
        const sy = hovered.y * zoomRef.current + panRef.current.y;

        const title = hovered.title.length > 40 ? hovered.title.substring(0, 40) + '...' : hovered.title;
        const lines = [
          title,
          `by ${hovered.displayName}`,
          `${hovered.messageCount} messages · ${timeAgo(hovered.updatedAt)}`,
        ];

        ctx.font = '13px sans-serif';
        const maxW = Math.max(...lines.map(l => ctx.measureText(l).width));
        const padding = 12;
        const lineHeight = 20;
        const boxW = maxW + padding * 2;
        const boxH = lines.length * lineHeight + padding * 2;

        let tx = sx + hovered.radius * zoomRef.current + 10;
        let ty = sy - boxH / 2;
        if (tx + boxW > W) tx = sx - boxW - hovered.radius * zoomRef.current - 10;
        if (ty < 0) ty = 10;
        if (ty + boxH > H) ty = H - boxH - 10;

        // Tooltip background
        ctx.fillStyle = isDark ? 'rgba(24,24,27,0.95)' : 'rgba(255,255,255,0.95)';
        ctx.shadowColor = isDark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.15)';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        const r = 8;
        ctx.moveTo(tx + r, ty);
        ctx.lineTo(tx + boxW - r, ty);
        ctx.quadraticCurveTo(tx + boxW, ty, tx + boxW, ty + r);
        ctx.lineTo(tx + boxW, ty + boxH - r);
        ctx.quadraticCurveTo(tx + boxW, ty + boxH, tx + boxW - r, ty + boxH);
        ctx.lineTo(tx + r, ty + boxH);
        ctx.quadraticCurveTo(tx, ty + boxH, tx, ty + boxH - r);
        ctx.lineTo(tx, ty + r);
        ctx.quadraticCurveTo(tx, ty, tx + r, ty);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;

        // Border
        ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Text
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        lines.forEach((line, i) => {
          ctx.fillStyle = i === 0
            ? (isDark ? '#fff' : '#000')
            : (isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)');
          ctx.font = i === 0 ? 'bold 13px sans-serif' : '12px sans-serif';
          ctx.fillText(line, tx + padding, ty + padding + i * lineHeight);
        });
      }

      ctx.restore();
      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [isDark]);

  // Mouse interaction handlers
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      lastMouseRef.current = { x: sx, y: sy };

      if (dragRef.current) {
        const world = screenToWorld(sx, sy);
        dragRef.current.node.x = world.x - dragRef.current.offsetX;
        dragRef.current.node.y = world.y - dragRef.current.offsetY;
        dragRef.current.node.vx = 0;
        dragRef.current.node.vy = 0;
        return;
      }

      if (isPanningRef.current) {
        return;
      }

      const world = screenToWorld(sx, sy);
      const node = findNodeAt(world.x, world.y);
      hoveredRef.current = node;
      canvas.style.cursor = node ? 'pointer' : 'grab';
    };

    const handleMouseDown = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const world = screenToWorld(sx, sy);
      const node = findNodeAt(world.x, world.y);

      if (node) {
        dragRef.current = {
          node,
          offsetX: world.x - node.x,
          offsetY: world.y - node.y,
        };
        canvas.style.cursor = 'grabbing';
      } else {
        isPanningRef.current = true;
        lastMouseRef.current = { x: sx, y: sy };
        canvas.style.cursor = 'grabbing';
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (dragRef.current) {
        // If drag was minimal, treat as click
        const rect = canvas.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const world = screenToWorld(sx, sy);
        const node = findNodeAt(world.x, world.y);
        if (node && node.id === dragRef.current.node.id) {
          onNodeClick(node);
        }
        dragRef.current = null;
      }
      isPanningRef.current = false;
      canvas.style.cursor = hoveredRef.current ? 'pointer' : 'grab';
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;

      const oldZoom = zoomRef.current;
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      zoomRef.current = Math.max(0.2, Math.min(5, zoomRef.current * delta));

      // Zoom toward cursor
      panRef.current.x = sx - (sx - panRef.current.x) * (zoomRef.current / oldZoom);
      panRef.current.y = sy - (sy - panRef.current.y) * (zoomRef.current / oldZoom);
    };

    // Pan handler via mousemove when isPanning
    const handlePanMove = (e: MouseEvent) => {
      if (!isPanningRef.current) return;
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      panRef.current.x += sx - lastMouseRef.current.x;
      panRef.current.y += sy - lastMouseRef.current.y;
      lastMouseRef.current = { x: sx, y: sy };
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mousemove', handlePanMove);
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', () => {
      isPanningRef.current = false;
      dragRef.current = null;
      hoveredRef.current = null;
    });
    canvas.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mousemove', handlePanMove);
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, [screenToWorld, findNodeAt, onNodeClick]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ cursor: 'grab' }}
    />
  );
}
