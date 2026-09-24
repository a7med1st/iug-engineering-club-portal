"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud } from "lucide-react";
import styles from "./LibraryManager.module.css";

export default function LibraryUploader({ folderId }: { folderId: string }) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<number | null>(null);
  const [results, setResults] = useState<Array<{ name: string; ok: boolean; message?: string }>>([]);
  const choose = (list: FileList | null) => setFiles(Array.from(list ?? []).slice(0, 10));
  const upload = () => {
    if (!files.length) return;
    const body = new FormData(); body.set("folderId", folderId); files.forEach((file) => body.append("files", file));
    const xhr = new XMLHttpRequest(); xhr.open("POST", "/admin/library/upload");
    xhr.upload.onprogress = (event) => event.lengthComputable && setProgress(Math.round((event.loaded / event.total) * 100));
    xhr.onload = () => {
      const payload = JSON.parse(xhr.responseText || "{}");
      setResults(payload.results ?? [{ name: "الرفع", ok: false, message: payload.error ?? "تعذر الرفع." }]);
      setProgress(null); setFiles([]); if (xhr.status < 300) router.refresh();
    };
    xhr.onerror = () => { setResults([{ name: "الرفع", ok: false, message: "تعذر الاتصال بالخادم." }]); setProgress(null); };
    setProgress(0); xhr.send(body);
  };
  return <div className={styles.uploader} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); choose(e.dataTransfer.files); }}>
    <UploadCloud size={30} aria-hidden="true" />
    <strong>اسحب الملفات هنا أو اخترها</strong><span>حتى 10 ملفات، 25MB لكل ملف</span>
    <input ref={input} hidden type="file" multiple accept=".pdf,.docx,.pptx,.xlsx,.zip,.jpg,.jpeg,.png,.webp" onChange={(e) => choose(e.target.files)} />
    <div className={styles.actions}><button type="button" className="btn secondary" onClick={() => input.current?.click()}>اختيار الملفات</button><button type="button" className="btn primary" disabled={!files.length || progress !== null} onClick={upload}>رفع الملفات</button></div>
    {!!files.length && <ul>{files.map((file) => <li key={`${file.name}-${file.size}`}>{file.name}</li>)}</ul>}
    {progress !== null && <progress max="100" value={progress}>{progress}%</progress>}
    {!!results.length && <ul>{results.map((result, index) => <li className={result.ok ? styles.ok : styles.bad} key={`${result.name}-${index}`}>{result.name}: {result.ok ? "تم الرفع" : result.message}</li>)}</ul>}
  </div>;
}

