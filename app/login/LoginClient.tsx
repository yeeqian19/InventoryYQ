"use client";
import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function LoginClient() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false); // 🟢 Added state for toggle
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("Invalid Email or Password.");
      setLoading(false);
    } else {
      router.push('/');
      router.refresh();
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0f172a] p-4">
      <div className="w-full max-w-md rounded-2xl bg-[#1e293b] p-10 shadow-2xl border border-slate-800">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-white tracking-tight">MY INVENTORY</h1>
          <p className="mt-2 text-sm text-slate-400">Sign in to your account</p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-500/10 p-3 text-center text-sm text-red-400 border border-red-500/20">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <input
              type="email"
              placeholder="Email"
              required
              className="w-full rounded-lg border border-slate-700 bg-[#0f172a] px-4 py-3 text-white focus:border-emerald-500 focus:outline-none transition-all"
              onChange={(e) => setEmail(e.target.value)}
            />
            
            {/* Password Container */}
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"} // 🟢 Toggle type
                placeholder="Password"
                required
                className="w-full rounded-lg border border-slate-700 bg-[#0f172a] px-4 py-3 text-white focus:border-emerald-500 focus:outline-none transition-all"
                onChange={(e) => setPassword(e.target.value)}
              />
              {/* Show/Hide Button */}
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-emerald-400 transition-colors"
              >
                {showPassword ? (
                  <span className="text-sm font-bold uppercase tracking-tighter">Hide</span>
                ) : (
                  <span className="text-sm font-bold uppercase tracking-tighter">Show</span>
                )}
              </button>
            </div>
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-emerald-600 py-3 font-bold text-white hover:bg-emerald-500 disabled:opacity-50 transition-all shadow-lg shadow-emerald-900/20"
          >
            {loading ? "AUTHENTICATING..." : "SIGN IN"}
          </button>
        </form>
      </div>
    </div>
  );
}