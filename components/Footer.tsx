import Image from "next/image";
import type { SVGProps } from "react";
import styles from "./Footer.module.css";

type BrandIconProps = SVGProps<SVGSVGElement>;

function FacebookIcon(props: BrandIconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <path d="M13.7 22v-8.2h2.77l.41-3.2H13.7V8.55c0-.93.26-1.56 1.59-1.56H17V4.13A22.9 22.9 0 0 0 14.53 4c-2.45 0-4.13 1.5-4.13 4.27v2.33H7.63v3.2h2.77V22h3.3Z" />
    </svg>
  );
}

function InstagramIcon(props: BrandIconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4.15" />
      <circle className={styles.instagramDot} cx="17.45" cy="6.65" r="1.15" />
    </svg>
  );
}

function WhatsAppIcon(props: BrandIconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <path d="M20.52 3.49A11.82 11.82 0 0 0 12.09 0C5.55 0 .23 5.32.23 11.86c0 2.09.55 4.13 1.6 5.93L.13 24l6.35-1.67a11.83 11.83 0 0 0 5.6 1.43h.01c6.54 0 11.86-5.32 11.86-11.86 0-3.17-1.22-6.16-3.43-8.41Zm-8.43 18.27h-.01a9.8 9.8 0 0 1-5-1.37l-.36-.21-3.77.99 1.01-3.67-.23-.38a9.83 9.83 0 0 1-1.51-5.26A9.88 9.88 0 0 1 12.09 2c2.63 0 5.1 1.03 6.96 2.89a9.8 9.8 0 0 1 2.89 7.01 9.87 9.87 0 0 1-9.85 9.86Z" />
      <path d="M17.5 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.39-1.48a8.94 8.94 0 0 1-1.65-2.05c-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.49s1.07 2.89 1.22 3.09c.15.2 2.1 3.21 5.1 4.5.71.31 1.27.49 1.7.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.42.25-.69.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35Z" />
    </svg>
  );
}

const SOCIAL_LINKS = [
  {
    label: "صفحة فيسبوك",
    ariaLabel: "صفحة النادي الهندسي على فيسبوك",
    href: "https://www.facebook.com/IUG.Engineering.Club",
    platform: "facebook",
    icon: FacebookIcon,
  },
  {
    label: "حساب إنستغرام",
    ariaLabel: "حساب النادي الهندسي على إنستغرام",
    href: "https://www.instagram.com/iug_engineering_club?utm_source=ig_web_button_share_sheet&igsi=ZDNlZDc0MzIxNw==",
    platform: "instagram",
    icon: InstagramIcon,
  },
  {
    label: "مجموعة واتساب",
    ariaLabel: "مجموعة النادي الهندسي على واتساب",
    href: "https://chat.whatsapp.com/HROGicrOtDXDh2B5ZPjsqf",
    platform: "whatsapp",
    icon: WhatsAppIcon,
  },
] as const;

export default function Footer() {
  return (
    <footer id="site-footer" className={`site-footer ${styles.footer}`}>
      <div className={styles.frame}>
        <div className={styles.ambientGlow} aria-hidden="true" />

        <div className={styles.grid}>
          <section className={styles.identity} aria-label="هوية النادي">
            <div className={styles.logoShell}>
              <Image
                className={styles.logo}
                src="/images/club-logo.png"
                width={84}
                height={84}
                alt="شعار النادي الهندسي"
              />
            </div>
            <div className={styles.identityText}>
              <strong>النادي الهندسي للطلاب</strong>
              <span>الجامعة الإسلامية - غزة</span>
            </div>
          </section>

          <nav className={styles.social} aria-label="روابط التواصل الاجتماعي">
            <h2>ابقَ على تواصل</h2>
            <div className={styles.socialLinks}>
              {SOCIAL_LINKS.map((item) => {
                const Icon = item.icon;

                return (
                  <a
                    key={item.platform}
                    className={styles.socialLink}
                    data-platform={item.platform}
                    href={item.href}
                    aria-label={item.ariaLabel}
                    title={item.label}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Icon className={styles.socialIcon} />
                  </a>
                );
              })}
            </div>
          </nav>

          <section className={styles.center} aria-label="رسالة النادي وحقوق النشر">
            <div className={styles.mottoBlock}>
              <p className={styles.motto}>
                <span>نحو</span>{" "}
                <span>مستقبل</span>{" "}
                <span>هندسي</span>{" "}
                <span>أفضل.</span>
              </p>
              <div className={styles.divider} aria-hidden="true">
                <span />
                <i />
                <span />
              </div>
            </div>
            <div className={styles.legalBlock}>
              <p className={styles.copyright} dir="ltr">© 2026 Engineering Club</p>
              <span className={styles.developer} dir="ltr">
                <span className={styles.developerLabel}>Designed &amp; Developed by</span>{" "}
                <span className={styles.developerName}>Ahmed M. Al-Shaikh Khalil</span>
              </span>
            </div>
          </section>
        </div>
      </div>
    </footer>
  );
}
