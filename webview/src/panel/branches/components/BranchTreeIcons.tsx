import type React from "react";

interface IconProps {
  style?: React.CSSProperties;
}

export function IconChevronDown({ style }: IconProps) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      style={{ verticalAlign: "middle", ...style }}
    >
      <polyline points="4,6 8,10 12,6" />
    </svg>
  );
}

export function IconChevronRight({ style }: IconProps) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      style={{ verticalAlign: "middle", ...style }}
    >
      <polyline points="6,4 10,8 6,12" />
    </svg>
  );
}

export function IconFolder({ style }: IconProps) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ verticalAlign: "middle", ...style }}
    >
      <path
        d="M8.10584 4.34613L8.25344 4.5H8.46667H13C13.8284 4.5 14.5 5.17157 14.5 6V12.1333C14.5 12.9529 13.932 13.5 13.3667 13.5H2.63333C2.06804 13.5 1.5 12.9529 1.5 12.1333V3.86667C1.5 3.04707 2.06804 2.5 2.63333 2.5H6.1217C6.25792 2.5 6.38824 2.55557 6.48253 2.65387L8.10584 4.34613Z"
        fill="currentColor"
        fillOpacity={0.15}
        stroke="currentColor"
      />
    </svg>
  );
}

export function IconBranch({ style }: IconProps) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ verticalAlign: "middle", ...style }}
    >
      <circle cx="4.5" cy="4" r="2" stroke="currentColor" />
      <path
        d="M4.5 11.5H8.5C9.60457 11.5 10.5 10.6046 10.5 9.5V8"
        stroke="currentColor"
      />
      <path
        d="M4.5 6.5L4.5 14.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="10.5" cy="6" r="2" stroke="currentColor" />
    </svg>
  );
}

export function IconFavorite({ style }: IconProps) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      style={{ verticalAlign: "middle", ...style }}
    >
      <path
        d="M8 2.5L9.3 5.7L12.8 6L10 8.4L10.8 12L8 10.2L5.2 12L6 8.4L3.2 6L6.7 5.7L8 2.5Z"
        fill="currentColor"
        stroke="currentColor"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconTag({ style }: IconProps) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ verticalAlign: "middle", ...style }}
    >
      <path d="M3 2.5h4.5l6 6-4.5 4.5-6-6V2.5z" stroke="currentColor" />
      <circle cx="5.5" cy="5" r="1" fill="currentColor" />
    </svg>
  );
}

export function IconTagOutline({ style }: IconProps) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ verticalAlign: "middle", ...style }}
    >
      <path
        d="M3 2.5h4.5l6 6-4.5 4.5-6-6V2.5z"
        stroke="currentColor"
        strokeDasharray="2 1.5"
      />
      <circle cx="5.5" cy="5" r="1" fill="currentColor" />
    </svg>
  );
}
