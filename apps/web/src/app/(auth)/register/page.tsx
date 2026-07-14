import type { Metadata } from "next";
import { RegisterForm } from "@/features/auth/components/register-form";

export const metadata: Metadata = { title: "Criar workspace — MilLead" };

export default function RegisterPage() {
  return <RegisterForm />;
}
