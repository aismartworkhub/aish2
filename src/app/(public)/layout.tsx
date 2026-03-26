import Header from "@/components/public/Header";
import Footer from "@/components/public/Footer";
import FloatingCta from "@/components/public/FloatingCta";
import QuickBannerDisplay from "@/components/public/QuickBannerDisplay";
import ProfileCompletionBanner from "@/components/public/ProfileCompletionBanner";

export default function PublicLayout({
 children,
}: {
 children: React.ReactNode;
}) {
 return (
   <>
     <Header />
     <div className="pt-20">
       <QuickBannerDisplay />
       <ProfileCompletionBanner />
       <main className="min-h-screen">{children}</main>
     </div>
     <Footer />
     <FloatingCta />
   </>
 );
}
