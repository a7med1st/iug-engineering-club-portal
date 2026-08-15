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
  checkInByQrCode,
  type CheckInResult,
} from "@/app/admin/activities/[id]/check-in/actions";

import styles from "@/app/admin/activities/[id]/check-in/check-in.module.css";

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

const initialResult: CheckInResult = {
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
  ).format(new Date(value));
}

export default function ActivityCheckInScanner({
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
    useState<CheckInResult>(
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
      // الكاميرا قد تكون متوقفة أصلًا.
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

    processingRef.current = true;

    setProcessing(true);

    /*
     * نوقف الكاميرا بمجرد قراءة QR
     * حتى لا تتم قراءة نفس الرمز مرات متتالية.
     */
    await stopScanner();

    try {
      const response =
        await checkInByQrCode(
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
      /*
       * Dynamic import حتى لا يتم تحميل
       * مكتبة الكاميرا على السيرفر.
       */
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
            "activity-checkin-reader",
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
           * أخطاء القراءة لكل Frame
           * طبيعية، لذلك نتجاهلها.
           */
        },
      );

      if (mountedRef.current) {
        setCameraRunning(true);
      }
    } catch (error) {
      console.error(
        "QR scanner start error:",
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
    result.status === "SUCCESS";

  const warning =
    result.status ===
    "ALREADY_CHECKED_IN";

  const error =
    result.status !== "IDLE" &&
    !success &&
    !warning;

  return (
    <div
      className={
        styles.scannerWrapper
      }
    >
      <div
        className={
          styles.scannerPanel
        }
      >
        <div
          className={
            styles.scannerPanelHead
          }
        >
          <div
            className={
              styles.scannerHeadIcon
            }
          >
            <Camera size={23} />
          </div>

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
            id="activity-checkin-reader"
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
                <Camera size={40} />

                <strong>
                  الكاميرا متوقفة
                </strong>

                <span>
                  اضغط تشغيل الكاميرا
                  لبدء مسح البطاقات.
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
              styles.startCameraButton
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
      </div>

      {/* =====================================
          RESULT
      ===================================== */}

      {result.status !==
        "IDLE" && (
        <section
          className={`${styles.resultCard} ${
            success
              ? styles.resultSuccess
              : warning
                ? styles.resultWarning
                : styles.resultError
          }`}
        >
          <div
            className={
              styles.resultIcon
            }
          >
            {success ? (
              <CheckCircle2
                size={34}
              />
            ) : warning ? (
              <TriangleAlert
                size={34}
              />
            ) : (
              <XCircle
                size={34}
              />
            )}
          </div>

          <div
            className={
              styles.resultCopy
            }
          >
            <span>
              {success
                ? "تم تسجيل الحضور"
                : warning
                  ? "تنبيه"
                  : "تعذر تسجيل الحضور"}
            </span>

            <h3>
              {result.message}
            </h3>
          </div>

          {result.student && (
            <div
              className={
                styles.studentResult
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