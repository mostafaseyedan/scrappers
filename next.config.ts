import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      new URL("http://localhost:5002/**", "https://reconrfp.cendien.com/**"),
    ],
  },
  async rewrites() {
    // Proxy Firebase Auth helper endpoints so redirect flows work on custom domains
    // See: https://firebase.google.com/docs/auth/web/redirect-best-practices#proxy-auth-requests
    return [
      {
        source: "/__/auth/:path*",
        destination: "https://rfpscraper-dc3d8.firebaseapp.com/__/auth/:path*",
      },
      {
        source: "/__/firebase/:path*",
        destination:
          "https://rfpscraper-dc3d8.firebaseapp.com/__/firebase/:path*",
      },
    ];
  },
};

export default nextConfig;
