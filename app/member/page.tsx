import Link from "next/link";

import {
  QrCode,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import {
  PERMISSIONS,
  requirePermission,
} from "@/lib/permissions";

export default async function Member() {
  const { user } =
    await requirePermission(
      PERMISSIONS.MEMBER_DASHBOARD,
    );

  return (
    <section className="section">
      <div className="shell">
        <div className="section-head">
          <div>
            <div className="eyebrow">
              Member Portal
            </div>

            <h2>
              لوحة العضو
            </h2>
          </div>
        </div>

        <div className="about-grid">
          <div className="about-panel">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                marginBottom: "14px",
              }}
            >
              <span
                style={{
                  width: "42px",
                  height: "42px",
                  display: "grid",
                  placeItems: "center",
                  borderRadius: "12px",
                  background:
                    "rgba(22, 136, 255, 0.08)",
                  color: "var(--blue)",
                }}
              >
                <UserRound size={21} />
              </span>

              <div>
                <span
                  style={{
                    display: "block",
                    color: "var(--muted)",
                    fontSize: ".75rem",
                    fontWeight: 700,
                  }}
                >
                  حساب العضو
                </span>

                <h2
                  style={{
                    margin: 0,
                  }}
                >
                  {user.name}
                </h2>
              </div>
            </div>

            <p>
              {user.position ||
                "عضو في النادي الهندسي"}
            </p>

            <p>
              {user.department?.nameAr ||
                "غير مرتبط بقسم"}
            </p>
          </div>

          <div className="about-panel">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                marginBottom: "12px",
              }}
            >
              <span
                style={{
                  width: "42px",
                  height: "42px",
                  display: "grid",
                  placeItems: "center",
                  borderRadius: "12px",
                  background:
                    "rgba(21, 115, 71, 0.08)",
                  color: "#157347",
                }}
              >
                <ShieldCheck size={21} />
              </span>

              <h2
                style={{
                  margin: 0,
                }}
              >
                صلاحيات الحساب
              </h2>
            </div>

            <p>
              هذا الحساب مخصص لأعضاء
              النادي وتم إنشاؤه بواسطة
              الإدارة.
            </p>

            <p>
              يمكنك تسجيل حضور الطلاب
              بالـQR، بينما تبقى أدوات
              الإدارة الكاملة متاحة فقط
              للحسابات التي تملك الصلاحيات
              الإدارية المناسبة.
            </p>
          </div>

          <div
            className="about-panel"
            style={{
              gridColumn: "1 / -1",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent:
                  "space-between",
                gap: "20px",
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <span
                  style={{
                    width: "48px",
                    height: "48px",
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                    borderRadius: "14px",
                    background:
                      "rgba(22, 136, 255, 0.08)",
                    color: "var(--blue)",
                  }}
                >
                  <QrCode size={24} />
                </span>

                <div>
                  <h2
                    style={{
                      margin:
                        "0 0 5px",
                    }}
                  >
                    تسجيل حضور الطلاب
                  </h2>

                  <p
                    style={{
                      margin: 0,
                    }}
                  >
                    اختر النشاط ثم امسح
                    رمز QR الموجود في بطاقة
                    قبول الطالب لتسجيل
                    حضوره.
                  </p>
                </div>
              </div>

              <Link
                href="/member/check-in"
                className="primary-btn"
                style={{
                  display:
                    "inline-flex",
                  alignItems: "center",
                  justifyContent:
                    "center",
                  gap: "8px",
                  minHeight: "44px",
                  textDecoration: "none",
                }}
              >
                <QrCode size={18} />
                فتح تسجيل الحضور
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}