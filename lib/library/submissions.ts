export function validateLibrarySubmissionTitle(value: unknown) {
  const title = typeof value === "string" ? value.trim() : "";
  if (!title || title.length > 120) throw new Error("اكتب عنوانًا لا يتجاوز 120 حرفًا.");
  return title;
}

export function canReviewLibrarySubmission(status: string, departmentId: string, reviewerDepartmentId: string) {
  return status === "PENDING" && departmentId === reviewerDepartmentId;
}
