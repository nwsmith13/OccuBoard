# Supabase Auth Email Templates

Configure these in:

`Supabase Dashboard -> Authentication -> Emails -> Templates`

## Confirm Signup

**Subject**

```text
Confirm your OccuBoard account
```

**Body**

```html
<h2>Welcome to OccuBoard!</h2>
<p>Please confirm your email address to finish creating your account.</p>
<p><a href="{{ .ConfirmationURL }}">Confirm my OccuBoard account</a></p>
<p>You are receiving this email because you created an OccuBoard account.</p>
```

## Reset Password

**Subject**

```text
Reset your OccuBoard password
```

**Body**

```html
<h2>Reset your OccuBoard password</h2>
<p>Use the link below to choose a new password for your OccuBoard account.</p>
<p><a href="{{ .ConfirmationURL }}">Reset my OccuBoard password</a></p>
<p>You are receiving this email because a password reset was requested for your OccuBoard account.</p>
```

## URL Configuration

Configure these in:

`Supabase Dashboard -> Authentication -> URL Configuration`

**Site URL**

```text
https://www.occuboard.io
```

**Redirect URLs**

```text
https://www.occuboard.io/*
http://localhost:5173/*
http://127.0.0.1:5173/*
```

The application sends signup confirmations to `/login?confirmed=1` and password recovery links to `/reset-password`.

## Stripe Product Description

Checkout metadata and the Checkout submit message use:

```text
OccuBoard Pro
Unlimited AI-powered job search tools, resume tailoring, recruiter messaging, interview prep, and application tracking.
```

Because Checkout uses the existing Stripe Price ID `price_1Te8BxDhoHP54GBjlCbY2coq`, update the visible line-item description in:

`Stripe Dashboard -> Product catalog -> OccuBoard Pro`

The associated product is `prod_UdOz87le0F8ZTJ`.
