# ربط صور الأقسام بقاعدة البيانات

## 📋 ما تم القيام به:

### 1. تحديث schema.prisma ✅
- إضافة حقول جديدة للصور في جدول `Department`:
  - `profileImageStoredName` - اسم الملف المخزن
  - `profileImageOriginalName` - اسم الملف الأصلي
  - `profileImageMime` - نوع الملف
  - `profileImageSize` - حجم الملف
  - `profileImageUpdatedAt` - وقت التحديث
  - نفس الحقول لـ `detailImage`

### 2. إنشاء Migration ✅
تم إنشاء ملف migration SQL:
```
prisma/migrations/20260901000000_department_profile_images/migration.sql
```

### 3. إنشاء مكتبة للصور ✅
ملف جديد: `lib/department-images.ts`
- دالة `getDepartmentDisplayImage()` - للحصول على أفضل صورة متاحة
- دالة `getDepartmentImageUrl()` - لإنشاء رابط الصورة

### 4. تحديث الصفحات ✅
- `app/departments/page.tsx` - قائمة الأقسام
- `app/departments/[slug]/page.tsx` - تفاصيل القسم

### 5. إضافة script التحميل ✅
ملف جديد: `scripts/upload-department-images.mjs`
- يقرأ الصور من `public/images/departments/`
- يحملها إلى Blob Storage
- يحدث قاعدة البيانات

## 🚀 الخطوات التالية:

### 1. تطبيق Migration على قاعدة البيانات
```powershell
npm run db:migrate
```
أو إذا كان لديك Docker:
```powershell
npm run db:deploy
```

### 2. تحميل الصور إلى قاعدة البيانات
```powershell
npm run upload:department-images
```

### 3. اختبار التغييرات
```powershell
npm run dev
```
ثم زيارة:
- `http://localhost:3000/departments` - قائمة الأقسام
- `http://localhost:3000/departments/ai` - تفاصيل قسم معين

## 📝 ملاحظات مهمة:

1. **التوافق الخلفي**: الحقول القديمة (`coverImage`, `detailImage`) محفوظة للتوافق الخلفي
2. **Blob Storage**: الصور تُخزن في:
   - **الإنتاج**: Vercel Blob Storage
   - **التطوير**: Local Storage (محلي)
3. **الصور الثابتة**: ستُستخدم كـ fallback إذا لم تكن الصور محملة

## 🔧 ملفات معدلة:

- ✅ `prisma/schema.prisma` - تحديث النموذج
- ✅ `prisma/migrations/20260901000000_department_profile_images/migration.sql` - Migration جديد
- ✅ `lib/department-images.ts` - مكتبة جديدة
- ✅ `app/departments/page.tsx` - تحديث الصفحة
- ✅ `app/departments/[slug]/page.tsx` - تحديث تفاصيل القسم
- ✅ `package.json` - إضافة أمر جديد
- ✅ `scripts/upload-department-images.mjs` - script جديد

## 🎯 النتيجة النهائية:

بعد تطبيق هذه التغييرات، ستظهر صور الأقسام بشكل احترافي في الموقع الرسمي مع:
- تخزين آمن في قاعدة البيانات
- دعم تحديثات الصور من لوحة الإدارة (يمكن إضافتها لاحقاً)
- أداء محسّن مع Blob Storage
