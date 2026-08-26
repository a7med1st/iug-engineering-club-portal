"use client";

import { AudioLines, Pause, Play } from "lucide-react";
import { useRef, useState } from "react";

import styles from "@/app/member/chat/chat.module.css";

const WAVEFORM = [
  32, 54, 76, 45, 68, 88, 58, 38,
  72, 94, 63, 48, 82, 57, 34, 70,
  91, 61, 42, 78, 52, 86, 66, 39,
  74, 96, 59, 44, 80, 62, 36, 69,
];

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

export default function ChatAudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const progress = duration ? currentTime / duration : 0;

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      await audio.play().catch(() => undefined);
    } else {
      audio.pause();
    }
  };

  const changePlaybackRate = () => {
    const next = playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : 1;
    setPlaybackRate(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };

  return (
    <div className={styles.voicePlayer}>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
        onDurationChange={(event) => setDuration(event.currentTarget.duration)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />

      <button
        type="button"
        className={styles.voicePlayButton}
        onClick={togglePlayback}
        aria-label={playing ? "إيقاف مؤقت" : "تشغيل التسجيل الصوتي"}
        title={playing ? "إيقاف مؤقت" : "تشغيل"}
      >
        {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
      </button>

      <div className={styles.voiceTrack}>
        <div className={styles.voiceWaveform} aria-hidden="true">
          {WAVEFORM.map((height, index) => (
            <span
              key={index}
              className={index / WAVEFORM.length <= progress ? styles.voiceWaveActive : ""}
              style={{ height: `${height}%` }}
            />
          ))}
        </div>
        <input
          type="range"
          min={0}
          max={duration || 0}
          step="0.05"
          value={Math.min(currentTime, duration || 0)}
          onChange={(event) => {
            const value = Number(event.target.value);
            setCurrentTime(value);
            if (audioRef.current) audioRef.current.currentTime = value;
          }}
          aria-label="موضع التسجيل الصوتي"
        />
        <span className={styles.voiceTime} dir="ltr">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>

      <button
        type="button"
        className={styles.voiceSpeedButton}
        onClick={changePlaybackRate}
        aria-label={`سرعة التشغيل ${playbackRate}×`}
        title="سرعة التشغيل"
      >
        {playbackRate}×
      </button>

      <AudioLines className={styles.voiceIcon} aria-hidden="true" />
    </div>
  );
}
