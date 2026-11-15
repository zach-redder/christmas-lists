import { PasscodeForm } from "@/components/GateForms";

export const metadata = { title: "Welcome · Redder Christmas 2026" };

export default function WelcomePage() {
  return (
    <>
      <p className="mb-4 text-center text-ink-soft">
        This is our family&apos;s private Christmas list site. Enter the family password to come in.
      </p>
      <PasscodeForm />
    </>
  );
}
