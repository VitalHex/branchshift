import type { CommitOperationError } from "../../shared/store/commit/types";

interface OperationErrorBannerProps {
  error: CommitOperationError | null;
}

export function OperationErrorBanner({
  error,
}: OperationErrorBannerProps): React.ReactNode {
  if (!error) return null;

  return (
    <div className="commit-operation-error" role="alert" aria-live="assertive">
      <div>{error.message}</div>
      {error.recovery && (
        <div className="commit-operation-error-recovery">{error.recovery}</div>
      )}
    </div>
  );
}
