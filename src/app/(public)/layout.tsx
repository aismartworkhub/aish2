import Header from "@/components/public/Header";
import Footer from "@/components/public/Footer";
import FloatingCta from "@/components/public/FloatingCta";
import QuickBannerDisplay from "@/components/public/QuickBannerDisplay";

export default function PublicLayout({
 children,
}: {
 children: React.ReactNode;
}) {
 return (
   <>
     <Header />
     <div className="pt-16 lg:pt-[72px]">
       <QuickBannerDisplay />
       <main className="min-h-screen">{children}</main>
     </div>
     <Footer />
     <FloatingCta />
   </>
 );
}
