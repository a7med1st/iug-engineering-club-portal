import { Suspense } from "react";
import AuthForm from "@/components/AuthForm";
export default function Login(){return <div className="auth-shell"><Suspense fallback={<div className="auth-card">جارٍ التحميل...</div>}><AuthForm/></Suspense></div>}
