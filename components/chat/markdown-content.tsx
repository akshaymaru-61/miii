"use client";

import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

type MarkdownContentProps = {
  children: string;
  className?: string;
};

export function MarkdownContent({ children, className }: MarkdownContentProps) {
  return (
    <div className={cn("markdown-content", className)}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children: c }) => (
            <p className="mb-3 last:mb-0 leading-relaxed [&:first-child]:mt-0">
              {c}
            </p>
          ),
          h1: ({ children: c }) => (
            <h1 className="mb-2 mt-4 border-b border-[var(--chat-border)] pb-1 text-lg font-semibold text-[#2d2a20] first:mt-0">
              {c}
            </h1>
          ),
          h2: ({ children: c }) => (
            <h2 className="mb-2 mt-4 text-base font-semibold text-[#2d2a20] first:mt-0">
              {c}
            </h2>
          ),
          h3: ({ children: c }) => (
            <h3 className="mb-1.5 mt-3 text-[15px] font-semibold text-[#2d2a20] first:mt-0">
              {c}
            </h3>
          ),
          ul: ({ children: c }) => (
            <ul className="my-2 list-disc space-y-1 pl-5 text-[15px]">{c}</ul>
          ),
          ol: ({ children: c }) => (
            <ol className="my-2 list-decimal space-y-1 pl-5 text-[15px]">{c}</ol>
          ),
          li: ({ children: c }) => <li className="leading-relaxed">{c}</li>,
          blockquote: ({ children: c }) => (
            <blockquote className="my-3 border-l-2 border-[#c9c4b8] pl-3 text-[#5c5748] italic">
              {c}
            </blockquote>
          ),
          a: ({ href, children: c }) => (
            <a
              href={href}
              className="font-medium text-[#1e6b52] underline decoration-[#a8c9bd] underline-offset-2 hover:decoration-[#1e6b52]"
              target="_blank"
              rel="noopener noreferrer"
            >
              {c}
            </a>
          ),
          hr: () => <hr className="my-4 border-[var(--chat-border)]" />,
          table: ({ children: c }) => (
            <div className="my-3 overflow-x-auto rounded-lg border border-[var(--chat-border)]">
              <table className="w-full min-w-[16rem] border-collapse text-left text-[14px]">
                {c}
              </table>
            </div>
          ),
          thead: ({ children: c }) => (
            <thead className="bg-[#ebe8e0]/90">{c}</thead>
          ),
          th: ({ children: c }) => (
            <th className="border-b border-[var(--chat-border)] px-3 py-2 font-semibold text-[#2d2a20]">
              {c}
            </th>
          ),
          td: ({ children: c }) => (
            <td className="border-b border-[#ebe8e0] px-3 py-2 text-[#3d3929]">
              {c}
            </td>
          ),
          tr: ({ children: c }) => <tr>{c}</tr>,
          pre: ({ children: c }) => (
            <pre className="my-3 overflow-x-auto rounded-lg border border-[var(--chat-border)] bg-[#f0efe9] p-3 text-[13px] leading-relaxed text-[#2d2a20]">
              {c}
            </pre>
          ),
          code: ({ className, children: c, ...props }) => {
            const isBlock = typeof className === "string" && className.includes("language-");
            if (isBlock) {
              return (
                <code className={cn("font-mono text-[13px] text-[#2d2a20]", className)} {...props}>
                  {c}
                </code>
              );
            }
            return (
              <code
                className="rounded-md bg-[#ebe8e0] px-1.5 py-0.5 font-mono text-[0.9em] text-[#2d2a20]"
                {...props}
              >
                {c}
              </code>
            );
          },
        }}
      >
        {children}
      </Markdown>
    </div>
  );
}
