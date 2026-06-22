"use client";

import React, { useState, useEffect } from "react";
import { Button, Card } from "@selecto/ui";
import { formatDate } from "@selecto/core";
import { translations } from "./translations";
import { 
  Code, 
  Layers, 
  Terminal, 
  CheckCircle, 
  ArrowRight, 
  Sparkles,
  Zap,
  Lock,
  Eye
} from "lucide-react";

const Chrome = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="4" />
    <line x1="21.17" y1="8" x2="12" y2="8" />
    <line x1="3.95" y1="6.06" x2="8.54" y2="14" />
    <line x1="10.88" y1="21.94" x2="15.46" y2="14" />
  </svg>
);

const Github = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
  </svg>
);

export default function Home() {
  const currentDateString = formatDate(new Date());
  const [activeTab, setActiveTab] = useState<"extension" | "sdk">("extension");
  const [locale, setLocale] = useState<"en" | "pt-br" | "es">("en");
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);

  useEffect(() => {
    const savedLocale = localStorage.getItem("selecto_website_locale");
    const targetLocale = (savedLocale === "en" || savedLocale === "pt-br" || savedLocale === "es")
      ? savedLocale
      : (() => {
          const browserLang = navigator.language.toLowerCase();
          if (browserLang.startsWith("pt")) return "pt-br";
          if (browserLang.startsWith("es")) return "es";
          return "en";
        })();

    if (targetLocale !== "en") {
      setTimeout(() => {
        setLocale(targetLocale);
      }, 0);
    }
  }, []);

  const t = (key: keyof typeof translations["en"]) => {
    return translations[locale][key] || translations["en"][key];
  };

  const changeLocale = (newLocale: "en" | "pt-br" | "es") => {
    setLocale(newLocale);
    localStorage.setItem("selecto_website_locale", newLocale);
    setIsLangMenuOpen(false);
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen text-slate-100 selection:bg-indigo-500/30">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-lg border-b border-slate-800/80 bg-slate-950/70">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-linear-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg tracking-wide bg-linear-to-r from-white to-slate-400 bg-clip-text text-transparent">
              Selecto
            </span>
            <span className="text-[10px] uppercase tracking-wider font-semibold bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-500/20">
              Open Source
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm text-slate-400">
            <a href="#features" className="hover:text-indigo-400 transition-colors">{t("navFeatures")}</a>
            <a href="#architecture" className="hover:text-indigo-400 transition-colors">{t("navArchitecture")}</a>
            <a href="#pricing" className="hover:text-indigo-400 transition-colors">{t("navPricing")}</a>
            <a href="https://github.com" target="_blank" className="hover:text-indigo-400 transition-colors flex items-center gap-1.5">
              <Github className="w-4 h-4" /> GitHub
            </a>
          </nav>

          <div className="flex items-center gap-3">
            {/* Language Switcher */}
            <div className="relative">
              <button
                onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900/40 text-slate-300 text-xs font-semibold hover:bg-slate-800/40 hover:text-white transition-all cursor-pointer"
              >
                <span>{locale === "en" ? "🇺🇸 EN" : locale === "pt-br" ? "🇧🇷 PT" : "🇪🇸 ES"}</span>
                <span className="text-[10px] opacity-60">▼</span>
              </button>
              {isLangMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsLangMenuOpen(false)} />
                  <div className="absolute right-0 mt-2 w-28 rounded-lg border border-slate-800 bg-slate-950/90 shadow-xl backdrop-blur-lg z-20 py-1 overflow-hidden">
                    <button
                      onClick={() => changeLocale("en")}
                      className={`flex w-full items-center px-3 py-2 text-xs hover:bg-slate-900 transition-colors text-left cursor-pointer ${
                        locale === "en" ? "text-indigo-400 font-bold" : "text-slate-300"
                      }`}
                    >
                      🇺🇸 English
                    </button>
                    <button
                      onClick={() => changeLocale("pt-br")}
                      className={`flex w-full items-center px-3 py-2 text-xs hover:bg-slate-900 transition-colors text-left cursor-pointer ${
                        locale === "pt-br" ? "text-indigo-400 font-bold" : "text-slate-300"
                      }`}
                    >
                      🇧🇷 Português
                    </button>
                    <button
                      onClick={() => changeLocale("es")}
                      className={`flex w-full items-center px-3 py-2 text-xs hover:bg-slate-900 transition-colors text-left cursor-pointer ${
                        locale === "es" ? "text-indigo-400 font-bold" : "text-slate-300"
                      }`}
                    >
                      🇪🇸 Español
                    </button>
                  </div>
                </>
              )}
            </div>

            <a href="http://localhost:3000" target="_blank">
              <Button id="nav-btn-dashboard" variant="outline" size="sm">
                {t("navDashboard")}
              </Button>
            </a>
            <Button id="nav-btn-get-started" variant="primary" size="sm">
              {t("navGetStarted")}
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-24 pb-20 md:pt-32 md:pb-28 overflow-hidden">
        {/* Decorative Blur Backgrounds */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-125 h-125 bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-1/3 left-1/3 w-75 h-75 bg-violet-600/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="max-w-5xl mx-auto px-6 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 border border-slate-800 text-xs text-indigo-400 mb-8 hover:border-slate-700/80 transition-colors">
            <Zap className="w-3.5 h-3.5 fill-indigo-400/20" />
            <span>{t("heroUpdated")}{currentDateString}</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight mb-8">
            {t("heroTitlePart1")}
            <span className="block mt-2 bg-linear-to-r from-indigo-400 via-violet-400 to-pink-400 bg-clip-text text-transparent">
              {t("heroTitlePart2")}
            </span>
          </h1>

          <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            {t("heroDescription")}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button id="hero-btn-primary" variant="primary" size="lg" className="w-full sm:w-auto gap-2">
              {t("heroStartFree")} <ArrowRight className="w-4 h-4" />
            </Button>
            <a href="https://github.com" target="_blank" className="w-full sm:w-auto">
              <Button id="hero-btn-github" variant="outline" size="lg" className="w-full sm:w-auto gap-2">
                <Github className="w-5 h-5" /> {t("heroGitHubStar")}
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Interactive Feature Preview Tabs */}
      <section id="features" className="py-20 border-t border-slate-900 bg-slate-950/40 relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl font-bold mb-4 bg-linear-to-r from-white to-slate-300 bg-clip-text text-transparent">
              {t("featuresTitle")}
            </h2>
            <p className="text-slate-400">
              {t("featuresSub")}
            </p>
          </div>

          <div className="flex justify-center gap-2 mb-12">
            <button 
              id="tab-btn-extension"
              onClick={() => setActiveTab("extension")}
              className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer ${
                activeTab === "extension" 
                  ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30" 
                  : "bg-slate-900/40 text-slate-400 border border-transparent hover:text-slate-200"
              }`}
            >
              {t("tabExtension")}
            </button>
            <button 
              id="tab-btn-sdk"
              onClick={() => setActiveTab("sdk")}
              className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer ${
                activeTab === "sdk" 
                  ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30" 
                  : "bg-slate-900/40 text-slate-400 border border-transparent hover:text-slate-200"
              }`}
            >
              {t("tabSdk")}
            </button>
          </div>

          <div className="grid md:grid-cols-12 gap-8 items-center">
            {activeTab === "extension" ? (
              <>
                <div className="md:col-span-5 space-y-6">
                  <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg w-10 h-10 flex items-center justify-center">
                    <Chrome className="w-5 h-5" />
                  </div>
                  <h3 className="text-2xl font-bold">{t("extTitle")}</h3>
                  <p className="text-slate-400 leading-relaxed">
                    {t("extDesc")}
                  </p>
                  <ul className="space-y-3">
                    <li className="flex items-center gap-2.5 text-sm text-slate-300">
                      <CheckCircle className="w-4.5 h-4.5 text-indigo-400" />
                      <span>{t("extBullet1")}</span>
                    </li>
                    <li className="flex items-center gap-2.5 text-sm text-slate-300">
                      <CheckCircle className="w-4.5 h-4.5 text-indigo-400" />
                      <span>{t("extBullet2")}</span>
                    </li>
                    <li className="flex items-center gap-2.5 text-sm text-slate-300">
                      <CheckCircle className="w-4.5 h-4.5 text-indigo-400" />
                      <span>{t("extBullet3")}</span>
                    </li>
                  </ul>
                </div>
                <div className="md:col-span-7">
                  <Card hoverEffect className="relative overflow-hidden group">
                    <div className="absolute inset-0 bg-linear-to-tr from-indigo-500/5 to-violet-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="border border-slate-800 rounded-lg bg-slate-950 p-4 space-y-4">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-900">
                        <div className="flex gap-1.5">
                          <span className="w-3 h-3 rounded-full bg-red-500/80" />
                          <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
                          <span className="w-3 h-3 rounded-full bg-green-500/80" />
                        </div>
                        <span className="text-xs text-slate-500">{t("extSandboxLabel")}</span>
                      </div>
                      <div className="h-64 flex flex-col justify-center items-center text-center space-y-4">
                        <div className="w-16 h-16 rounded-full bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 text-indigo-400">
                          <Eye className="w-8 h-8" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{t("extSandboxTitle")}</p>
                          <p className="text-xs text-slate-500 mt-1 max-w-sm">{t("extSandboxDesc")}</p>
                        </div>
                        <div className="px-4 py-2 bg-indigo-500/20 text-indigo-300 text-xs rounded border border-indigo-500/30">
                          {t("extLockedSelector")}
                        </div>
                      </div>
                    </div>
                  </Card>
                </div>
              </>
            ) : (
              <>
                <div className="md:col-span-5 space-y-6">
                  <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg w-10 h-10 flex items-center justify-center">
                    <Code className="w-5 h-5" />
                  </div>
                  <h3 className="text-2xl font-bold">{t("sdkTitle")}</h3>
                  <p className="text-slate-400 leading-relaxed">
                    {t("sdkDesc")}
                  </p>
                  <ul className="space-y-3">
                    <li className="flex items-center gap-2.5 text-sm text-slate-300">
                      <CheckCircle className="w-4.5 h-4.5 text-indigo-400" />
                      <span>{t("sdkBullet1")}</span>
                    </li>
                    <li className="flex items-center gap-2.5 text-sm text-slate-300">
                      <CheckCircle className="w-4.5 h-4.5 text-indigo-400" />
                      <span>{t("sdkBullet2")}</span>
                    </li>
                    <li className="flex items-center gap-2.5 text-sm text-slate-300">
                      <CheckCircle className="w-4.5 h-4.5 text-indigo-400" />
                      <span>{t("sdkBullet3")}</span>
                    </li>
                  </ul>
                </div>
                <div className="md:col-span-7">
                  <Card hoverEffect className="relative overflow-hidden group">
                    <div className="absolute inset-0 bg-linear-to-tr from-indigo-500/5 to-violet-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="border border-slate-800 bg-slate-950 rounded-lg p-4 font-mono text-xs text-indigo-300 space-y-2">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-900 text-slate-500">
                        <div className="flex gap-1.5">
                          <span className="w-3 h-3 rounded-full bg-red-500/80" />
                          <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
                          <span className="w-3 h-3 rounded-full bg-green-500/80" />
                        </div>
                        <span>{t("sdkInstallLabel")}</span>
                      </div>
                      <p className="text-slate-500">{t("sdkInstallComment1")}</p>
                      <p><span className="text-slate-400">npm install</span> selecto-onboarding-sdk</p>
                      <p className="mt-4 text-slate-500">{t("sdkInstallComment2")}</p>
                      <p className="text-violet-400">import <span className="text-indigo-400">{"{ OnboardingRunner }"}</span> from <span className="text-pink-400">{"\"selecto-onboarding-sdk\""}</span>;</p>
                      <p className="text-slate-400">const runner = new OnboardingRunner({"{"}</p>
                      <p className="pl-4">endpoint: <span className="text-pink-400">{"\"https://selecto.mycompany.com/api\""}</span>,</p>
                      <p className="pl-4">userId: <span className="text-pink-400">{"\"usr_91283\""}</span></p>
                      <p className="text-slate-400">{"});"}</p>
                      <p className="text-indigo-400">runner.startTour({"\"tour_dashboard_v1\""});</p>
                    </div>
                  </Card>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Tech Stack & Architecture Section */}
      <section id="architecture" className="py-20 border-t border-slate-950 bg-slate-950/20 relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl font-bold mb-4 bg-linear-to-r from-white to-slate-300 bg-clip-text text-transparent">
              {t("archTitle")}
            </h2>
            <p className="text-slate-400">
              {t("archSub")}
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card hoverEffect className="space-y-4">
              <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                <Terminal className="w-5 h-5" />
              </div>
              <h4 className="text-lg font-semibold">{t("archCard1Title")}</h4>
              <p className="text-slate-400 text-sm leading-relaxed">
                {t("archCard1Desc")}
              </p>
            </Card>

            <Card hoverEffect className="space-y-4">
              <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                <Layers className="w-5 h-5" />
              </div>
              <h4 className="text-lg font-semibold">{t("archCard2Title")}</h4>
              <p className="text-slate-400 text-sm leading-relaxed">
                {t("archCard2Desc")}
              </p>
            </Card>

            <Card hoverEffect className="space-y-4">
              <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                <Lock className="w-5 h-5" />
              </div>
              <h4 className="text-lg font-semibold">{t("archCard3Title")}</h4>
              <p className="text-slate-400 text-sm leading-relaxed">
                {t("archCard3Desc")}
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 border-t border-slate-900 bg-slate-950/40 relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl font-bold mb-4 bg-linear-to-r from-white to-slate-300 bg-clip-text text-transparent">
              {t("pricingTitle")}
            </h2>
            <p className="text-slate-400">
              {t("pricingSub")}
            </p>
          </div>

          <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-8 items-stretch">
            <Card className="flex flex-col justify-between border border-slate-800 bg-slate-950/50 p-8 space-y-6">
              <div>
                <h3 className="text-xl font-bold">{t("pricingCard1Title")}</h3>
                <p className="text-slate-400 text-xs mt-1">{t("pricingCard1Sub")}</p>
                <div className="mt-6 flex items-baseline gap-1 text-white">
                  <span className="text-4xl font-extrabold">{t("pricingCard1Price")}</span>
                  <span className="text-slate-500 text-sm">{t("pricingCard1Period")}</span>
                </div>
                <ul className="mt-8 space-y-4">
                  <li className="flex items-center gap-2.5 text-sm text-slate-300">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <span>{t("pricingCard1Bullet1")}</span>
                  </li>
                  <li className="flex items-center gap-2.5 text-sm text-slate-300">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <span>{t("pricingCard1Bullet2")}</span>
                  </li>
                  <li className="flex items-center gap-2.5 text-sm text-slate-300">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <span>{t("pricingCard1Bullet3")}</span>
                  </li>
                </ul>
              </div>
              <a href="https://github.com" target="_blank" className="w-full">
                <Button id="pricing-btn-deploy" variant="outline" className="w-full justify-center">
                  {t("pricingCard1Button")}
                </Button>
              </a>
            </Card>

            <Card className="flex flex-col justify-between border-2 border-indigo-600 bg-slate-900/60 p-8 space-y-6 relative overflow-hidden">
              <div className="absolute top-4 right-4 bg-indigo-500/10 text-indigo-400 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border border-indigo-500/20">
                Popular
              </div>
              <div>
                <h3 className="text-xl font-bold">{t("pricingCard2Title")}</h3>
                <p className="text-slate-400 text-xs mt-1">{t("pricingCard2Sub")}</p>
                <div className="mt-6 flex items-baseline gap-1 text-white">
                  <span className="text-4xl font-extrabold">{t("pricingCard2Price")}</span>
                  <span className="text-slate-500 text-sm">{t("pricingCard2Period")}</span>
                </div>
                <ul className="mt-8 space-y-4">
                  <li className="flex items-center gap-2.5 text-sm text-slate-300">
                    <CheckCircle className="w-4 h-4 text-indigo-400" />
                    <span>{t("pricingCard2Bullet1")}</span>
                  </li>
                  <li className="flex items-center gap-2.5 text-sm text-slate-300">
                    <CheckCircle className="w-4 h-4 text-indigo-400" />
                    <span>{t("pricingCard2Bullet2")}</span>
                  </li>
                  <li className="flex items-center gap-2.5 text-sm text-slate-300">
                    <CheckCircle className="w-4 h-4 text-indigo-400" />
                    <span>{t("pricingCard2Bullet3")}</span>
                  </li>
                </ul>
              </div>
              <Button id="pricing-btn-cloud" variant="primary" className="w-full justify-center">
                {t("pricingCard2Button")}
              </Button>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-linear-to-t from-slate-950 to-indigo-950/20 text-center relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-6 relative z-10 space-y-6">
          <h2 className="text-3xl font-extrabold">{t("ctaTitle")}</h2>
          <p className="text-slate-400 max-w-xl mx-auto">
            {t("ctaSub")}
          </p>
          <div className="flex justify-center gap-4">
            <Button id="cta-btn-get-started" variant="primary" size="lg">
              {t("ctaButton")}
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-900 bg-slate-950 py-12 text-slate-500 text-xs">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <p className="font-semibold text-slate-400 text-sm">Selecto</p>
            <p className="mt-1">{t("footerSubtitle")}</p>
          </div>
          <div className="flex items-center gap-6">
            <a href="#features" className="hover:underline">{t("navFeatures")}</a>
            <a href="#architecture" className="hover:underline">{t("navArchitecture")}</a>
            <a href="#pricing" className="hover:underline">{t("navPricing")}</a>
            <a href="/privacy" className="hover:underline">{t("footerPrivacy")}</a>
          </div>
          <div>
            <p>© {new Date().getFullYear()} {t("footerCopyright")}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
