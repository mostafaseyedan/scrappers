"use client";

import { useRouter, usePathname } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { Geist, Geist_Mono } from "next/font/google";
import styles from "./layout.module.scss";
import { useEffect, useRef, useState } from "react";
import { UserContext } from "./userContext";
import { Toaster } from "@/components/ui/sonner";
import { AiChat } from "au/components/AiChat";
import Image from "next/image";
import { chat as chatModel } from "@/app/models2";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { getFirebaseAuth } from "./auth/firebase";

import "./globals.css";

const auth = getFirebaseAuth();

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const publicPaths = ["/login", "/register", "/reset-password"];

function getLocal(key: string, defaultValue?: any) {
  if (typeof window !== "undefined") {
    const value = localStorage.getItem(key);
    if (value) {
      try {
        return JSON.parse(value);
      } catch (e) {
        console.error("Failed to parse localStorage item", key, e);
      }
    }
  }
  return defaultValue;
}

function setLocal(key: string, value: any) {
  if (typeof window !== "undefined") {
    localStorage.setItem(key, JSON.stringify(value));
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [showChatPanel, setShowChatPanel] = useState(false);
  const [panelSizes, setPanelSizes] = useState([100, 100]);
  const isPublic = publicPaths.some((p) => pathname?.startsWith(p));
  const loadedRef = useRef(false);
  const usersCache = useRef<Record<string, any>>({});

  // Update local storage when saved state changes
  useEffect(() => {
    if (loadedRef.current) {
      setLocal("layout.showChatPanel", showChatPanel);
    }
  }, [showChatPanel]);

  // Save panel sizes
  useEffect(() => {
    if (
      !isPublic &&
      loadedRef.current &&
      showChatPanel &&
      panelSizes.length === 2
    ) {
      setLocal("layout.panelSizes", panelSizes);
    }
  }, [panelSizes, showChatPanel]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (authChecked && !user && !isPublic) {
      logout();
    }
  }, [authChecked, user, isPublic, router]);

  // Subscribe to Firebase auth once on mount
  useEffect(() => {
    const localShowChatPanel = getLocal("layout.showChatPanel");
    if (localShowChatPanel !== undefined) setShowChatPanel(localShowChatPanel);

    const localPanelSizes = getLocal("layout.panelSizes");
    if (
      localPanelSizes &&
      Array.isArray(localPanelSizes) &&
      localPanelSizes.length === 2
    ) {
      setPanelSizes(localPanelSizes);
    }

    loadedRef.current = true;

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setAuthChecked(true);
    });

    return () => unsubscribe();
  }, []);

  async function getUser(uid: string) {
    if (usersCache.current[uid] !== undefined) {
      return usersCache.current[uid];
    }

    const response = await fetch(`/api/users/${uid}`);
    const json = await response.json();

    if (json.error) {
      usersCache.current[uid] = null;
      // Silently handle missing users - they may have been deleted or are invalid IDs
      // The calling code will fall back to showing the UID instead
      return;
    }

    usersCache.current[uid] = json;
    return json;
  }

  function logout() {
    setUser(null); // Optimistic update
    router.push("/login"); // Immediate redirect

    // Perform logout operations in the background
    signOut(auth).catch(console.error);
    fetch("/api/logout").catch(console.error);
  }

  return (
    <UserContext.Provider value={{ user, getUser }}>
      <html lang="en" suppressHydrationWarning>
        <title>Cendien RFP</title>
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased ${
            showChatPanel ? styles.showChatPanel : ""
          }`}
          suppressHydrationWarning
        >
          <ResizablePanelGroup
            id="main-layout-panel-group"
            className={styles.layoutWrapper}
            direction="horizontal"
            onLayout={(sizes: number[]) => {
              if (showChatPanel && sizes.length === 2) {
                setPanelSizes(sizes);
              }
            }}
          >
            <ResizablePanel
              id="main-content-panel"
              className={styles.layout}
              defaultSize={panelSizes[0]}
            >
              {!isPublic && (
                <header className={styles.layout_header}>
                  <div className={styles.layout_header_content}>
                    <div className={styles.layout_header_left}>
                      <Image
                        src="/cendien_corp_logo.jpg"
                        alt="logo"
                        className={styles.cendienLogo}
                        width={30}
                        height={30}
                      />
                      <div className={styles.layout_header_title}>
                        <h2>Cendien RFP Aggregation Hub</h2>
                      </div>
                    </div>

                    <div className={styles.layout_header_right}>
                      <nav className={styles.layout_header_quickLinks}>
                        <a
                          href="https://sales.cendien.com/"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Analyze
                        </a>
                        <a
                          href="https://cendien.monday.com/boards/4374039553"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Monday
                        </a>
                        <a
                          href="https://rag.cendien.com/"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          RAG
                        </a>
                        <a
                          href="https://resume.cendien.com/"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Resume
                        </a>
                      </nav>

                      {user?.uid && (
                        <button
                          onClick={logout}
                          className="inline-flex items-center justify-center rounded-lg border border-gray-300 p-2 text-gray-600 transition-colors hover:border-gray-400 hover:bg-gray-50 hover:text-gray-900"
                          title="Logout"
                        >
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                            />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                </header>
              )}
              <main className={styles.layout_main}>
                {isPublic || authChecked ? children : null}
              </main>
              <footer className={styles.layout_footer}>Cendien RFP</footer>
            </ResizablePanel>
            {!isPublic && showChatPanel && (
              <>
                <ResizableHandle />
                <ResizablePanel
                  id="chat-panel"
                  className={styles.aiChat}
                  defaultSize={panelSizes[1]}
                >
                  <AiChat chatKey="aiChat" model={chatModel} />
                </ResizablePanel>
              </>
            )}
          </ResizablePanelGroup>
          <Toaster />
        </body>
      </html>
    </UserContext.Provider>
  );
}
