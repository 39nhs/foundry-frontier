import type { NextConfig } from "next";

const isGitHubPages = process.env.GITHUB_PAGES === "true";
const githubPagesBasePath = "/foundry-frontier";

const nextConfig: NextConfig = {
  ...(isGitHubPages
    ? {
        output: "export",
        basePath: githubPagesBasePath,
        assetPrefix: githubPagesBasePath,
        trailingSlash: true,
      }
    : {}),
};

export default nextConfig;
