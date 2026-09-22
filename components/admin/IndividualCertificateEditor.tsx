"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Save } from "lucide-react";
import styles from "./CertificateTemplateEditor.module.css";

export default function IndividualCertificateEditor({ certificateId, name, x, y, width, height, fontSize, fontFamily, color, align, templateUrl, action }: {
  certificateId: string; name: string; x: number; y: number; width: number; height: number;
  fontSize: number; fontFamily: string; color: string; align: string; templateUrl: string;
  action: (data: FormData) => void;
}) {
  const [value, setValue] = useState({ name, x, y });
  const [scale, setScale] = useState(1);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = previewRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / width));
    observer.observe(element);
    return () => observer.disconnect();
  }, [width]);

  function move(event: PointerEvent<HTMLSpanElement>) {
    const rect = previewRef.current?.getBoundingClientRect();
    if (!rect) return;
    setValue((current) => ({ ...current,
      x: Math.round(Math.max(0, Math.min(width, (event.clientX - rect.left) * width / rect.width))),
      y: Math.round(Math.max(0, Math.min(height, (event.clientY - rect.top) * height / rect.height))),
    }));
  }

  const anchor = align === "left" ? "0%" : align === "right" ? "-100%" : "-50%";

  return <form action={action} className={styles.editor}>
    <input type="hidden" name="certificateId" value={certificateId} />
    <input type="hidden" name="customNameX" value={value.x} />
    <input type="hidden" name="customNameY" value={value.y} />
    <div className={styles.previewColumn}>
      <div ref={previewRef} className={styles.preview} style={{ aspectRatio: `${width}/${height}` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={templateUrl} alt="معاينة الشهادة" />
        <span className={styles.draggableText} onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); move(event); }} onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) move(event); }} style={{ left: value.x * scale, top: value.y * scale, fontSize: fontSize * scale, fontFamily, color, "--anchor": anchor } as React.CSSProperties}>{value.name}</span>
      </div>
      <small>اسحب الاسم داخل الشهادة لتغيير مكانه.</small>
    </div>
    <div className={styles.settings}>
      <fieldset className={styles.settingSection}>
        <div className={styles.sectionHeading}><strong>بيانات هذه الشهادة</strong></div>
        <div className={styles.fieldGrid}>
          <label className={styles.fontField}><span>الاسم على الشهادة</span><input name="customName" value={value.name} maxLength={160} required onChange={(event) => setValue((current) => ({ ...current, name: event.target.value }))} /></label>
          <label><span>X</span><div className={styles.numberField}><input type="number" min="0" max={width} value={value.x} onChange={(event) => setValue((current) => ({ ...current, x: Number(event.target.value) }))} /><small>px</small></div></label>
          <label><span>Y</span><div className={styles.numberField}><input type="number" min="0" max={height} value={value.y} onChange={(event) => setValue((current) => ({ ...current, y: Number(event.target.value) }))} /><small>px</small></div></label>
        </div>
      </fieldset>
      <button className={styles.saveButton}><Save size={18} />حفظ وإعادة توليد الشهادة</button>
    </div>
  </form>;
}
