"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { API } from "../lib/api";


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
      const body = register
        ? { organization, email, password, name }
        : { organization, email, password };
      const res = await fetch(`${API}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      localStorage.setItem("agentos_token", data.access_token);
      router.push("/");
    } catch (e: any) {
      setError(e.message || "Auth failed");
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    submit(false);
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={onSubmit}>
        <h1>AgentOS</h1>
        <p className="sub">Open-source control plane for enterprise AI agents.</p>
        {error && <p className="error">{error}</p>}
        <div className="field">
          <label>Organization</label>
          <input value={organization} onChange={(e) => setOrganization(e.target.value)} />
        </div>
        <div className="field">
          <label>Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label>Name (register)</label>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button className="btn" disabled={loading} type="submit">
            Sign in
          </button>
          <button className="btn secondary" type="button" disabled={loading} onClick={() => submit(true)}>
            Register org
          </button>
        </div>
      </form>
    </div>
  );
}
