import React from 'react';
import {
  ArrowDown,
  ArrowRight,
  BookOpen,
  Check,
  FileText,
  MessageCircle,
  Sparkles,
  Upload,
  WandSparkles,
} from 'lucide-react';

interface LandingPageProps {
  onLogin: () => void;
}

const features = [
  {
    icon: FileText,
    tint: 'bg-blue-50 text-blue-600',
    title: 'Tóm tắt tài liệu',
    description: 'Biến tài liệu dài thành phần tóm tắt dễ đọc, các ý chính và điểm cần ôn.',
  },
  {
    icon: MessageCircle,
    tint: 'bg-blue-50 text-blue-600',
    title: 'Hỏi đáp theo tài liệu',
    description: 'Trao đổi với Aura AI và nhận câu trả lời dựa trên nội dung bạn đã tải lên.',
  },
  {
    icon: WandSparkles,
    tint: 'bg-orange-50 text-orange-600',
    title: 'Tạo quiz ôn tập',
    description: 'Tạo câu hỏi trắc nghiệm theo tài liệu để tự kiểm tra mức độ hiểu bài.',
  },
];

export const LandingPage: React.FC<LandingPageProps> = ({ onLogin }) => (
  <div className="landing-page min-h-screen overflow-hidden bg-[#fbfbff] text-slate-900">
    <header className="relative z-10 mx-auto flex h-[82px] max-w-7xl items-center justify-between px-5 sm:px-8">
      <a href="#top" className="flex items-center gap-3" aria-label="AuraStudy trang chủ">
        <img src="/assets/aurastudy-logo.png" alt="" className="h-11 w-11 object-contain" />
        <span className="text-xl font-extrabold tracking-tight">AuraStudy</span>
      </a>
      <nav className="hidden items-center gap-9 text-sm font-medium text-slate-600 md:flex">
        <a href="#features" className="transition hover:text-blue-700">Tính năng</a>
        <a href="#how-it-works" className="transition hover:text-blue-700">Cách hoạt động</a>
      </nav>
      <button
        onClick={onLogin}
        className="rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-md"
      >
        Đăng nhập
      </button>
    </header>

    <main id="top">
      <section className="relative mx-auto grid min-h-[620px] max-w-7xl items-center gap-12 px-5 pb-20 pt-10 sm:px-8 lg:grid-cols-[0.92fr_1.08fr] lg:gap-8 lg:pb-24 lg:pt-8">
        <div className="relative z-10 max-w-2xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white/80 px-3.5 py-2 text-sm font-semibold text-blue-700 shadow-sm">
            <Sparkles className="h-4 w-4" />
            Trợ lý học tập AI dành cho bạn
          </div>
          <h1 className="text-5xl font-extrabold leading-[1.08] tracking-[-0.055em] sm:text-6xl lg:text-[72px]">
            Học tập rõ ràng,
            <span className="landing-gradient block">tiến bộ mỗi ngày.</span>
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-slate-600 sm:text-xl">
            Tải tài liệu lên, hỏi đáp cùng Aura AI, tạo bài quiz và theo dõi hành trình học tập trong một không gian duy nhất.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={onLogin}
              className="group inline-flex items-center justify-center gap-2.5 rounded-full bg-blue-600 px-7 py-4 text-base font-bold text-white shadow-lg shadow-blue-200 transition hover:-translate-y-1 hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-200"
            >
              Bắt đầu học miễn phí
              <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
            </button>
            <a
              href="#features"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-7 py-4 text-base font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-700"
            >
              Khám phá tính năng
              <ArrowDown className="h-4 w-4" />
            </a>
          </div>
          <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-slate-500">
            <span className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500" /> Học theo tài liệu của bạn</span>
            <span className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500" /> Ôn tập chủ động</span>
          </div>
        </div>

        <div className="relative mx-auto flex min-h-[420px] w-full max-w-[620px] items-center justify-center lg:min-h-[540px]">
          <div className="landing-orb absolute left-[14%] top-[12%] h-64 w-64 rounded-full bg-blue-300/30 blur-3xl" />
          <div className="landing-orb landing-orb-delay absolute bottom-[8%] right-[8%] h-64 w-64 rounded-full bg-sky-300/35 blur-3xl" />
          <div className="landing-float relative w-full max-w-[490px] rounded-[30px] border border-white/80 bg-white/75 p-4 shadow-[0_30px_100px_-35px_rgba(37,99,235,0.24)] backdrop-blur-xl sm:p-6">
            <div className="flex items-center justify-between border-b border-slate-100 px-2 pb-4">
              <div className="flex items-center gap-3">
                <img src="/assets/aurastudy-logo.png" alt="" className="h-9 w-9 object-contain" />
                <div>
                  <p className="text-sm font-bold">Không gian học tập</p>
                  <p className="text-xs text-slate-400">Tập trung vào điều quan trọng</p>
                </div>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600">Đang học</span>
            </div>

            <div className="mt-5 rounded-2xl bg-gradient-to-br from-blue-50 via-white to-sky-50 p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm"><FileText className="h-5 w-5" /></div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">Nguyên lý hệ điều hành</p>
                  <p className="mt-1 text-xs text-slate-500">Tài liệu học tập · 12 trang</p>
                </div>
                <span className="rounded-lg bg-white px-2.5 py-1 text-[11px] font-bold text-rose-500 shadow-sm">PDF</span>
              </div>
              <div className="mt-5 space-y-2.5">
                <div className="h-2.5 w-full rounded-full bg-white" />
                <div className="h-2.5 w-[88%] rounded-full bg-white" />
                <div className="h-2.5 w-[68%] rounded-full bg-white" />
              </div>
              <div className="mt-5 flex items-center gap-2 rounded-xl bg-white/90 px-3.5 py-3 text-xs font-medium text-slate-600 shadow-sm">
                <Upload className="h-4 w-4 text-blue-600" /> Tài liệu đã sẵn sàng để khám phá
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-600"><MessageCircle className="h-4 w-4" /></div>
                <p className="mt-3 text-xs font-bold text-slate-800">Hỏi Aura AI</p>
                <p className="mt-1 text-[11px] leading-5 text-slate-500">Giải thích khái niệm trong tài liệu</p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-orange-600"><BookOpen className="h-4 w-4" /></div>
                <p className="mt-3 text-xs font-bold text-slate-800">Ôn tập nhanh</p>
                <p className="mt-1 text-[11px] leading-5 text-slate-500">Tạo câu hỏi để nhớ lâu hơn</p>
              </div>
            </div>
          </div>
          <div className="landing-float landing-float-late absolute -left-2 top-[19%] hidden items-center gap-3 rounded-2xl border border-white bg-white/95 px-4 py-3 shadow-lg shadow-blue-100 sm:flex">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-700"><Sparkles className="h-4 w-4" /></div>
            <div><p className="text-xs font-bold">Tóm tắt thông minh</p><p className="mt-1 text-[11px] text-slate-500">Nắm ý chính nhanh chóng</p></div>
          </div>
          <div className="landing-float landing-float-delay absolute -right-1 bottom-[16%] hidden items-center gap-3 rounded-2xl border border-white bg-white/95 px-4 py-3 shadow-lg shadow-sky-100 sm:flex">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700"><Check className="h-4 w-4" /></div>
            <div><p className="text-xs font-bold">Tiến bộ từng bước</p><p className="mt-1 text-[11px] text-slate-500">Theo dõi kết quả học tập</p></div>
          </div>
        </div>
      </section>

      <section id="features" className="relative border-y border-slate-100 bg-white/80 px-5 py-20 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-blue-600">Một nơi cho cả hành trình</p>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">Từ tài liệu đến tự tin</h2>
            <p className="mt-4 text-base leading-7 text-slate-600">AuraStudy giúp bạn biến nội dung cần học thành những bước nhỏ, rõ ràng và dễ bắt đầu.</p>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {features.map(({ icon: Icon, tint, title, description }, index) => (
              <article key={title} className="landing-card rounded-3xl border border-slate-100 bg-white p-7 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-100/70" style={{ animationDelay: `${index * 120}ms` }}>
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${tint}`}><Icon className="h-5 w-5" /></div>
                <h3 className="mt-6 text-lg font-bold">{title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="px-5 py-20 sm:px-8 sm:py-24">
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-blue-600">Bắt đầu thật đơn giản</p>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">Học theo cách của bạn</h2>
            <p className="mt-5 max-w-lg text-base leading-8 text-slate-600">Tải lên tài liệu đang học, chọn cách bạn muốn ôn tập và để AuraStudy hỗ trợ phần còn lại.</p>
            <button onClick={onLogin} className="mt-8 inline-flex items-center gap-2 rounded-full bg-slate-900 px-6 py-3.5 text-sm font-bold text-white transition hover:bg-blue-700">
              Khám phá AuraStudy <ArrowRight className="h-4 w-4" />
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              ['01', 'Tải tài liệu', 'PDF, DOCX và nhiều định dạng phổ biến'],
              ['02', 'Khám phá nội dung', 'Tóm tắt hoặc đặt câu hỏi theo bài học'],
              ['03', 'Ôn tập và tiến bộ', 'Làm quiz và xem lại kết quả của bạn'],
            ].map(([number, title, description]) => (
              <div key={number} className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
                <span className="text-sm font-extrabold tracking-widest text-blue-600">{number}</span>
                <h3 className="mt-7 text-base font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="relative isolate flex min-h-[260px] items-end justify-center overflow-hidden bg-slate-950 px-5 pb-6 text-white sm:min-h-[320px]">
        <img
          src="/assets/galaxy-footer.svg"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 -z-10 h-full w-full object-cover"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-slate-950/65 via-slate-950/10 to-transparent" />
        <div className="text-center text-sm font-medium tracking-wide text-white/85 drop-shadow sm:text-base">
          AuraStudy <span className="mx-2 text-white/50">·</span> Copyright {new Date().getFullYear()}
        </div>
      </footer>
    </main>
  </div>
);
