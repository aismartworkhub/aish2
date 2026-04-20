"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowUp } from "lucide-react";
import { isExternalHref } from "@/lib/utils";
import { useSiteCta } from "@/hooks/useSiteCta";

export default function FloatingCta() {
 const { buttonUrl, buttonText, floatingEnabled } = useSiteCta();
 const ctaOpensNewTab = isExternalHref(buttonUrl);
 const [isVisible, setIsVisible] = useState(false);

 useEffect(() => {
   const handleScroll = () => setIsVisible(window.scrollY > 300);
   window.addEventListener("scroll", handleScroll);
   return () => window.removeEventListener("scroll", handleScroll);
 }, []);

 const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

 return (
   <div className="fixed bottom-6 right-6 z-40 flex flex-col gap-3">
     {isVisible && (
       <button
         onClick={scrollToTop}
         className="hidden md:flex w-12 h-12 rounded-sm bg-brand-dark/80 text-white items-center justify-center shadow-lg hover:bg-brand-dark transition-all backdrop-blur-sm"
         aria-label="맨 위로"
       >
         <ArrowUp size={20} />
       </button>
     )}

     {floatingEnabled && (
       <Link
         href={buttonUrl}
         target={ctaOpensNewTab ? "_blank" : undefined}
         rel={ctaOpensNewTab ? "noopener noreferrer" : undefined}
         className="md:hidden flex items-center gap-2 px-6 py-3.5 rounded-sm bg-brand-blue text-white text-sm font-semibold uppercase tracking-widest shadow-2xl shadow-brand-blue/30 hover:bg-brand-dark transition-all"
       >
         {buttonText}
       </Link>
     )}
   </div>
 );
}
