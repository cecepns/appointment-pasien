import { useCallback, useEffect, useRef, useState } from "react";
import { Eraser } from "lucide-react";

function getPos(canvas, e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
  };
}

export default function SignaturePad({ onChange, className = "" }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    if (w === 0 || h === 0) return;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2;
  }, []);

  useEffect(() => {
    resize();
    const ro = new ResizeObserver(() => resize());
    if (canvasRef.current?.parentElement) {
      ro.observe(canvasRef.current.parentElement);
    }
    window.addEventListener("resize", resize);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, [resize]);

  const notifyBlob = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(
      (blob) => {
        onChange?.(blob);
      },
      "image/png",
      0.92
    );
  }, [onChange]);

  const start = (e) => {
    e.preventDefault();
    drawing.current = true;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const { x, y } = getPos(canvas, e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const move = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const { x, y } = getPos(canvas, e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasInk(true);
  };

  const end = (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (drawing.current) {
      drawing.current = false;
      notifyBlob();
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    resize();
    setHasInk(false);
    onChange?.(null);
  };

  return (
    <div className={className}>
      <div className="relative rounded-xl border-2 border-dashed border-slate-300 bg-white overflow-hidden touch-none">
        <canvas
          ref={canvasRef}
          className="block h-44 w-full cursor-crosshair"
          onMouseDown={start}
          onMouseMove={move}
          onMouseUp={end}
          onMouseLeave={end}
          onTouchStart={start}
          onTouchMove={move}
          onTouchEnd={end}
        />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          {hasInk ? "Tanda tangan tersimpan saat submit." : "Tanda tangan di area di atas."}
        </p>
        <button
          type="button"
          onClick={clear}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          <Eraser className="h-3.5 w-3.5" />
          Hapus
        </button>
      </div>
    </div>
  );
}
