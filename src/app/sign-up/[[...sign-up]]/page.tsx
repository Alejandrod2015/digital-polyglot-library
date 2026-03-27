import { Suspense } from "react";
import SignUpClient from "./SignUpClient";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SignUpClient />
    </Suspense>
  );
}
