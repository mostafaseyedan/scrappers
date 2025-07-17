"use client";

import { useRouter } from "next/navigation";
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
import { app } from "@/lib/firebaseClient";
import { Geist, Geist_Mono } from "next/font/google";
import styles from "./layout.module.scss";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const router = useRouter();
  const auth = getAuth(app);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  async function logout() {
    await signOut(getAuth(app));
    await fetch("/api/logout");
    router.push("/login");
  }

  return (
    <html lang="en">
      <title>Cendien Recon</title>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div className={styles.layout}>
          {user?.uid && (
            <header className={styles.layout_header}>
              <h1>Recon</h1>

              <nav className={styles.layout_nav}>
                <Link href="/solicitations">Solicitations</Link>
                <Link href="/contacts">Contacts</Link>
                <Link href="/status">Status</Link>
                <Link href="/settings">Settings</Link>
              </nav>
            </header>
          )}
          <main>{children}</main>
          <footer className={styles.layout_footer}>Cendien Recon</footer>
          {user?.uid && (
            <div className={styles.layout_userBox}>
              <DropdownMenu>
                <DropdownMenuTrigger className={styles.layout_userBoxTrigger}>
                  <Avatar className="rounded-lg">
                    <AvatarImage
                      src="https://github.com/evilrabbit.png"
                      alt="@evilrabbit"
                    />
                    <AvatarFallback>ER</AvatarFallback>
                  </Avatar>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className={styles.layout_userBoxContent}
                  align="end"
                >
                  <DropdownMenuItem onSelect={() => router.push("/settings")}>
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={logout}>Logout</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
          <Toaster />
        </div>
      </body>
    </html>
  );
}
