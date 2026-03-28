"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowUp } from "lucide-react";
import { useSiteCta } from "@/hooks/useSiteCta";

export default function FloatingCta() {
 const { buttonUrl, buttonText, floatingEnabled } = useSiteCta();
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
         className="hidden md:flex w-12 h-12 rounded-full bg-gray-800/80 text-white items-center justify-center shadow-lg hover:bg-gray-800 transition-all backdrop-blur-sm"
         aria-label="맨 위로"
       >
         <ArrowUp size={20} />
       </button>
     )}

     {floatingEnabled && (
       <Link
         href={buttonUrl}
         target="_blank"
         rel="noopener noreferrer"
         className="md:hidden flex items-center gap-2 px-6 py-3.5 rounded-full bg-primary-600 text-white text-sm font-semibold shadow-2xl shadow-primary-600/30 hover:bg-primary-700 transition-all"
       >
         {buttonText}
       </Link>
     )}
   </div>
 );
}
