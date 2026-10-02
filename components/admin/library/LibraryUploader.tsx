"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud } from "lucide-react";
import { LIBRARY_MAX_FILE_MB, LIBRARY_MAX_FILES } from "@/lib/library/constants";
import styles from "./LibraryManager.module.css";

export default function LibraryUploader({ folderId, uploadUrl = "/admin/library/upload" }: { folderId: string; uploadUrl?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<number | null>(null);
  const [results, setResults] = useState<Array<{ name: string; ok: boolean; message?: string }>>([]);
  const choose = (list: FileList | null) => setFiles(Array.from(list ?? []).slice(0, LIBRARY_MAX_FILES));
  const uploadOne = (file: File, index: number, total: number) => new Promise<{ name: string; ok: boolean; message?: string }>((resolve) => {
    const body = new FormData();
    body.set("folderId", folderId);
    body.append("files", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", uploadUrl);
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      setProgress(Math.round(((index + (event.loaded / event.total)) / total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status === 413) {
        resolve({ name: file.name, ok: false, message: "حجم الملف أكبر من الحد الذي يسمح به الخادم." });
        return;
      }

      let payload: { error?: string; results?: Array<{ name: string; ok: boolean; message?: string }> } = {};
      try {
        payload = JSON.parse(xhr.responseText || "{}");
      } catch {
        // A proxy can return an HTML error page instead of the route's JSON response.
      }
      resolve(payload.results?.[0] ?? {
        name: file.name,
        ok: xhr.status >= 200 && xhr.status < 300,
        message: payload.error ?? "تعذر رفع الملف.",
      });
    };
    xhr.onerror = () => resolve({ name: file.name, ok: false, message: "تعذر الاتصال بالخادم." });
    xhr.send(body);
  });

  const upload = async () => {
    if (!files.length) return;
    setProgress(0);
    const uploaded: Array<{ name: string; ok: boolean; message?: string }> = [];
    let index = 0;
    for (const file of files) {
      uploaded.push(await uploadOne(file, index, files.length));
      index += 1;
      setProgress(Math.round((index / files.length) * 100));
    }
    setResults(uploaded);
    setProgress(null);
    setFiles([]);
    if (input.current) input.current.value = "";
    if (uploaded.some((result) => result.ok)) router.refresh();
  };
  return <div className={styles.uploader} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); choose(e.dataTransfer.files); }}>
    <UploadCloud size={30} aria-hidden="true" />
    <strong>اسحب الملفات هنا أو اخترها</strong><span>حتى {LIBRARY_MAX_FILES} ملفات، {LIBRARY_MAX_FILE_MB}MB لكل ملف</span>
    <input ref={input} hidden type="file" multiple onChange={(e) => choose(e.target.files)} />
    <div className={styles.actions}><button type="button" className="btn secondary" onClick={() => input.current?.click()}>اختيار الملفات</button><button type="button" className="btn primary" disabled={!files.length || progress !== null} onClick={upload}>رفع الملفات</button></div>
    {!!files.length && <ul>{files.map((file) => <li key={`${file.name}-${file.size}`}>{file.name}</li>)}</ul>}
    {progress !== null && <progress max="100" value={progress}>{progress}%</progress>}
    {!!results.length && <ul>{results.map((result, index) => <li className={result.ok ? styles.ok : styles.bad} key={`${result.name}-${index}`}>{result.name}: {result.ok ? "تم الرفع" : result.message}</li>)}</ul>}
  </div>;
}

