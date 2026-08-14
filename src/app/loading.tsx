import { BrandLoader } from "@/components/effects/brand-loader";

/**
 * Next.js native loading UI — shows on every client-side route navigation
 * (App Router automatically swaps this in during transitions).
 */
export default function Loading() {
  return (
    <div className="flex flex-1 items-center justify-center py-24">
      <BrandLoader />
    </div>
  );
}
