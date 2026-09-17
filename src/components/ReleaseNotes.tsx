import { memo, type ReactNode } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import "./release-notes.css";

const schema = {
  ...defaultSchema,
  tagNames: ["p", "br", "hr", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "strong", "em", "del", "blockquote", "pre", "code", "a", "details", "summary", "table", "thead", "tbody", "tr", "th", "td"],
  attributes: { a: ["href", "title"], ol: ["start"], th: ["align"], td: ["align"] },
  protocols: { href: ["https", "http"] },
};

const components: Components = {
  a: ({ href, children }) => /^https?:\/\//i.test(href ?? "")
    ? <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
    : <span>{children}</span>,
  table: ({ children }) => <div className="release-notes-table"><table>{children}</table></div>,
};

const inline = ({ children }: { children?: ReactNode }) => <span>{children} </span>;
const summaryComponents: Components = {
  p: inline, h1: inline, h2: inline, h3: inline, h4: inline, h5: inline, h6: inline,
  ul: inline, ol: inline, li: inline, blockquote: inline, pre: inline, code: inline,
  strong: inline, em: inline, del: inline, a: inline,
  details: () => null, table: () => null, hr: () => null,
};

export default memo(function ReleaseNotes({ body, compact = false }: { body?: string; compact?: boolean }) {
  if (!body?.trim()) return <p className="release-notes-empty">暂无更新说明</p>;
  return (
    <div className={compact ? "release-notes release-notes-summary" : "release-notes"}>
      <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, [rehypeSanitize, schema]]}
        components={compact ? summaryComponents : components}>
        {body}
      </Markdown>
    </div>
  );
});
