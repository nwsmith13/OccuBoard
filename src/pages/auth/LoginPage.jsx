import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AuthForm } from "./AuthForm.jsx";

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const notice = searchParams.get("password") === "updated"
    ? "Password updated. You can sign in now."
    : searchParams.get("confirmed") === "1"
      ? "Email confirmed. Welcome to OccuBoard."
      : "";
  return (
    <AuthForm
      mode="login"
      title="Welcome back"
      submitLabel="Sign In"
      notice={notice}
      footer={(
        <span className="grid gap-2">
          <Link className="font-semibold text-[#FFB26B] hover:text-[#FF7A00]" to="/forgot-password">Forgot password?</Link>
          <span>New to OccuBoard? <Link className="font-semibold text-[#FFB26B] hover:text-[#FF7A00]" to="/signup">Create an account</Link></span>
        </span>
      )}
      onSuccess={() => navigate("/app")}
    />
  );
}
