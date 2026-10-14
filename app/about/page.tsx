import Image from "next/image";
import { BookOpen, Cog, Lightbulb, Users } from "lucide-react";
import styles from "./about.module.css";

export default function About() {
  return <section className={styles.page}>
    <h1 className={styles.introTitle}>من نحن</h1>
    <div className={styles.layout}>
      <figure className={styles.team}>
        <Image src="/images/team.jpeg" alt="فريق النادي الهندسي في الجامعة الإسلامية بغزة" width={1600} height={1200} priority sizes="(max-width: 900px) 100vw, 50vw"/>
        <figcaption><span>فريق النادي الهندسي</span><strong className={styles.motto}><span>نحو</span>{" "}<span>مستقبل</span>{" "}<span>هندسي</span>{" "}<span>أفضل.</span></strong></figcaption>
      </figure>
      <div className={styles.copy}>
        <p>النادي الهندسي في الجامعة الإسلامية بغزة هو نادٍ طلابي أكاديمي يعتني بطلبة كلية الهندسة بمختلف تخصصاتهم، ويعمل بالتعاون مع الكلية والأقسام الأكاديمية لدعم الطلبة وتعزيز مشاركتهم في الحياة الجامعية. ويشكّل إطارًا يجمع اهتماماتهم العلمية والعملية، ويتيح لهم تبادل الخبرات وتطوير قدراتهم والمساهمة في الأنشطة والمبادرات الهندسية.</p>
        <p>ويركّز النادي على احتياجات الطالب خلال رحلته الأكاديمية؛ من فهم المساقات والتعرّف إلى تخصصه، إلى اكتساب المهارات اللازمة للتدريب والعمل. ولهذا يسعى إلى تقديم أنشطة متنوعة، تشمل اللقاءات التعليمية، والتدريب على البرامج والأدوات الهندسية، والتحديات التطبيقية، والإرشاد الأكاديمي والمهني، مع إتاحة مساحة للطلبة لمشاركة تجاربهم وتعلّم مهارات تتجاوز حدود القاعة الدراسية.</p>
        <p>وتنطلق رؤية النادي من أن للهندسة دورًا مباشرًا في تحسين حياة الناس. لذلك يشجّع التعاون بين التخصصات والعمل على أفكار تستجيب لاحتياجات المجتمع الفلسطيني، خصوصًا في ظل تحديات قطاع غزة. كما يسعى إلى فتح قنوات تواصل مع الخريجين وأصحاب الخبرة والمؤسسات، بما يساعد الطلبة على اكتشاف مساراتهم المهنية، وبناء علاقات مفيدة، والمشاركة في خدمة مجتمعهم بعلمهم ومهاراتهم.</p>
      </div>
    </div>
    <section className={styles.fields} aria-labelledby="fields-title">
      <h2 id="fields-title">مجالات عملنا</h2>
      <div className={styles.fieldsGrid}>
        {[
          { Icon: BookOpen, title: "تعليم وإرشاد", text: "لقاءات تعليمية وإرشاد أكاديمي ومهني يساعد الطلبة على فهم مساقاتهم واكتشاف مساراتهم." },
          { Icon: Cog, title: "تدريب هندسي", text: "ورش تطبيقية وتدريب على البرامج والأدوات الهندسية لتطوير المهارات اللازمة للتدريب والعمل." },
          { Icon: Lightbulb, title: "مشاريع وتحديات", text: "تحديات تطبيقية وأفكار مشتركة بين التخصصات تشجّع الابتكار والعمل الجماعي وحل المشكلات." },
          { Icon: Users, title: "خدمة المجتمع", text: "مبادرات هندسية تستجيب لاحتياجات المجتمع الفلسطيني، وتوظّف علم الطلبة ومهاراتهم لصنع أثر." },
        ].map(({ Icon, title, text }) => <article className={styles.field} key={title}>
          <Icon size={32} strokeWidth={1.6} aria-hidden="true"/>
          <h3>{title}</h3><p>{text}</p>
        </article>)}
      </div>
    </section>
    <div className={styles.teamNote}><span>من الطلبة، وللطلبة</span><p>نلتقي على شغف الهندسة، ونكبر بما نتعلّمه معاً.</p></div>
  </section>;
}
