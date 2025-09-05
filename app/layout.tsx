"use client";

import { useRouter, usePathname } from "next/navigation";
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
import { useEffect, useRef, useState } from "react";
import { UserContext } from "./userContext";
import { Toaster } from "@/components/ui/sonner";
import Image from "next/image";
import { cn } from "@/lib/utils";

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
  const pathname = usePathname();
  const auth = getAuth(app);
  const [user, setUser] = useState<any>(null);
  const [, setAuthChecked] = useState(false);
  const usersCache = useRef<Record<string, any>>({});

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setAuthChecked(true);
    });
    return () => unsubscribe();
  }, []);

  async function getUser(uid: string) {
    if (usersCache.current[uid]) {
      return usersCache.current[uid];
    }

    const response = await fetch(`/api/users/${uid}`);
    const json = await response.json();

    if (json.error) {
      console.error("Failed to get user", json.error);
      return;
    }

    usersCache.current[uid] = json;
    return json;
  }

  async function logout() {
    await signOut(getAuth(app));
    await fetch("/api/logout");
    router.push("/login");
  }

  function isActive(path: string) {
    return pathname === path;
  }

  return (
    <UserContext.Provider value={{ user, getUser }}>
      <html lang="en">
        <title>Cendien Recon</title>
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        >
          <div className={styles.layout}>
            {user?.uid && !pathname.startsWith("/login") && (
              <header className={styles.layout_header}>
                <div className={styles.layout_header_1stRow}>
                  <Image
                    src="/cendien_corp_logo.jpg"
                    alt="logo"
                    className={styles.cendienLogo}
                    width={30}
                    height={30}
                  />
                  <a href="https://rag.cendien.com/">RAG Chatbot</a>
                  <a href="https://reconrfp.cendien.com/">Recon</a>
                  <a href="https://cendien.monday.com/boards/4374039553">
                    Monday
                  </a>
                </div>
                <div className={styles.layout_header_2ndRow}>
                  <h1>Recon</h1>

                  <nav className={styles.layout_nav}>
                    <Link
                      href="/solicitations"
                      data-state={
                        isActive("/solicitations") ? "active" : undefined
                      }
                    >
                      Solicitations
                    </Link>
                    <Link
                      className="hidden"
                      href="/contacts"
                      data-state={isActive("/contacts") ? "active" : undefined}
                    >
                      Contacts
                    </Link>
                    <Link
                      href="/logs"
                      data-state={isActive("/logs") ? "active" : undefined}
                    >
                      Logs
                    </Link>
                    <Link
                      className="hidden"
                      href="/stats"
                      data-state={isActive("/stats") ? "active" : undefined}
                    >
                      Stats
                    </Link>
                    <Link
                      className="hidden"
                      href="/settings"
                      data-state={isActive("/settings") ? "active" : undefined}
                    >
                      Settings
                    </Link>
                  </nav>
                </div>
              </header>
            )}
            <main>{children}</main>
            <footer className={styles.layout_footer}>Cendien Recon</footer>
            {user?.uid && (
              <div className={styles.layout_userBox}>
                <DropdownMenu>
                  <DropdownMenuTrigger className={styles.layout_userBoxTrigger}>
                    <Avatar className={styles.layout_userBox_avatar}>
                      <AvatarImage />
                      <AvatarFallback></AvatarFallback>
                    </Avatar>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    className={styles.layout_userBoxContent}
                    align="end"
                  >
                    <DropdownMenuItem onSelect={() => router.push("/settings")}>
                      Settings
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={logout}>
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
            <Toaster />
          </div>
        </body>
      </html>
    </UserContext.Provider>
  );
}
