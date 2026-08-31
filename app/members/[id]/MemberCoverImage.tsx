"use client";

import { useEffect, useRef, useState } from "react";

import styles from "./member-public.module.css";

export default function MemberCoverImage({ src }: { src: string | null }) {
  const [imageFailed, setImageFailed] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setImageFailed(false);
    setImageLoaded(false);

    const image = imageRef.current;
    if (src && image?.complete) {
      if (image.naturalWidth > 0) setImageLoaded(true);
      else setImageFailed(true);
    }
  }, [src]);

  if (!src || imageFailed) return null;

  return (
    <img
      ref={imageRef}
      src={src}
      alt=""
      aria-hidden="true"
      className={`${styles.coverImage} ${
        imageLoaded ? styles.coverImageLoaded : ""
      }`}
      onLoad={() => setImageLoaded(true)}
      onError={() => {
        setImageLoaded(false);
        setImageFailed(true);
      }}
    />
  );
}
