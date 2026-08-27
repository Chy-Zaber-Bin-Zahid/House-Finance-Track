import Link from "next/link";
import { AuthForm } from "@/components/auth-form";

export const metadata = { title: "Ask for access" };

export default function RegisterPage() {
  return (
    <AuthForm
      title="Ask for access"
      intro="Pick your own password. The owner decides whether you can sign in, and what you can do."
      submitLabel="Ask for access"
      endpoint="/api/accounts"
      onDone={{
        message:
          "Asked. You cannot sign in until the owner approves the account — ask them to check the accounts screen.",
      }}
      footer={
        <>
          Already have access? <Link href="/sign-in">Sign in</Link>.
        </>
      }
    />
  );
}
