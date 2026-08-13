export default function AdminFeedback({
  error,
  success,
}: {
  error?: string;
  success?: string;
}) {
  if (error) {
    return <div className="form-error admin-feedback" role="alert">{error}</div>;
  }

  if (success) {
    return <div className="form-success admin-feedback" role="status">{success}</div>;
  }

  return null;
}
