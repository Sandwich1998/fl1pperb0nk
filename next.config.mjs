/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "secure.runescape.com",
        pathname: "/m=itemdb_oldschool/**",
      },
    ],
  },
};

export default nextConfig;
