"use client";

import { useActionState, useMemo, useState } from "react";
import { Check, Copy, Link2, RefreshCw, Save } from "lucide-react";
import { rotateAttendanceLink, saveAttendanceLink, type AttendanceLinkActionState } from "./attendance-link-actions";
import styles from "./AttendanceLinkPanel.module.css";

const initial:AttendanceLinkActionState={ok:false,message:""};
type LinkData={isActive:boolean;opensAt:string;closesAt:string;tokenPrefix:string};

export default function AttendanceLinkPanel({activityId,link}:{activityId:string;link:LinkData|null}){
  const[saved,saveAction,saving]=useActionState(saveAttendanceLink,initial);const[rotated,rotateAction,rotating]=useActionState(rotateAttendanceLink,initial);const[copied,setCopied]=useState(false);
  const token=rotated.token??saved.token;const url=useMemo(()=>token&&typeof window!=="undefined"?`${window.location.origin}/attendance/${activityId}/${token}`:"",[activityId,token]);const feedback=rotated.message||saved.message;const ok=rotated.message?rotated.ok:saved.ok;
  return <section className={styles.panel}>
    <div className={styles.heading}><span className={styles.headingIcon}><Link2 size={19}/></span><div><h2>رابط تسجيل الحضور</h2><p>{link?`الرمز الحالي يبدأ بـ ${link.tokenPrefix}`:"أنشئ رابط الحضور الخاص بهذا النشاط."}</p></div>{link&&<span className={link.isActive?styles.active:styles.inactive}>{link.isActive?"فعّال":"متوقف"}</span>}</div>
    <form action={saveAction} className={styles.form}><input type="hidden" name="activityId" value={activityId}/><label><span>بداية الاستقبال</span><input type="datetime-local" name="opensAt" defaultValue={link?.opensAt}/></label><label><span>نهاية الاستقبال</span><input type="datetime-local" name="closesAt" defaultValue={link?.closesAt}/></label>{link&&<label className={styles.toggle}><input type="checkbox" name="isActive" defaultChecked={link.isActive}/><span/><strong>تفعيل الرابط</strong></label>}<button className={styles.primaryButton} disabled={saving}><Save size={17}/>{link?"حفظ":"إنشاء الرابط"}</button></form>
    {(url||link)&&<div className={styles.linkRow}>{url?<input readOnly value={url} dir="ltr" aria-label="رابط تسجيل الحضور"/>:<span>دوّر الرابط لإظهار نسخة جديدة قابلة للنسخ.</span>}{url&&<button type="button" className={styles.copyButton} onClick={async()=>{await navigator.clipboard.writeText(url);setCopied(true)}}>{copied?<Check size={17}/>:<Copy size={17}/>} {copied?"تم النسخ":"نسخ"}</button>}{link&&<form action={rotateAction} onSubmit={e=>{if(!confirm("سيتم إبطال الرابط السابق. متابعة؟"))e.preventDefault()}}><input type="hidden" name="activityId" value={activityId}/><button className={styles.rotateButton} disabled={rotating}><RefreshCw size={17}/>تدوير الرابط</button></form>}</div>}
    {feedback&&<p className={ok?styles.success:styles.error} role="status">{feedback}</p>}
  </section>;
}
