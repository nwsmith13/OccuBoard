import { Link, useNavigate } from "react-router-dom";
import { AuthForm } from "./AuthForm.jsx";

export function SignUpPage() {
  const navigate = useNavigate();
  return (
    <AuthForm
      mode="signup"
      title="Create your workspace"
      submitLabel="Sign up"
      footer={<span>Already have an account? <Link className="font-semibold text-brand-700" to="/login">Login</Link></span>}
      onSuccess={() => navigate("/app")}
    />
  );
}
