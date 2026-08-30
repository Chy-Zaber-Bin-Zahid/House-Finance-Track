import { TextLink } from "@/components/ui";
import { AuthForm } from "@/components/auth-form";

export const metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <AuthForm
      title="Sign in"
      intro="The sheet is private to the family."
      submitLabel="Sign in"
      endpoint="/api/auth/sign-in"
      onDone={{ redirect: "/" }}
      footer={
        <>
          No account yet? <TextLink href="/register">Ask for access</TextLink>.
        </>
      }
    />
  );
}
