export type RegistrationWindow = {
  isOpen: boolean;
  opensAt: Date;
  closesAt: Date;
};

export type RegistrationWindowStatus =
  | "OPEN"
  | "NOT_STARTED"
  | "ENDED"
  | "DISABLED";

export function registrationWindowStatus(
  form: RegistrationWindow,
  referenceTime: Date = new Date(),
): RegistrationWindowStatus {
  if (!form.isOpen) return "DISABLED";
  if (referenceTime.getTime() < form.opensAt.getTime()) return "NOT_STARTED";
  if (referenceTime.getTime() >= form.closesAt.getTime()) return "ENDED";
  return "OPEN";
}

export function registrationWindowStatusForActivity(
  form: RegistrationWindow,
  activityEndsAt: Date | null,
  referenceTime: Date = new Date(),
): RegistrationWindowStatus {
  if (
    form.isOpen &&
    activityEndsAt &&
    form.closesAt.getTime() <= referenceTime.getTime() &&
    activityEndsAt.getTime() > referenceTime.getTime()
  ) {
    return registrationWindowStatus({ ...form, closesAt: activityEndsAt }, referenceTime);
  }

  return registrationWindowStatus(form, referenceTime);
}

export function isRegistrationOpen(
  form: RegistrationWindow | null | undefined,
  referenceTime: Date = new Date(),
) {
  return Boolean(
    form && registrationWindowStatus(form, referenceTime) === "OPEN",
  );
}
