import { Octokit } from "@octokit/rest";
import { throttling } from "@octokit/plugin-throttling";

const TOKEN = process.env.GH_TOKEN;

if (!TOKEN) {
  console.error("GH_TOKEN is missing");
  process.exit(1);
}

const ThrottledOctokit = Octokit.plugin(throttling);

export const octokit = new ThrottledOctokit({
  auth: TOKEN,
  throttle: {
    onRateLimit: (retryAfter, options, _octokit, retryCount) => {
      console.warn(
        `[THROTTLE] Rate limit hit on ${options.method} ${options.url}. ` +
        `Retry after ${retryAfter}s (attempt ${retryCount + 1}/3)`
      );
      return retryCount < 3;
    },
    onSecondaryRateLimit: (retryAfter, options, _octokit, retryCount) => {
      console.warn(
        `[THROTTLE] Secondary rate limit on ${options.method} ${options.url}. ` +
        `Retry after ${retryAfter}s (attempt ${retryCount + 1}/2)`
      );
      return retryCount < 2;
    },
  },
});
