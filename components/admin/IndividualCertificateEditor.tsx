"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Save } from "lucide-react";
import { CERTIFICATE_FONTS } from "@/lib/certificate-template-settings";
import styles from "./CertificateTemplateEditor.module.css";
import layout from "./IndividualCertificateEditor.module.css";

export default function IndividualCertificateEditor({ certificateId, name, x, y, width, height, fontSize, bold, fontFamily, color, align, templateUrl, action }: {
  certificateId: string; name: string; x: number; y: number; width: number; height: number;
  fontSize: number; bold: boolean; fontFamily: string; color: string; align: string; templateUrl: string;
  action: (data: FormData) => void;
}) {
  const [value, setValue] = useState({ name, x, y, fontSize, bold, fontFamily });
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

  return <form action={action} className={`${styles.editor} ${layout.editor}`}>
    <input type="hidden" name="certificateId" value={certificateId} />
    <input type="hidden" name="customNameX" value={value.x} />
    <input type="hidden" name="customNameY" value={value.y} />
    <div className={`${styles.previewColumn} ${layout.previewColumn}`}>
      <div ref={previewRef} className={styles.preview} style={{ aspectRatio: `${width}/${height}` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={templateUrl} alt="معاينة الشهادة" />
        <span className={styles.draggableText} onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); move(event); }} onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) move(event); }} style={{ left: value.x * scale, top: value.y * scale, fontSize: value.fontSize * scale, fontFamily: value.fontFamily, fontWeight: value.bold ? 700 : 400, WebkitTextStroke: value.bold ? `${Math.max(.5, value.fontSize * .025) * scale}px ${color}` : undefined, color, "--anchor": anchor } as React.CSSProperties}>{value.name}</span>
      </div>
      <small>اسحب الاسم داخل الشهادة لتغيير مكانه.</small>
    </div>
    <div className={`${styles.settings} ${layout.settings}`}>
      <fieldset className={layout.section}>
        <legend>إعدادات الاسم</legend>
        <label className={layout.nameField}><span>الاسم على الشهادة</span><input name="customName" value={value.name} maxLength={160} required onChange={(event) => setValue((current) => ({ ...current, name: event.target.value }))} /></label>
        <div className={layout.fields}>
          <label><span>الموضع الأفقي</span><div className={layout.numberField}><input type="number" min="0" max={width} value={value.x} onChange={(event) => setValue((current) => ({ ...current, x: Number(event.target.value) }))} /><small>px</small></div></label>
          <label><span>الموضع العمودي</span><div className={layout.numberField}><input type="number" min="0" max={height} value={value.y} onChange={(event) => setValue((current) => ({ ...current, y: Number(event.target.value) }))} /><small>px</small></div></label>
          <label><span>حجم الخط</span><div className={layout.numberField}><input name="customNameFontSize" type="number" min="1" max="512" step="0.01" value={value.fontSize} onChange={(event) => setValue((current) => ({ ...current, fontSize: Math.max(1, Math.min(512, Number(event.target.value) || 1)) }))} /><small>px</small></div></label>
          <label><span>نوع الخط</span><select className={layout.fontSelect} name="customNameFontFamily" value={value.fontFamily} onChange={(event) => setValue((current) => ({ ...current, fontFamily: event.target.value }))}>{CERTIFICATE_FONTS.map((font) => <option key={font} value={font}>{font}</option>)}</select></label>
          <label className={layout.boldField}><input name="customNameBold" type="checkbox" checked={value.bold} onChange={(event) => setValue((current) => ({ ...current, bold: event.target.checked }))} /><span className={layout.boldIcon}>B</span><span>خط غامق</span></label>
        </div>
      </fieldset>
      <button className={`${styles.saveButton} ${layout.saveButton}`}><Save size={18} />حفظ وإعادة توليد الشهادة</button>
    </div>
  </form>;
}
