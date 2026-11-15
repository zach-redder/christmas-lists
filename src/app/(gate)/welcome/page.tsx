import { PasscodeForm } from "@/components/GateForms";

export const metadata = { title: "Welcome" };

export default function WelcomePage() {
  return (
    <>
      <p className="mb-4 text-center text-ink-soft">
        This is a private family Christmas list site. Enter your family&apos;s password to come in.
      </p>
      <PasscodeForm />
    </>
  );
}
