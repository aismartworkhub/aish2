import Header from "@/components/public/Header";
import Footer from "@/components/public/Footer";
import ActionCluster from "@/components/public/ActionCluster";
import BottomTabNav from "@/components/public/BottomTabNav";
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
       {/* 모바일: BottomTabNav 높이만큼 하단 여백. lg+에서는 패딩 0. */}
       <main className="min-h-screen pb-20 lg:pb-0">{children}</main>
     </div>
     <Footer />
     <ActionCluster />
     <BottomTabNav />
   </>
 );
}
