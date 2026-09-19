"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { AlignCenter, AlignLeft, AlignRight, Grip, ImageUp, Save } from "lucide-react";
import { CERTIFICATE_FONTS, type CertificateFontFamily, type TextAlign } from "@/lib/certificate-template-settings";
import styles from "./CertificateTemplateEditor.module.css";

type FieldKey="name"|"title"|"date";
type Values={nameX:number;nameY:number;nameFontSize:number;nameFontFamily:string;nameColor:string;nameAlign:string;titleVisible:boolean;titleX:number;titleY:number;titleFontSize:number;titleFontFamily:string;titleColor:string;titleAlign:string;dateVisible:boolean;dateX:number;dateY:number;dateFontSize:number;dateFontFamily:string;dateColor:string;dateAlign:string};
type TextValue={x:number;y:number;fontSize:number;fontFamily:CertificateFontFamily;color:string;align:TextAlign;visible:boolean};
type EditorState=Record<FieldKey,TextValue>;

const labels:Record<FieldKey,string>={name:"اسم الطالب",title:"اسم النشاط",date:"التاريخ"};
const asFont=(value:string)=>CERTIFICATE_FONTS.includes(value as CertificateFontFamily)?value as CertificateFontFamily:"Cairo";
const asAlign=(value:string)=>["left","center","right"].includes(value)?value as TextAlign:"center";
const clamp=(value:number,min:number,max:number)=>Math.min(max,Math.max(min,value));

function initialState(values:Values):EditorState{return{
  name:{x:values.nameX,y:values.nameY,fontSize:values.nameFontSize,fontFamily:asFont(values.nameFontFamily),color:values.nameColor,align:asAlign(values.nameAlign),visible:true},
  title:{x:values.titleX,y:values.titleY,fontSize:values.titleFontSize,fontFamily:asFont(values.titleFontFamily),color:values.titleColor,align:asAlign(values.titleAlign),visible:values.titleVisible},
  date:{x:values.dateX,y:values.dateY,fontSize:values.dateFontSize,fontFamily:asFont(values.dateFontFamily),color:values.dateColor,align:asAlign(values.dateAlign),visible:values.dateVisible},
}}

function Alignment({field,value,onChange}:{field:FieldKey;value:TextAlign;onChange:(value:TextAlign)=>void}){
  const options=[{value:"right" as const,label:"يمين",Icon:AlignRight},{value:"center" as const,label:"وسط",Icon:AlignCenter},{value:"left" as const,label:"يسار",Icon:AlignLeft}];
  return <div className={styles.alignments} role="radiogroup" aria-label="المحاذاة">{options.map(({value:option,label,Icon})=><label key={option} title={label}><input type="radio" name={`${field}Align`} value={option} checked={value===option} onChange={()=>onChange(option)}/><span><Icon size={16}/></span></label>)}</div>;
}

function TextControls({field,value,width,height,onChange}:{field:FieldKey;value:TextValue;width:number;height:number;onChange:(patch:Partial<TextValue>)=>void}){
  const number=(key:"x"|"y"|"fontSize",max:number)=><label><span>{key==="x"?"X":key==="y"?"Y":"حجم الخط"}</span><div className={styles.numberField}><input name={`${field}${key==="fontSize"?"FontSize":key.toUpperCase()}`} type="number" min={key==="fontSize"?1:0} max={max} step="1" value={Math.round(value[key])} onChange={e=>onChange({[key]:clamp(Number(e.target.value)||0,key==="fontSize"?1:0,max)})}/><small>px</small></div></label>;
  return <div className={styles.fieldGrid}>
    {number("x",width)}{number("y",height)}{number("fontSize",512)}
    <label className={styles.fontField}><span>نوع الخط</span><select name={`${field}FontFamily`} value={value.fontFamily} onChange={e=>onChange({fontFamily:asFont(e.target.value)})}>{CERTIFICATE_FONTS.map(font=><option key={font} value={font} style={{fontFamily:font}}>{font}</option>)}</select></label>
    <label><span>اللون</span><input className={styles.colorInput} name={`${field}Color`} type="color" value={value.color} onChange={e=>onChange({color:e.target.value})}/></label>
    <div className={styles.alignmentField}><span>المحاذاة</span><Alignment field={field} value={value.align} onChange={align=>onChange({align})}/></div>
  </div>;
}

export default function CertificateTemplateEditor({activityId,values,action,templateName,templateUrl,templateWidth,templateHeight,activityTitle,activityDate}:{activityId:string;values:Values;action:(data:FormData)=>void;templateName?:string;templateUrl?:string;templateWidth:number;templateHeight:number;activityTitle:string;activityDate:string}){
  const[state,setState]=useState(()=>initialState(values));const[preview,setPreview]=useState(templateUrl);const[dimensions,setDimensions]=useState({width:templateWidth,height:templateHeight});const[scale,setScale]=useState(1);const[dragging,setDragging]=useState<FieldKey>();const previewRef=useRef<HTMLDivElement>(null);const objectUrlRef=useRef<string|undefined>(undefined);
  useEffect(()=>{const element=previewRef.current;if(!element)return;const observer=new ResizeObserver(([entry])=>setScale(entry.contentRect.width/dimensions.width));observer.observe(element);return()=>observer.disconnect()},[dimensions.width]);
  useEffect(()=>()=>{if(objectUrlRef.current)URL.revokeObjectURL(objectUrlRef.current)},[]);
  const update=(field:FieldKey,patch:Partial<TextValue>)=>setState(current=>({...current,[field]:{...current[field],...patch}}));
  const move=(field:FieldKey,event:ReactPointerEvent)=>{const rect=previewRef.current?.getBoundingClientRect();if(!rect)return;update(field,{x:Math.round(clamp((event.clientX-rect.left)*dimensions.width/rect.width,0,dimensions.width)),y:Math.round(clamp((event.clientY-rect.top)*dimensions.height/rect.height,0,dimensions.height))})};
  const pointerDown=(field:FieldKey,event:ReactPointerEvent<HTMLSpanElement>)=>{event.currentTarget.setPointerCapture(event.pointerId);setDragging(field);move(field,event)};
  return <form action={action} className={styles.editor}>
    <input type="hidden" name="activityId" value={activityId}/><input type="hidden" name="templateWidth" value={dimensions.width}/><input type="hidden" name="templateHeight" value={dimensions.height}/>
    <div className={styles.previewColumn}>
      <label className={styles.upload}><span className={styles.uploadIcon}><ImageUp size={20}/></span><span className={styles.uploadCopy}><strong>{templateName?"استبدال صورة القالب":"رفع صورة القالب"}</strong><small>{templateName??"PNG أو JPG أو WEBP"}</small></span><input type="file" name="template" accept="image/png,image/jpeg,image/webp" onChange={event=>{const file=event.target.files?.[0];if(!file)return;if(objectUrlRef.current)URL.revokeObjectURL(objectUrlRef.current);const url=URL.createObjectURL(file);objectUrlRef.current=url;const image=new Image();image.onload=()=>{const next={width:image.naturalWidth,height:image.naturalHeight};setState(current=>Object.fromEntries(Object.entries(current).map(([field,text])=>[field,{...text,x:text.x*next.width/dimensions.width,y:text.y*next.height/dimensions.height,fontSize:text.fontSize*next.width/dimensions.width}])) as EditorState);setDimensions(next)};image.src=url;setPreview(url)}}/></label>
      <div className={styles.dimensions}><span>{dimensions.width} × {dimensions.height} px</span><span><Grip size={14}/> اسحب النص لتغيير موقعه</span></div>
      <div ref={previewRef} className={styles.preview} style={{aspectRatio:`${dimensions.width}/${dimensions.height}`}}>
        {preview?<>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={preview} alt="معاينة قالب الشهادة"/>{(["name","title","date"] as const).map(field=>state[field].visible&&<span key={field} className={`${styles.draggableText} ${dragging===field?styles.dragging:""}`} onPointerDown={event=>pointerDown(field,event)} onPointerMove={event=>{if(dragging===field)move(field,event)}} onPointerUp={()=>setDragging(undefined)} onPointerCancel={()=>setDragging(undefined)} style={{left:state[field].x*scale,top:state[field].y*scale,fontSize:state[field].fontSize*scale,fontFamily:state[field].fontFamily,color:state[field].color,"--anchor":state[field].align==="left"?"0%":state[field].align==="right"?"-100%":"-50%"} as React.CSSProperties}>{field==="name"?"اسم الطالب":field==="title"?activityTitle:activityDate}</span>)}</>:<div className={styles.emptyPreview}><ImageUp size={30}/><strong>لا توجد معاينة</strong><span>اختر صورة القالب</span></div>}
      </div>
    </div>
    <div className={styles.settings}>
      {(["name","title","date"] as const).map(field=><fieldset key={field} className={styles.settingSection}><div className={styles.sectionHeading}><strong>{labels[field]}</strong>{field==="name"?<span className={styles.required}>أساسي</span>:<label className={styles.switch}><input type="checkbox" name={`${field}Visible`} checked={state[field].visible} onChange={e=>update(field,{visible:e.target.checked})}/><span/><small>إظهار</small></label>}</div><TextControls field={field} value={state[field]} width={dimensions.width} height={dimensions.height} onChange={patch=>update(field,patch)}/></fieldset>)}
      <button className={styles.saveButton}><Save size={18}/>حفظ القالب</button>
    </div>
  </form>;
}
