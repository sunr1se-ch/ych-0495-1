import { Handlers } from "$fresh/server.ts";

export const handler: Handlers = {
  GET: () => {
    return Response.redirect("https://dash.speedscope.cn/dashboard", 307);
  },
};

export default function Home() {
  return null;
}
