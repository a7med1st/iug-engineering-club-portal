export function checkboxAnswer(
  entries: FormDataEntryValue[],
  options: string[],
  required: boolean,
): string[] | null {
  if (entries.length === 0) {
    if (required) throw new Error("اختر إجابة واحدة على الأقل.");
    return null;
  }

  const values: string[] = [];
  for (const entry of entries) {
    if (
      typeof entry !== "string" ||
      !options.includes(entry) ||
      values.includes(entry)
    ) {
      throw new Error("تم إرسال خيار غير صالح أو مكرر.");
    }
    values.push(entry);
  }
  return values;
}
