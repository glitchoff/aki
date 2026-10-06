import { Suspense } from "react";
import { Reader } from "@/components/Reader";

export default function ReadPage() {
  return (
    <Suspense fallback={null}>
      <Reader />
    </Suspense>
  );
}