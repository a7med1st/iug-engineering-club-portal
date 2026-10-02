export class StudentRegistrationFieldError extends Error {
  constructor(readonly field: "studentNumber", message: string) {
    super(message);
  }
}

export function optionalStudentRegistrationFields(input: { studentNumber?: unknown; departmentId?: unknown }) {
  const studentNumber = String(input.studentNumber ?? "").trim();
  const departmentId = String(input.departmentId ?? "").trim();

  if (studentNumber && !/^\d{5,20}$/.test(studentNumber)) {
    throw new StudentRegistrationFieldError("studentNumber", "الرقم الجامعي يجب أن يحتوي على أرقام فقط.");
  }

  return {
    studentNumber: studentNumber || null,
    departmentId: departmentId || null,
  };
}
