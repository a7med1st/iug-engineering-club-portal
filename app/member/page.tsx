import Link from "next/link";

import {
  BookOpenText,
  CalendarDays,
  ExternalLink,
  MessageSquareText,
  Network,
  QrCode,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import {
  ACTIVITY_ADMIN_PERMISSIONS,
  PERMISSIONS,
  hasAnyPermission,
  hasPermission,
  requirePermission,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export default async function Member() {
  const { user } =
    await requirePermission(
      PERMISSIONS.MEMBER_DASHBOARD,
    );

  const structureItem =
    await prisma.clubStructureItem.findUnique({
      where: {
        userId: user.id,
      },
      select: {
        title: true,
      },
    });

  const canManageActivities =
    hasAnyPermission(
      user.role,
      ACTIVITY_ADMIN_PERMISSIONS,
      user.memberPermissions,
    );

  const canScanAttendance =
    hasPermission(
      user.role,
      PERMISSIONS.ATTENDANCE_SCAN,
      user.memberPermissions,
    );

  const canManageGuides =
    hasPermission(
      user.role,
      PERMISSIONS.GUIDE_MANAGE,
      user.memberPermissions,
    );

  const canManageStructure =
    hasPermission(
      user.role,
      PERMISSIONS.STRUCTURE_MANAGE,
      user.memberPermissions,
    );

  const canManageContact =
    hasPermission(
      user.role,
      PERMISSIONS.CONTACT_MANAGE,
      user.memberPermissions,
    );

  const managementLinks = [
    ...(canManageActivities
      ? [
          {
            href:
              "/admin/activities",
            title:
              "إدارة أنشطة القسم",
            text:
              "إدارة الأنشطة والتسجيلات ضمن القسم المرتبط بحسابك.",
            icon:
              CalendarDays,
          },
        ]
      : []),

    ...(canManageGuides
      ? [
          {
            href:
              "/admin/guides",
            title:
              "دليل القسم",
            text:
              "تعديل دليل قسمك فقط.",
            icon:
              BookOpenText,
          },
        ]
      : []),

    ...(canManageStructure
      ? [
          {
            href:
              "/admin/structure",
            title:
              "هيكلية القسم",
            text:
              "إدارة عناصر الهيكلية التابعة لقسمك.",
            icon:
              Network,
          },
        ]
      : []),

    ...(canManageContact
      ? [
          {
            href:
              "/admin/contact",
            title:
              "إدارة التواصل",
            text:
              "متابعة الشكاوى والاقتراحات وطلبات التعاون.",
            icon:
              MessageSquareText,
          },
        ]
      : []),
  ];

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
                alignItems:
                  "center",
                gap: "10px",
                marginBottom:
                  "14px",
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
                  color:
                    "var(--blue)",
                }}
              >
                <UserRound
                  size={21}
                />
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
              {structureItem?.title ||
                user.position ||
                "عضو في النادي الهندسي"}
            </p>

            <p>
              {user.department
                ?.nameAr ||
                "الإدارة العامة"}
            </p>
          </div>

          <div className="about-panel">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "18px",
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
                    width: "46px",
                    height: "46px",
                    display: "grid",
                    placeItems: "center",
                    borderRadius: "13px",
                    background:
                      "rgba(22, 136, 255, 0.08)",
                    color:
                      "var(--blue)",
                  }}
                >
                  <UserRound size={22} />
                </span>

                <div>
                  <h2
                    style={{
                      margin: "0 0 5px",
                    }}
                  >
                    ملفي الشخصي
                  </h2>

                  <p
                    style={{
                      margin: 0,
                    }}
                  >
                    عدّل صورتك وغلافك ونبذتك ومهاراتك وروابطك.
                  </p>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  flexWrap: "wrap",
                }}
              >
                {structureItem && (
                  <Link
                    href={`/members/${user.id}`}
                    className="ghost-btn"
                  >
                    <ExternalLink size={16} />
                    عرض
                  </Link>
                )}

                <Link
                  href="/member/profile"
                  className="primary-btn"
                  style={{
                    textDecoration: "none",
                  }}
                >
                  تعديل الملف
                </Link>
              </div>
            </div>

            {!structureItem && (
              <p
                style={{
                  marginTop: "14px",
                  color: "var(--muted)",
                }}
              >
                ستصبح صفحتك العامة متاحة عند ربط حسابك بالهيكلية من الإدارة.
              </p>
            )}
          </div>

          <div className="about-panel">
            <div
              style={{
                display: "flex",
                alignItems:
                  "center",
                gap: "10px",
                marginBottom:
                  "12px",
              }}
            >
              <span
                style={{
                  width: "42px",
                  height: "42px",
                  display: "grid",
                  placeItems:
                    "center",
                  borderRadius:
                    "12px",
                  background:
                    "rgba(21, 115, 71, 0.08)",
                  color:
                    "#157347",
                }}
              >
                <ShieldCheck
                  size={21}
                />
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
              الأدوات الظاهرة لك
              تعتمد على الصلاحيات
              التي منحتها الإدارة
              لحسابك.
            </p>

            <p>
              الصلاحيات المرتبطة
              بقسم تعمل فقط داخل{" "}
              <strong>
                {user.department
                  ?.nameAr ||
                  "القسم المحدد لحسابك"}
              </strong>
              .
            </p>
          </div>

          {managementLinks.map(
            ({
              href,
              title,
              text,
              icon: Icon,
            }) => (
              <div
                className="about-panel"
                key={href}
              >
                <div
                  style={{
                    display:
                      "flex",
                    alignItems:
                      "center",
                    justifyContent:
                      "space-between",
                    gap: "18px",
                    flexWrap:
                      "wrap",
                  }}
                >
                  <div
                    style={{
                      display:
                        "flex",
                      alignItems:
                        "center",
                      gap: "12px",
                    }}
                  >
                    <span
                      style={{
                        width:
                          "46px",
                        height:
                          "46px",
                        display:
                          "grid",
                        placeItems:
                          "center",
                        borderRadius:
                          "13px",
                        background:
                          "rgba(22, 136, 255, 0.08)",
                        color:
                          "var(--blue)",
                      }}
                    >
                      <Icon
                        size={22}
                      />
                    </span>

                    <div>
                      <h2
                        style={{
                          margin:
                            "0 0 5px",
                        }}
                      >
                        {title}
                      </h2>

                      <p
                        style={{
                          margin: 0,
                        }}
                      >
                        {text}
                      </p>
                    </div>
                  </div>

                  <Link
                    href={href}
                    className="ghost-btn"
                  >
                    فتح
                  </Link>
                </div>
              </div>
            ),
          )}

          {canScanAttendance && (
            <div
              className="about-panel"
              style={{
                gridColumn:
                  "1 / -1",
              }}
            >
              <div
                style={{
                  display:
                    "flex",
                  alignItems:
                    "center",
                  justifyContent:
                    "space-between",
                  gap: "20px",
                  flexWrap:
                    "wrap",
                }}
              >
                <div
                  style={{
                    display:
                      "flex",
                    alignItems:
                      "center",
                    gap: "12px",
                  }}
                >
                  <span
                    style={{
                      width:
                        "48px",
                      height:
                        "48px",
                      display:
                        "grid",
                      placeItems:
                        "center",
                      flexShrink: 0,
                      borderRadius:
                        "14px",
                      background:
                        "rgba(22, 136, 255, 0.08)",
                      color:
                        "var(--blue)",
                    }}
                  >
                    <QrCode
                      size={24}
                    />
                  </span>

                  <div>
                    <h2
                      style={{
                        margin:
                          "0 0 5px",
                      }}
                    >
                      تسجيل حضور
                      الطلاب
                    </h2>

                    <p
                      style={{
                        margin: 0,
                      }}
                    >
                      ستظهر لك أنشطة
                      قسمك المسموح
                      بتسجيل الحضور
                      لها فقط.
                    </p>
                  </div>
                </div>

                <Link
                  href="/member/check-in"
                  className="primary-btn"
                  style={{
                    display:
                      "inline-flex",
                    alignItems:
                      "center",
                    justifyContent:
                      "center",
                    gap: "8px",
                    minHeight:
                      "44px",
                    textDecoration:
                      "none",
                  }}
                >
                  <QrCode
                    size={18}
                  />

                  فتح تسجيل الحضور
                </Link>
              </div>
            </div>
          )}

          {!managementLinks.length &&
            !canScanAttendance && (
              <div
                className="about-panel"
                style={{
                  gridColumn:
                    "1 / -1",
                }}
              >
                <h2>
                  لا توجد صلاحيات
                  إضافية حاليًا
                </h2>

                <p>
                  يمكن للإدارة تحديد
                  صلاحيات هذا الحساب
                  من صفحة إدارة
                  الأعضاء.
                </p>
              </div>
            )}
        </div>
      </div>
    </section>
  );
}
