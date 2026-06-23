export type Article = {
  id: number;
  title: string;
  image_url: string | null;
  description: string | null;
  body_html: string | null;
  published_at: string | null;
  original_url: string | null;
};

export type Source = {
  id: number;
  name: string;
  kind: "rss" | "email";
  identifier: string;
  active: boolean;
  created_at: string;
};
