"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { trackGa4Event } from "@/lib/ga4";

type Props = {
  isNewUser: boolean;
};

export default function PostLoginTracker({ isNewUser }: Props) {
  const router = useRouter();

  useEffect(() => {
    if (isNewUser) {
      trackGa4Event("sign_up", { method: "clerk" });
    } else {
      trackGa4Event("login", { method: "clerk" });
    }
    router.replace("/");
  }, [isNewUser, router]);

  return null;
}
