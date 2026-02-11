import Link from "next/link";
import Image from "next/image";
import { COMPANY, FOOTER_NAV } from "@/lib/constants/homepage-data";

export function FooterMarketing() {
  return (
    <footer className="bg-gray-900" aria-labelledby="footer-heading">
      <h2 id="footer-heading" className="sr-only">
        Footer
      </h2>
      <div className="mx-auto max-w-7xl px-4 pb-8 pt-12 sm:px-6 sm:pt-24 lg:px-8 lg:pt-32">
        <div className="xl:grid xl:grid-cols-3 xl:gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <Image
              src="/logo.jpg"
              alt={COMPANY.name}
              width={480}
              height={120}
              className="h-12 w-auto sm:h-16 lg:h-20"
            />
            <p className="text-sm italic text-gray-400">{COMPANY.slogan}</p>
            <p className="text-sm leading-6 text-gray-300">
              {COMPANY.description}
            </p>
          </div>

          {/* Links */}
          <div className="mt-10 grid grid-cols-2 gap-8 sm:grid-cols-3 xl:col-span-2 xl:mt-0">
            <div>
              <h3 className="text-sm font-semibold leading-6 text-white">
                서비스
              </h3>
              <ul className="mt-6 space-y-4">
                {FOOTER_NAV.services.map((item) => (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      className="text-sm leading-6 text-gray-300 hover:text-white"
                    >
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold leading-6 text-white">
                회사
              </h3>
              <ul className="mt-6 space-y-4">
                {FOOTER_NAV.company.map((item) => (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      className="text-sm leading-6 text-gray-300 hover:text-white"
                    >
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold leading-6 text-white">
                법적 고지
              </h3>
              <ul className="mt-6 space-y-4">
                {FOOTER_NAV.legal.map((item) => (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      className="text-sm leading-6 text-gray-300 hover:text-white"
                    >
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-16 border-t border-white/10 pt-8 sm:mt-20 lg:mt-24">
          <p className="text-xs leading-5 text-gray-400">
            &copy; 2026 {COMPANY.name}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
