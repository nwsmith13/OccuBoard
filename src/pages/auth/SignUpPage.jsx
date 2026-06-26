import { Link, useNavigate } from "react-router-dom";
import { AuthForm } from "./AuthForm.jsx";

export function SignUpPage() {
  const navigate = useNavigate();
  return (
    <AuthForm
      mode="signup"
      title="Create your workspace"
      submitLabel="Sign up"
      footer={<span>Already have an account? <Link className="font-semibold text-[#FFB26B] hover:text-[#FF7A00]" to="/login">Sign In</Link></span>}
      onSuccess={() => navigate("/app")}
    />
  );
}
