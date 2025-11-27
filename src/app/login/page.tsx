"use client";

import { Button } from "@/components/ui/button";
import { signIn } from "@/lib/auth-client";
import { FaGoogle, FaShieldAlt, FaHistory, FaRocket } from "react-icons/fa";

const BenefitItem = ({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) => (
  <div className="flex items-start space-x-3">
    <div className="shrink-0 mt-1">
      <Icon className="h-5 w-5 text-blue-600" />
    </div>
    <div>
      <h4 className="font-medium text-gray-900">{title}</h4>
      <p className="text-sm text-gray-600">{description}</p>
    </div>
  </div>
);

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-gray-900">
            Welcome to Our AI Platform
          </h2>
        </div>

        <div className="rounded-lg bg-white p-6 shadow-sm border border-gray-200">
          <h3 className="text-lg font-medium text-center mb-4">Why sign in?</h3>
          <div className="space-y-4 mb-6">
            <BenefitItem
              icon={FaHistory}
              title="Chat History"
              description="Access your conversation history across all your devices"
            />
            <BenefitItem
              icon={FaShieldAlt}
              title="Secure Access"
              description="We use secure authentication to protect your data and our systems"
            />
          </div>
          <div className="mt-8 space-y-6">
            <div>
              <Button
                onClick={async () => {
                  await signIn.social({ provider: "google", callbackURL: "/" });
                }}
                className="group relative flex w-full justify-center gap-2 rounded-md px-4 py-4 text-sm font-medium shadow-sm ring-1 ring-inset"
              >
                <FaGoogle className="h-5 w-5" />
                <span>Continue with Google</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
