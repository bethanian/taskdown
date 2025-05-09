"use client";

import React from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface HighlightedTextProps {
  text: string;
  highlight?: string;
}

export const HighlightedText: React.FC<HighlightedTextProps> = ({ text, highlight }) => {
  if (!highlight || highlight.trim() === '' || !text) {
    return <>{text}</>;
  }
  // Escape special characters in highlight string for regex
  const escapedHighlight = highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escapedHighlight})`, 'gi');
  
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, i) => {
        if (part.toLowerCase() === highlight.toLowerCase()) {
          return (
            <mark key={i} className="bg-primary/30 text-primary-foreground px-0.5 py-0 rounded-sm no-underline">
              {part}
            </mark>
          );
        }
        return part;
      })}
    </>
  );
};

interface MarkdownWithHighlightProps {
  markdownText: string;
  searchTerm?: string;
  className?: string;
}

export const MarkdownWithHighlight: React.FC<MarkdownWithHighlightProps> = ({
  markdownText,
  searchTerm,
  className,
}) => {
  const customRenderers: Components = React.useMemo(() => ({
    p: (props) => {
      const childrenWithHighlight = React.Children.map(props.children, (child) => {
        if (typeof child === 'string') {
          return <HighlightedText text={child} highlight={searchTerm} />;
        }
        return child;
      });
      // eslint-disable-next-line jsx-a11y/heading-has-content
      return <p {...props} children={childrenWithHighlight} />;
    },
    li: (props) => {
       const childrenWithHighlight = React.Children.map(props.children, (child) => {
        if (React.isValidElement(child) && child.type === 'p') { 
          // If li contains p, p renderer handles it by cloning with potentially modified children
          // This requires the 'p' renderer to correctly handle its children.
          // We simply pass the original children of 'p' to our 'p' renderer.
           const pChildren = (child.props as any).children;
           const highlightedPChildren = React.Children.map(pChildren, pChild => {
             if (typeof pChild === 'string') {
               return <HighlightedText text={pChild} highlight={searchTerm} />;
             }
             return pChild;
           });
          return React.cloneElement(child as React.ReactElement<any>, {}, highlightedPChildren);
        }
        if (typeof child === 'string') {
          return <HighlightedText text={child} highlight={searchTerm} />;
        }
        return child;
      });
      return <li {...props} children={childrenWithHighlight} />;
    },
    strong: (props) => {
      const childrenWithHighlight = React.Children.map(props.children, (child) => {
        if (typeof child === 'string') {
          return <HighlightedText text={child} highlight={searchTerm} />;
        }
        return child;
      });
      return <strong {...props} children={childrenWithHighlight} />;
    },
    em: (props) => {
      const childrenWithHighlight = React.Children.map(props.children, (child) => {
        if (typeof child === 'string') {
          return <HighlightedText text={child} highlight={searchTerm} />;
        }
        return child;
      });
      return <em {...props} children={childrenWithHighlight} />;
    },
    code: (props) => { // Handle inline code
      const { children, inline, className: codeClassName, ...rest } = props;
      if (inline && typeof children === 'string') {
        const highlightedCode = <HighlightedText text={children} highlight={searchTerm} />;
        return <code {...rest} className={codeClassName}>{highlightedCode}</code>;
      }
      // For block code, typically don't highlight search terms inside, but could if needed
      return <code {...rest} className={codeClassName}>{children}</code>;
    },
    // Add other inline elements as needed, e.g., a, del
  }), [searchTerm]);

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={customRenderers} className={className}>
      {markdownText}
    </ReactMarkdown>
  );
};