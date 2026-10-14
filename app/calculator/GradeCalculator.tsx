"use client";
import { useState } from "react";
import { Calculator, Plus, Trash2, RotateCcw } from "lucide-react";
import { calculateGrades } from "@/lib/grade-calculator";
import styles from "./calculator.module.css";

type Row = { id: number; name: string; hours: string; grade: string; repeated: boolean; previous: string };
const emptyRow = (id: number): Row => ({id,name:"",hours:"3",grade:"",repeated:false,previous:""});
export default function GradeCalculator() {
  const [rows,setRows] = useState<Row[]>([emptyRow(1),emptyRow(2),emptyRow(3)]);
  const [cumulative,setCumulative] = useState(false);
  const [average,setAverage] = useState("");
  const [previousHours,setPreviousHours] = useState("");
  const update = (id:number,patch:Partial<Row>) => setRows(current=>current.map(row=>row.id===id?{...row,...patch}:row));
  let result: ReturnType<typeof calculateGrades> | undefined;
  let error = "";
  const entered = rows.filter(row=>row.grade!=="");
  try {
    if (entered.length) {
      if (cumulative && (average==="" || previousHours==="")) throw new Error("أدخل المعدل السابق والساعات المحتسبة لحساب التراكمي.");
      if (cumulative && entered.some(row=>row.repeated && row.previous==="")) throw new Error("أدخل العلامة السابقة لكل مساق معاد.");
      result=calculateGrades(entered.map(row=>({hours:Number(row.hours),grade:Number(row.grade),previousGrade:cumulative && row.repeated?Number(row.previous):undefined})),cumulative?{average:Number(average),hours:Number(previousHours)}:undefined);
    }
  } catch(cause) { error=cause instanceof Error?cause.message:"تحقق من البيانات."; }
  const format=(value:number|null|undefined)=>value==null?"—":value.toFixed(2)+"%";
  return <div className={styles.page}>
    <header className={styles.heading}><Calculator size={26}/><h1>حاسبة المعدل</h1></header>
    <div className={styles.modes} data-cumulative={cumulative} role="group" aria-label="نوع المعدل"><button type="button" aria-pressed={!cumulative} onClick={()=>setCumulative(false)}>فصلي</button><button type="button" aria-pressed={cumulative} onClick={()=>setCumulative(true)}>فصلي وتراكمي</button></div>
    <div key={cumulative ? "cumulative" : "semester"} className={styles.modeContent}>
    {cumulative && <div className={styles.previous}><label>المعدل التراكمي السابق<input type="number" min="0" max="100" step="any" value={average} onChange={e=>setAverage(e.target.value)}/></label><label>الساعات المحتسبة سابقاً<input type="number" min="0" step="any" value={previousHours} onChange={e=>setPreviousHours(e.target.value)}/></label></div>}
    <div className={styles.tableWrap}><table><thead><tr><th>المساق</th><th>الساعات</th><th>العلامة / 100</th>{cumulative && <><th>معاد</th><th>العلامة السابقة</th></>}<th><span className={styles.srOnly}>حذف</span></th></tr></thead><tbody>{rows.map((row,index)=><tr key={row.id}>
      <td><input aria-label={`اسم المساق ${index+1}`} placeholder={`مساق ${index+1}`} value={row.name} maxLength={100} onChange={e=>update(row.id,{name:e.target.value})}/></td>
      <td><input aria-label={`ساعات المساق ${index+1}`} type="number" min="1" max="12" value={row.hours} onChange={e=>update(row.id,{hours:e.target.value})}/></td>
      <td><input aria-label={`علامة المساق ${index+1}`} type="number" min="0" max="100" step="any" value={row.grade} onChange={e=>update(row.id,{grade:e.target.value})}/></td>
      {cumulative && <><td><input aria-label={`المساق ${index+1} معاد`} type="checkbox" checked={row.repeated} onChange={e=>update(row.id,{repeated:e.target.checked})}/></td><td>{row.repeated && <input aria-label={`العلامة السابقة للمساق ${index+1}`} type="number" min="0" max="100" step="any" value={row.previous} onChange={e=>update(row.id,{previous:e.target.value})}/>}</td></>}
      <td><button type="button" className={styles.iconButton} aria-label={`حذف المساق ${index+1}`} title="حذف المساق" onClick={()=>setRows(current=>current.filter(item=>item.id!==row.id))}><Trash2 size={17}/></button></td>
    </tr>)}</tbody></table></div>
    <div className={styles.actions}><button type="button" onClick={()=>setRows(current=>[...current,emptyRow(Math.max(0,...current.map(row=>row.id))+1)])}><Plus size={17}/>إضافة مساق</button><button type="button" onClick={()=>{setRows([emptyRow(1),emptyRow(2),emptyRow(3)]);setAverage("");setPreviousHours("");}}><RotateCcw size={17}/>مسح البيانات</button></div>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <div className={styles.results} aria-live="polite"><div><span>المعدل الفصلي</span><strong>{format(result?.semester)}</strong></div>{cumulative && <div><span>المعدل التراكمي المتوقع</span><strong>{format(result?.cumulative)}</strong></div>}<div><span>ساعات الفصل المحتسبة</span><strong>{result?.hours??0}</strong></div></div>
    <p className={styles.note}>الحساب تقديري اعتماداً على البيانات المدخلة.<br/>للمساق المعاد، أدخل العلامة المحتسبة حالياً ضمن معدلك السابق وساعات المساق مرة واحدة.<br/>تُحتسب العلامة الأعلى في التراكمي وعلامة الفصل الحالية في الفصلي.<br/>المساقات غير المحتسبة في المعدل لا تُدرج هنا.</p>
    </div>
  </div>;
}
