export const departmentFontClass = (slug: string) => {
  if (["computer-engineering", "ai-engineering"].includes(slug)) return "dept-orbitron";
  if (["architecture", "civil-engineering"].includes(slug)) return "dept-space";
  if (["industrial-engineering", "mechanical-engineering"].includes(slug)) return "dept-rajdhani";
  return "dept-exo";
};
