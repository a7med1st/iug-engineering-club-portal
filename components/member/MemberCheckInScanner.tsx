"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Camera,
  CheckCircle2,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
  XCircle,
} from "lucide-react";

import {
  checkInMemberQr,
  type MemberCheckInResult,
} from "@/app/member/check-in/actions";

import styles from "@/app/member/check-in/member-checkin.module.css";

type ScannerInstance = {
  start: (
    cameraConfig: {
      facingMode: string;
    },

    config: {
      fps: number;

      qrbox: {
        width: number;
        height: number;
      };

      aspectRatio: number;
    },

    successCallback: (
      decodedText: string,
    ) => void,

    errorCallback?: (
      errorMessage: string,
    ) => void,
  ) => Promise<unknown>;

  stop: () => Promise<void>;
  clear: () => void;
};

type Props = {
  activityId: string;
};

const initialResult: MemberCheckInResult = {
  status: "IDLE",
  message: "",
};

function formatCheckInDate(
  value: string,
) {
  return new Intl.DateTimeFormat(
    "ar-PS",
    {
      dateStyle: "medium",
      timeStyle: "medium",
    },
  ).format(
    new Date(value),
  );
}

export default function MemberCheckInScanner({
  activityId,
}: Props) {
  const scannerRef =
    useRef<ScannerInstance | null>(
      null,
    );

  const processingRef =
    useRef(false);

  const mountedRef =
    useRef(true);

  const [cameraRunning, setCameraRunning] =
    useState(false);

  const [starting, setStarting] =
    useState(false);

  const [processing, setProcessing] =
    useState(false);

  const [cameraError, setCameraError] =
    useState("");

  const [result, setResult] =
    useState<MemberCheckInResult>(
      initialResult,
    );

  async function stopScanner() {
    const scanner =
      scannerRef.current;

    if (!scanner) {
      return;
    }

    try {
      await scanner.stop();
    } catch {
      // قد تكون الكاميرا متوقفة أصلًا.
    }

    if (mountedRef.current) {
      setCameraRunning(false);
    }
  }

  async function handleDecoded(
    decodedText: string,
  ) {
    if (
      processingRef.current
    ) {
      return;
    }

    processingRef.current =
      true;

    setProcessing(true);

    await stopScanner();

    try {
      const response =
        await checkInMemberQr(
          activityId,
          decodedText,
        );

      if (mountedRef.current) {
        setResult(response);
      }
    } catch {
      if (mountedRef.current) {
        setResult({
          status: "ERROR",
          message:
            "تعذر الاتصال بالخادم. حاول مرة أخرى.",
        });
      }
    } finally {
      if (mountedRef.current) {
        setProcessing(false);
      }
    }
  }

  async function startScanner() {
    if (
      starting ||
      cameraRunning
    ) {
      return;
    }

    setStarting(true);
    setCameraError("");
    setResult(initialResult);

    processingRef.current =
      false;

    try {
      const {
        Html5Qrcode,
      } = await import(
        "html5-qrcode"
      );

      let scanner =
        scannerRef.current;

      if (!scanner) {
        scanner =
          new Html5Qrcode(
            "member-activity-checkin-reader",
            false,
          ) as unknown as ScannerInstance;

        scannerRef.current =
          scanner;
      }

      await scanner.start(
        {
          facingMode:
            "environment",
        },

        {
          fps: 10,

          qrbox: {
            width: 250,
            height: 250,
          },

          aspectRatio:
            1.333333,
        },

        (decodedText) => {
          void handleDecoded(
            decodedText,
          );
        },

        () => {
          /*
           * أخطاء عدم وجود QR داخل كل frame طبيعية.
           */
        },
      );

      if (mountedRef.current) {
        setCameraRunning(true);
      }
    } catch (error) {
      console.error(
        "Member QR scanner start error:",
        error,
      );

      if (mountedRef.current) {
        setCameraError(
          "تعذر تشغيل الكاميرا. تأكد من السماح للموقع باستخدام الكاميرا.",
        );
      }
    } finally {
      if (mountedRef.current) {
        setStarting(false);
      }
    }
  }

  async function scanNext() {
    processingRef.current =
      false;

    setResult(initialResult);

    await startScanner();
  }

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;

      const scanner =
        scannerRef.current;

      if (scanner) {
        void scanner
          .stop()
          .catch(() => {});

        try {
          scanner.clear();
        } catch {
          // تجاهل.
        }
      }
    };
  }, []);

  const success =
    result.status ===
    "SUCCESS";

  const warning =
    result.status ===
    "ALREADY_CHECKED_IN";

  return (
    <div
      className={
        styles.scannerLayout
      }
    >
      <section
        className={
          styles.scannerPanel
        }
      >
        <div
          className={
            styles.scannerHead
          }
        >
          <span
            className={
              styles.scannerHeadIcon
            }
          >
            <Camera size={23} />
          </span>

          <div>
            <h2>
              ماسح رمز الدخول
            </h2>

            <p>
              وجّه الكاميرا نحو QR
              الموجود في بطاقة قبول
              الطالب.
            </p>
          </div>
        </div>

        <div
          className={
            styles.cameraFrame
          }
        >
          <div
            id="member-activity-checkin-reader"
            className={
              styles.reader
            }
          />

          {!cameraRunning &&
            result.status ===
              "IDLE" && (
              <div
                className={
                  styles.cameraPlaceholder
                }
              >
                <Camera size={42} />

                <strong>
                  الكاميرا متوقفة
                </strong>

                <span>
                  اضغط تشغيل الكاميرا
                  لبدء تسجيل الحضور.
                </span>
              </div>
            )}

          {processing && (
            <div
              className={
                styles.processingOverlay
              }
            >
              <RefreshCw
                size={30}
                className={
                  styles.spin
                }
              />

              <strong>
                جارٍ التحقق...
              </strong>
            </div>
          )}
        </div>

        {cameraError && (
          <div
            className={
              styles.cameraError
            }
          >
            <TriangleAlert
              size={18}
            />

            {cameraError}
          </div>
        )}

        {result.status ===
          "IDLE" && (
          <button
            type="button"
            className={
              styles.startButton
            }
            disabled={
              starting ||
              cameraRunning
            }
            onClick={() => {
              void startScanner();
            }}
          >
            <Camera size={19} />

            {starting
              ? "جارٍ تشغيل الكاميرا..."
              : cameraRunning
                ? "الكاميرا تعمل"
                : "تشغيل الكاميرا"}
          </button>
        )}
      </section>

      {result.status !==
        "IDLE" && (
        <section
          className={`${styles.resultCard} ${
            success
              ? styles.successResult
              : warning
                ? styles.warningResult
                : styles.errorResult
          }`}
        >
          <div
            className={
              styles.resultIcon
            }
          >
            {success ? (
              <CheckCircle2
                size={36}
              />
            ) : warning ? (
              <TriangleAlert
                size={36}
              />
            ) : (
              <XCircle
                size={36}
              />
            )}
          </div>

          <span
            className={
              styles.resultEyebrow
            }
          >
            {success
              ? "تم تسجيل الحضور"
              : warning
                ? "تنبيه"
                : "تعذر تسجيل الحضور"}
          </span>

          <h3>
            {result.message}
          </h3>

          {result.student && (
            <div
              className={
                styles.studentData
              }
            >
              <div>
                <span>
                  الطالب
                </span>

                <strong>
                  {
                    result.student
                      .name
                  }
                </strong>
              </div>

              <div>
                <span>
                  التخصص
                </span>

                <strong>
                  {result.student
                    .department ??
                    "غير محدد"}
                </strong>
              </div>

              <div>
                <span>
                  البريد
                </span>

                <strong dir="ltr">
                  {
                    result.student
                      .email
                  }
                </strong>
              </div>
            </div>
          )}

          {result.checkedInAt && (
            <div
              className={
                styles.checkInTime
              }
            >
              <ShieldCheck
                size={17}
              />

              <span>
                وقت الدخول:
              </span>

              <strong>
                {formatCheckInDate(
                  result.checkedInAt,
                )}
              </strong>
            </div>
          )}

          <button
            type="button"
            className={
              styles.scanNextButton
            }
            onClick={() => {
              void scanNext();
            }}
          >
            <RefreshCw size={18} />

            مسح طالب آخر
          </button>
        </section>
      )}
    </div>
  );
}