import type { SVGProps } from "react";

// Bold-weight icons from Phosphor (https://phosphoricons.com, MIT licence),
// inlined as paths rather than adding the package. Copied verbatim from
// phosphor-icons/core assets/bold; size follows the `size` prop, colour follows
// the surrounding text colour.
type IconProps = Omit<SVGProps<SVGSVGElement>, "width" | "height"> & { size?: number };

function Icon({ size = 20, d, ...rest }: IconProps & { d: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 256"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
      {...rest}
    >
      <path d={d} />
    </svg>
  );
}

export function PaperPlaneTilt(props: IconProps) {
  return (
    <Icon
      {...props}
      d="M230.14,25.86a20,20,0,0,0-19.57-5.11l-.22.07L18.44,79a20,20,0,0,0-3.06,37.25L99,157l40.71,83.65a19.81,19.81,0,0,0,18,11.38c.57,0,1.15,0,1.73-.07A19.82,19.82,0,0,0,177,237.56L235.18,45.65a1.42,1.42,0,0,0,.07-.22A20,20,0,0,0,230.14,25.86ZM156.91,221.07l-34.37-70.64,46-45.95a12,12,0,0,0-17-17l-46,46L34.93,99.09,210,46Z"
    />
  );
}

export function UserPlus(props: IconProps) {
  return (
    <Icon
      {...props}
      d="M256,136a12,12,0,0,1-12,12h-8v8a12,12,0,0,1-24,0v-8h-8a12,12,0,0,1,0-24h8v-8a12,12,0,0,1,24,0v8h8A12,12,0,0,1,256,136Zm-54.81,56.28a12,12,0,1,1-18.38,15.44C169.12,191.42,145,172,108,172c-28.89,0-55.46,12.68-74.81,35.72a12,12,0,0,1-18.38-15.44A124.08,124.08,0,0,1,63.5,156.53a72,72,0,1,1,89,0A124,124,0,0,1,201.19,192.28ZM108,148a48,48,0,1,0-48-48A48.05,48.05,0,0,0,108,148Z"
    />
  );
}

export function UserCheck(props: IconProps) {
  return (
    <Icon
      {...props}
      d="M152.5,156.54a72,72,0,1,0-89,0,124,124,0,0,0-48.69,35.74,12,12,0,0,0,18.38,15.44C46.88,191.42,71,172,108,172s61.12,19.42,74.81,35.72a12,12,0,1,0,18.38-15.44A123.89,123.89,0,0,0,152.5,156.54ZM60,100a48,48,0,1,1,48,48A48.05,48.05,0,0,1,60,100Zm192.49,36.49-32,32a12,12,0,0,1-17,0l-16-16a12,12,0,0,1,17-17L212,143l23.51-23.52a12,12,0,1,1,17,17Z"
    />
  );
}
