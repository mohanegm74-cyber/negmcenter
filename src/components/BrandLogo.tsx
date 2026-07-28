export const LOGO_URL = "/logo.png";

export function BrandLogo({ size = 96, className = "" }: { size?: number; className?: string }) {
  return (
    <img
      src={LOGO_URL}
      alt="سنتر الأستاذ محمد نجم"
      width={size}
      height={size}
      className={`inline-block rounded-2xl object-contain shadow-lg ${className}`}
      style={{ width: size, height: size }}
    />
  );
}