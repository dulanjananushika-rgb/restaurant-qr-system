import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <section className="mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center px-6 text-center">
        <p className="mb-4 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-neutral-300">
          QR Restaurant Ordering System
        </p>

        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight md:text-6xl">
          Professional restaurant ordering system is starting.
        </h1>

        <p className="mt-6 max-w-2xl text-base leading-7 text-neutral-400 md:text-lg">
          Dine-in QR ordering, take away, kitchen, waiter, cashier, admin,
          staff management, inventory, and reports will be built step by step.
        </p>

        <Link
          href="/login"
          className="mt-8 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-neutral-200"
        >
          Open Admin Dashboard
        </Link>
      </section>
    </main>
  );
}