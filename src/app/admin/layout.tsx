import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminTopbar from "@/components/admin/AdminTopbar";

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <main className="min-h-screen bg-[#0B0F14] text-white">
      <div className="flex min-h-screen">
        <AdminSidebar />

        <section className="flex min-h-screen flex-1 flex-col">
          <AdminTopbar />
          <div className="flex-1 px-5 py-6 lg:px-8">{children}</div>
        </section>
      </div>
    </main>
  );
}