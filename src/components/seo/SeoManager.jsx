import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const baseUrl = "https://www.occuboard.io";
const socialImage = `${baseUrl}/assets/occuboard-social-card.png`;
const homeDescription = "Analyze realistic job fit, uncover hiring considerations, strengthen your positioning, tailor resumes, write recruiter outreach, and prepare for interviews with OccuBoard.";

const pageMetadata = {
  "/": {
    title: "OccuBoard | AI Job Application Copilot & Fit Analysis",
    description: homeDescription,
    indexable: true,
  },
  "/privacy": {
    title: "Privacy Policy | OccuBoard",
    description: "Learn how OccuBoard collects, uses, stores, and protects account, resume, job search, application, billing, and AI processing data.",
    indexable: true,
  },
  "/terms": {
    title: "Terms of Service | OccuBoard",
    description: "Review the terms that govern OccuBoard accounts, subscriptions, AI-generated content, acceptable use, and job search services.",
    indexable: true,
  },
  "/login": {
    title: "Log In | OccuBoard",
    description: "Log in to your OccuBoard job search workspace.",
  },
  "/signup": {
    title: "Create Your OccuBoard Account",
    description: "Create an OccuBoard account and begin building focused, tailored job applications.",
  },
  "/forgot-password": {
    title: "Reset Your Password | OccuBoard",
    description: "Request a password reset link for your OccuBoard account.",
  },
  "/reset-password": {
    title: "Choose a New Password | OccuBoard",
    description: "Choose a new password for your OccuBoard account.",
  },
};

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${baseUrl}/#organization`,
  name: "OccuBoard",
  url: `${baseUrl}/`,
  logo: `${baseUrl}/assets/occuboard-logo-email.png`,
  email: "support@occuboard.io",
  description: "OccuBoard is an AI-powered job application copilot for realistic fit analysis, recruiter perspective, truthful positioning, interview preparation, and application tracking.",
};

const softwareApplicationSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "@id": `${baseUrl}/#software`,
  name: "OccuBoard",
  url: `${baseUrl}/`,
  description: "An AI-powered job application copilot for realistic fit analysis, hiring considerations, recruiter confidence, truthful positioning, resume tailoring, recruiter outreach, interview preparation, and application tracking.",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  isAccessibleForFree: true,
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    description: "Free plan with three AI-powered applications.",
  },
  publisher: { "@id": `${baseUrl}/#organization` },
  featureList: [
    "Realistic job fit analysis",
    "Hiring consideration detection",
    "Recruiter perspective and confidence",
    "Application recovery strategy",
    "Resume tailoring",
    "Recruiter outreach generation",
    "Interview preparation",
    "Application tracking",
  ],
};

export function SeoManager() {
  const location = useLocation();

  useEffect(() => {
    const metadata = pageMetadata[location.pathname] || {
      title: "OccuBoard | Job Search Workspace",
      description: "Manage job analysis, tailored application materials, interview preparation, and application tracking in OccuBoard.",
      indexable: false,
    };
    const pageUrl = `${baseUrl}${location.pathname === "/" ? "/" : location.pathname}`;
    const robots = metadata.indexable
      ? "index, follow, max-image-preview:large"
      : "noindex, nofollow, noarchive";

    document.title = metadata.title;
    setMeta("name", "description", metadata.description);
    setMeta("name", "robots", robots);
    setMeta("name", "googlebot", robots);
    setLink("canonical", metadata.indexable ? pageUrl : "");
    setMeta("property", "og:type", "website");
    setMeta("property", "og:site_name", "OccuBoard");
    const socialTitle = location.pathname === "/"
      ? "OccuBoard: Understand How Recruiters May See Your Application"
      : metadata.title;
    const socialDescription = location.pathname === "/"
      ? "Evaluate realistic fit, identify hiring concerns, and build a truthful strategy for resumes, recruiter outreach, and interviews."
      : metadata.description;
    setMeta("property", "og:title", socialTitle);
    setMeta("property", "og:description", socialDescription);
    setMeta("property", "og:url", pageUrl);
    setMeta("property", "og:image", socialImage);
    setMeta("property", "og:image:width", "1200");
    setMeta("property", "og:image:height", "630");
    setMeta("property", "og:image:alt", "OccuBoard AI job search workspace");
    setMeta("name", "twitter:card", "summary_large_image");
    setMeta("name", "twitter:title", socialTitle);
    setMeta("name", "twitter:description", socialDescription);
    setMeta("name", "twitter:image", socialImage);
    setMeta("name", "twitter:image:alt", "OccuBoard AI job search workspace");
    syncStructuredData(location.pathname === "/");
  }, [location.pathname]);

  return null;
}

function setMeta(attribute, key, content) {
  let element = document.head.querySelector(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute("content", content);
}

function setLink(rel, href) {
  let element = document.head.querySelector(`link[rel="${rel}"]`);
  if (!href) {
    element?.remove();
    return;
  }
  if (!element) {
    element = document.createElement("link");
    element.setAttribute("rel", rel);
    document.head.appendChild(element);
  }
  element.setAttribute("href", href);
}

function syncStructuredData(showHomepageSchemas) {
  setStructuredData("organization-schema", showHomepageSchemas ? organizationSchema : null);
  setStructuredData("software-application-schema", showHomepageSchemas ? softwareApplicationSchema : null);
}

function setStructuredData(id, data) {
  let element = document.getElementById(id);
  if (!data) {
    element?.remove();
    return;
  }
  if (!element) {
    element = document.createElement("script");
    element.id = id;
    element.type = "application/ld+json";
    document.head.appendChild(element);
  }
  element.textContent = JSON.stringify(data);
}
