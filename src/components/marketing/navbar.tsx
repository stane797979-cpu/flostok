"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { COMPANY, MARKETING_NAV } from "@/lib/constants/homepage-data";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full transition-all duration-300",
        scrolled
          ? "border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80"
          : "bg-transparent"
      )}
    >
      <div className="mx-auto flex h-28 max-w-7xl items-center px-6 lg:px-8">
        {/* Logo - 좌측 */}
        <Link href="/" className="flex-shrink-0">
          <Image
            src="/logo.jpg"
            alt={COMPANY.name}
            width={480}
            height={120}
            className={cn(
              "w-auto transition-all duration-300 rounded",
              scrolled ? "h-14" : "h-20"
            )}
            priority
          />
        </Link>

        {/* Desktop Nav - 중앙 */}
        <nav className="hidden flex-1 items-center justify-center gap-12 md:flex">
          {MARKETING_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-xl font-bold text-gray-800 transition-colors hover:text-primary-600"
            >
              {item.name}
            </Link>
          ))}
        </nav>

        {/* CTA 버튼 - 우측 */}
        <div className="hidden flex-shrink-0 md:block">
          <Button size="lg" className="bg-primary-600 px-7 text-base font-bold shadow-lg hover:bg-primary-700" asChild>
            <Link href="/contact">상담/무료진단 신청</Link>
          </Button>
        </div>

        {/* Mobile Menu */}
        <Sheet>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
              <span className="sr-only">메뉴 열기</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72">
            <div className="flex flex-col gap-6 pt-6">
              <Link href="/" className="flex items-center">
                <Image
                  src="/logo.jpg"
                  alt={COMPANY.name}
                  width={400}
                  height={100}
                  className="h-16 w-auto invert"
                />
              </Link>
              <nav className="flex flex-col gap-4">
                {MARKETING_NAV.map((item) => (
                  <SheetClose key={item.href} asChild>
                    <Link
                      href={item.href}
                      className="text-base font-medium text-gray-600 transition-colors hover:text-gray-900"
                    >
                      {item.name}
                    </Link>
                  </SheetClose>
                ))}
              </nav>
              <SheetClose asChild>
                <Button asChild className="w-full">
                  <Link href="/contact">상담/무료진단 신청</Link>
                </Button>
              </SheetClose>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
