import { Post, type IPost } from "../models/post.model.js";
import type { WeconContext } from "@weconjs/core";

interface CreatePostInput {
  title: string;
  content: string;
  excerpt?: string;
  tags?: string[];
  status?: "draft" | "published";
  authorId: string;
}

interface UpdatePostInput {
  title?: string;
  content?: string;
  excerpt?: string;
  tags?: string[];
  status?: "draft" | "published" | "archived";
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export class PostsService {
  constructor(private ctx: WeconContext) {}

  async findAll(
    page = 1,
    limit = 20,
    status?: string
  ): Promise<{ posts: IPost[]; total: number }> {
    const skip = (page - 1) * limit;
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;

    const [posts, total] = await Promise.all([
      Post.find(filter)
        .populate("author", "name email role")
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      Post.countDocuments(filter),
    ]);

    return { posts, total };
  }

  async findBySlug(slug: string): Promise<IPost | null> {
    return Post.findOne({ slug }).populate("author", "name email role");
  }

  async findById(id: string): Promise<IPost | null> {
    return Post.findById(id).populate("author", "name email role");
  }

  async create(input: CreatePostInput): Promise<IPost> {
    let slug = slugify(input.title);

    // Ensure unique slug
    const existing = await Post.findOne({ slug });
    if (existing) {
      slug = `${slug}-${Date.now()}`;
    }

    const post = await Post.create({
      title: input.title,
      slug,
      content: input.content,
      excerpt: input.excerpt || input.content.slice(0, 200),
      author: input.authorId,
      tags: input.tags || [],
      status: input.status || "draft",
    });

    return post.populate("author", "name email role");
  }

  async update(id: string, input: UpdatePostInput): Promise<IPost | null> {
    const update: Record<string, unknown> = { ...input };

    if (input.title) {
      update.slug = slugify(input.title);
    }

    return Post.findByIdAndUpdate(id, { $set: update }, { new: true }).populate(
      "author",
      "name email role"
    );
  }

  async delete(id: string): Promise<boolean> {
    const result = await Post.findByIdAndDelete(id);
    return !!result;
  }

  async findByTag(
    tag: string,
    page = 1,
    limit = 20
  ): Promise<{ posts: IPost[]; total: number }> {
    const skip = (page - 1) * limit;
    const filter = { tags: tag, status: "published" };

    const [posts, total] = await Promise.all([
      Post.find(filter)
        .populate("author", "name email role")
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      Post.countDocuments(filter),
    ]);

    return { posts, total };
  }
}
