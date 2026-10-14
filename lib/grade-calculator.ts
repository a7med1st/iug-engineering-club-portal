export type GradeCourse = { hours: number; grade: number; previousGrade?: number };

export function calculateGrades(courses: GradeCourse[], previous?: { average: number; hours: number }) {
  if (courses.some(row => !Number.isFinite(row.hours) || row.hours <= 0 || row.hours > 12 || !Number.isFinite(row.grade) || row.grade < 0 || row.grade > 100 || (row.previousGrade !== undefined && (!Number.isFinite(row.previousGrade) || row.previousGrade < 0 || row.previousGrade > 100)))) throw new Error("تحقق من ساعات المساقات وعلاماتها.");
  const hours = courses.reduce((sum, row) => sum + row.hours, 0);
  const points = courses.reduce((sum, row) => sum + row.hours * row.grade, 0);
  if (!previous) return { hours, semester: hours ? points / hours : null, cumulative: null };
  if (!Number.isFinite(previous.average) || previous.average < 0 || previous.average > 100 || !Number.isFinite(previous.hours) || previous.hours < 0) throw new Error("تحقق من المعدل السابق والساعات المحتسبة.");
  const repeatedHours = courses.filter(row => row.previousGrade !== undefined).reduce((sum, row) => sum + row.hours, 0);
  const oldRepeatedPoints = courses.reduce((sum, row) => sum + (row.previousGrade ?? 0) * (row.previousGrade !== undefined ? row.hours : 0), 0);
  if (repeatedHours > previous.hours || oldRepeatedPoints > previous.average * previous.hours + .0001 || previous.average * previous.hours - oldRepeatedPoints > (previous.hours - repeatedHours) * 100 + .0001) throw new Error("بيانات المساقات المعادة لا تتوافق مع المعدل والساعات السابقة.");
  const totalHours = previous.hours + hours - repeatedHours;
  const totalPoints = previous.average * previous.hours + courses.reduce((sum, row) => sum + row.hours * (row.previousGrade === undefined ? row.grade : Math.max(0, row.grade - row.previousGrade)), 0);
  return { hours, semester: hours ? points / hours : null, cumulative: totalHours ? totalPoints / totalHours : null };
}
