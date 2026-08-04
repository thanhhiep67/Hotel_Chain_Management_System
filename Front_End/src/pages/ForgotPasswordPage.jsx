import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { forgotPassword, resetPassword } from '../api/auth';

const HOTEL_BG = 'https://images.unsplash.com/photo-1455587734955-081b22074882?w=1200&q=80';
const OTP_TTL  = 5 * 60; // 5 phút tính bằng giây

// ── shared UI primitives ───────────────────────────────────────────────────

const Logo = ({ mobile }) => (
  <Link to="/" className={mobile ? 'lg:hidden flex items-center gap-2 mb-8' : 'flex items-center gap-2.5 w-fit'}>
    <div className={`${mobile ? 'w-8 h-8' : 'w-9 h-9'} bg-[#C9A84C] rounded-lg flex items-center justify-center`}>
      <svg className={`${mobile ? 'w-4 h-4' : 'w-5 h-5'} text-[#0A0A0B]`} fill="currentColor" viewBox="0 0 20 20">
        <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/>
      </svg>
    </div>
    <span className={`${mobile ? 'text-lg' : 'text-xl'} font-bold text-white tracking-tight`}>
      Hotel<span className="text-[#C9A84C]">Chain</span>
    </span>
  </Link>
);

function ErrBanner({ msg }) {
  if (!msg) return null;
  return (
    <div className="mb-5 px-4 py-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl flex items-center gap-2">
      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
      {msg}
    </div>
  );
}

const inputCls = (err) =>
  `w-full px-4 py-3 border rounded-xl text-sm outline-none transition
   ${err
     ? 'border-red-400 focus:ring-2 focus:ring-red-100'
     : 'border-gray-200 focus:border-[#C9A84C] focus:ring-2 focus:ring-[#C9A84C]/15'}`;

const btnCls =
  'w-full py-3 bg-[#0A0A0B] hover:bg-[#C9A84C] disabled:opacity-60 text-white hover:text-[#0A0A0B] font-semibold rounded-xl text-sm transition-all duration-200 cursor-pointer';

function EyeBtn({ show, toggle }) {
  return (
    <button type="button" onClick={toggle}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer">
      {show
        ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>
        : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
      }
    </button>
  );
}

// ── main component ─────────────────────────────────────────────────────────

export default function ForgotPasswordPage() {
  const navigate = useNavigate();

  // bước hiện tại: 'email' | 'otp' | 'success'
  const [step, setStep] = useState('email');

  // --- bước 1: nhập email ---
  const [email,           setEmail]           = useState('');
  const [emailErr,        setEmailErr]        = useState('');
  const [emailServerErr,  setEmailServerErr]  = useState('');
  const [emailLoading,    setEmailLoading]    = useState(false);

  // --- bước 2: nhập OTP + mật khẩu mới ---
  const [otp,             setOtp]             = useState('');
  const [newPwd,          setNewPwd]          = useState('');
  const [confirmPwd,      setConfirmPwd]      = useState('');
  const [otpErrors,       setOtpErrors]       = useState({});
  const [otpServerErr,    setOtpServerErr]    = useState('');
  const [otpLoading,      setOtpLoading]      = useState(false);
  const [showPwd,         setShowPwd]         = useState(false);
  const [showConfirmPwd,  setShowConfirmPwd]  = useState(false);

  // --- countdown ---
  const [countdown,     setCountdown]     = useState(OTP_TTL);
  const [resendLoading, setResendLoading] = useState(false);

  const fmt = (s) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  useEffect(() => {
    if (step !== 'otp' || countdown <= 0) return;
    const id = setInterval(() => setCountdown(c => c - 1), 1000);
    return () => clearInterval(id);
  }, [step, countdown]);

  // ── handlers ──────────────────────────────────────────────────────────────

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    if (!email)                           { setEmailErr('Email không được để trống'); return; }
    if (!/\S+@\S+\.\S+/.test(email))      { setEmailErr('Email không hợp lệ'); return; }
    setEmailLoading(true);
    setEmailServerErr('');
    try {
      await forgotPassword(email);
      setCountdown(OTP_TTL);
      setStep('otp');
    } catch (err) {
      setEmailServerErr(err.response?.data?.message ?? 'Không thể gửi mã OTP, thử lại sau');
    } finally {
      setEmailLoading(false);
    }
  };

  const handleResend = async () => {
    setResendLoading(true);
    setOtpServerErr('');
    try {
      await forgotPassword(email);
      setCountdown(OTP_TTL);
      setOtp('');
    } catch (err) {
      setOtpServerErr(err.response?.data?.message ?? 'Không thể gửi lại mã OTP');
    } finally {
      setResendLoading(false);
    }
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!otp)                                  errs.otp         = 'Mã OTP không được để trống';
    else if (!/^\d{6}$/.test(otp))             errs.otp         = 'Mã OTP gồm 6 chữ số';
    if (!newPwd)                               errs.newPwd      = 'Mật khẩu không được để trống';
    else if (newPwd.length < 6)                errs.newPwd      = 'Mật khẩu tối thiểu 6 ký tự';
    if (!confirmPwd)                           errs.confirmPwd  = 'Vui lòng xác nhận mật khẩu';
    else if (confirmPwd !== newPwd)            errs.confirmPwd  = 'Mật khẩu xác nhận không khớp';
    if (Object.keys(errs).length)              { setOtpErrors(errs); return; }

    setOtpLoading(true);
    setOtpServerErr('');
    try {
      await resetPassword({ email, otp, newPassword: newPwd });
      setStep('success');
    } catch (err) {
      setOtpServerErr(err.response?.data?.message ?? 'Đặt lại mật khẩu thất bại, thử lại');
    } finally {
      setOtpLoading(false);
    }
  };

  // ── shared layout wrapper ─────────────────────────────────────────────────

  const LeftPanel = () => (
    <div className="hidden lg:flex lg:w-5/12 xl:w-[42%] flex-col relative overflow-hidden bg-[#0A0A0B]">
      <img src={HOTEL_BG} alt="" className="absolute inset-0 w-full h-full object-cover opacity-25" />
      <div className="absolute inset-0"
        style={{ background: 'linear-gradient(160deg,rgba(10,10,11,0.6) 0%,rgba(10,10,11,0.92) 100%)' }} />
      <div className="relative flex flex-col justify-between h-full p-10">
        <Logo />
        <div>
          <p className="text-4xl text-white font-light leading-snug mb-8">
            Bảo mật tài khoản<br />của bạn
          </p>
          <div className="flex items-center gap-4 mb-3">
            {[['OTP','Bảo mật'], ['5 phút','Hiệu lực'], ['BCrypt','Mã hóa']].map(([v, l]) => (
              <div key={l} className="text-center">
                <p className="text-[#C9A84C] font-bold text-lg leading-none">{v}</p>
                <p className="text-white/50 text-xs mt-1">{l}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // ── bước 1: nhập email ────────────────────────────────────────────────────

  if (step === 'email') return (
    <div className="min-h-screen flex">
      <LeftPanel />
      <div className="flex-1 flex flex-col items-center justify-center bg-white px-6 py-10">
        <Logo mobile />
        <div className="w-full max-w-sm">
          <div className="mb-6">
            <Link to="/login" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition mb-6">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
              </svg>
              Quay lại đăng nhập
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Quên mật khẩu</h1>
            <p className="text-sm text-gray-500">
              Nhập email đã đăng ký, chúng tôi sẽ gửi mã OTP để đặt lại mật khẩu.
            </p>
          </div>

          <ErrBanner msg={emailServerErr} />

          <form onSubmit={handleEmailSubmit} noValidate className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input
                type="email" value={email} autoFocus autoComplete="email"
                placeholder="example@gmail.com"
                onChange={e => { setEmail(e.target.value); setEmailErr(''); setEmailServerErr(''); }}
                className={inputCls(emailErr)}
              />
              {emailErr && <p className="mt-1 text-xs text-red-500">{emailErr}</p>}
            </div>

            <button type="submit" disabled={emailLoading} className={`${btnCls} mt-2`}>
              {emailLoading ? 'Đang gửi...' : 'Gửi mã OTP'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Nhớ mật khẩu rồi?{' '}
            <Link to="/login" className="text-[#C9A84C] font-semibold hover:underline">Đăng nhập</Link>
          </p>
        </div>
      </div>
    </div>
  );

  // ── bước 2: nhập OTP + mật khẩu mới ─────────────────────────────────────

  if (step === 'otp') return (
    <div className="min-h-screen flex">
      <LeftPanel />
      <div className="flex-1 flex flex-col items-center justify-center bg-white px-6 py-10">
        <Logo mobile />
        <div className="w-full max-w-sm">
          <div className="mb-6">
            <button
              onClick={() => setStep('email')}
              className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition mb-6 cursor-pointer">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
              </svg>
              Thay đổi email
            </button>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Nhập mã OTP</h1>
            <p className="text-sm text-gray-500">
              Mã OTP đã được gửi đến <span className="font-medium text-gray-800">{email}</span>
            </p>
          </div>

          {/* Countdown */}
          <div className={`mb-5 flex items-center justify-between px-4 py-3 rounded-xl text-sm border
            ${countdown > 0
              ? 'bg-amber-50 border-amber-200 text-amber-700'
              : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              {countdown > 0
                ? <span>Mã hết hạn sau <span className="font-mono font-semibold">{fmt(countdown)}</span></span>
                : <span>Mã OTP đã hết hạn</span>
              }
            </div>
            {countdown <= 0 && (
              <button
                type="button" onClick={handleResend} disabled={resendLoading}
                className="text-[#C9A84C] font-semibold hover:underline disabled:opacity-60 cursor-pointer text-xs">
                {resendLoading ? 'Đang gửi...' : 'Gửi lại'}
              </button>
            )}
          </div>

          <ErrBanner msg={otpServerErr} />

          <form onSubmit={handleResetSubmit} noValidate className="space-y-4">

            {/* OTP */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Mã OTP (6 chữ số)</label>
              <input
                type="text" inputMode="numeric" maxLength={6} value={otp}
                placeholder="••••••" autoComplete="one-time-code" autoFocus
                onChange={e => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setOtp(v);
                  setOtpErrors(p => ({ ...p, otp: '' }));
                  setOtpServerErr('');
                }}
                className={`${inputCls(otpErrors.otp)} tracking-[0.5em] text-center font-mono text-lg`}
              />
              {otpErrors.otp && <p className="mt-1 text-xs text-red-500">{otpErrors.otp}</p>}
            </div>

            {/* Mật khẩu mới */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Mật khẩu mới</label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'} value={newPwd}
                  placeholder="••••••••" autoComplete="new-password"
                  onChange={e => {
                    setNewPwd(e.target.value);
                    setOtpErrors(p => ({ ...p, newPwd: '' }));
                  }}
                  className={`${inputCls(otpErrors.newPwd)} pr-11`}
                />
                <EyeBtn show={showPwd} toggle={() => setShowPwd(v => !v)} />
              </div>
              {otpErrors.newPwd && <p className="mt-1 text-xs text-red-500">{otpErrors.newPwd}</p>}
            </div>

            {/* Xác nhận mật khẩu */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Xác nhận mật khẩu</label>
              <div className="relative">
                <input
                  type={showConfirmPwd ? 'text' : 'password'} value={confirmPwd}
                  placeholder="••••••••" autoComplete="new-password"
                  onChange={e => {
                    setConfirmPwd(e.target.value);
                    setOtpErrors(p => ({ ...p, confirmPwd: '' }));
                  }}
                  className={`${inputCls(otpErrors.confirmPwd)} pr-11`}
                />
                <EyeBtn show={showConfirmPwd} toggle={() => setShowConfirmPwd(v => !v)} />
              </div>
              {otpErrors.confirmPwd && <p className="mt-1 text-xs text-red-500">{otpErrors.confirmPwd}</p>}
            </div>

            <button type="submit" disabled={otpLoading || countdown <= 0} className={`${btnCls} mt-2`}>
              {otpLoading ? 'Đang xử lý...' : 'Đặt lại mật khẩu'}
            </button>
          </form>

          {countdown > 0 && (
            <p className="text-center text-xs text-gray-400 mt-4">
              Chưa nhận được mã?{' '}
              <button
                type="button" onClick={handleResend} disabled={resendLoading}
                className="text-[#C9A84C] hover:underline disabled:opacity-60 cursor-pointer">
                {resendLoading ? 'Đang gửi...' : 'Gửi lại'}
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );

  // ── bước 3: thành công ────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 w-full max-w-sm text-center">
        {/* Icon thành công */}
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
          </svg>
        </div>

        <h2 className="text-xl font-bold text-gray-900 mb-2">Đặt lại mật khẩu thành công!</h2>
        <p className="text-sm text-gray-500 mb-8">
          Mật khẩu của bạn đã được cập nhật. Hãy đăng nhập với mật khẩu mới.
        </p>

        <button
          onClick={() => navigate('/login')}
          className={btnCls}>
          Đăng nhập ngay
        </button>

        <div className="mt-5">
          <Link to="/" className="text-sm text-gray-400 hover:text-gray-600 transition">
            Về trang chủ
          </Link>
        </div>
      </div>
    </div>
  );
}
