import type { SVGProps } from 'react';

/**
 * Domo logo — stylized "D" lettermark (monochrome, inherits currentColor).
 */
export function DomoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M5 3h8c4.97 0 9 4.03 9 9s-4.03 9-9 9H5V3zm3 3v12h5c3.31 0 6-2.69 6-6s-2.69-6-6-6H8z" />
    </svg>
  );
}

