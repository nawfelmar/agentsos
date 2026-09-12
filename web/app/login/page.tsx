"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { API, setSession } from "../lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [organization, setOrganization] = useState("acme-auto");
  const [email, setEmail] = useState("admin@acme.local");
  const [password, setPassword] = useState("agentos-demo");
  const [name, setName] = useState("Admin");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(register: boolean) {
    setLoading(true);
    setError("");
    try {
      const path = register ? "/api/v1/auth/register" : "/api/v1/auth/login";
      const body = register ? { organization, email, password, name } : { organization, email, password };
      const res = await fetch(`${API}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setSession(data.access_token, organization);
      router.push("/");
    } catch (e: any) {
      setError(e.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-shell">
      <section className="login-hero">
        <div>
          <h1>AgentOS</h1>
          <p className="pitch">
            The control plane for enterprise AI agents — bring your agents, keep data private, govern every tool call.
          </p>
          <ul>
            <li>Register and version heterogeneous agents like deployable software</li>
            <li>Enforce ALLOW / DENY / APPROVAL_REQUIRED at the tool boundary</li>
            <li>Observe runs, evaluate versions, and roll back with audit evidence</li>
          </ul>
        </div>
        <div className="mono" style={{ opacity: 0.7 }}>
          Control plane ≠ execution plane
        </div>
      </section>
      <section className="login-panel">
        <form
          className="login-card"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            submit(false);
          }}
        >
          <h2>Sign in</h2>
          <p className="sub">Access your organization’s agent fleet governance console.</p>
          {error ? <div className="error-banner">{error}</div> : null}
          <div className="field">
            <label>Organization</label>
            <input value={organization} onChange={(e) => setOrganization(e.target.value)} />
          </div>
          <div className="field">
            <label>Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label>Name (for new org)</label>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="kbd-row">
            <button className="btn" disabled={loading} type="submit">
              Sign in
            </button>
            <button className="btn secondary" type="button" disabled={loading} onClick={() => submit(true)}>
              Register organization
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
