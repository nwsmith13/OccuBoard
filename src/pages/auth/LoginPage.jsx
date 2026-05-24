import { Link, useNavigate } from "react-router-dom";
import { AuthForm } from "./AuthForm.jsx";

export function LoginPage() {
  const navigate = useNavigate();
  return (
    <AuthForm
      mode="login"
      title="Welcome back"
      submitLabel="Login"
      footer={<span>New to OccuBoard? <Link className="font-semibold text-brand-700" to="/signup">Create an account</Link></span>}
      onSuccess={() => navigate("/app")}
    />
  );
}
