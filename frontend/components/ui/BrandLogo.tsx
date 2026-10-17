import Image from "next/image";

export default function BrandLogo({ size }: { size: number }) {
  return (
    <Image
      src="/Fluxa-Logo.webp"
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      priority
    />
  );
}
