"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setErrorMessage("");

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        setErrorMessage(
          error.message === "Invalid login credentials"
            ? "Email atau kata sandi tidak sesuai. Periksa kembali lalu coba lagi."
            : "Login belum berhasil. Silakan coba lagi beberapa saat."
        );
        setIsLoading(false);
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    } catch {
      setErrorMessage("Koneksi bermasalah. Periksa jaringan lalu coba lagi.");
      setIsLoading(false);
    }
  }

  return (
    <section className="auth-panel" aria-labelledby="login-heading">
      <div className="auth-brand" aria-label="Fluxa">
        <span className="auth-brand-mark" aria-hidden="true">F</span>
        <span>Fluxa</span>
      </div>

      <h1 className="auth-heading" id="login-heading">Selamat datang kembali</h1>
      <p className="auth-description">
        Masuk untuk melanjutkan pengelolaan bisnis Anda.
      </p>

      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="auth-field">
          <label className="auth-label" htmlFor="email">Email</label>
          <input
            className="auth-input"
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="nama@bisnis.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>

        <div className="auth-field">
          <label className="auth-label" htmlFor="password">Kata sandi</label>
          <div className="auth-input-wrap">
            <input
              className="auth-input auth-input-password"
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Masukkan kata sandi"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <button
              className="auth-password-toggle"
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
            >
              {showPassword ? "Sembunyikan" : "Tampilkan"}
            </button>
          </div>
        </div>

        {errorMessage && <p className="auth-error" role="alert">{errorMessage}</p>}

        <button className="auth-button" type="submit" disabled={isLoading}>
          {isLoading ? "Memeriksa akun..." : "Masuk"}
        </button>
      </form>

      <p className="auth-footer">Akses aman untuk operasional bisnis Anda.</p>
    </section>
  );
}