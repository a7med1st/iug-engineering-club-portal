"use client";

import { BarChart3, FileText, LoaderCircle, Mic, Paperclip, Plus, Send, Square, X } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { sendChatMessage, type ChatComposerState } from "@/app/member/chat/actions";
import styles from "@/app/member/chat/chat.module.css";

const INITIAL_STATE: ChatComposerState = { status: "idle" };

function formatDuration(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={styles.sendButton} aria-label="إرسال الرسالة" title="إرسال" disabled={pending}>
      {pending ? <LoaderCircle className={styles.composerSpinner} aria-hidden="true" /> : <Send aria-hidden="true" />}
    </button>
  );
}

export default function ChatComposer({ conversationId, className }: { conversationId: string; className: string }) {
  const [state, formAction] = useActionState(sendChatMessage, INITIAL_STATE);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isVoiceNote, setIsVoiceNote] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [pollOpen, setPollOpen] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [mediaError, setMediaError] = useState("");

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingTimer = useRef<number | null>(null);
  const typingTimer = useRef<number | null>(null);
  const lastTypingPing = useRef(0);
  const discardRecording = useRef(false);

  const sendTyping = async (active: boolean) => {
    try {
      await fetch(`/member/chat/${conversationId}/typing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
        cache: "no-store",
      });
    } catch {}
  };

  const stopTyping = () => {
    if (typingTimer.current !== null) {
      window.clearTimeout(typingTimer.current);
      typingTimer.current = null;
    }
    void sendTyping(false);
  };

  const clearAttachment = () => {
    setSelectedFile(null);
    setIsVoiceNote(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const resetComposer = () => {
    clearAttachment();
    setPollOpen(false);
    setPollQuestion("");
    setPollOptions(["", ""]);
    setMediaError("");
    if (textareaRef.current) {
      textareaRef.current.value = "";
      textareaRef.current.style.height = "auto";
    }
  };

  useEffect(() => {
    if (state.status === "success") resetComposer();
  }, [state.submissionId, state.status]);

  useEffect(() => {
    return () => {
      if (typingTimer.current !== null) window.clearTimeout(typingTimer.current);
      if (recordingTimer.current !== null) window.clearInterval(recordingTimer.current);
      recorderRef.current?.stream.getTracks().forEach((track) => track.stop());
      void sendTyping(false);
    };
  }, []);

  const onInput = (event: React.FormEvent<HTMLTextAreaElement>) => {
    const textarea = event.currentTarget;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
    const now = Date.now();

    if (textarea.value.trim() && now - lastTypingPing.current > 900) {
      lastTypingPing.current = now;
      void sendTyping(true);
    }

    if (typingTimer.current !== null) window.clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(() => void sendTyping(false), 2_200);
  };

  const selectFile = (file: File | null) => {
    setSelectedFile(file);
    setIsVoiceNote(false);
    setPollOpen(false);
    setMediaError("");
  };

  const stopRecording = (discard = false) => {
    discardRecording.current = discard;
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  };

  const startRecording = async () => {
    if (recording) {
      stopRecording();
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setMediaError("متصفحك لا يدعم تسجيل الرسائل الصوتية.");
      return;
    }

    try {
      clearAttachment();
      setPollOpen(false);
      setMediaError("");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        setRecording(false);
        if (recordingTimer.current !== null) window.clearInterval(recordingTimer.current);
        recordingTimer.current = null;

        if (discardRecording.current) {
          discardRecording.current = false;
          setRecordingSeconds(0);
          return;
        }

        const type = recorder.mimeType || "audio/webm";
        const extension = type.includes("mp4") ? "m4a" : "webm";
        const file = new File(chunks, `voice-${Date.now()}.${extension}`, { type });
        const transfer = new DataTransfer();
        transfer.items.add(file);
        if (fileInputRef.current) fileInputRef.current.files = transfer.files;
        setSelectedFile(file);
        setIsVoiceNote(true);
      };

      recorderRef.current = recorder;
      discardRecording.current = false;
      setRecordingSeconds(0);
      setRecording(true);
      recorder.start(500);
      recordingTimer.current = window.setInterval(() => setRecordingSeconds((value) => value + 1), 1_000);
    } catch {
      setMediaError("تعذر الوصول إلى الميكروفون. تحقق من إذن المتصفح.");
    }
  };

  const togglePoll = () => {
    if (recording) stopRecording(true);
    clearAttachment();
    setPollOpen((value) => !value);
    setMediaError("");
  };

  return (
    <form action={formAction} className={`${className} ${styles.composerEnhanced}`}>
      <input type="hidden" name="conversationId" value={conversationId} />
      <input type="hidden" name="isVoiceNote" value={isVoiceNote ? "true" : "false"} />

      {pollOpen && (
        <section className={styles.pollEditor} aria-label="إنشاء تصويت">
          <div className={styles.pollEditorHeader}>
            <strong>تصويت جديد</strong>
            <button type="button" className={styles.composerCloseButton} onClick={togglePoll} aria-label="إغلاق التصويت" title="إغلاق">
              <X aria-hidden="true" />
            </button>
          </div>
          <input name="pollQuestion" value={pollQuestion} onChange={(event) => setPollQuestion(event.target.value)} maxLength={180} placeholder="اكتب سؤال التصويت" required />
          <div className={styles.pollOptionEditor}>
            {pollOptions.map((option, index) => (
              <div key={index} className={styles.pollOptionInput}>
                <input
                  name="pollOption"
                  value={option}
                  onChange={(event) => setPollOptions((items) => items.map((item, itemIndex) => itemIndex === index ? event.target.value : item))}
                  maxLength={120}
                  placeholder={`الخيار ${index + 1}`}
                  required
                />
                {pollOptions.length > 2 && (
                  <button type="button" className={styles.composerCloseButton} onClick={() => setPollOptions((items) => items.filter((_, itemIndex) => itemIndex !== index))} aria-label={`حذف الخيار ${index + 1}`} title="حذف الخيار">
                    <X aria-hidden="true" />
                  </button>
                )}
              </div>
            ))}
          </div>
          {pollOptions.length < 6 && (
            <button type="button" className={styles.addPollOption} onClick={() => setPollOptions((items) => [...items, ""])}>
              <Plus aria-hidden="true" />
              إضافة خيار
            </button>
          )}
        </section>
      )}

      {(selectedFile || recording) && (
        <div className={`${styles.attachmentPreview} ${recording ? styles.recordingPreview : ""}`}>
          {recording ? <Mic aria-hidden="true" /> : <FileText aria-hidden="true" />}
          <span>{recording ? `جارٍ التسجيل ${formatDuration(recordingSeconds)}` : isVoiceNote ? `رسالة صوتية ${formatDuration(recordingSeconds)}` : selectedFile?.name}</span>
          <button type="button" className={styles.composerCloseButton} onClick={() => recording ? stopRecording(true) : clearAttachment()} aria-label="إلغاء المرفق" title="إلغاء">
            <X aria-hidden="true" />
          </button>
        </div>
      )}

      {(state.status === "error" || mediaError) && <p className={styles.composerError} role="alert">{mediaError || state.message}</p>}

      <div className={styles.composerBar}>
        <div className={styles.composerTools}>
          <label className={styles.composerToolButton} title="إرفاق ملف">
            <Paperclip aria-hidden="true" />
            <span className={styles.srOnly}>إرفاق ملف</span>
            <input
              ref={fileInputRef}
              type="file"
              name="attachment"
              accept=".jpg,.jpeg,.jfif,.png,.webp,.webm,.ogg,.oga,.ogv,.m4a,.mp4,.m4v,.mp3,.wav,.pdf,.docx"
              onChange={(event) => selectFile(event.target.files?.[0] ?? null)}
            />
          </label>
          <button type="button" className={`${styles.composerToolButton} ${recording ? styles.composerToolButtonActive : ""}`} onClick={startRecording} aria-label={recording ? "إنهاء التسجيل" : "تسجيل رسالة صوتية"} title={recording ? "إنهاء التسجيل" : "رسالة صوتية"}>
            {recording ? <Square aria-hidden="true" /> : <Mic aria-hidden="true" />}
          </button>
          <button type="button" className={`${styles.composerToolButton} ${pollOpen ? styles.composerToolButtonActive : ""}`} onClick={togglePoll} aria-label="إنشاء تصويت" title="تصويت">
            <BarChart3 aria-hidden="true" />
          </button>
        </div>

        <textarea
          ref={textareaRef}
          name="body"
          rows={1}
          maxLength={3000}
          placeholder="اكتب رسالتك..."
          onInput={onInput}
          onBlur={stopTyping}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
        />

        <SubmitButton />
      </div>
    </form>
  );
}
