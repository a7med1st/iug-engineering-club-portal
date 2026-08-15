"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  CalendarDays,
  CheckCircle2,
  GraduationCap,
  Hash,
  MapPin,
  QrCode,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";

import {
  QRCodeSVG,
} from "qrcode.react";

import styles from "@/app/student/student.module.css";

type Props = {
  studentName: string;
  studentNumber: string | null;
  departmentName: string;

  activityTitle: string;
  activityLocation: string;
  activityDate: string;

  checkInToken: string;
  checkedInAt: string | null;
};

export default function StudentAcceptanceCard({
  studentName,
  studentNumber,
  departmentName,
  activityTitle,
  activityLocation,
  activityDate,
  checkInToken,
  checkedInAt,
}: Props) {
  const [open, setOpen] =
    useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(
      event: KeyboardEvent,
    ) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [open]);

  const qrValue =
    `ENGCLUB:${checkInToken}`;

  return (
    <>
      {/* زر فتح البطاقة */}

      <button
        type="button"
        className={
          styles.acceptanceCardButton
        }
        onClick={() =>
          setOpen(true)
        }
      >
        <CheckCircle2
          size={17}
        />

        <span>
          عرض بطاقة القبول
        </span>
      </button>

      {/* البطاقة */}

      {open && (
        <div
          className={
            styles.acceptanceCardLayer
          }
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setOpen(false);
            }
          }}
        >
          <section
            className={
              styles.acceptanceCard
            }
            role="dialog"
            aria-modal="true"
            aria-labelledby="acceptance-card-title"
          >
            {/* ========================================
                HEADER
            ======================================== */}

            <header
              className={
                styles.acceptanceCardHeader
              }
            >
              <button
                type="button"
                className={
                  styles.acceptanceCardClose
                }
                onClick={() =>
                  setOpen(false)
                }
                aria-label="إغلاق بطاقة القبول"
              >
                <X size={22} />
              </button>

              <div
                className={
                  styles.acceptanceHeaderCheck
                }
              >
                <CheckCircle2
                  size={34}
                />
              </div>

              <div
                className={
                  styles.acceptanceHeaderCopy
                }
              >
                <h2
                  id="acceptance-card-title"
                >
                  بطاقة قبول
                </h2>

                <p>
                  يسعدنا تأكيد قبولك
                  للمشاركة في النشاط.
                </p>
              </div>
            </header>

            {/* ========================================
                ACTIVITY TITLE
            ======================================== */}

            <div
              className={
                styles.acceptanceActivityStrip
              }
            >
              <span
                className={
                  styles.acceptanceActivityLabel
                }
              >
                النشاط
              </span>

              <h3>
                {activityTitle}
              </h3>
            </div>

            {/* ========================================
                MAIN CONTENT
            ======================================== */}

            <div
              className={
                styles.acceptanceContent
              }
            >
              {/* ================================
                  QR PANEL
              ================================ */}

              <div
                className={
                  styles.acceptanceQrPanel
                }
              >
                <div
                  className={
                    styles.acceptanceQrTitle
                  }
                >
                  <span
                    className={
                      styles.acceptanceQrTitleIcon
                    }
                  >
                    <QrCode
                      size={20}
                    />
                  </span>

                  <div>
                    <strong>
                      رمز الدخول
                    </strong>

                    <span>
                      اعرض الرمز عند
                      دخول النشاط
                    </span>
                  </div>
                </div>

                {checkedInAt ? (
                  <div
                    className={
                      styles.acceptanceCheckedIn
                    }
                  >
                    <CheckCircle2
                      size={31}
                    />

                    <div>
                      <strong>
                        تم تسجيل حضورك
                      </strong>

                      <span>
                        {checkedInAt}
                      </span>
                    </div>
                  </div>
                ) : (
                  <>
                    <div
                      className={
                        styles.acceptanceQrBox
                      }
                    >
                      <QRCodeSVG
                        value={qrValue}
                        size={205}
                        level="H"
                        bgColor="#ffffff"
                        fgColor="#06182c"
                        title={`رمز دخول ${activityTitle}`}
                      />
                    </div>

                    <div
                      className={
                        styles.acceptanceQrHint
                      }
                    >
                      <span
                        className={
                          styles.acceptanceQrHintIcon
                        }
                      >
                        <ShieldCheck
                          size={17}
                        />
                      </span>

                      <span>
                        هذا الرمز خاص
                        بتسجيلك، لا تشاركه
                        مع شخص آخر.
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* ================================
                  DETAILS
              ================================ */}

              <div
                className={
                  styles.acceptanceDetailsGrid
                }
              >
                {/* اسم الطالب */}

                <div
                  className={
                    styles.acceptanceDetailItem
                  }
                >
                  <span
                    className={
                      styles.acceptanceDetailIcon
                    }
                  >
                    <UserRound
                      size={21}
                    />
                  </span>

                  <div
                    className={
                      styles.acceptanceDetailContent
                    }
                  >
                    <span>
                      اسم الطالب
                    </span>

                    <strong>
                      {studentName}
                    </strong>
                  </div>
                </div>

                {/* الرقم الجامعي */}

                <div
                  className={
                    styles.acceptanceDetailItem
                  }
                >
                  <span
                    className={
                      styles.acceptanceDetailIcon
                    }
                  >
                    <Hash size={21} />
                  </span>

                  <div
                    className={
                      styles.acceptanceDetailContent
                    }
                  >
                    <span>
                      الرقم الجامعي
                    </span>

                    <strong dir="ltr">
                      {studentNumber ??
                        "غير محدد"}
                    </strong>
                  </div>
                </div>

                {/* التخصص */}

                <div
                  className={
                    styles.acceptanceDetailItem
                  }
                >
                  <span
                    className={
                      styles.acceptanceDetailIcon
                    }
                  >
                    <GraduationCap
                      size={21}
                    />
                  </span>

                  <div
                    className={
                      styles.acceptanceDetailContent
                    }
                  >
                    <span>
                      التخصص
                    </span>

                    <strong>
                      {departmentName}
                    </strong>
                  </div>
                </div>

                {/* الموعد */}

                <div
                  className={
                    styles.acceptanceDetailItem
                  }
                >
                  <span
                    className={
                      styles.acceptanceDetailIcon
                    }
                  >
                    <CalendarDays
                      size={20}
                    />
                  </span>

                  <div
                    className={
                      styles.acceptanceDetailContent
                    }
                  >
                    <span>
                      الموعد
                    </span>

                    <strong>
                      {activityDate}
                    </strong>
                  </div>
                </div>

                {/* المكان */}

                <div
                  className={`${styles.acceptanceDetailItem} ${styles.acceptanceDetailWide}`}
                >
                  <span
                    className={
                      styles.acceptanceDetailIcon
                    }
                  >
                    <MapPin
                      size={21}
                    />
                  </span>

                  <div
                    className={
                      styles.acceptanceDetailContent
                    }
                  >
                    <span>
                      المكان
                    </span>

                    <strong>
                      {activityLocation}
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            {/* ========================================
                STATUS FOOTER
            ======================================== */}

            <footer
              className={
                styles.acceptanceFooter
              }
            >
              <span
                className={
                  styles.acceptanceFooterCheck
                }
              >
                <CheckCircle2
                  size={20}
                />
              </span>

              <span>
                حالة التسجيل:
              </span>

              <strong>
                مقبول
              </strong>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}